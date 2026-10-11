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
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useMemo } from "react";
import { useAuthContext } from "@/state/AuthContext";
import { usePlayer } from "@/state/PlayerContext";
import { useQuery } from "@tanstack/react-query";
import {
  queryUserCollection,
  queryWishlist,
  queryTrackGroups,
  queryTopSold,
} from "@/queries/queries";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@/constants/theme";
import AddToQueueButton from "@/components/AddToQueueButton";
import DownloadsTab from "@/components/DownloadsTab";
import FavoriteTrackButton from "@/components/FavoriteTrackButton";
import { downloadToTrack, useDownloads } from "@/scripts/downloadManager";
import { getHistory, HistoryItem } from "@/scripts/historyManager";
import { API_ROOT } from "@/constants/api-root";
import { API_KEY } from "@/constants/api-key";
import { audioTrackType, resolveArtworkUrl, trackStreamPath } from "@/scripts/utils";

type LibrarySort = "newest" | "title" | "artist" | "album";
const SORT_OPTIONS: { id: LibrarySort; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "title", label: "Title" },
  { id: "artist", label: "Artist" },
  { id: "album", label: "Album" },
];

function resolveArtwork(obj: any): string {
  if (!obj) return "";
  if (typeof obj === "string") return resolveArtworkUrl(obj);

  const candidate =
    obj.artwork ||
    obj.coverUri ||
    obj.coverUrl ||
    obj.cover?.sizes?.[600] ||
    obj.cover?.sizes?.[300] ||
    obj.cover?.sizes?.[120] ||
    obj.cover?.sizes?.["600"] ||
    obj.cover?.sizes?.["300"] ||
    obj.cover?.sizes?.["120"] ||
    (typeof obj.cover === "string" ? obj.cover : obj.cover?.url) ||
    obj.trackGroupCover?.sizes?.[600] ||
    obj.trackGroupCover?.sizes?.[300] ||
    obj.trackGroupCover?.sizes?.[120] ||
    obj.avatar?.sizes?.[300] ||
    obj.avatar?.sizes?.[120] ||
    obj.avatar?.url ||
    "";

  return resolveArtworkUrl(candidate);
}

function resolveArtist(obj: any): string {
  if (!obj) return "";
  if (typeof obj.artist === "string" && obj.artist.trim()) return obj.artist.trim();
  if (obj.artist?.name && typeof obj.artist.name === "string") return obj.artist.name.trim();
  if (Array.isArray(obj.trackArtists) && obj.trackArtists.length > 0) {
    const names = obj.trackArtists.map((a: any) => a?.artistName || a?.name || "").filter(Boolean);
    if (names.length > 0) return names.join(", ");
  }
  if (obj.trackGroup?.artist?.name) return obj.trackGroup.artist.name.trim();
  if (typeof obj.trackGroup?.artist === "string") return obj.trackGroup.artist.trim();
  if (obj.album?.artist?.name) return obj.album.artist.name.trim();
  if (typeof obj.album?.artist === "string") return obj.album.artist.trim();
  if (obj.artistName && typeof obj.artistName === "string") return obj.artistName.trim();
  return "";
}

function resolveAudioStreamUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("file://")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    if (API_ROOT && API_ROOT !== "/" && trimmed.startsWith(API_ROOT)) {
      return trimmed;
    }
    return `${API_ROOT}${trimmed}`;
  }
  return `${API_ROOT}/${trimmed}`;
}

export default function LibraryScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { playTrack, activeTrack } = usePlayer();
  const [activeTab, setActiveTab] = useState<"library" | "purchases" | "wishlist" | "downloads">(
    "library",
  );
  const downloadedTracks = useDownloads();
  const [librarySearch, setLibrarySearch] = useState("");
  const [librarySort, setLibrarySort] = useState<LibrarySort>("newest");

  const userId = user?.id;

  // Purchases query
  const { data: collectionData, isPending: isCollectionPending } = useQuery(
    queryUserCollection(userId),
  );

  // Wishlist / Likes query
  const { data: wishlistData, isPending: isWishlistPending } = useQuery(queryWishlist(userId));

  // Catalog releases to enrich favorited tracks whose albums are not yet in purchases/wishlist
  const { data: catalogData } = useQuery(queryTrackGroups({ distinctArtists: false, take: 50 }));
  const { data: topSoldData } = useQuery(queryTopSold({ take: 50 }));

  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  useEffect(() => {
    getHistory().then(setHistoryItems);
  }, []);

  const purchases = collectionData?.results || [];
  const wishlist = wishlistData?.results || [];

  // Combined tracks (sans duplicates) across purchased albums and favorited tracks
  const combinedTracks = useMemo(() => {
    const trackMap = new Map<number | string, RNTrack>();
    // When each track joined the library; a track found in several places keeps the latest date
    const addedAt = new Map<number | string, number>();
    const timeOf = (date: unknown) => (date ? new Date(date as string).getTime() || 0 : 0);
    const markAdded = (id: number | string, time: number) => {
      addedAt.set(id, Math.max(addedAt.get(id) || 0, time));
    };

    // Build album lookup map (by id, trackGroupId, slug, title) from all available sources
    const albumLookup = new Map<
      number | string,
      { artwork: string; artist: string; trackGroup: any }
    >();

    const indexAlbum = (tg: any) => {
      if (!tg) return;
      const artwork = resolveArtwork(tg);
      const artist = resolveArtist(tg);
      const entry = { artwork, artist, trackGroup: tg };
      if (tg.id !== undefined) {
        albumLookup.set(tg.id, entry);
        albumLookup.set(String(tg.id), entry);
      }
      if (tg.trackGroupId !== undefined) {
        albumLookup.set(tg.trackGroupId, entry);
        albumLookup.set(String(tg.trackGroupId), entry);
      }
      if (tg.urlSlug) {
        albumLookup.set(tg.urlSlug, entry);
      }
      if (tg.title) {
        albumLookup.set(tg.title.toLowerCase().trim(), entry);
      }
    };

    purchases.forEach((p: any) => indexAlbum(p?.trackGroup || p));
    wishlist.forEach((w: any) => indexAlbum(w?.trackGroup || w));
    (catalogData?.results || []).forEach(indexAlbum);
    (topSoldData?.results || []).forEach(indexAlbum);

    historyItems.forEach((h: HistoryItem) => {
      if (h) {
        const art = resolveArtworkUrl(h.coverUri);
        const entry = {
          artwork: art,
          artist: h.artistName || "",
          trackGroup: {
            id: Number(h.id) || 0,
            trackGroupId: Number(h.id) || 0,
            title: h.title,
            artist: { name: h.artistName } as any,
            artistId: Number(h.artistId) || 0,
            urlSlug: h.urlSlug,
            cover: { sizes: { 300: art, 600: art, 120: art } as any },
          },
        };
        albumLookup.set(h.id, entry);
        albumLookup.set(String(h.id), entry);
        if (h.urlSlug) albumLookup.set(h.urlSlug, entry);
        if (h.title) albumLookup.set(h.title.toLowerCase().trim(), entry);
      }
    });

    const matchAlbum = (t: any, fav?: any) => {
      const candidateIds = [
        t?.trackGroupId,
        t?.trackGroup?.id,
        t?.trackGroup?.trackGroupId,
        t?.albumId,
        t?.album?.id,
        fav?.trackGroupId,
        fav?.albumId,
      ].filter((v: any) => v !== undefined && v !== null);

      for (const id of candidateIds) {
        if (albumLookup.has(id)) return albumLookup.get(id);
        if (albumLookup.has(String(id))) return albumLookup.get(String(id));
      }

      const candidateSlugs = [t?.trackGroup?.urlSlug, t?.album?.urlSlug, fav?.urlSlug].filter(
        Boolean,
      );

      for (const slug of candidateSlugs) {
        if (albumLookup.has(slug)) return albumLookup.get(slug);
      }

      const candidateTitles = [
        t?.trackGroup?.title,
        t?.album?.title,
        fav?.trackGroup?.title,
        fav?.albumTitle,
      ]
        .filter(Boolean)
        .map((s: string) => s.toLowerCase().trim());

      for (const title of candidateTitles) {
        if (albumLookup.has(title)) return albumLookup.get(title);
      }

      return undefined;
    };

    const addTrackToMap = (
      t: any,
      fav?: any,
      albumFallback?: { artwork: string; artist: string; trackGroup: any },
      added = 0,
    ) => {
      if (!t) return;
      const trackId = t.id ?? fav?.trackId ?? t.trackId;
      if (!trackId) return;
      markAdded(trackId, added);

      const matched = matchAlbum(t, fav) || albumFallback;
      const rawAudio = t.audio?.url || trackStreamPath(trackId);
      const streamUrl = resolveAudioStreamUrl(rawAudio);

      const artwork =
        resolveArtwork(t) ||
        resolveArtwork(t.trackGroup) ||
        resolveArtwork(t.album) ||
        resolveArtwork(fav) ||
        matched?.artwork ||
        "";

      const artist =
        resolveArtist(t) ||
        resolveArtist(t.trackGroup) ||
        resolveArtist(t.album) ||
        resolveArtist(fav) ||
        matched?.artist ||
        "";

      const existing = trackMap.get(trackId);
      if (existing) {
        if (!existing.artwork && artwork) existing.artwork = artwork;
        if (!existing.artist && artist) existing.artist = artist;
        if (!existing.url && streamUrl) existing.url = streamUrl;
        return;
      }

      const trackGroup = t.trackGroup ||
        t.album ||
        matched?.trackGroup || {
          id: t.trackGroupId || 0,
          releaseDate: "",
          trackGroupId: t.trackGroupId || 0,
          title: t.title || "Track",
          artist: { name: artist } as any,
          artistId: 0,
          urlSlug: "",
          cover: { sizes: { 300: artwork, 600: artwork, 120: artwork } as any },
        };

      trackMap.set(trackId, {
        ...t,
        id: trackId,
        title: t.title || fav?.title || "Unknown Track",
        artist,
        artwork,
        url: streamUrl,
        headers: t.headers || { "mirlo-api-key": API_KEY },
        type: t.type || audioTrackType(streamUrl),
        queueIndex: 0,
        trackGroupId: t.trackGroupId || trackGroup.id || 0,
        trackGroup,
        audio: {
          url: rawAudio,
          duration: t.audio?.duration || t.duration,
        },
        isPreview: Boolean(t.isPreview),
        order: t.order || 1,
        allowIndividualSale: Boolean(t.allowIndividualSale),
      });
    };

    // 1. Add tracks from purchased albums
    purchases.forEach((p: any) => {
      const tg = p?.trackGroup || p;
      const albumFallback = tg ? albumLookup.get(tg.id) : undefined;
      const added = timeOf(p?.datePurchased);
      if (tg?.tracks && Array.isArray(tg.tracks)) {
        tg.tracks.forEach((t: RNTrack) => addTrackToMap(t, undefined, albumFallback, added));
      } else if (p.track) {
        addTrackToMap(p.track, p, albumFallback, added);
      }
    });

    // 2. Add tracks from wishlisted / liked albums
    wishlist.forEach((w: any) => {
      const tg = w?.trackGroup || w;
      const albumFallback = tg ? albumLookup.get(tg.id) : undefined;
      const added = timeOf(w?.createdAt);
      if (tg?.tracks && Array.isArray(tg.tracks)) {
        tg.tracks.forEach((t: RNTrack) => addTrackToMap(t, undefined, albumFallback, added));
      } else if (w.track) {
        addTrackToMap(w.track, w, albumFallback, added);
      }
    });

    // 3. Add tracks from user's explicit track favorites
    if (user?.trackFavorites) {
      user.trackFavorites.forEach((fav: any) => {
        addTrackToMap(fav?.track || fav, fav, undefined, timeOf(fav?.createdAt));
      });
    }

    // 4. Add downloaded songs; ones already listed keep their Mirlo entry and play the saved file
    downloadedTracks.forEach((dl) => {
      markAdded(dl.id, dl.downloadedAt);
      if (!trackMap.has(dl.id)) trackMap.set(dl.id, downloadToTrack(dl));
    });

    // Newest additions first; tracks added together keep their album order
    return Array.from(trackMap.values()).sort(
      (a, b) => (addedAt.get(b.id) || 0) - (addedAt.get(a.id) || 0),
    );
  }, [user, purchases, wishlist, catalogData, topSoldData, historyItems, downloadedTracks]);

  // All Tracks as shown: matching the search, in the chosen order
  const visibleTracks = useMemo(() => {
    const query = librarySearch.trim().toLowerCase();
    const albumOf = (t: RNTrack) => t.trackGroup?.title || "";
    const matches = query
      ? combinedTracks.filter((t) =>
          [t.title, t.artist, albumOf(t)].some((field) =>
            String(field || "")
              .toLowerCase()
              .includes(query),
          ),
        )
      : combinedTracks;
    if (librarySort === "newest") return matches;
    const key = (t: RNTrack) =>
      String(
        (librarySort === "title" ? t.title : librarySort === "artist" ? t.artist : albumOf(t)) ||
          "",
      );
    return [...matches].sort((a, b) => key(a).localeCompare(key(b)));
  }, [combinedTracks, librarySearch, librarySort]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Library</Text>
        <Text style={styles.subtitle}>All music, offline downloads, purchases & likes</Text>

        {/* Scrollable Segmented Toggle Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toggleRow}
        >
          {/* Section 1: Library (All combined tracks sans duplicates) */}
          <TouchableOpacity
            onPress={() => setActiveTab("library")}
            style={[styles.togglePill, activeTab === "library" && styles.togglePillActive]}
          >
            <Ionicons
              name="musical-notes"
              size={15}
              color={
                activeTab === "library" ? theme.colors.playButtonIcon : theme.colors.textSecondary
              }
            />
            <Text style={[styles.toggleText, activeTab === "library" && styles.toggleTextActive]}>
              All Tracks ({combinedTracks.length})
            </Text>
          </TouchableOpacity>

          {/* Section 2: Purchases */}
          <TouchableOpacity
            onPress={() => setActiveTab("purchases")}
            style={[styles.togglePill, activeTab === "purchases" && styles.togglePillActive]}
          >
            <Ionicons
              name="bag-handle-outline"
              size={15}
              color={
                activeTab === "purchases" ? theme.colors.playButtonIcon : theme.colors.textSecondary
              }
            />
            <Text style={[styles.toggleText, activeTab === "purchases" && styles.toggleTextActive]}>
              Purchases ({purchases.length})
            </Text>
          </TouchableOpacity>

          {/* Section 3: Likes & Wishlist */}
          <TouchableOpacity
            onPress={() => setActiveTab("wishlist")}
            style={[styles.togglePill, activeTab === "wishlist" && styles.togglePillActive]}
          >
            <Ionicons
              name="heart-outline"
              size={15}
              color={
                activeTab === "wishlist" ? theme.colors.playButtonIcon : theme.colors.textSecondary
              }
            />
            <Text style={[styles.toggleText, activeTab === "wishlist" && styles.toggleTextActive]}>
              Likes & Wishlist ({wishlist.length})
            </Text>
          </TouchableOpacity>

          {/* Section 4: Downloads (On device offline files) */}
          <TouchableOpacity
            onPress={() => setActiveTab("downloads")}
            style={[styles.togglePill, activeTab === "downloads" && styles.togglePillActive]}
          >
            <Ionicons
              name="download-outline"
              size={15}
              color={
                activeTab === "downloads" ? theme.colors.playButtonIcon : theme.colors.textSecondary
              }
            />
            <Text style={[styles.toggleText, activeTab === "downloads" && styles.toggleTextActive]}>
              Downloads ({downloadedTracks.length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Content */}
      {!user &&
      activeTab !== "downloads" &&
      !(activeTab === "library" && downloadedTracks.length > 0) ? (
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
      ) : activeTab === "library" ? (
        combinedTracks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="musical-notes-outline" size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>Your library is empty</Text>
            <Text style={styles.emptySubtitle}>
              Favorited songs, purchases, and on-device downloaded audio files will appear here
              together.
            </Text>
          </View>
        ) : (
          <View style={styles.libraryPane}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={theme.colors.textMuted} />
              <TextInput
                value={librarySearch}
                onChangeText={setLibrarySearch}
                placeholder="Search your library"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.searchInput}
                autoCorrect={false}
                returnKeyType="search"
              />
              {librarySearch ? (
                <Pressable onPress={() => setLibrarySearch("")} accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.sortRow}>
              {SORT_OPTIONS.map((option) => {
                const active = librarySort === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => setLibrarySort(option.id)}
                    style={[styles.togglePill, active && styles.togglePillActive]}
                  >
                    <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <FlatList
              data={visibleTracks}
              keyExtractor={(item, index) => `track-${item.id}-${index}`}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.emptySubtitle}>No songs match "{librarySearch}"</Text>
              }
              renderItem={({ item }) => {
                const isSelected = Boolean(activeTrack?.url && activeTrack.url === item.url);
                return (
                  <Pressable
                    onPress={() => playTrack(item, visibleTracks, "Your Library")}
                    style={[styles.card, isSelected && styles.selectedCard]}
                  >
                    {item.artwork ? (
                      <Image source={{ uri: item.artwork }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.placeholder]}>
                        <Ionicons name="musical-notes" size={20} color={theme.colors.primary} />
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
                      {item.id > 0 && <FavoriteTrackButton track={item} size={17} />}
                    </View>
                  </Pressable>
                );
              }}
            />
          </View>
        )
      ) : activeTab === "downloads" ? (
        <DownloadsTab />
      ) : activeTab === "purchases" ? (
        isCollectionPending ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : purchases.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="bag-handle-outline" size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No purchases yet</Text>
            <Text style={styles.emptySubtitle}>
              Music you buy directly from artists on Mirlo will appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={purchases}
            keyExtractor={(item, index) => String(item.id ?? index)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const tg = (item as any).trackGroup;
              const coverUri = tg?.cover?.sizes?.[300] || tg?.cover?.sizes?.[120];
              return (
                <Pressable
                  onPress={() => {
                    if (tg?.artistId && tg?.urlSlug) {
                      router.push({
                        pathname: "/artist/[id]/album/[slug]/album-tracks",
                        params: { id: String(tg.artistId), slug: String(tg.urlSlug) },
                      });
                    }
                  }}
                  style={styles.card}
                >
                  {coverUri ? (
                    <Image source={{ uri: coverUri }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.placeholder]}>
                      <Ionicons name="musical-notes" size={20} color={theme.colors.primary} />
                    </View>
                  )}
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {tg?.title || "Purchased Item"}
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
        )
      ) : isWishlistPending ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : wishlist.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={48} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>No saved items</Text>
          <Text style={styles.emptySubtitle}>
            Tap the heart on any album to save it to your wishlist.
          </Text>
        </View>
      ) : (
        <FlatList
          data={wishlist}
          keyExtractor={(item, index) => String(item.id ?? index)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const tg = (item as any).trackGroup;
            const coverUri = tg?.cover?.sizes?.[300] || tg?.cover?.sizes?.[120];
            return (
              <Pressable
                onPress={() => {
                  if (tg?.artistId && tg?.urlSlug) {
                    router.push({
                      pathname: "/artist/[id]/album/[slug]/album-tracks",
                      params: { id: String(tg.artistId), slug: String(tg.urlSlug) },
                    });
                  }
                }}
                style={styles.card}
              >
                {coverUri ? (
                  <Image source={{ uri: coverUri }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.placeholder]}>
                    <Ionicons name="heart" size={20} color={theme.colors.primary} />
                  </View>
                )}
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {tg?.title || "Saved Album"}
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    fontSize: 22,
    fontWeight: "800",
    color: theme.colors.textPrimary,
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
    paddingBottom: 40,
  },
  libraryPane: {
    flex: 1,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 4,
    paddingHorizontal: 12,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.surfaceCardBorder,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  sortRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
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
