const PLAY_COUNTS_KEY = "mirlo_blue_play_counts_v1";

function getStorage() {
  try {
    return require("@react-native-async-storage/async-storage").default;
  } catch {
    return null;
  }
}

// In-memory cache for synchronous entitlement evaluations
let playCountsCache: Record<number, number> | null = null;
type PlayCountsListener = (counts: Record<number, number>) => void;
const listeners = new Set<PlayCountsListener>();

/**
 * Loads the consolidated dictionary of track play counts from storage.
 */
export async function getTrackPlayCounts(): Promise<Record<number, number>> {
  if (playCountsCache !== null) return playCountsCache;
  try {
    const storage = getStorage();
    const raw = storage ? await storage.getItem(PLAY_COUNTS_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        playCountsCache = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.error("Failed to load play counts:", err);
  }
  const emptyCounts: Record<number, number> = {};
  playCountsCache = emptyCounts;
  return emptyCounts;
}

/**
 * Synchronous check for current play count of a track from memory cache.
 */
export function getTrackPlaysSync(trackId: number): number {
  return playCountsCache?.[trackId] ?? 0;
}

/**
 * Persists the consolidated play counts dictionary.
 */
async function persistPlayCounts(next: Record<number, number>): Promise<void> {
  playCountsCache = next;
  try {
    const storage = getStorage();
    if (storage) {
      await storage.setItem(PLAY_COUNTS_KEY, JSON.stringify(next));
    }
  } catch (err) {
    console.error("Failed to persist play counts:", err);
  }
  listeners.forEach((listener) => {
    try {
      listener(next);
    } catch (e) {
      console.error("Play counts listener error:", e);
    }
  });
}

/**
 * Retrieves the play count for an individual track.
 */
export async function getTrackPlays(trackId: number): Promise<number> {
  const counts = await getTrackPlayCounts();
  return counts[trackId] ?? 0;
}

/**
 * Records a played track, incrementing its play count in persistent storage.
 */
export async function recordTrackPlay(trackId: number, maxFreePlays?: number): Promise<number> {
  const counts = await getTrackPlayCounts();
  const current = counts[trackId] ?? 0;
  const updated = current + 1;
  const isExhausted = maxFreePlays !== undefined && maxFreePlays !== null && updated >= maxFreePlays;
  const next = { ...counts, [trackId]: isExhausted ? Number.MAX_SAFE_INTEGER : updated };
  await persistPlayCounts(next);
  return updated;
}

/**
 * Explicitly marks a track's preview plays as exhausted (e.g. on HTTP 402 Payment Required).
 */
export async function markTrackExhausted(trackId: number): Promise<void> {
  const counts = await getTrackPlayCounts();
  const next = { ...counts, [trackId]: Number.MAX_SAFE_INTEGER };
  await persistPlayCounts(next);
}

/**
 * Determines whether a track has reached its free preview threshold.
 */
export async function isPlaybackLimitReached(
  trackId: number,
  maxFreePlays?: number,
): Promise<boolean> {
  if (isTrackDisabledSync(trackId)) return true;
  if (maxFreePlays === undefined || maxFreePlays === null) {
    return false;
  }
  const plays = await getTrackPlays(trackId);
  const reached = plays >= maxFreePlays;
  if (reached) {
    await markTrackExhausted(trackId);
  }
  return reached;
}

/**
 * Clears all recorded play counts and limits.
 */
export async function clearPlayCounts(): Promise<void> {
  await persistPlayCounts({});
  try {
    const storage = getStorage();
    if (storage) {
      await storage.removeItem(PLAY_COUNTS_KEY);
    }
  } catch (err) {
    console.error("Failed to clear play counts:", err);
  }
}

/**
 * Subscribes to updates in play counts.
 */
export function subscribePlayCounts(listener: PlayCountsListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Backward-compatible adapters
export async function getDisabledTrackIds(): Promise<Set<number>> {
  const counts = await getTrackPlayCounts();
  const disabled = new Set<number>();
  for (const [id, count] of Object.entries(counts)) {
    if (count >= Number.MAX_SAFE_INTEGER) {
      disabled.add(Number(id));
    }
  }
  return disabled;
}

export function isTrackDisabledSync(trackId: number): boolean {
  return (playCountsCache?.[trackId] ?? 0) >= Number.MAX_SAFE_INTEGER;
}

export async function markTrackDisabled(trackId: number): Promise<void> {
  await markTrackExhausted(trackId);
}

export async function clearDisabledTracks(): Promise<void> {
  await clearPlayCounts();
}

export function subscribeDisabledTracks(listener: (disabled: Set<number>) => void): () => void {
  return subscribePlayCounts(async () => {
    const set = await getDisabledTrackIds();
    listener(set);
  });
}

export async function reachedMaxPlays(
  trackId: number,
  maxFreePlays?: number,
): Promise<boolean | undefined> {
  return isPlaybackLimitReached(trackId, maxFreePlays);
}

export async function incrementPlayCount(trackId: number, maxFreePlays?: number): Promise<void> {
  await recordTrackPlay(trackId, maxFreePlays);
}
