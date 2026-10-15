const LISTENER_ID_STORAGE_KEY = "social_music_listener_userid";

let cachedListenerId: string | null = null;

function generateRandomId(): string {
  // Simple UUID v4 generator without heavy external dependencies
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getStorage() {
  try {
    return require("@react-native-async-storage/async-storage").default;
  } catch {
    return null;
  }
}

/**
 * Returns a stable, anonymous listener ID for Mirlo authorized streaming.
 * Stored locally in AsyncStorage to keep sessions coherent across playback requests.
 */
export async function getOrCreateListenerUserId(): Promise<string> {
  if (cachedListenerId) return cachedListenerId;

  try {
    const storage = getStorage();
    if (storage) {
      const existing = await storage.getItem(LISTENER_ID_STORAGE_KEY);
      if (existing && existing.trim()) {
        const storedId = existing.trim();
        cachedListenerId = storedId;
        return storedId;
      }

      const generated = generateRandomId();
      await storage.setItem(LISTENER_ID_STORAGE_KEY, generated);
      cachedListenerId = generated;
      return generated;
    }
  } catch {
    // Fall back to memory cache
  }

  if (!cachedListenerId) {
    const generated = generateRandomId();
    cachedListenerId = generated;
    return generated;
  }
  return cachedListenerId;
}

/**
 * Synchronous getter returning the in-memory cached ID if already initialized,
 * or a transient fallback if AsyncStorage has not yet resolved.
 */
export function getListenerUserIdSync(): string {
  if (!cachedListenerId) {
    cachedListenerId = generateRandomId();
  }
  return cachedListenerId;
}
