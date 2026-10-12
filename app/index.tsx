import { useState, useEffect, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  FlatList,
  ScrollView,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { queryTrackGroups, queryTopSold } from "@/queries/queries";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@/constants/theme";
import { getHistory, subscribeHistory, HistoryItem } from "@/scripts/historyManager";
import { savedAlbumHref } from "@/scripts/downloadManager";
import {
  RADIO_STATIONS,
  RadioStation,
  queryRadioPlays,
} from "@/queries/radio";
import OfflineNotice from "@/components/OfflineNotice";
import { openInBrowser } from "@/scripts/openInBrowser";
import { useAppIsReadyContext } from "@/state/AppReadyContext";

export default function Index() {
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Recent Releases: a random pick of released albums, like the website, drawn fresh each
  // time Home comes into view. When this can't load, Mirlo is out of reach. It holds the
  // splash screen, so it fails on the first timeout and Retry in the notice tries again
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
    retry: false,
  });

  // Query Popular Purchases
  const {
    data: topSoldData,
    isPending: isTopSoldPending,
    refetch: refetchTopSold,
  } = useQuery(
    queryTopSold({
      take: 12,
      datePurchased: "pastMonth",
    }),
  );

  const retry = () => {
    refetchRecent();
    refetchTopSold();
  };

  const recentReleases = recentData?.results || [];
  const popularPurchases = topSoldData?.results || [];

  // The splash screen stays up until Home has its first content (or an error to show)
  const { setIsDataLoaded } = useAppIsReadyContext();
  useEffect(() => {
    if (!isRecentPending) setIsDataLoaded(true);
  }, [isRecentPending, setIsDataLoaded]);

  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

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

  // The first visit already loads a list; every return to Home draws a new one
  const hasFocused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (hasFocused.current) refetchRecent();
      hasFocused.current = true;
    }, [refetchRecent]),
  );

  // Top 6 items for the "Viewing History" 2-column grid
  const quickAccessItems = historyItems.slice(0, 6);

  const cardWidth = Math.max(140, Math.min(170, (width - 48) / 2.2));

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            source={require("@/assets/images/Logo-Mirlo_LogoOnly.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.brandText}>mirlo<Text style={styles.brandHighlight}>blue</Text></Text>
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
      >
        {offline ? (
          <OfflineNotice retrying={isRecentFetching} onRetry={retry} onOpenLibrary={() => router.push("/library")} />
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
                            ? router.push(savedAlbumHref(item.downloadAlbum))
                            : router.push({
                                pathname: "/artist/[id]/album/[slug]/album-tracks",
                                params: {
                                  id: String(item.artistId),
                                  slug: String(item.urlSlug),
                                },
                              })
                        }
                        style={styles.historyCard}
                      >
                        {item.coverUri ? (
                          <Image source={{ uri: item.coverUri }} style={styles.historyThumb} />
                        ) : (
                          <View style={[styles.historyThumb, styles.thumbPlaceholder]}>
                            <Ionicons name="musical-notes" size={16} color={theme.colors.primary} />
                          </View>
                        )}
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
                  data={recentReleases}
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
                          {coverUri ? (
                            <Image
                              source={{ uri: coverUri }}
                              style={styles.cardCoverImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={[styles.cardCoverImage, styles.thumbPlaceholder]}>
                              <Ionicons name="musical-notes" size={36} color={theme.colors.primary} />
                            </View>
                          )}
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
                  data={popularPurchases}
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
                          {coverUri ? (
                            <Image
                              source={{ uri: coverUri }}
                              style={styles.cardCoverImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={[styles.cardCoverImage, styles.thumbPlaceholder]}>
                              <Ionicons name="flame" size={36} color={theme.colors.primary} />
                            </View>
                          )}
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
                data={RADIO_STATIONS}
                keyExtractor={(station) => station.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContent}
                renderItem={({ item }) => <StationCard station={item} cardWidth={cardWidth} />}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// A station in the Radio row, shaped like an album card: the cover and song are what's on
// air now, and tapping opens the station's screen
function StationCard({ station, cardWidth }: { station: RadioStation; cardWidth: number }) {
  const router = useRouter();
  const { data: plays } = useQuery(queryRadioPlays(station));
  const onAir = plays?.[0];

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/station/[id]", params: { id: station.id } })}
      accessibilityLabel={`Open ${station.name}`}
      style={[styles.albumCard, { width: cardWidth }]}
    >
      <View style={styles.cardImageContainer}>
        {onAir?.artwork ? (
          <Image source={{ uri: onAir.artwork }} style={styles.cardCoverImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardCoverImage, styles.thumbPlaceholder]}>
            <Ionicons name="radio" size={36} color={theme.colors.primary} />
          </View>
        )}
        <View style={styles.glassSheen} />
        <Text style={styles.airtimeBadge}>LIVE</Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {station.name}
      </Text>
      <Text style={styles.cardArtist} numberOfLines={1}>
        {onAir ? `${onAir.song} Â· ${onAir.artist}` : station.location}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  brandText: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandHighlight: {
    color: theme.colors.primary,
    fontWeight: "800",
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
    paddingBottom: 30,
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
