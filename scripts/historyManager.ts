import AsyncStorage from "@react-native-async-storage/async-storage";

// An album on Mirlo, opened by its artist and slug
type MirloAlbumEntry = {
  id: string | number;
  artistId: string | number;
  urlSlug: string;
  title: string;
  artistName: string;
  coverUri?: string;
  downloadAlbum?: undefined;
};

// An album saved on this phone, opened in Library > Downloads by its album key
type SavedAlbumEntry = {
  downloadAlbum: string;
  title: string;
  artistName: string;
  coverUri?: string;
  id?: undefined;
  artistId?: undefined;
  urlSlug?: undefined;
};

export type HistoryEntry = MirloAlbumEntry | SavedAlbumEntry;
export type HistoryItem = HistoryEntry & { viewedAt: number };

const HISTORY_STORAGE_KEY = "mirlo_blue_viewing_history_v1";
const MAX_HISTORY_ITEMS = 20;

// Listeners for realtime update in components
type HistoryListener = (items: HistoryItem[]) => void;
const listeners = new Set<HistoryListener>();

// The same album seen again replaces its earlier entry
function entryKey(entry: HistoryEntry): string {
  return entry.downloadAlbum ? `saved:${entry.downloadAlbum}` : `mirlo:${entry.id}`;
}

// Every entry opens something: a Mirlo album page or a saved album
function opensAlbum(entry: HistoryEntry): boolean {
  return Boolean(entry.downloadAlbum || entry.urlSlug);
}

export async function getHistory(): Promise<HistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(opensAlbum);
    return [];
  } catch (err) {
    console.error("Failed to load viewing history:", err);
    return [];
  }
}

export async function recordHistoryItem(entry: HistoryEntry): Promise<void> {
  try {
    const current = await getHistory();
    const key = entryKey(entry);
    const filtered = current.filter((item) => entryKey(item) !== key);

    // Prepend latest viewed item
    const newItem = { ...entry, viewedAt: Date.now() } as HistoryItem;
    const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));

    // Notify listeners
    listeners.forEach((listener) => {
      try {
        listener(updated);
      } catch (e) {
        console.error("History listener error:", e);
      }
    });
  } catch (err) {
    console.error("Failed to record viewing history:", err);
  }
}

export function subscribeHistory(listener: HistoryListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function removeHistoryItems(predicate: (item: HistoryItem) => boolean): Promise<void> {
  try {
    const current = await getHistory();
    const updated = current.filter((item) => !predicate(item));
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    listeners.forEach((listener) => {
      try {
        listener(updated);
      } catch (e) {
        console.error("History listener error:", e);
      }
    });
  } catch (err) {
    console.error("Failed to remove history items:", err);
  }
}

export async function clearHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
    listeners.forEach((listener) => listener([]));
  } catch (err) {
    console.error("Failed to clear history:", err);
  }
}
