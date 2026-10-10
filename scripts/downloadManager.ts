import AsyncStorage from "@react-native-async-storage/async-storage";

export type DownloadedTrack = {
  id: number;
  title: string;
  artist: string;
  albumTitle?: string;
  artwork?: string;
  url: string; // local file uri or cached audio stream
  duration?: number;
  downloadedAt: number;
  fileSize?: string;
};

const DOWNLOADS_STORAGE_KEY = "mirlo_blue_downloaded_tracks_v1";

type DownloadListener = (tracks: DownloadedTrack[]) => void;
const listeners = new Set<DownloadListener>();

export async function getDownloadedTracks(): Promise<DownloadedTrack[]> {
  try {
    const raw = await AsyncStorage.getItem(DOWNLOADS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch (err) {
    console.error("Failed to load downloads:", err);
    return [];
  }
}

export async function saveDownloadedTrack(track: DownloadedTrack): Promise<void> {
  try {
    const current = await getDownloadedTracks();
    const existingIndex = current.findIndex((t) => t.id === track.id);
    let updated: DownloadedTrack[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = track;
    } else {
      updated = [track, ...current];
    }
    await AsyncStorage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(updated));
    listeners.forEach((listener) => {
      try {
        listener(updated);
      } catch {}
    });
  } catch (err) {
    console.error("Failed to save downloaded track:", err);
  }
}

export async function removeDownloadedTrack(trackId: number): Promise<void> {
  try {
    const current = await getDownloadedTracks();
    const updated = current.filter((t) => t.id !== trackId);
    await AsyncStorage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(updated));
    listeners.forEach((listener) => {
      try {
        listener(updated);
      } catch {}
    });
  } catch (err) {
    console.error("Failed to remove downloaded track:", err);
  }
}

export function subscribeDownloads(listener: DownloadListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
