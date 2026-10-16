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
let likedTrackKeys = new Set<string>();
let isLoaded = false;
let loaded: Promise<void> | null = null;
const listeners = new Set<(saves: FaircampSaves) => void>();

function trackKey(track: RNTrack): string {
  return track.url || `${track.trackGroup?.urlSlug || track.trackGroupId}:${track.id}`;
}

function albumKey(album: AlbumProps): string {
  return album.urlSlug || String(album.id);
}

function rebuildIndex(): void {
  likedTrackKeys = new Set(saves.tracks.map((saved) => trackKey(saved.track)));
}

function publish(): void {
  rebuildIndex();
  listeners.forEach((listener) => listener(saves));
}

async function persist(): Promise<void> {
  try {
    const serialized = JSON.stringify(saves, (key, value) => {
      if (key === "trackGroup" && value && typeof value === "object") {
        const trackGroup = { ...value };
        delete trackGroup.tracks;
        return trackGroup;
      }
      return value;
    });
    await AsyncStorage.setItem(STORAGE_KEY, serialized);
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
      isLoaded = true;
      publish();
    })
    .catch((error) => {
      isLoaded = true;
      console.error("Failed to load Faircamp likes and wishlists:", error);
    });
  return loaded;
}

export async function toggleFaircampTrackLike(track: RNTrack): Promise<void> {
  await load();
  const key = trackKey(track);
  const exists = likedTrackKeys.has(key);
  saves = {
    ...saves,
    tracks: exists
      ? saves.tracks.filter((saved) => trackKey(saved.track) !== key)
      : [{ track, likedAt: Date.now() }, ...saves.tracks],
  };
  publish();
  await persist();
}

export async function toggleFaircampAlbumWishlist(
  album: AlbumProps,
  displayedTracks: RNTrack[],
): Promise<void> {
  await load();
  const key = albumKey(album);
  const exists = saves.albums.some((saved) => albumKey(saved.album) === key);
  const trackKeys = new Set(displayedTracks.map(trackKey));
  saves = {
    tracks: exists
      ? saves.tracks.filter((saved) => !trackKeys.has(trackKey(saved.track)))
      : [
          ...displayedTracks
            .filter((track) => !likedTrackKeys.has(trackKey(track)))
            .map((track) => ({ track, likedAt: Date.now() })),
          ...saves.tracks,
        ],
    albums: exists
      ? saves.albums.filter((saved) => albumKey(saved.album) !== key)
      : [{ album, savedAt: Date.now() }, ...saves.albums],
  };
  publish();
  await persist();
}

export function isFaircampTrackLiked(track: RNTrack): boolean {
  return likedTrackKeys.has(trackKey(track));
}

export function useFaircampSaves(): FaircampSaves {
  const [current, setCurrent] = useState(saves);
  useEffect(() => {
    listeners.add(setCurrent);
    if (isLoaded) {
      setCurrent((prev) => (prev === saves ? prev : saves));
    } else {
      load();
    }
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
    album.source === "Faircamp" || album.urlSlug?.startsWith("fairplayer-") === true
  );
}

export function isFaircampTrack(track: {
  source?: string;
  trackGroup?: { source?: string; urlSlug?: string };
}): boolean {
  return (
    track.source === "Faircamp" ||
    track.trackGroup?.source === "Faircamp" ||
    track.trackGroup?.urlSlug?.startsWith("fairplayer-") === true
  );
}
