import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useMemo, type ComponentProps } from "react";
import { useAuthContext } from "@/state/AuthContext";
import { usePlayer } from "@/state/PlayerContext";
import { useQuery } from "@tanstack/react-query";
import { queryUserCollection, queryWishlist } from "@/queries/queries";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@/constants/theme";
import AddToQueueButton from "@/components/AddToQueueButton";
import DownloadsTab from "@/components/DownloadsTab";
import FavoriteTrackButton from "@/components/FavoriteTrackButton";
import { useDownloads } from "@/scripts/downloadManager";
import { fairplayerReleaseSlug } from "@/queries/fairplayer";
import { ownsAlbum, resolveArtworkUrl } from "@/scripts/utils";
import { useStationLikes } from "@/scripts/stationLikes";
import { usePodcastEpisodeLikes, PodcastEpisodeLike } from "@/scripts/podcastLikes";
import { useFaircampSaves, FaircampSaves } from "@/scripts/faircampSaves";
import { findStation, liveTrack } from "@/queries/radio";
import { hashString } from "@/queries/podcast";

type LibraryTab = "wishlist" | "purchases" | "bookmarks" | "downloads";
type IconName = ComponentProps<typeof Ionicons>["name"];

const timeOf = (date: unknown) => (date ? new Date(date as string).getTime() || 0 : 0);

function albumCover(tg: any): string {
  return resolveArtworkUrl(
    tg?.cover?.sizes?.[300] ||
      tg?.cover?.sizes?.[120] ||
      tg?.cover?.sizes?.[600] ||
      (typeof tg?.cover === "string" ? tg.cover : tg?.cover?.url),
  );
}

export type WishlistAlbum = { trackGroup: AlbumProps; savedAt: number };

// Wishlist: albums on the Mirlo wishlist, plus Faircamp albums saved on the phone or holding
// a liked song, newest first. Albums the listener owns move to Purchases. Each album opens
// its page, where the listener can play or buy it
export function buildWishlistAlbums({
  user,
  wishlist,
  faircampSaves,
}: {
  user?: LoggedInUser | null;
  wishlist: any[];
  faircampSaves: FaircampSaves;
}): WishlistAlbum[] {
  const albums = new Map<string, WishlistAlbum>();
  const keep = (trackGroup: any, savedAt: number) => {
    if (!trackGroup || ownsAlbum(user, trackGroup)) return;
    const key = String(trackGroup.urlSlug || trackGroup.id);
    const existing = albums.get(key);
    albums.set(key, {
      trackGroup: existing?.trackGroup ?? trackGroup,
      savedAt: Math.max(existing?.savedAt ?? 0, savedAt),
    });
  };

  wishlist.forEach((w: any) => keep(w?.trackGroup, timeOf(w?.createdAt)));
  user?.trackFavorites?.forEach((f: any) =>
    keep(f?.track?.trackGroup, timeOf(f?.createdAt)),
  );
  faircampSaves.albums.forEach(({ album, savedAt }) => keep(album, savedAt));
  faircampSaves.tracks.forEach(({ track, likedAt }) => keep(track.trackGroup, likedAt));

  return Array.from(albums.values()).sort((a, b) => b.savedAt - a.savedAt);
}

function episodeTrack(ep: PodcastEpisodeLike): RNTrack {
  return {
    id: -(Math.abs(hashString(`ep-${ep.episodeId}`)) || 600000),
    title: ep.title,
    artist: ep.artist,
    artwork: ep.artwork || "",
    url: ep.url,
    type: "default",
    duration: ep.duration,
    order: 1,
    queueIndex: 0,
    allowIndividualSale: false,
    isPreview: false,
    audio: {
      url: ep.url,
      duration: ep.duration,
    },
    trackGroupId: 0,
    podcastId: ep.showId,
    podcastEpisodeId: ep.episodeId,
  } as RNTrack;
}

// Bookmarks: liked radio stations and podcast episodes, kept on the phone, newest first
export function buildBookmarks({
  stationLikes,
  podcastEpisodeLikes = [],
}: {
  stationLikes: { stationId: string; likedAt: number }[];
  podcastEpisodeLikes?: PodcastEpisodeLike[];
}): RNTrack[] {
  const stations = stationLikes.flatMap(({ stationId, likedAt }) => {
    const station = findStation(stationId);
    return station ? [{ track: liveTrack(station), likedAt }] : [];
  });
  const episodes = podcastEpisodeLikes.map((ep) => ({ track: episodeTrack(ep), likedAt: ep.likedAt }));
  return [...stations, ...episodes]
    .sort((a, b) => b.likedAt - a.likedAt)
    .map(({ track }) => track);
}

export default function LibraryScreen({
  openAlbum: openAlbumProp,
  openAlbumTrigger,
}: {
  openAlbum?: string;
  openAlbumTrigger?: number;
} = {}) {
  const router = useRouter();
  const { user } = useAuthContext();
  const { playTrack, activeTrack } = usePlayer();
  // History links a saved album here: ?tab=downloads&album=<album key>
  const params = useLocalSearchParams<{ tab?: string; album?: string }>();
  const targetAlbum = openAlbumProp ?? params.album;
  const [activeTab, setActiveTab] = useState<LibraryTab>(
    targetAlbum || params.tab === "downloads" ? "downloads" : "wishlist",
  );
  useEffect(() => {
    if (targetAlbum || params.tab === "downloads") setActiveTab("downloads");
  }, [targetAlbum, openAlbumTrigger, params.tab]);
  const downloadedTracks = useDownloads();
  const stationLikes = useStationLikes();
  const podcastEpisodeLikes = usePodcastEpisodeLikes();
  const faircampSaves = useFaircampSaves();

  const userId = user?.id;
  const { data: collectionData, isPending: isCollectionPending } = useQuery(
    queryUserCollection(userId),
  );
  const { data: wishlistData, isPending: isWishlistPending } = useQuery(queryWishlist(userId));

  const purchases = useMemo(() => collectionData?.results || [], [collectionData?.results]);
  const wishlistAlbums = useMemo(
    () => buildWishlistAlbums({ user, wishlist: wishlistData?.results || [], faircampSaves }),
    [user, wishlistData?.results, faircampSaves],
  );
  const bookmarks = useMemo(
    () => buildBookmarks({ stationLikes, podcastEpisodeLikes }),
    [stationLikes, podcastEpisodeLikes],
  );

  const isWishlistLoading = Boolean(userId) && isWishlistPending && wishlistAlbums.length === 0;

  const tabs: { id: LibraryTab; label: string; icon: IconName; count: number }[] = [
    { id: "wishlist", label: "Wishlist", icon: "heart-outline", count: wishlistAlbums.length },
    { id: "purchases", label: "Purchases", icon: "bag-handle-outline", count: purchases.length },
    { id: "bookmarks", label: "Bookmarks", icon: "bookmark-outline", count: bookmarks.length },
    {
      id: "downloads",
      label: "Downloads",
      icon: "download-outline",
      count: downloadedTracks.length,
    },
  ];

  const renderEmpty = (icon: IconName, title: string, subtitle: string) => (
    <View style={styles.emptyContainer}>
      <Ionicons name={icon} size={48} color={theme.colors.textMuted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );

  const renderSignIn = () => (
    <View style={styles.guestContainer}>
      <Ionicons name="lock-closed-outline" size={48} color={theme.colors.primary} />
      <Text style={styles.guestTitle}>Sign in to access your cloud library</Text>
      <Text style={styles.guestSubtitle}>
        Your purchases, wishlist, and favorited artists sync across all devices.
      </Text>
      <TouchableOpacity onPress={() => router.push("/login")} style={styles.loginBtn}>
        <Text style={styles.loginBtnText}>Sign In</Text>
      </TouchableOpacity>
    </View>
  );

  // Opens a release's page, where the listener can play or buy it
  const openAlbumPage = (tg: any) => {
    if (tg?.urlSlug && (tg?.artistId || fairplayerReleaseSlug.decode(String(tg.urlSlug)))) {
      router.push({
        pathname: "/artist/[id]/album/[slug]/album-tracks",
        params: {
          id:
            fairplayerReleaseSlug.artistRouteId(String(tg.urlSlug)) ??
            String(tg.artist?.urlSlug || tg.artistId),
          slug: String(tg.urlSlug),
        },
      });
    }
  };

  const renderAlbumList = (albums: any[], fallbackTitle: string, fallbackIcon: IconName) => (
    <FlatList
      data={albums}
      keyExtractor={(item, index) =>
        `album-${item.trackGroup?.urlSlug ?? item.trackGroupId ?? item.trackId}-${index}`
      }
      initialNumToRender={12}
      maxToRenderPerBatch={10}
      windowSize={5}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => {
        const tg = item.trackGroup;
        const coverUri = albumCover(tg);
        return (
          <Pressable onPress={() => openAlbumPage(tg)} style={styles.card}>
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.placeholder]}>
                <Ionicons name={fallbackIcon} size={20} color={theme.colors.primary} />
              </View>
            )}
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {tg?.title || fallbackTitle}
              </Text>
              <Text style={styles.cardArtist} numberOfLines={1}>
                {tg?.artist?.name || "Artist"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>
        );
      }}
    />
  );

  const wishlistContent = useMemo(() => {
    if (!user && wishlistAlbums.length === 0) return renderSignIn();
    if (isWishlistLoading) {
      return <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />;
    }
    if (wishlistAlbums.length === 0) {
      return renderEmpty(
        "heart-outline",
        "No saved albums",
        "Tap the heart on any song or album to save its album to your wishlist.",
      );
    }
    return renderAlbumList(wishlistAlbums, "Saved Album", "heart");
  }, [user, isWishlistLoading, wishlistAlbums]);

  const purchasesContent = useMemo(() => {
    if (!user) return renderSignIn();
    if (isCollectionPending) {
      return <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />;
    }
    if (purchases.length === 0) {
      return renderEmpty(
        "bag-handle-outline",
        "No purchases yet",
        "Music you buy directly from artists on Mirlo will appear here.",
      );
    }
    return renderAlbumList(purchases, "Purchased Item", "musical-notes");
  }, [user, isCollectionPending, purchases]);

  const bookmarksContent = useMemo(() => {
    if (bookmarks.length === 0) {
      return renderEmpty(
        "bookmark-outline",
        "No bookmarks yet",
        "Like a radio station or podcast episode to keep it here.",
      );
    }
    return (
      <FlatList
        data={bookmarks}
        keyExtractor={(item) => `bookmark-${item.liveStation ?? item.podcastEpisodeId}`}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isSelected = Boolean(activeTrack?.url && activeTrack.url === item.url);
          return (
            <Pressable
              onPress={() => playTrack(item, bookmarks, "Bookmarks")}
              style={[styles.card, isSelected && styles.selectedCard]}
            >
              {item.artwork ? (
                <Image source={{ uri: item.artwork }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.placeholder]}>
                  <Ionicons name="radio-outline" size={20} color={theme.colors.primary} />
                </View>
              )}
              <View style={styles.cardInfo}>
                <Text
                  style={[
                    styles.cardTitle,
                    isSelected && { color: theme.colors.primary, fontWeight: "700" },
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text style={styles.cardArtist} numberOfLines={1}>
                  {item.artist}
                </Text>
              </View>
              <View style={styles.actionRow}>
                <AddToQueueButton track={item} size={17} />
                <FavoriteTrackButton track={item} size={17} />
              </View>
            </Pressable>
          );
        }}
      />
    );
  }, [bookmarks, activeTrack?.url, playTrack]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Library</Text>
        <Text style={styles.subtitle}>Your wishlist, purchases, bookmarks & downloads</Text>

        {/* Scrollable Segmented Toggle Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toggleRow}
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[styles.togglePill, active && styles.togglePillActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={tab.icon}
                  size={15}
                  color={active ? theme.colors.playButtonIcon : theme.colors.textSecondary}
                />
                <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                  {tab.label} ({tab.count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Pre-mounted Sub-Panes for Instant Tab Switching */}
      <View style={styles.contentArea}>
        <View
          style={[styles.subPane, activeTab !== "wishlist" && styles.subPaneHidden]}
          pointerEvents={activeTab === "wishlist" ? "auto" : "none"}
        >
          {wishlistContent}
        </View>
        <View
          style={[styles.subPane, activeTab !== "purchases" && styles.subPaneHidden]}
          pointerEvents={activeTab === "purchases" ? "auto" : "none"}
        >
          {purchasesContent}
        </View>
        <View
          style={[styles.subPane, activeTab !== "bookmarks" && styles.subPaneHidden]}
          pointerEvents={activeTab === "bookmarks" ? "auto" : "none"}
        >
          {bookmarksContent}
        </View>
        <View
          style={[styles.subPane, activeTab !== "downloads" && styles.subPaneHidden]}
          pointerEvents={activeTab === "downloads" ? "auto" : "none"}
        >
          <DownloadsTab openAlbum={targetAlbum} openAlbumTrigger={openAlbumTrigger} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentArea: {
    flex: 1,
    position: "relative",
  },
  subPane: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1,
    zIndex: 0,
  },
  subPaneHidden: {
    opacity: 0,
    zIndex: -1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceCardBorder,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: 22,
    fontWeight: "normal",
    color: theme.colors.textPrimary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  togglePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.surfaceCardBorder,
  },
  togglePillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  toggleTextActive: {
    color: theme.colors.playButtonIcon,
    fontWeight: "700",
  },
  listContent: {
    padding: 12,
    paddingBottom: 80,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.surfaceCardBorder,
  },
  selectedCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.primary,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceElevated,
  },
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  cardArtist: {
    color: theme.colors.textCyan,
    fontSize: 12,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 10,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  emptySubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
  },
  guestContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 12,
  },
  guestTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  guestSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  loginBtn: {
    marginTop: 8,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: theme.radius.full,
  },
  loginBtnText: {
    color: theme.colors.playButtonIcon,
    fontWeight: "700",
    fontSize: 14,
  },
});
