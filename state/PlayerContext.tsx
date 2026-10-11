import { incrementPlayCount, reachedMaxPlays } from "@/scripts/trackPlayUtils";
import {
  createContext,
  useState,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  IOSCategory,
  IOSCategoryOptions,
  usePlaybackState,
  useTrackPlayerEvents,
  PlaybackState,
  RepeatMode,
  State,
} from "react-native-track-player";
import { useAuthContext } from "./AuthContext";
import { isTrackOwned, audioTrackType, resolveArtworkUrl } from "@/scripts/utils";
import { API_ROOT } from "@/constants/api-root";
import { API_KEY } from "@/constants/api-key";
import { useRouter } from "expo-router";
import * as api from "../queries/fetch/fetchWrapper";
import { recordHistoryItem } from "@/scripts/historyManager";
import { fetchRecentReleaseTracks } from "@/scripts/autoplay";

// Autoplay tops up Next Up when fewer than this many tracks remain
const AUTOPLAY_THRESHOLD = 2;
const AUTOPLAY_ALBUMS_PER_BATCH = 5;

// The repeat button cycles off → repeat all → repeat one
export type RepeatSetting = "none" | "queue" | "track";
const REPEAT_CYCLE: RepeatSetting[] = ["none", "queue", "track"];
const REPEAT_MODES: Record<RepeatSetting, RepeatMode> = {
  none: RepeatMode.Off,
  queue: RepeatMode.Queue,
  track: RepeatMode.Track,
};

// Fisher-Yates: every order equally likely
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Same track: by Mirlo id when both have one, otherwise by stream URL
function isSameTrack(a: RNTrack, b: RNTrack): boolean {
  if (a.id !== undefined && b.id !== undefined) return a.id === b.id;
  return Boolean(a.url) && a.url === b.url;
}

const setupPlayerOptions = {
  autoHandleInterruptions: true,
  iosCategory: IOSCategory.Playback,
  iosCategoryOptions: [
    IOSCategoryOptions.AllowAirPlay,
    IOSCategoryOptions.AllowBluetoothA2DP,
  ],
};

const updatePlayerOptions = {
  android: {
    appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
  },
  capabilities: [
    Capability.Play,
    Capability.Pause,
    Capability.SkipToNext,
    Capability.SkipToPrevious,
    Capability.SeekTo,
  ],
  compactCapabilities: [
    Capability.Play,
    Capability.Pause,
    Capability.SkipToNext,
    Capability.SkipToPrevious,
  ],
  notificationCapabilities: [
    Capability.Play,
    Capability.Pause,
    Capability.SkipToNext,
    Capability.SkipToPrevious,
    Capability.SeekTo,
  ],
  progressUpdateEventInterval: 2,
};

let playerSetupPromise: Promise<void> | null = null;

function isAlreadyInitializedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.toLowerCase().includes("already") &&
    message.toLowerCase().includes("initial")
  );
}

export async function ensureTrackPlayerInitialized(): Promise<void> {
  if (!playerSetupPromise) {
    playerSetupPromise = (async () => {
      try {
        await TrackPlayer.setupPlayer(setupPlayerOptions);
      } catch (error) {
        if (!isAlreadyInitializedError(error)) {
          throw error;
        }
      }
      await TrackPlayer.updateOptions(updatePlayerOptions);
    })().catch((error) => {
      playerSetupPromise = null;
      throw error;
    });
  }
  return playerSetupPromise;
}

function resolveStreamUrl(rawAudio: string): string {
  if (!rawAudio) return "";
  if (/^(https?|file):\/\//.test(rawAudio)) return rawAudio;
  const path = rawAudio.startsWith("/") ? rawAudio : `/${rawAudio}`;
  if (API_ROOT && API_ROOT !== "/" && path.startsWith(`${API_ROOT}/`)) return path;
  return `${API_ROOT}${path}`;
}

// Prepares any track for the player: absolute stream URL, API key header, artwork, and artist
function toPlayerTrack(
  t: RNTrack,
  fallback: { artwork?: string; artist?: string } = {},
): RNTrack {
  const cover = t.trackGroup?.cover as any;
  const streamUrl = resolveStreamUrl(t.url || t.audio?.url || "");
  const artwork = resolveArtworkUrl(
    t.artwork ||
      cover?.sizes?.[600] ||
      cover?.sizes?.[300] ||
      cover?.sizes?.[120] ||
      (typeof cover === "string" ? cover : cover?.url) ||
      fallback.artwork ||
      "",
  );
  const artist =
    (typeof t.artist === "string" && t.artist) ||
    (t.artist as any)?.name ||
    t.trackArtists?.[0]?.artistName ||
    t.trackGroup?.artist?.name ||
    fallback.artist ||
    "";

  return {
    ...t,
    url: streamUrl,
    headers: t.headers || { "mirlo-api-key": API_KEY },
    type: t.type || audioTrackType(streamUrl),
    artwork,
    artist,
  };
}

export type QueueSection = "queue" | "upcoming";
export type QueueSlot = { section: QueueSection; index: number };

export interface PlayerContextType {
  playbackState: PlaybackState | { state: undefined };
  playableTracks: RNTrack[];
  setPlayableTracks: (tracks: RNTrack[]) => void;
  // Tracks currently loaded in the player, and the name of where they came from
  playingQueue: RNTrack[];
  queueSource: string;
  userQueue: RNTrack[];
  setUserQueue: React.Dispatch<React.SetStateAction<RNTrack[]>>;
  addToQueue: (track: RNTrack) => void;
  removeFromUserQueue: (index: number) => void;
  clearUserQueue: () => void;
  moveQueueItem: (from: QueueSlot, to: QueueSlot) => Promise<void>;
  playFromUserQueue: (index: number) => Promise<void>;
  skipToUpcoming: (index: number) => Promise<void>;
  activeTrack: RNTrack | undefined;
  setActiveTrack: (track: RNTrack) => void;
  shuffled: boolean;
  toggleShuffle: () => Promise<void>;
  isPlaying: boolean;
  looping: RepeatSetting;
  cycleRepeat: () => Promise<void>;
  // Centralized transport actions
  playTrack: (track: RNTrack, albumTracks?: RNTrack[], source?: string) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrevious: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
}

export const PlayerContext = createContext<PlayerContextType | null>(null);

export const PlayerContextProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [shuffled, setShuffled] = useState<boolean>(false);
  const [looping, setLooping] = useState<RepeatSetting>("none");
  const [playableTracks, setPlayableTracks] = useState<RNTrack[]>([]);
  const [playingQueue, setPlayingQueue] = useState<RNTrack[]>([]);
  const [queueSource, setQueueSource] = useState<string>("");
  const [userQueue, setUserQueue] = useState<RNTrack[]>([]);
  const [activeTrack, setActiveTrack] = useState<RNTrack>();
  const [playerState, setPlayerState] = useState<State | undefined>(undefined);
  const playBackState = usePlaybackState();
  const { user } = useAuthContext();
  const router = useRouter();
  const incrementedRef = useRef(false);

  const activeTrackOwnedRef = useRef<boolean>(false);
  const activeTrackIdRef = useRef<number | null>(null);
  const queueGenerationRef = useRef(0);
  const autoplaySkipRef = useRef(0);
  const autoplayFillingRef = useRef(false);
  const [autoplayRecheck, setAutoplayRecheck] = useState(0);
  // The playlist in its own order, so turning shuffle off can put it back
  const playlistOrderRef = useRef<RNTrack[]>([]);

  const addToQueue = useCallback((track: RNTrack) => {
    setUserQueue((prev) => [...prev, track]);
  }, []);

  const removeFromUserQueue = useCallback((index: number) => {
    setUserQueue((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const clearUserQueue = useCallback(() => {
    setUserQueue([]);
  }, []);

  useEffect(() => {
    ensureTrackPlayerInitialized().catch((err) => {
      console.error("Track Player initialization error:", err);
    });
  }, []);

  useEffect(() => {
    activeTrackOwnedRef.current = false;
    activeTrackIdRef.current = null;
  }, [user]);

  useTrackPlayerEvents(
    [
      Event.PlaybackActiveTrackChanged,
      Event.PlaybackState,
      Event.PlaybackProgressUpdated,
      Event.PlaybackQueueEnded,
      Event.PlaybackError,
    ],
    async (event) => {
      if (
        event.type === Event.PlaybackError &&
        event.message?.includes("Track play limit exceeded")
      ) {
        router.push("/maxPlaysReached");
        return;
      }

      if (event.type === Event.PlaybackState) {
        setPlayerState(event.state);
        return;
      }

      if (event.type === Event.PlaybackQueueEnded) {
        return;
      }

      if (event.type === Event.PlaybackActiveTrackChanged) {
        const track = (await TrackPlayer.getActiveTrack()) as RNTrack | undefined;
        if (track) {
          setActiveTrack(track);
          activeTrackOwnedRef.current = isTrackOwned(track);
          activeTrackIdRef.current = track.id ?? null;
          incrementedRef.current = false;
        }
        return;
      }

      if (
        !activeTrackOwnedRef.current &&
        event.type === Event.PlaybackProgressUpdated
      ) {
        const progressRatio = event.duration > 0 ? event.position / event.duration : 0;
        if (progressRatio < 0.05) {
          incrementedRef.current = false;
        }

        if (!incrementedRef.current && progressRatio >= 0.5) {
          incrementedRef.current = true;
          const currentTrack = (await TrackPlayer.getActiveTrack()) as RNTrack | undefined;
          const targetId = activeTrackIdRef.current ?? currentTrack?.id;

          // Issue #67 fix: Strictly guard track ID to ensure it is a valid integer before telemetry
          if (typeof targetId === "number" && Number.isInteger(targetId) && targetId > 0) {
            if (!user && currentTrack?.trackGroup?.artist?.maxFreePlays !== undefined) {
              incrementPlayCount(targetId);
            }
            try {
              await api.get(`/v1/tracks/${targetId}/trackPlay`, {});
            } catch (error) {
              console.error("Failed to record track play:", error);
            }
          }
        }
      }
    },
  );

  const togglePlayPause = useCallback(async () => {
    try {
      await ensureTrackPlayerInitialized();
      const state = playBackState.state;
      if (state === State.Playing || state === State.Buffering) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
    } catch (err) {
      console.error("Toggle playback error:", err);
    }
  }, [playBackState.state]);

  const playTrack = useCallback(
    async (track: RNTrack, albumTracks?: RNTrack[], source?: string) => {
      try {
        await ensureTrackPlayerInitialized();
        const currentActive = (await TrackPlayer.getActiveTrack()) as RNTrack | undefined;

        // If clicking the track that is already playing or paused: toggle play/pause
        const isSameTrack =
          currentActive &&
          ((track.id !== undefined && currentActive.id === track.id) ||
            (track.url && currentActive.url === track.url));

        if (isSameTrack) {
          await togglePlayPause();
          return;
        }

        const queue = (await TrackPlayer.getQueue()) as RNTrack[];
        const isSameAlbum =
          currentActive &&
          Boolean(track.trackGroup?.urlSlug) &&
          currentActive.trackGroup?.urlSlug === track.trackGroup?.urlSlug &&
          queue.length > 0;

        // Only skip within current queue if no fresh custom album/playlist tracks list was provided
        if (isSameAlbum && (!albumTracks || albumTracks.length === 0)) {
          const indexInQueue = queue.findIndex(
            (t) =>
              (track.id !== undefined && t.id === track.id) ||
              (track.url && t.url === track.url)
          );
          if (indexInQueue !== -1) {
            await TrackPlayer.skip(indexInQueue);
            await TrackPlayer.play();
            return;
          }
        }

        const enrichedTrack = toPlayerTrack(track);
        const resolvedArtwork = enrichedTrack.artwork;
        const enrichedArtist = enrichedTrack.artist;

        // New album or new playlist: load fresh queue
        const rawTracks = albumTracks && albumTracks.length > 0 ? albumTracks : [track];
        const playlist = rawTracks.map((t) =>
          toPlayerTrack(t, { artwork: resolvedArtwork, artist: enrichedArtist }),
        );

        // Find the clicked track by id, url, or title
        let targetIndex = rawTracks.findIndex(
          (t) =>
            (track.id !== undefined && t.id === track.id) ||
            (track.url && t.url === track.url) ||
            (track.title && t.title === track.title)
        );
        if (targetIndex === -1) {
          targetIndex = typeof track.queueIndex === "number" ? track.queueIndex : 0;
        }
        targetIndex = Math.min(Math.max(0, targetIndex), playlist.length - 1);

        // Shuffle on: the clicked track plays first, the rest follow in random order
        playlistOrderRef.current = playlist;
        const tracksToLoad = shuffled
          ? [playlist[targetIndex], ...shuffle(playlist.filter((_, i) => i !== targetIndex))]
          : playlist;
        const startIndex = shuffled ? 0 : targetIndex;

        setPlayableTracks(playlist);
        setPlayingQueue(tracksToLoad);
        queueGenerationRef.current += 1;
        autoplaySkipRef.current = 0;
        setQueueSource(source || track.trackGroup?.title || "");
        await TrackPlayer.setQueue(tracksToLoad);
        await TrackPlayer.skip(startIndex);
        await TrackPlayer.play();

        // Record to Viewing History if trackGroup information is available
        if (track.trackGroup) {
          recordHistoryItem({
            id: track.trackGroup.id,
            artistId: track.trackGroup.artistId,
            urlSlug: track.trackGroup.urlSlug,
            title: track.trackGroup.title || track.title,
            artistName: enrichedArtist,
            coverUri: resolvedArtwork,
          });
        }
      } catch (err) {
        console.error("Play track error:", err);
      }
    },
    [togglePlayPause, shuffled],
  );

  // Plays a track from "Your Queue" next, keeping the rest of the current playlist intact
  const playFromUserQueue = useCallback(
    async (index: number) => {
      const queued = userQueue[index];
      if (!queued) return;
      try {
        await ensureTrackPlayerInitialized();
        const next = toPlayerTrack(queued);
        setUserQueue((prev) => prev.filter((_, i) => i !== index));

        const activeIndex = await TrackPlayer.getActiveTrackIndex();
        if (activeIndex === undefined) {
          await playTrack(next, [next], next.trackGroup?.title);
          return;
        }
        const insertAt = activeIndex + 1;
        await TrackPlayer.add(next, insertAt);
        setPlayingQueue((prev) => [...prev.slice(0, insertAt), next, ...prev.slice(insertAt)]);
        await TrackPlayer.skip(insertAt);
        await TrackPlayer.play();
      } catch (err) {
        console.error("Play from queue error:", err);
      }
    },
    [userQueue, playTrack],
  );

  const skipToUpcoming = useCallback(async (index: number) => {
    try {
      await ensureTrackPlayerInitialized();
      const activeIndex = await TrackPlayer.getActiveTrackIndex();
      await TrackPlayer.skip((activeIndex ?? -1) + 1 + index);
      await TrackPlayer.play();
    } catch (err) {
      console.error("Skip to upcoming error:", err);
    }
  }, []);

  // Moves a track within or between "Your Queue" and "Next Up"
  const moveQueueItem = useCallback(
    async (from: QueueSlot, to: QueueSlot) => {
      if (from.section === to.section && from.index === to.index) return;
      try {
        await ensureTrackPlayerInitialized();
        const base = ((await TrackPlayer.getActiveTrackIndex()) ?? -1) + 1;
        let nextUserQueue = [...userQueue];
        let nextPlaying = [...playingQueue];

        let item: RNTrack | undefined;
        if (from.section === "queue") {
          [item] = nextUserQueue.splice(from.index, 1);
        } else {
          [item] = nextPlaying.splice(base + from.index, 1);
          await TrackPlayer.remove(base + from.index);
        }
        if (!item) return;

        if (to.section === "queue") {
          nextUserQueue.splice(to.index, 0, item);
        } else {
          const insertAt = base + to.index;
          const prepared = toPlayerTrack(item);
          nextPlaying.splice(insertAt, 0, prepared);
          if (insertAt < nextPlaying.length - 1) {
            await TrackPlayer.add(prepared, insertAt);
          } else {
            await TrackPlayer.add(prepared);
          }
        }

        setUserQueue(nextUserQueue);
        setPlayingQueue(nextPlaying);
      } catch (err) {
        console.error("Move queue item error:", err);
      }
    },
    [userQueue, playingQueue],
  );

  // Keeps playback going: when Next Up runs low, append previews from recent releases
  useEffect(() => {
    if (looping !== "none" || !activeTrack || activeTrack.liveStation || playingQueue.length === 0) return;
    const activeIndex = playingQueue.findIndex(
      (t) =>
        (activeTrack.id !== undefined && t.id === activeTrack.id) ||
        (activeTrack.url && t.url === activeTrack.url),
    );
    if (activeIndex < 0) return;
    if (playingQueue.length - activeIndex - 1 >= AUTOPLAY_THRESHOLD) return;
    if (autoplayFillingRef.current) return;

    autoplayFillingRef.current = true;
    const generation = queueGenerationRef.current;
    const known = new Set(playingQueue.map((t) => t.id));

    (async () => {
      try {
        // Skip past albums whose previews are all already queued
        let added: RNTrack[] = [];
        for (let attempt = 0; attempt < 3 && added.length === 0; attempt++) {
          const batch = await fetchRecentReleaseTracks(
            autoplaySkipRef.current,
            AUTOPLAY_ALBUMS_PER_BATCH,
          );
          autoplaySkipRef.current += AUTOPLAY_ALBUMS_PER_BATCH;
          if (batch.length === 0) break;
          added = batch.filter((t) => !known.has(t.id)).map((t) => toPlayerTrack(t));
        }
        if (added.length === 0 || generation !== queueGenerationRef.current) return;

        await TrackPlayer.add(added as any);
        setPlayingQueue((prev) => [...prev, ...added]);
      } catch (err) {
        console.error("Autoplay error:", err);
      } finally {
        autoplayFillingRef.current = false;
        if (generation !== queueGenerationRef.current) setAutoplayRecheck((n) => n + 1);
      }
    })();
  }, [activeTrack, playingQueue, looping, autoplayRecheck]);

  // Shuffle reorders what's still coming up. Turning it off puts those tracks back in
  // playlist order; tracks added later (queued or autoplay) keep their place at the end
  const toggleShuffle = useCallback(async () => {
    try {
      await ensureTrackPlayerInitialized();
      const nextShuffled = !shuffled;
      setShuffled(nextShuffled);

      const activeIndex = await TrackPlayer.getActiveTrackIndex();
      if (activeIndex === undefined) return;
      const played = playingQueue.slice(0, activeIndex + 1);
      const upcoming = playingQueue.slice(activeIndex + 1);
      if (upcoming.length < 2) return;

      let reordered: RNTrack[];
      if (nextShuffled) {
        reordered = shuffle(upcoming);
      } else {
        const order = playlistOrderRef.current;
        const position = (t: RNTrack) => {
          const i = order.findIndex((o) => isSameTrack(o, t));
          return i === -1 ? Number.MAX_SAFE_INTEGER : i;
        };
        reordered = [...upcoming].sort((a, b) => position(a) - position(b));
      }

      await TrackPlayer.removeUpcomingTracks();
      await TrackPlayer.add(reordered as any);
      setPlayingQueue([...played, ...reordered]);
    } catch (err) {
      console.error("Shuffle error:", err);
    }
  }, [shuffled, playingQueue]);

  // Repeat cycles off → repeat all → repeat one, using the player's own repeat mode so it
  // also works from the lock screen and when a song ends on its own
  const cycleRepeat = useCallback(async () => {
    const next = REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(looping) + 1) % REPEAT_CYCLE.length];
    try {
      await ensureTrackPlayerInitialized();
      await TrackPlayer.setRepeatMode(REPEAT_MODES[next]);
      setLooping(next);
    } catch (err) {
      console.error("Repeat mode error:", err);
    }
  }, [looping]);

  const skipNext = useCallback(async () => {
    try {
      await ensureTrackPlayerInitialized();
      if (userQueue.length > 0) {
        await playFromUserQueue(0);
        return;
      }
      const queue = await TrackPlayer.getQueue();
      const trackIndex = await TrackPlayer.getActiveTrackIndex();
      if (queue.length === 0 || trackIndex === undefined) return;

      if (trackIndex >= queue.length - 1) {
        await TrackPlayer.skip(0);
      } else {
        await TrackPlayer.skipToNext();
      }
    } catch (err) {
      console.error("Skip next error:", err);
    }
  }, [userQueue, playFromUserQueue]);

  const skipPrevious = useCallback(async () => {
    try {
      await ensureTrackPlayerInitialized();
      const progress = await TrackPlayer.getProgress();
      if (progress.position > 3) {
        await TrackPlayer.seekTo(0);
        return;
      }

      const queue = await TrackPlayer.getQueue();
      const trackIndex = await TrackPlayer.getActiveTrackIndex();
      if (queue.length === 0 || trackIndex === undefined) return;

      if (trackIndex === 0) {
        await TrackPlayer.skip(queue.length - 1);
      } else {
        await TrackPlayer.skipToPrevious();
      }
    } catch (err) {
      console.error("Skip previous error:", err);
    }
  }, []);

  const seekTo = useCallback(async (position: number) => {
    try {
      await ensureTrackPlayerInitialized();
      await TrackPlayer.seekTo(position);
    } catch (err) {
      console.error("Seek error:", err);
    }
  }, []);

  const isPlaying =
    playerState === State.Playing || playBackState.state === State.Playing;

  const value: PlayerContextType = useMemo(
    () => ({
      playbackState: playBackState,
      playableTracks,
      setPlayableTracks,
      playingQueue,
      queueSource,
      userQueue,
      setUserQueue,
      addToQueue,
      removeFromUserQueue,
      clearUserQueue,
      moveQueueItem,
      playFromUserQueue,
      skipToUpcoming,
      activeTrack,
      setActiveTrack,
      shuffled,
      toggleShuffle,
      isPlaying,
      looping,
      cycleRepeat,
      playTrack,
      togglePlayPause,
      skipNext,
      skipPrevious,
      seekTo,
    }),
    [
      playBackState,
      playableTracks,
      playingQueue,
      queueSource,
      userQueue,
      setUserQueue,
      addToQueue,
      removeFromUserQueue,
      clearUserQueue,
      moveQueueItem,
      playFromUserQueue,
      skipToUpcoming,
      activeTrack,
      shuffled,
      toggleShuffle,
      isPlaying,
      looping,
      cycleRepeat,
      playTrack,
      togglePlayPause,
      skipNext,
      skipPrevious,
      seekTo,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
};

export const usePlayer = (): PlayerContextType => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerContextProvider");
  }
  return context;
};
