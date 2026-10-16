import { memo, useState, useEffect, useMemo, useDeferredValue } from "react";
import {
  ActivityIndicator,
  BackHandler,
  View,
  Text,
  FlatList,
  ScrollView,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryTrackGroups, queryTopSold } from "@/queries/queries";
import {
  distributeFairChorusAlbums,
  queryFederatedChorusAlbums,
} from "@/queries/chorus";
import {
  fairplayerReleaseSlug,
  queryFairplayerAlbums,
} from "@/queries/fairplayer";
import { useRouter } from "expo-router";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@/constants/theme";
import { getHistory, getHistorySync, subscribeHistory, HistoryItem } from "@/scripts/historyManager";
import {
  mainTabIndex,
  openMainTab,
  openSavedAlbum,
  setMainTab,
  useMainTab,
} from "@/components/Footer";
import QueueScreen from "@/app/feed";
import LibraryScreen from "@/app/library";
import {
  RADIO_STATIONS,
  RadioStation,
  deduplicateRadioStations,
  sortRadioRandomly,
  queryRadioPlays,
  queryDiscoveredRadioStations,
} from "@/queries/radio";
import {
  PODCAST_SHOWS,
  PodcastShow,
  queryPodcastEpisodes,
  queryDiscussionLatestDates,
  sortDiscussionsByLastUpdate,
  queryDiscoveredPodcasts,
} from "@/queries/podcast";
import OfflineNotice from "@/components/OfflineNotice";
import { openInBrowser } from "@/scripts/openInBrowser";
import { useAppIsReadyContext } from "@/state/AppReadyContext";
import {
  isQualityArtwork,
  resolveArtworkUrl,
  resolveQualityArtworkSource,
} from "@/scripts/utils";

export function shuffleCarousel<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function blendCarouselReleases(
  direct: AlbumProps[] = [],
  chorus: AlbumProps[] = [],
  fairplayer: AlbumProps[] = [],
): AlbumProps[] {
  const seenIds = new Set<number>();
  const seenSlugs = new Set<string>();
  const artistCounts = new Map<string, number>();

  const shuffledDirect = shuffleCarousel(direct);
  const shuffledChorus = distributeFairChorusAlbums(shuffleCarousel(chorus), 2);
  const shuffledFairplayer = distributeFairChorusAlbums(shuffleCarousel(fairplayer), 2);

  const combinedCandidates = shuffleCarousel([
    ...shuffledDirect,
    ...shuffledChorus,
    ...shuffledFairplayer,
  ]);

  const blended: AlbumProps[] = [];
  for (const item of combinedCandidates) {
    if (!item) continue;
    const artistKey = (item.artist?.name || String(item.artistId || "")).toLowerCase().trim();
    const count = artistCounts.get(artistKey) || 0;
    if (count >= 2) continue;
    if (seenIds.has(item.id) || (item.urlSlug && seenSlugs.has(item.urlSlug))) continue;

    seenIds.add(item.id);
    if (item.urlSlug) seenSlugs.add(item.urlSlug);
    artistCounts.set(artistKey, count + 1);
    blended.push(item);
  }

  return blended;
}

// Home's carousels keep their picks this long before drawing new ones
const CAROUSEL_STALE_TIME = 15 * 60 * 1000;

// Queries behind Home's carousels
const HOME_QUERIES = new Set([
  "fetchTrackGroups",
  "fetchTopSold",
  "federatedChorusAlbums",
  "fairplayerAlbums",
  "discoveredRadioStations",
  "castopodPodcasts",
  "discussionLatestDates",
  "fetchRadioPlays",
  "podcastEpisodes",
]);

// Where an overlay waits while hidden
const PARKED_X = 10000;

const MemoQueueScreen = memo(QueueScreen);
const MemoLibraryScreen = memo(LibraryScreen);

export default function Index() {
  const router = useRouter();
  const { tab, savedAlbum, savedAlbumSeq } = useMainTab();

  // Android Back returns to Home when on Queue or Library at the root of the stack
  useEffect(() => {
    if (tab === "home") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (router.canDismiss()) return false;
      setMainTab("home");
      return true;
    });
    return () => sub.remove();
  }, [tab, router]);

  // Home is always there. Queue and Library are overlays: the UI thread slides the one in
  // use into place and parks the other far off-screen, where it cannot be touched
  const queueStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: mainTabIndex.value === 1 ? 0 : PARKED_X }],
  }));
  const libraryStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: mainTabIndex.value === 2 ? 0 : PARKED_X }],
  }));

  return (
    <View style={styles.root}>
      <HomePane active={tab === "home"} />
      <Animated.View style={[styles.overlayPane, queueStyle]}>
        <MemoQueueScreen />
      </Animated.View>
      <Animated.View style={[styles.overlayPane, libraryStyle]}>
        <MemoLibraryScreen openAlbum={savedAlbum} openAlbumTrigger={savedAlbumSeq} />
      </Animated.View>
    </View>
  );
}

const HomePane = memo(function HomePane({ active }: { active: boolean }) {
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [shuffleSeed, setShuffleSeed] = useState(0);

  // Recent Releases: a random pick of released albums, like the website. The picks hold for a
  // while so Home stays put as you come and go; pulling down draws new ones. When this can't
  // load, Mirlo is out of reach. It holds the splash screen, so it fails on the first timeout
  // and Retry in the notice tries again
  const {
    data: recentData,
    isPending: isRecentPending,
    isError: offline,
    isFetching: isRecentFetching,
    refetch: refetchRecent,
  } = useQuery({
    ...queryTrackGroups({
      take: 12,
      orderBy: "random",
      distinctArtists: true,
      isReleased: "released",
    }),
    staleTime: CAROUSEL_STALE_TIME,
    retry: false,
  });

  // Query Popular Purchases
  const {
    data: topSoldData,
    isPending: isTopSoldPending,
    refetch: refetchTopSold,
  } = useQuery({
    ...queryTopSold({
      take: 12,
      datePurchased: "pastMonth",
    }),
    staleTime: CAROUSEL_STALE_TIME,
  });

  // Query releases from the configured Mirlo Chorus catalog
  const {
    data: chorusAlbums,
    refetch: refetchChorus,
  } = useQuery({
    ...queryFederatedChorusAlbums({ take: 40 }),
    retry: false,
  });

  const { data: fairplayerAlbums, refetch: refetchFairplayer } = useQuery({
    ...queryFairplayerAlbums(40),
    retry: false,
  });

  // Query discovered autonomous community and pirate radio stations
  const {
    data: discoveredRadio = [],
    refetch: refetchDiscoveredRadio,
  } = useQuery(queryDiscoveredRadioStations(8));

  // Discover podcast feeds through the open Castopod Index catalog
  const {
    data: discoveredPodcasts = [],
    refetch: refetchDiscoveredPodcasts,
  } = useQuery(queryDiscoveredPodcasts(6));

  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  // Leaving Home stops its refresh: refreshes in flight are cancelled and Home keeps the
  // releases it already has. First loads carry on, since Home has nothing to show without them
  const queryClient = useQueryClient();
  useEffect(() => {
    if (active) return;
    setIsPullRefreshing(false);
    queryClient.cancelQueries({
      predicate: (query) =>
        HOME_QUERIES.has(String(query.queryKey[0])) && query.state.data !== undefined,
    });
  }, [active, queryClient]);
  const retry = () => {
    setShuffleSeed((s) => s + 1);
    refetchChorus();
    refetchFairplayer();
    refetchDiscoveredRadio();
    refetchDiscoveredPodcasts();
    // The pull spinner waits for Mirlo's picks; the wider catalogs fill in as they arrive
    return Promise.all([refetchRecent(), refetchTopSold()]);
  };
  const pullToRefresh = () => {
    setIsPullRefreshing(true);
    retry().finally(() => setIsPullRefreshing(false));
  };

  // Shuffled blend of Mirlo, Chorus, and Faircamp releases with fair artist representation
  const recentReleases = useMemo(
    () =>
      blendCarouselReleases(
        recentData?.results || [],
        chorusAlbums || [],
        fairplayerAlbums || [],
      ),
    [recentData?.results, chorusAlbums, fairplayerAlbums, shuffleSeed],
  );

  // Shuffled curated and discovered radio stations
  const radioStations = useMemo(() => {
    const combined = [...RADIO_STATIONS, ...discoveredRadio].filter((station) =>
      isQualityArtwork(station.artwork),
    );
    return sortRadioRandomly(deduplicateRadioStations(combined));
  }, [discoveredRadio, shuffleSeed]);

  // Curated and Castopod-indexed discussion shows, ordered by latest episode
  const { data: latestDates } = useQuery(queryDiscussionLatestDates(PODCAST_SHOWS));

  const podcastShows = useMemo(() => {
    const combined = [...PODCAST_SHOWS, ...discoveredPodcasts].filter((show) =>
      isQualityArtwork(show.artwork),
    );
    const withLiveDates = combined.map((show) => {
      const liveDate = latestDates?.[show.id];
      return liveDate ? { ...show, lastUpdated: liveDate } : show;
    });
    return sortDiscussionsByLastUpdate(withLiveDates);
  }, [latestDates, discoveredPodcasts]);

  const popularPurchases = useMemo(
    () => shuffleCarousel(topSoldData?.results || []),
    [topSoldData?.results, shuffleSeed],
  );

  // Menu taps outrank carousel renders: new releases, stations, and shows draw at low priority,
  // so a tap interrupts them instead of waiting for them to finish
  const shownReleases = useDeferredValue(recentReleases);
  const shownPurchases = useDeferredValue(popularPurchases);
  const shownStations = useDeferredValue(radioStations);
  const shownShows = useDeferredValue(podcastShows);

  // The splash screen stays up until Home has its first content (or an error to show)
  const { setIsDataLoaded } = useAppIsReadyContext();
  useEffect(() => {
    if (!isRecentPending) setIsDataLoaded(true);
  }, [isRecentPending, setIsDataLoaded]);

  const [historyItems, setHistoryItems] = useState<HistoryItem[]>(getHistorySync);

  useEffect(() => {
    let mounted = true;
    getHistory().then((items) => {
      if (mounted) setHistoryItems(items);
    });
    const unsubscribe = subscribeHistory((items) => {
      if (mounted) setHistoryItems(items);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Top 6 items for the "Viewing History" 2-column grid
  const quickAccessItems = historyItems.slice(0, 6);

  const cardWidth = Math.max(140, Math.min(170, (width - 48) / 2.2));

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            source={require("@/assets/images/Logo-Mirlo_LogoOnly.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View style={styles.brandWordmark}>
            <Text style={styles.brandText}>MIRLO</Text>
            <Text style={[styles.brandText, styles.brandHighlight]}>BLUE</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            onPress={() => openInBrowser("https://mirlo.space/team/support")}
            style={styles.subscribeButton}
            accessibilityRole="button"
            accessibilityLabel="Subscribe to support Mirlo"
          >
            <Ionicons name="heart" size={15} color={theme.colors.playButtonIcon} />
            <Text style={styles.subscribeText}>Subscribe</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/search")}
            style={styles.searchButton}
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <Ionicons name="search" size={22} color={theme.colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isPullRefreshing}
            onRefresh={pullToRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.surfaceElevated}
          />
        }
      >
        {offline ? (
          <OfflineNotice retrying={isRecentFetching} onRetry={retry} onOpenLibrary={() => openMainTab("library")} />
        ) : (
          <>
            {/* Viewing History / Quick Access 2-Column Grid */}
            {quickAccessItems.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionHeader}>History</Text>
                </View>
                <View style={styles.historyGrid}>
                  {quickAccessItems.map((item, idx) => {
                    return (
                      <Pressable
                        key={`${item.downloadAlbum ?? item.id}-${idx}`}
                        onPress={() =>
                          item.downloadAlbum
                            ? openSavedAlbum(item.downloadAlbum)
                            : router.push({
                                pathname: "/artist/[id]/album/[slug]/album-tracks",
                                params: {
                                  id:
                                    fairplayerReleaseSlug.artistRouteId(
                                      item.urlSlug ?? "",
                                    ) ?? String(item.artistId),
                                  slug: String(item.urlSlug),
                                },
                              })
                        }
                        style={styles.historyCard}
                      >
                        <Image
                          source={resolveQualityArtworkSource(item.coverUri)}
                          style={styles.historyThumb}
                        />
                        <View style={styles.historyTextContainer}>
                          <Text style={styles.historyTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={styles.historyArtist} numberOfLines={1}>
                            {item.artistName}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* SECTION 1: RECENT RELEASES (Horizontal Carousel) */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionHeader}>Recent Releases</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
              </View>

              {isRecentPending ? (
                <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 30 }} />
              ) : (
                <FlatList
                  horizontal
                  data={shownReleases}
                  keyExtractor={(item, index) => String(item.id ?? index)}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carouselContent}
                  renderItem={({ item }) => {
                    const coverUri =
                      item.cover?.sizes?.[600] ||
                      item.cover?.sizes?.[300] ||
                      item.cover?.sizes?.[120];
                    return (
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: "/artist/[id]/album/[slug]/album-tracks",
                            params: {
                              id:
                                fairplayerReleaseSlug.artistRouteId(
                                  String(item.urlSlug || ""),
                                ) ?? String(item.artist?.urlSlug || item.artistId),
                              slug: String(item.urlSlug),
                            },
                          })
                        }
                        style={[styles.albumCard, { width: cardWidth }]}
                      >
                        <View style={styles.cardImageContainer}>
                          <Image
                            source={resolveQualityArtworkSource(coverUri)}
                            style={styles.cardCoverImage}
                            resizeMode="cover"
                          />
                          <View style={styles.glassSheen} />
                        </View>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.cardArtist} numberOfLines={1}>
                          {item.artist?.name}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              )}
            </View>

            {/* SECTION 2: POPULAR PURCHASES (Horizontal Carousel) */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionHeader}>Popular Purchases</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
              </View>

              {isTopSoldPending ? (
                <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 30 }} />
              ) : (
                <FlatList
                  horizontal
                  data={shownPurchases}
                  keyExtractor={(item, index) => String(item.id ?? index)}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carouselContent}
                  renderItem={({ item }) => {
                    const coverUri =
                      item.cover?.sizes?.[600] ||
                      item.cover?.sizes?.[300] ||
                      item.cover?.sizes?.[120];
                    return (
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: "/artist/[id]/album/[slug]/album-tracks",
                            params: {
                              id: String(item.artistId),
                              slug: String(item.urlSlug),
                            },
                          })
                        }
                        style={[styles.albumCard, { width: cardWidth }]}
                      >
                        <View style={styles.cardImageContainer}>
                          <Image
                            source={resolveQualityArtworkSource(coverUri)}
                            style={styles.cardCoverImage}
                            resizeMode="cover"
                          />
                          <View style={styles.glassSheen} />
                        </View>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.cardArtist} numberOfLines={1}>
                          {item.artist?.name}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              )}
            </View>

            {/* RADIO: one card per station, showing what's on air */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionHeader}>Radio</Text>
              </View>
              <FlatList
                horizontal
                data={shownStations}
                keyExtractor={(station) => station.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContent}
                renderItem={({ item }) => (
                  <StationCard station={item} cardWidth={cardWidth} active={active} />
                )}
              />
            </View>

            {/* DISCUSSION: one card per show, showing latest episode */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionHeader}>Discussion</Text>
              </View>
              <FlatList
                horizontal
                data={shownShows}
                keyExtractor={(show) => show.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContent}
                renderItem={({ item }) => <DiscussionCard show={item} cardWidth={cardWidth} />}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
});

// A station in the Radio row, shaped like an album card: the cover and song are what's on
// air now, and tapping opens the station's screen
// Stations refresh their song every minute only while Home is on screen
function StationCard({
  station,
  cardWidth,
  active,
}: {
  station: RadioStation;
  cardWidth: number;
  active: boolean;
}) {
  const router = useRouter();
  const { data: plays } = useQuery({
    ...queryRadioPlays(station),
    refetchInterval: active ? 60_000 : false,
  });
  const onAir = plays?.[0];
  const [failedArtwork, setFailedArtwork] = useState<string>();
  const onAirArtwork = onAir?.artwork;
  const rawImage = isQualityArtwork(onAirArtwork) ? onAirArtwork : station.artwork;

  if (!isQualityArtwork(rawImage) || failedArtwork === rawImage) return null;

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/station/[id]", params: { id: station.id } })}
      accessibilityLabel={`Open ${station.name}`}
      style={[styles.albumCard, { width: cardWidth }]}
    >
      <View style={styles.cardImageContainer}>
        <Image
          source={{ uri: resolveArtworkUrl(rawImage) }}
          style={styles.cardCoverImage}
          resizeMode="cover"
          onError={() => setFailedArtwork(rawImage)}
        />
        <View style={styles.glassSheen} />
        <Text style={styles.airtimeBadge}>LIVE</Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {station.name}
      </Text>
      <Text style={styles.cardArtist} numberOfLines={1}>
        {onAir ? `${onAir.song} · ${onAir.artist}` : station.location}
      </Text>
    </Pressable>
  );
}

// A show in the Discussion row, shaped like an album card: the cover and latest episode,
// and tapping opens the show's episode list
function DiscussionCard({ show, cardWidth }: { show: PodcastShow; cardWidth: number }) {
  const router = useRouter();
  const { data: episodes } = useQuery(queryPodcastEpisodes(show));
  const latest = episodes?.[0];
  const [failedArtwork, setFailedArtwork] = useState<string>();

  if (!isQualityArtwork(show.artwork) || failedArtwork === show.artwork) return null;

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/podcast/[id]", params: { id: show.id } })}
      accessibilityLabel={`Open ${show.name}`}
      style={[styles.albumCard, { width: cardWidth }]}
    >
      <View style={styles.cardImageContainer}>
        <Image
          source={{ uri: resolveArtworkUrl(show.artwork) }}
          style={styles.cardCoverImage}
          resizeMode="cover"
          onError={() => setFailedArtwork(show.artwork)}
        />
        <View style={styles.glassSheen} />
        <Text style={styles.airtimeBadge}>TALK</Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {show.name}
      </Text>
      <Text style={styles.cardArtist} numberOfLines={1}>
        {latest ? latest.title : show.author}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: theme.colors.background,
  },
  overlayPane: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceCardBorder,
    backgroundColor: theme.colors.surface,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoImage: {
    width: 28,
    height: 28,
    tintColor: theme.colors.logo,
  },
  brandWordmark: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandText: {
    fontFamily: theme.fonts.display,
    fontSize: 22,
    fontWeight: "normal",
    color: theme.colors.textPrimary,
    letterSpacing: 0.5,
  },
  brandHighlight: {
    color: theme.colors.primary,
    paddingRight: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  subscribeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
  },
  subscribeText: {
    color: theme.colors.playButtonIcon,
    fontSize: 14,
    fontWeight: "700",
  },
  searchButton: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.surfaceCardBorder,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  section: {
    marginTop: 22,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    ...theme.typography.sectionHeader,
  },
  historyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    justifyContent: "space-between",
    rowGap: 8,
  },
  historyCard: {
    width: "48.5%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.surfaceCardBorder,
    height: 52,
  },
  historyThumb: {
    width: 52,
    height: 52,
    backgroundColor: theme.colors.surface,
  },
  thumbPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
  },
  historyTextContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  historyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  historyArtist: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  carouselContent: {
    paddingHorizontal: 16,
    gap: 14,
  },
  albumCard: {
    marginRight: 2,
  },
  cardImageContainer: {
    aspectRatio: 1,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceGlassBorder,
    position: "relative",
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  cardCoverImage: {
    width: "100%",
    height: "100%",
  },
  glassSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "40%",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  airtimeBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    backgroundColor: "rgba(7, 11, 20, 0.8)",
    color: theme.colors.textCyan,
    fontSize: 11,
    fontWeight: "700",
    overflow: "hidden",
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: 13,
    marginTop: 8,
  },
  cardArtist: {
    color: theme.colors.textCyan,
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
});
