import AsyncStorage from "@react-native-async-storage/async-storage";

export type HistoryItem = {
  id: string | number;
  artistId: string | number;
  urlSlug: string;
  title: string;
  artistName: string;
  coverUri?: string;
  viewedAt: number;
};

const HISTORY_STORAGE_KEY = "mirlo_blue_viewing_history_v1";
const MAX_HISTORY_ITEMS = 20;

// Listeners for realtime update in components
type HistoryListener = (items: HistoryItem[]) => void;
const listeners = new Set<HistoryListener>();

export async function getHistory(): Promise<HistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch (err) {
    console.error("Failed to load viewing history:", err);
    return [];
  }
}

export async function recordHistoryItem(item: {
  id: string | number;
  artistId: string | number;
  urlSlug: string;
  title: string;
  artistName: string;
  coverUri?: string;
}): Promise<void> {
  try {
    const current = await getHistory();

    // Remove any existing entry for the same album slug or ID to prevent duplicates
    const filtered = current.filter(
      (entry) =>
        String(entry.urlSlug) !== String(item.urlSlug) &&
        String(entry.id) !== String(item.id),
    );

    const newItem: HistoryItem = {
      id: item.id,
      artistId: item.artistId,
      urlSlug: item.urlSlug,
      title: item.title,
      artistName: item.artistName,
      coverUri: item.coverUri,
      viewedAt: Date.now(),
    };

    // Prepend latest viewed item
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

export async function clearHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
    listeners.forEach((listener) => listener([]));
  } catch (err) {
    console.error("Failed to clear history:", err);
  }
}
