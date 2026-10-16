import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export type FaircampSavedTrack = {
  track: RNTrack;
  likedAt: number;
};

export type FaircampSavedAlbum = {
  album: AlbumProps;
  savedAt: number;
};

export type FaircampSaves = {
  tracks: FaircampSavedTrack[];
  albums: FaircampSavedAlbum[];
};

const STORAGE_KEY = "mirlo_blue_faircamp_saves_v1";

let saves: FaircampSaves = { tracks: [], albums: [] };
let loaded: Promise<void> | null = null;
const listeners = new Set<(saves: FaircampSaves) => void>();

function trackKey(track: RNTrack): string {
  return track.url || `${track.trackGroup?.urlSlug || track.trackGroupId}:${track.id}`;
}

function albumKey(album: AlbumProps): string {
  return album.urlSlug || String(album.id);
}

function publish(): void {
  listeners.forEach((listener) => listener(saves));
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
  } catch (error) {
    console.error("Failed to save Faircamp likes and wishlists:", error);
  }
}

function load(): Promise<void> {
  loaded ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FaircampSaves>;
        saves = {
          tracks: Array.isArray(parsed.tracks) ? parsed.tracks : [],
          albums: Array.isArray(parsed.albums) ? parsed.albums : [],
        };
      }
      publish();
    })
    .catch((error) => {
      console.error("Failed to load Faircamp likes and wishlists:", error);
    });
  return loaded;
}

function trackBelongsToAlbum(track: RNTrack, targetAlbumKey: string): boolean {
  if (track.trackGroup) {
    return albumKey(track.trackGroup as AlbumProps) === targetAlbumKey;
  }
  if (track.trackGroupId !== undefined) {
    return String(track.trackGroupId) === targetAlbumKey;
  }
  return false;
}

export async function toggleFaircampTrackLike(track: RNTrack): Promise<void> {
  await load();
  const key = trackKey(track);
  const exists = saves.tracks.some((saved) => trackKey(saved.track) === key);
  const hasAlbum = Boolean(
    track.trackGroup && (track.trackGroup.urlSlug || track.trackGroup.id),
  );
  const { tracks: _tracks, ...cleanTrackGroup } = (track.trackGroup || {}) as AlbumProps;
  const cleanTrack = hasAlbum ? { ...track, trackGroup: cleanTrackGroup } : track;
  const nextTracks = exists
    ? saves.tracks.filter((saved) => trackKey(saved.track) !== key)
    : [{ track: cleanTrack, likedAt: Date.now() }, ...saves.tracks];

  let nextAlbums = saves.albums;
  if (hasAlbum) {
    const targetAlbumKey = albumKey(cleanTrackGroup);
    if (!exists) {
      if (!saves.albums.some((saved) => albumKey(saved.album) === targetAlbumKey)) {
        nextAlbums = [{ album: cleanTrackGroup, savedAt: Date.now() }, ...saves.albums];
      }
    } else {
      const anyTrackStillLiked = nextTracks.some((saved) =>
        trackBelongsToAlbum(saved.track, targetAlbumKey),
      );
      if (!anyTrackStillLiked) {
        nextAlbums = saves.albums.filter(
          (saved) => albumKey(saved.album) !== targetAlbumKey,
        );
      }
    }
  }

  saves = {
    tracks: nextTracks,
    albums: nextAlbums,
  };
  publish();
  await persist();
}

export function isFaircampAlbumWishlisted(
  album: { id?: number; urlSlug?: string },
  currentSaves: FaircampSaves = saves,
): boolean {
  const key = album.urlSlug || String(album.id);
  if (!key || key === "undefined") return false;
  return (
    currentSaves.albums.some((saved) => albumKey(saved.album) === key) ||
    currentSaves.tracks.some((saved) => trackBelongsToAlbum(saved.track, key))
  );
}

export async function toggleFaircampAlbumWishlist(
  album: AlbumProps,
  displayedTracks: RNTrack[],
): Promise<void> {
  await load();
  const { tracks: _tracks, ...cleanAlbum } = album;
  const key = albumKey(cleanAlbum);
  const exists = isFaircampAlbumWishlisted(cleanAlbum, saves);
  const trackKeys = new Set(displayedTracks.map(trackKey));
  saves = {
    tracks: exists
      ? saves.tracks.filter(
          (saved) =>
            !trackKeys.has(trackKey(saved.track)) &&
            !trackBelongsToAlbum(saved.track, key),
        )
      : [
          ...displayedTracks
            .filter(
              (track) =>
                !saves.tracks.some((saved) => trackKey(saved.track) === trackKey(track)),
            )
            .map((track) => ({
              track: { ...track, trackGroup: cleanAlbum },
              likedAt: Date.now(),
            })),
          ...saves.tracks,
        ],
    albums: exists
      ? saves.albums.filter((saved) => albumKey(saved.album) !== key)
      : [
          { album: cleanAlbum, savedAt: Date.now() },
          ...saves.albums.filter((saved) => albumKey(saved.album) !== key),
        ],
  };
  publish();
  await persist();
}

export function isFaircampTrackLiked(track: RNTrack): boolean {
  const key = trackKey(track);
  return saves.tracks.some((saved) => trackKey(saved.track) === key);
}

export function useFaircampSaves(): FaircampSaves {
  const [current, setCurrent] = useState(saves);
  useEffect(() => {
    listeners.add(setCurrent);
    load();
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);
  return current;
}

export function isFaircampAlbum(album: {
  source?: string;
  urlSlug?: string;
}): boolean {
  return (
    album.source === "Faircamp" ||
    album.urlSlug?.startsWith("fairplayer-") === true ||
    Boolean(album.source && album.source !== "Mirlo Space")
  );
}

export function isFaircampTrack(track: {
  source?: string;
  trackGroup?: { source?: string; urlSlug?: string };
}): boolean {
  const source = track.source || track.trackGroup?.source;
  return (
    source === "Faircamp" ||
    track.trackGroup?.urlSlug?.startsWith("fairplayer-") === true ||
    Boolean(source && source !== "Mirlo Space")
  );
}
