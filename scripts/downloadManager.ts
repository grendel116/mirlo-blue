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
  downloadedAt: number;
  source: "mirlo" | "file";
  order?: number;
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

function publish(next: DownloadedTrack[]) {
  downloads = next;
  listeners.forEach((listener) => {
    try {
      listener(next);
    } catch {}
  });
}

async function persist(next: DownloadedTrack[]) {
  downloads = next;
  isLoaded = true;
  await AsyncStorage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(next));
  publish(next);
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

export async function forgetDownloadedTrack(trackId: number): Promise<void> {
  const current = await getDownloadedTracks();
  await persist(current.filter((t) => t.id !== trackId));
}

export async function forgetDownloadedTracks(trackIds: number[]): Promise<void> {
  const idSet = new Set(trackIds);
  const current = await getDownloadedTracks();
  await persist(current.filter((t) => !idSet.has(t.id)));
}

export async function updateDownloadedTrack(
  trackId: number,
  updates: Partial<DownloadedTrack>,
): Promise<void> {
  const current = await getDownloadedTracks();
  await persist(current.map((t) => (t.id === trackId ? { ...t, ...updates } : t)));
}

export async function updateDownloadedTracks(
  filter: (t: DownloadedTrack) => boolean,
  updates: Partial<DownloadedTrack>,
): Promise<void> {
  const current = await getDownloadedTracks();
  await persist(current.map((t) => (filter(t) ? { ...t, ...updates } : t)));
}

export function subscribeDownloads(listener: DownloadListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
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
  } as RNTrack;
}

// Group of downloaded songs belonging to the same album
export type DownloadedAlbum = {
  key: string;
  title: string;
  artist: string;
  artwork?: string;
  tracks: DownloadedTrack[];
  totalBytes: number;
  downloadedAt: number;
  source: "mirlo" | "file";
};

export function albumKeyOf(track: DownloadedTrack): string {
  if (track.folder) return track.folder;
  const normalized = (track.albumTitle || "Imported Audio").trim().toLowerCase();
  return `album:${normalized}`;
}

// Groups downloaded tracks by album, sorting newest albums first
export function groupTracksIntoAlbums(tracks: DownloadedTrack[]): DownloadedAlbum[] {
  const map = new Map<string, DownloadedAlbum>();

  for (const track of tracks) {
    const key = albumKeyOf(track);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        title: track.albumTitle || "Imported Audio",
        artist: track.artist || "Unknown Artist",
        artwork: track.artwork,
        tracks: [track],
        totalBytes: track.bytes || 0,
        downloadedAt: track.downloadedAt,
        source: track.source,
      });
    } else {
      existing.tracks.push(track);
      existing.totalBytes += track.bytes || 0;
      if (!existing.artwork && track.artwork) {
        existing.artwork = track.artwork;
      }
      if (track.downloadedAt > existing.downloadedAt) {
        existing.downloadedAt = track.downloadedAt;
      }
      if ((existing.artist === "Unknown Artist" || !existing.artist) && track.artist) {
        existing.artist = track.artist;
      }
    }
  }

  return Array.from(map.values())
    .map((album) => ({
      ...album,
      tracks: [...album.tracks].sort((a, b) => (a.order || 0) - (b.order || 0) || a.id - b.id),
    }))
    .sort((a, b) => b.downloadedAt - a.downloadedAt);
}

// Updates cover art for every track in an album
export async function updateAlbumArtwork(albumKey: string, artworkUri: string): Promise<void> {
  const current = await getDownloadedTracks();
  const next = current.map((t) => (albumKeyOf(t) === albumKey ? { ...t, artwork: artworkUri } : t));
  await persist(next);
}

// Updates album title and artist for every track in an album
export async function updateAlbumMetadata(
  albumKey: string,
  updates: { title?: string; artist?: string },
): Promise<void> {
  const current = await getDownloadedTracks();
  const next = current.map((t) => {
    if (albumKeyOf(t) !== albumKey) return t;
    return {
      ...t,
      albumTitle: updates.title !== undefined ? updates.title : t.albumTitle,
      artist: updates.artist !== undefined ? updates.artist : t.artist,
    };
  });
  await persist(next);
}
