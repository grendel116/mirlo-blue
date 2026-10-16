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
import { useState, useEffect, useMemo, type ComponentProps, type ReactElement } from "react";
import { useAuthContext } from "@/state/AuthContext";
import { usePlayer } from "@/state/PlayerContext";
import { useQuery, useQueries } from "@tanstack/react-query";
import {
  queryUserCollection,
  queryWishlist,
  queryTrackGroups,
  queryTopSold,
  queryAlbum,
} from "@/queries/queries";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@/constants/theme";
import AddToQueueButton from "@/components/AddToQueueButton";
import DownloadsTab from "@/components/DownloadsTab";
import FavoriteTrackButton from "@/components/FavoriteTrackButton";
import { DownloadedTrack, downloadToTrack, useDownloads } from "@/scripts/downloadManager";
import { getHistory, getHistorySync, subscribeHistory, HistoryItem } from "@/scripts/historyManager";
import { fairplayerReleaseSlug } from "@/queries/fairplayer";
import { API_ROOT } from "@/constants/api-root";
import { API_KEY } from "@/constants/api-key";
import {
  audioTrackType,
  isTrackOwnedOrPreview,
  resolveArtworkUrl,
  trackStreamPath,
} from "@/scripts/utils";
import { useStationLikes } from "@/scripts/stationLikes";
import { usePodcastEpisodeLikes, PodcastEpisodeLike } from "@/scripts/podcastLikes";
import { useFaircampSaves, FaircampSavedTrack } from "@/scripts/faircampSaves";
import { findStation, liveTrack } from "@/queries/radio";
import { hashString } from "@/queries/podcast";

type LibraryTab = "library" | "purchases" | "wishlist" | "bookmarks" | "downloads";
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

type AlbumEntry = { artwork: string; artist: string; trackGroup: any };
type ShelfKey = number | string;

const timeOf = (date: unknown) => (date ? new Date(date as string).getTime() || 0 : 0);

function albumEntry(tg: any): AlbumEntry {
  const { tracks: _tracks, ...trackGroup } = tg;
  return { artwork: resolveArtwork(tg), artist: resolveArtist(tg), trackGroup };
}

// Cover, artist, and album details from every album we know of, so a song that arrives
// without them borrows them from its album
function createAlbumLookup(albums: any[], historyItems: HistoryItem[] = []) {
  const albumLookup = new Map<ShelfKey, AlbumEntry>();

  albums.forEach((item: any) => {
    const tg = item?.trackGroup || item;
    if (!tg) return;
    const entry = albumEntry(tg);
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
  });

  historyItems.forEach((h: HistoryItem) => {
    if (h && h.downloadAlbum === undefined) {
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

  return (t: any, fav?: any): AlbumEntry | undefined => {
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
}

// Songs gathered from several places, each listed once. A song found in several places keeps
// the latest date it joined; songs listed under `exclude` stay off the shelf
function createShelf(
  matchAlbum: (t: any, fav?: any) => AlbumEntry | undefined,
  exclude: Set<ShelfKey> = new Set(),
) {
  const tracks = new Map<ShelfKey, RNTrack>();
  const addedAt = new Map<ShelfKey, number>();

  const markAdded = (key: ShelfKey, time: number) => {
    addedAt.set(key, Math.max(addedAt.get(key) || 0, time));
  };

  // A ready-made track under its own key
  const put = (key: ShelfKey, track: RNTrack, added = 0) => {
    if (exclude.has(key)) return;
    markAdded(key, added);
    if (!tracks.has(key)) tracks.set(key, track);
  };

  // A Mirlo or Faircamp song in any shape the API sends, filled out from its album
  const add = (t: any, added = 0, fav?: any, albumFallback?: AlbumEntry) => {
    if (!t) return;
    const trackId = t.id ?? fav?.trackId ?? t.trackId;
    if (!trackId) return;
    const key: ShelfKey = t.source === "Faircamp" && t.url ? `faircamp:${t.url}` : trackId;
    if (exclude.has(key)) return;
    markAdded(key, added);

    const matched = matchAlbum(t, fav) || albumFallback;
    const rawAudio = t.audio?.url || t.url || trackStreamPath(trackId);
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

    const existing = tracks.get(key);
    if (existing) {
      if (!existing.artwork && artwork) existing.artwork = artwork;
      if (!existing.artist && artist) existing.artist = artist;
      if (!existing.url && streamUrl) existing.url = streamUrl;
      return;
    }

    const rawTrackGroup = t.trackGroup ||
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
    const { tracks: _tracks, ...trackGroup } = rawTrackGroup;

    tracks.set(key, {
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
      source: t.source || trackGroup?.source || "Mirlo Space",
      sourceUrl: t.sourceUrl || trackGroup?.sourceUrl || "https://mirlo.space",
    });
  };

  // Newest additions first; songs added together keep their album order
  const list = (): RNTrack[] =>
    Array.from(tracks.entries())
      .sort(([keyA, a], [keyB, b]) => {
        const timeDiff = (addedAt.get(keyB) || 0) - (addedAt.get(keyA) || 0);
        if (timeDiff !== 0) return timeDiff;
        const aAlbumId = a.trackGroupId || a.trackGroup?.id;
        const bAlbumId = b.trackGroupId || b.trackGroup?.id;
        if (aAlbumId && bAlbumId && aAlbumId === bAlbumId) {
          return (a.order || 0) - (b.order || 0);
        }
        return 0;
      })
      .map(([, track]) => track);

  return { tracks, add, put, markAdded, list };
}

// Imported files carry no Mirlo id; the artist and title in their tags name the song
function songIdentity(artist?: string, title?: string): string {
  const a = (artist || "").trim().toLowerCase();
  const t = (title || "").trim().toLowerCase();
  return a && t ? `${a}|${t}` : "";
}

export interface BuildLibraryTracksParams {
  purchases: any[];
  fullAlbums: AlbumProps[];
  purchaseDateByAlbumId: Map<number | string, string>;
  downloadedTracks: DownloadedTrack[];
}

// Tracks: every song the listener fully owns — purchases and the songs saved on the phone
export function buildLibraryTracks({
  purchases,
  fullAlbums,
  purchaseDateByAlbumId,
  downloadedTracks,
}: BuildLibraryTracksParams): RNTrack[] {
  const shelf = createShelf(createAlbumLookup([...purchases, ...fullAlbums]));

  // 1. Tracks from full purchased albums
  fullAlbums.forEach((album) => {
    if (!album.tracks || !Array.isArray(album.tracks)) return;
    const entry = albumEntry(album);
    const purchaseDate =
      purchaseDateByAlbumId.get(album.id) ??
      purchaseDateByAlbumId.get(album.trackGroupId) ??
      purchaseDateByAlbumId.get(album.urlSlug);
    const added = timeOf(purchaseDate || album.releaseDate);
    album.tracks.forEach((t: RNTrack) => {
      shelf.add({ ...t, trackGroup: entry.trackGroup }, added, undefined, entry);
    });
  });

  // 2. Individual track purchases, and purchases that arrive with their tracks attached
  purchases.forEach((p: any) => {
    const tg = p?.trackGroup || p;
    const entry = tg ? albumEntry(tg) : undefined;
    const added = timeOf(p?.datePurchased);
    if (tg?.tracks && Array.isArray(tg.tracks)) {
      tg.tracks.forEach((t: RNTrack) => shelf.add(t, added, undefined, entry));
    } else if (p.track) {
      shelf.add(p.track, added, p, entry);
    }
  });

  // 3. Songs saved on the phone. A Mirlo download shares its purchase's id and plays the saved
  // file; an imported file of a purchased song joins that purchase and plays the file
  const purchasedBySong = new Map<string, ShelfKey>();
  shelf.tracks.forEach((t, key) => {
    const identity = songIdentity(t.artist, t.title);
    if (identity) purchasedBySong.set(identity, key);
  });

  downloadedTracks.forEach((dl) => {
    const purchasedKey = shelf.tracks.has(dl.id)
      ? dl.id
      : dl.source === "file"
        ? purchasedBySong.get(songIdentity(dl.artist, dl.title))
        : undefined;

    if (purchasedKey === undefined) {
      shelf.put(dl.id, downloadToTrack(dl), dl.downloadedAt);
      return;
    }
    shelf.markAdded(purchasedKey, dl.downloadedAt);
    if (purchasedKey !== dl.id) {
      const purchased = shelf.tracks.get(purchasedKey)!;
      purchased.url = dl.url;
      purchased.audio = { ...purchased.audio, url: dl.url };
      purchased.headers = {};
    }
  });

  return shelf.list();
}

export interface BuildWishlistTracksParams {
  user?: LoggedInUser | null;
  wishlist: any[];
  catalogData?: { results: AlbumProps[] };
  topSoldData?: { results: AlbumProps[] };
  historyItems: HistoryItem[];
  faircampTracks?: FaircampSavedTrack[];
  ownedIds: Set<ShelfKey>;
}

// Wishlist: liked Mirlo and Faircamp songs, leaving out songs the listener already owns.
// Wishlisted albums and catalog releases fill in each song's cover and artist
export function buildWishlistTracks({
  user,
  wishlist,
  catalogData,
  topSoldData,
  historyItems,
  faircampTracks = [],
  ownedIds,
}: BuildWishlistTracksParams): RNTrack[] {
  const shelf = createShelf(
    createAlbumLookup(
      [...wishlist, ...(catalogData?.results || []), ...(topSoldData?.results || [])],
      historyItems,
    ),
    ownedIds,
  );

  user?.trackFavorites?.forEach((fav: any) => {
    shelf.add(fav?.track || fav, timeOf(fav?.createdAt), fav);
  });
  faircampTracks.forEach(({ track, likedAt }) => shelf.add(track, likedAt));

  return shelf.list();
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

export interface BuildBookmarksParams {
  stationLikes: { stationId: string; likedAt: number }[];
  podcastEpisodeLikes?: PodcastEpisodeLike[];
}

// Bookmarks: liked radio stations and podcast episodes, kept on the phone
export function buildBookmarks({
  stationLikes,
  podcastEpisodeLikes = [],
}: BuildBookmarksParams): RNTrack[] {
  const shelf = createShelf(() => undefined);
  stationLikes.forEach(({ stationId, likedAt }) => {
    const station = findStation(stationId);
    if (station) shelf.put(`station:${stationId}`, liveTrack(station), likedAt);
  });
  podcastEpisodeLikes.forEach((ep) => {
    shelf.put(`episode:${ep.episodeId}`, episodeTrack(ep), ep.likedAt);
  });
  return shelf.list();
}

export default function LibraryScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { playTrack, activeTrack, disabledTrackIds } = usePlayer();
  // History links a saved album here: ?tab=downloads&album=<album key>
  const params = useLocalSearchParams<{ tab?: string; album?: string }>();
  const [activeTab, setActiveTab] = useState<LibraryTab>(
    params.tab === "downloads" ? "downloads" : "library",
  );
  useEffect(() => {
    if (params.tab === "downloads") setActiveTab("downloads");
  }, [params.tab, params.album]);
  const downloadedTracks = useDownloads();
  const stationLikes = useStationLikes();
  const podcastEpisodeLikes = usePodcastEpisodeLikes();
  const faircampSaves = useFaircampSaves();
  const [librarySearch, setLibrarySearch] = useState("");
  const [librarySort, setLibrarySort] = useState<LibrarySort>("newest");

  const userId = user?.id;
  const hasTrackFavorites = Boolean(user?.trackFavorites?.length);

  // Purchases query
  const { data: collectionData, isPending: isCollectionPending } = useQuery(
    queryUserCollection(userId),
  );

  // Wishlist / Likes query
  const { data: wishlistData, isPending: isWishlistPending } = useQuery(queryWishlist(userId));

  // Catalog releases to enrich favorited tracks whose albums are not yet in purchases/wishlist
  const { data: catalogData } = useQuery({
    ...queryTrackGroups({ distinctArtists: false, take: 50 }),
    enabled: hasTrackFavorites,
    staleTime: 5 * 60 * 1000,
  });
  const { data: topSoldData } = useQuery({
    ...queryTopSold({ take: 50 }),
    enabled: hasTrackFavorites,
    staleTime: 5 * 60 * 1000,
  });

  const [historyItems, setHistoryItems] = useState<HistoryItem[]>(getHistorySync);
  useEffect(() => {
    getHistory().then(setHistoryItems);
    return subscribeHistory(setHistoryItems);
  }, []);

  const purchases = useMemo(() => collectionData?.results || [], [collectionData?.results]);
  const wishlist = useMemo(() => wishlistData?.results || [], [wishlistData?.results]);

  // Unique album descriptors for purchased albums that need their full tracks fetched
  const purchasedAlbumDescriptors = useMemo(() => {
    const map = new Map<
      number | string,
      {
        slug: string;
        id: string;
        albumId: number | string;
        datePurchased?: string;
        needsFetch: boolean;
      }
    >();

    purchases.forEach((p: any) => {
      const tg = p?.trackGroup || p;
      const rawId = tg?.id ?? tg?.trackGroupId ?? p?.trackGroupId;
      if (!rawId) return;
      const albumKey = String(rawId);
      const slug = tg?.urlSlug ? String(tg.urlSlug) : albumKey;
      const id = tg?.artistId ? String(tg.artistId) : albumKey;
      const hasTracks = Boolean(tg?.tracks && Array.isArray(tg.tracks) && tg.tracks.length > 0);
      if (!map.has(albumKey)) {
        map.set(albumKey, {
          slug,
          id,
          albumId: rawId,
          datePurchased: p?.datePurchased,
          needsFetch: !hasTracks,
        });
      }
    });

    if (user?.userTrackGroupPurchases) {
      user.userTrackGroupPurchases.forEach((utgp: any) => {
        const rawId = utgp?.trackGroupId;
        if (!rawId) return;
        const albumKey = String(rawId);
        if (!map.has(albumKey)) {
          map.set(albumKey, {
            slug: albumKey,
            id: albumKey,
            albumId: rawId,
            needsFetch: true,
          });
        }
      });
    }

    return Array.from(map.values());
  }, [purchases, user?.userTrackGroupPurchases]);

  // Fetch full album details (including track list) only for purchased albums missing tracks
  const albumQueries = useQueries({
    queries: purchasedAlbumDescriptors
      .filter((desc) => desc.needsFetch)
      .map((desc) => queryAlbum({ slug: desc.slug, id: desc.id })),
  });

  const fullAlbums = useMemo(() => {
    const list: AlbumProps[] = [];
    albumQueries.forEach((q) => {
      if (q.data?.result) {
        list.push(q.data.result);
      }
    });
    return list;
  }, [albumQueries]);

  const purchaseDateByAlbumId = useMemo(() => {
    const map = new Map<number | string, string>();
    purchasedAlbumDescriptors.forEach((desc) => {
      if (desc.datePurchased) {
        map.set(desc.albumId, desc.datePurchased);
        map.set(String(desc.albumId), desc.datePurchased);
        map.set(desc.slug, desc.datePurchased);
      }
    });
    return map;
  }, [purchasedAlbumDescriptors]);

  // Tracks: purchases and songs saved on the phone, each listed once
  const combinedTracks = useMemo(
    () =>
      buildLibraryTracks({
        purchases,
        fullAlbums,
        purchaseDateByAlbumId,
        downloadedTracks,
      }),
    [purchases, fullAlbums, purchaseDateByAlbumId, downloadedTracks],
  );

  // Wishlist, song by song, leaving out songs already in Tracks
  const wishlistTracks = useMemo(
    () =>
      buildWishlistTracks({
        user,
        wishlist,
        catalogData,
        topSoldData,
        historyItems,
        faircampTracks: faircampSaves.tracks,
        ownedIds: new Set(combinedTracks.map((t) => t.id)),
      }),
    [
      user,
      wishlist,
      catalogData,
      topSoldData,
      historyItems,
      faircampSaves.tracks,
      combinedTracks,
    ],
  );

  const bookmarks = useMemo(
    () => buildBookmarks({ stationLikes, podcastEpisodeLikes }),
    [stationLikes, podcastEpisodeLikes],
  );

  const isPurchasedAlbumsPending = albumQueries.some((q) => q.isPending);
  const isLibraryLoading =
    Boolean(userId) &&
    (isCollectionPending || (purchasedAlbumDescriptors.length > 0 && isPurchasedAlbumsPending)) &&
    combinedTracks.length === 0;

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

  const isWishlistLoading = Boolean(userId) && isWishlistPending && wishlistTracks.length === 0;

  // Purchases live in the Mirlo account; the other tabs also hold music kept on the phone
  const needsSignIn =
    !user &&
    (activeTab === "purchases" ||
      (activeTab === "library" && combinedTracks.length === 0) ||
      (activeTab === "wishlist" && wishlistTracks.length === 0));

  const tabs: {
    id: LibraryTab;
    label: string;
    icon: ComponentProps<typeof Ionicons>["name"];
    count: number;
  }[] = [
    { id: "library", label: "Tracks", icon: "musical-notes", count: combinedTracks.length },
    { id: "purchases", label: "Purchases", icon: "bag-handle-outline", count: purchases.length },
    { id: "wishlist", label: "Wishlist", icon: "heart-outline", count: wishlistTracks.length },
    { id: "bookmarks", label: "Bookmarks", icon: "bookmark-outline", count: bookmarks.length },
    {
      id: "downloads",
      label: "Downloads",
      icon: "download-outline",
      count: downloadedTracks.length,
    },
  ];

  const renderEmpty = (
    icon: ComponentProps<typeof Ionicons>["name"],
    title: string,
    subtitle: string,
  ) => (
    <View style={styles.emptyContainer}>
      <Ionicons name={icon} size={48} color={theme.colors.textMuted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );

  // Opens a release's page, where the listener can play or buy it
  const openAlbum = (tg: any) => {
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

  // Songs that fail `canPlay` show dimmed with a lock and open their album instead of playing
  const renderTrackList = (
    tracks: RNTrack[],
    queueName: string,
    {
      listEmpty,
      canPlay = () => true,
    }: { listEmpty?: ReactElement; canPlay?: (track: RNTrack) => boolean } = {},
  ) => {
    const playable = tracks.filter(canPlay);
    return (
      <FlatList
        data={tracks}
        keyExtractor={(item, index) =>
          `track-${item.liveStation ?? item.podcastEpisodeId ?? item.url ?? item.id}-${index}`
        }
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={listEmpty}
        renderItem={({ item }) => {
          const isPlayable = canPlay(item);
          const isSelected = Boolean(activeTrack?.url && activeTrack.url === item.url);
          return (
            <Pressable
              onPress={() =>
                isPlayable ? playTrack(item, playable, queueName) : openAlbum(item.trackGroup)
              }
              style={[
                styles.card,
                isSelected && styles.selectedCard,
                !isPlayable && styles.lockedCard,
              ]}
              accessibilityHint={isPlayable ? undefined : "Opens the album to buy this song"}
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
                {isPlayable ? (
                  <AddToQueueButton track={item} size={17} />
                ) : (
                  <Ionicons
                    name="lock-closed-outline"
                    size={17}
                    color={theme.colors.textMuted}
                    accessibilityLabel="Buy to play"
                  />
                )}
                <FavoriteTrackButton track={item} size={17} />
              </View>
            </Pressable>
          );
        }}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Library</Text>
        <Text style={styles.subtitle}>Your music, wishlist, bookmarks & downloads</Text>

        {/* Scrollable Segmented Toggle Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toggleRow}
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[styles.togglePill, active && styles.togglePillActive]}
              >
                <Ionicons
                  name={tab.icon}
                  size={15}
                  color={active ? theme.colors.playButtonIcon : theme.colors.textSecondary}
                />
                <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                  {tab.label} ({tab.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      {needsSignIn ? (
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
        isLibraryLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : combinedTracks.length === 0 ? (
          renderEmpty(
            "musical-notes-outline",
            "Your library is empty",
            "Songs you buy and audio files saved on this phone will appear here together.",
          )
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
            {renderTrackList(visibleTracks, "Your Library", {
              listEmpty: (
                <Text style={styles.emptySubtitle}>No songs match "{librarySearch}"</Text>
              ),
            })}
          </View>
        )
      ) : activeTab === "downloads" ? (
        <DownloadsTab openAlbum={params.album} />
      ) : activeTab === "bookmarks" ? (
        bookmarks.length === 0 ? (
          renderEmpty(
            "bookmark-outline",
            "No bookmarks yet",
            "Like a radio station or podcast episode to keep it here.",
          )
        ) : (
          renderTrackList(bookmarks, "Bookmarks")
        )
      ) : activeTab === "purchases" ? (
        isCollectionPending ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : purchases.length === 0 ? (
          renderEmpty(
            "bag-handle-outline",
            "No purchases yet",
            "Music you buy directly from artists on Mirlo will appear here.",
          )
        ) : (
          <FlatList
            data={purchases}
            keyExtractor={(item) =>
              "trackGroupId" in item ? `album-${item.trackGroupId}` : `track-${item.trackId}`
            }
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={5}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const tg = (item as any).trackGroup;
              const coverUri = tg?.cover?.sizes?.[300] || tg?.cover?.sizes?.[120];
              return (
                <Pressable
                  onPress={() => openAlbum(tg)}
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
      ) : isWishlistLoading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : wishlistTracks.length === 0 ? (
        renderEmpty(
          "heart-outline",
          "No saved songs",
          "Tap the heart on any song or album to save it to your wishlist.",
        )
      ) : (
        renderTrackList(wishlistTracks, "Wishlist", {
          canPlay: (t) => isTrackOwnedOrPreview(t, user, undefined, disabledTrackIds),
        })
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
    marginVertical: 10,
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
  lockedCard: {
    opacity: 0.45,
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
