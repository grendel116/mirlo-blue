import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// A song saved on the phone. Mirlo downloads keep their Mirlo track id, so the rest of the
// app treats them as the same song and plays the saved file. Files added from the phone
// get negative ids, which never collide with Mirlo's
export type DownloadedTrack = {
  id: number;
  title: string;
  artist: string;
  albumTitle?: string;
  artwork?: string;
  url: string; // file:// uri of the saved audio
  folder?: string; // file:// uri of the album folder it was unpacked into
  duration?: number;
  bytes?: number;
  order?: number; // position within its album
  downloadedAt: number;
  source: "mirlo" | "file";
};

const DOWNLOADS_STORAGE_KEY = "mirlo_blue_downloads_v2";

// Formats offered for Mirlo downloads; Mirlo also has WAV, ALAC, Opus, and smaller MP3s
export type DownloadFormat = "320.mp3" | "flac";
export const DOWNLOAD_FORMATS: { id: DownloadFormat; label: string }[] = [
  { id: "320.mp3", label: "MP3 320" },
  { id: "flac", label: "FLAC" },
];

// Mirlo builds the zip, the phone downloads it, then unpacks it
export type DownloadStage = "preparing" | "downloading" | "unpacking";

type DownloadListener = (tracks: DownloadedTrack[]) => void;
const listeners = new Set<DownloadListener>();

// In-memory copy so the player can look up a saved file without waiting on storage
let downloads: DownloadedTrack[] = [];
let isLoaded = false;

async function persist(next: DownloadedTrack[]) {
  downloads = next;
  isLoaded = true;
  await AsyncStorage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(next));
  listeners.forEach((listener) => listener(next));
}

export async function getDownloadedTracks(): Promise<DownloadedTrack[]> {
  if (isLoaded) return downloads;
  try {
    const raw = await AsyncStorage.getItem(DOWNLOADS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    downloads = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to load downloads:", err);
    downloads = [];
  }
  isLoaded = true;
  return downloads;
}

// Newest first; a song downloaded again replaces its earlier copy
export async function saveDownloadedTracks(tracks: DownloadedTrack[]): Promise<void> {
  const current = await getDownloadedTracks();
  const ids = new Set(tracks.map((t) => t.id));
  await persist([...tracks, ...current.filter((t) => !ids.has(t.id))]);
}

export async function forgetDownloadedTracks(trackIds: number[]): Promise<void> {
  const ids = new Set(trackIds);
  const current = await getDownloadedTracks();
  await persist(current.filter((t) => !ids.has(t.id)));
}

export function subscribeDownloads(listener: DownloadListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// The saved songs, kept current as downloads come and go
export function useDownloads(): DownloadedTrack[] {
  const [tracks, setTracks] = useState<DownloadedTrack[]>([]);
  useEffect(() => {
    getDownloadedTracks().then(setTracks);
    return subscribeDownloads(setTracks);
  }, []);
  return tracks;
}

// The saved copy of a song, if there is one
export function findDownload(trackId: number | undefined): DownloadedTrack | undefined {
  if (trackId === undefined) return undefined;
  return downloads.find((t) => t.id === trackId);
}

// A saved song as a player track
export function downloadToTrack(dl: DownloadedTrack): RNTrack {
  return {
    id: dl.id,
    title: dl.title,
    artist: dl.artist,
    artwork: dl.artwork,
    url: dl.url,
    queueIndex: 0,
    trackGroupId: 0,
    trackGroup: {
      id: 0,
      releaseDate: "",
      trackGroupId: 0,
      title: dl.albumTitle || "On this phone",
      artist: { name: dl.artist } as any,
      artistId: 0,
      urlSlug: "",
      cover: { sizes: { 300: dl.artwork, 600: dl.artwork } as any },
    },
    audio: { url: dl.url, duration: dl.duration },
    isPreview: false,
    order: dl.order || 1,
    headers: {},
    allowIndividualSale: false,
    downloadAlbum: albumKeyOf(dl),
  } as RNTrack;
}

// Saved songs that belong together: an unpacked Mirlo album, or files imported under one name
export type DownloadedAlbum = {
  key: string;
  title: string;
  artist: string;
  artwork?: string;
  tracks: DownloadedTrack[];
  totalBytes: number;
  downloadedAt: number;
};

export function albumKeyOf(track: DownloadedTrack): string {
  if (track.folder) return track.folder;
  return `album:${(track.albumTitle || "Imported Audio").trim().toLowerCase()}`;
}

// Newest albums first, each with its songs in album order
export function groupTracksIntoAlbums(tracks: DownloadedTrack[]): DownloadedAlbum[] {
  const albums = new Map<string, DownloadedAlbum>();

  for (const track of tracks) {
    const key = albumKeyOf(track);
    const album = albums.get(key);
    if (!album) {
      albums.set(key, {
        key,
        title: track.albumTitle || "Imported Audio",
        artist: track.artist || "Unknown Artist",
        artwork: track.artwork,
        tracks: [track],
        totalBytes: track.bytes || 0,
        downloadedAt: track.downloadedAt,
      });
      continue;
    }
    album.tracks.push(track);
    album.totalBytes += track.bytes || 0;
    album.artwork ||= track.artwork;
    album.downloadedAt = Math.max(album.downloadedAt, track.downloadedAt);
  }

  return Array.from(albums.values())
    .map((album) => ({
      ...album,
      tracks: album.tracks.sort((a, b) => (a.order || 0) - (b.order || 0) || a.id - b.id),
    }))
    .sort((a, b) => b.downloadedAt - a.downloadedAt);
}

// Changes what every song in an album shows. Imported albums are grouped by title, so a new
// title can merge into another album; the album's key afterwards is returned
export async function updateAlbum(
  albumKey: string,
  changes: Partial<Pick<DownloadedTrack, "albumTitle" | "artist" | "artwork">>,
): Promise<string> {
  const current = await getDownloadedTracks();
  let newKey = albumKey;
  await persist(
    current.map((t) => {
      if (albumKeyOf(t) !== albumKey) return t;
      const updated = { ...t, ...changes };
      newKey = albumKeyOf(updated);
      return updated;
    }),
  );
  return newKey;
}

export async function updateTrackTitle(trackId: number, title: string): Promise<void> {
  const current = await getDownloadedTracks();
  await persist(current.map((t) => (t.id === trackId ? { ...t, title } : t)));
}

// Moves a song one place up (-1) or down (1) within its album
export async function moveTrack(albumKey: string, trackId: number, step: -1 | 1): Promise<void> {
  const current = await getDownloadedTracks();
  const album = groupTracksIntoAlbums(current).find((a) => a.key === albumKey);
  if (!album) return;
  const from = album.tracks.findIndex((t) => t.id === trackId);
  const to = from + step;
  if (from < 0 || to < 0 || to >= album.tracks.length) return;

  const ordered = [...album.tracks];
  [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
  const position = new Map(ordered.map((t, i) => [t.id, i + 1]));
  await persist(current.map((t) => (position.has(t.id) ? { ...t, order: position.get(t.id) } : t)));
}
