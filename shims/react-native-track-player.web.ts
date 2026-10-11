import Hls from "hls.js/dist/hls.min.js";

export enum State {
  None = "none",
  Ready = "ready",
  Playing = "playing",
  Paused = "paused",
  Stopped = "stopped",
  Loading = "loading",
  Buffering = "buffering",
  Error = "error",
  Ended = "ended",
}

export enum Event {
  PlayerError = "player-error",
  PlaybackState = "playback-state",
  PlaybackError = "playback-error",
  PlaybackQueueEnded = "playback-queue-ended",
  PlaybackActiveTrackChanged = "playback-active-track-changed",
  PlaybackPlayWhenReadyChanged = "playback-play-when-ready-changed",
  PlaybackProgressUpdated = "playback-progress-updated",
  RemotePlay = "remote-play",
  RemotePause = "remote-pause",
  RemoteStop = "remote-stop",
  RemoteNext = "remote-next",
  RemotePrevious = "remote-previous",
  RemoteSeek = "remote-seek",
  RemoteDuck = "remote-duck",
}

export enum Capability {
  Play,
  Pause,
  Stop,
  SeekTo,
  Skip,
  SkipToNext,
  SkipToPrevious,
}

export enum IOSCategory {
  Playback = "playback",
}

export enum IOSCategoryOptions {
  AllowAirPlay = "allowAirPlay",
  AllowBluetoothA2DP = "allowBluetoothA2DP",
}

export enum AppKilledPlaybackBehavior {
  ContinuePlayback = "continue-playback",
}

export enum RepeatMode {
  Off,
  Track,
  Queue,
}

export type PlaybackState = { state: State };

let queue: any[] = [];
let activeIndex = 0;
let currentState: State = State.None;
let repeatMode: RepeatMode = RepeatMode.Off;
const listeners = new Set<(event: any) => void>();
let audioElement: HTMLAudioElement | null = null;
let hlsInstance: Hls | null = null;

function emit(type: Event, data: any = {}) {
  listeners.forEach((listener) => {
    try {
      listener({ type, ...data });
    } catch {}
  });
}

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audioElement) {
    audioElement = new Audio();
    audioElement.addEventListener("play", () => {
      currentState = State.Playing;
      emit(Event.PlaybackState, { state: State.Playing });
    });
    audioElement.addEventListener("pause", () => {
      currentState = State.Paused;
      emit(Event.PlaybackState, { state: State.Paused });
    });
    audioElement.addEventListener("ended", () => {
      if (repeatMode === RepeatMode.Track && audioElement) {
        audioElement.currentTime = 0;
        audioElement.play().catch(() => {});
      } else if (activeIndex < queue.length - 1) {
        TrackPlayer.skipToNext();
      } else if (repeatMode === RepeatMode.Queue && queue.length > 0) {
        TrackPlayer.skip(0);
      } else {
        currentState = State.Ended;
        emit(Event.PlaybackQueueEnded);
      }
    });
    audioElement.addEventListener("timeupdate", () => {
      if (audioElement) {
        emit(Event.PlaybackProgressUpdated, {
          position: audioElement.currentTime,
          duration: audioElement.duration || 0,
        });
      }
    });
  }
  return audioElement;
}

function loadAudioSource(audio: HTMLAudioElement, url: string) {
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  const isHls = url.includes(".m3u8");

  if (isHls) {
    if (Hls.isSupported()) {
      hlsInstance = new Hls({
        enableWorker: true,
      });
      hlsInstance.loadSource(url);
      hlsInstance.attachMedia(audio);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        audio.play().catch(() => {});
      });
      hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hlsInstance?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hlsInstance?.recoverMediaError();
              break;
            default:
              hlsInstance?.destroy();
              hlsInstance = null;
              // Fallback to native audio element if HLS fails
              audio.src = url;
              audio.play().catch(() => {});
              break;
          }
        }
      });
      return;
    } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
      audio.src = url;
      audio.play().catch(() => {});
      return;
    }
  }

  audio.src = url;
  audio.play().catch(() => {});
}

const TrackPlayer = {
  setupPlayer: async () => {
    currentState = State.Ready;
    return undefined;
  },
  updateOptions: async () => undefined,
  registerPlaybackService: () => {},
  addEventListener: (event: Event, listener: (data: any) => void) => {
    listeners.add(listener);
    return { remove: () => listeners.delete(listener) };
  },
  setQueue: async (newQueue: any[]) => {
    queue = [...newQueue];
    activeIndex = 0;
    return undefined;
  },
  getQueue: async () => [...queue],
  getActiveTrack: async () => (queue.length > 0 ? queue[activeIndex] : undefined),
  getActiveTrackIndex: async () => (queue.length > 0 ? activeIndex : undefined),
  add: async (tracks: any[] | any, insertBeforeIndex?: number) => {
    const items = Array.isArray(tracks) ? tracks : [tracks];
    if (
      typeof insertBeforeIndex === "number" &&
      insertBeforeIndex >= 0 &&
      insertBeforeIndex < queue.length
    ) {
      queue.splice(insertBeforeIndex, 0, ...items);
      if (insertBeforeIndex <= activeIndex) activeIndex += items.length;
    } else {
      queue.push(...items);
    }
    return undefined;
  },
  remove: async (indexes: number | number[]) => {
    const list = (Array.isArray(indexes) ? indexes : [indexes]).sort((a, b) => b - a);
    for (const index of list) {
      if (index < 0 || index >= queue.length || index === activeIndex) continue;
      queue.splice(index, 1);
      if (index < activeIndex) activeIndex -= 1;
    }
    return undefined;
  },
  move: async (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || fromIndex >= queue.length) return undefined;
    const activeTrack = queue[activeIndex];
    const [item] = queue.splice(fromIndex, 1);
    queue.splice(Math.min(Math.max(toIndex, 0), queue.length), 0, item);
    activeIndex = queue.indexOf(activeTrack);
    return undefined;
  },
  removeUpcomingTracks: async () => {
    queue = queue.slice(0, activeIndex + 1);
    return undefined;
  },
  skip: async (index: number) => {
    if (index >= 0 && index < queue.length) {
      activeIndex = index;
      emit(Event.PlaybackActiveTrackChanged, { track: queue[activeIndex], index });
      const track = queue[activeIndex];
      const audio = getAudio();
      if (audio && track?.url) {
        loadAudioSource(audio, track.url);
      }
    }
    return undefined;
  },
  skipToNext: async () => {
    if (activeIndex < queue.length - 1) {
      await TrackPlayer.skip(activeIndex + 1);
    }
    return undefined;
  },
  skipToPrevious: async () => {
    if (activeIndex > 0) {
      await TrackPlayer.skip(activeIndex - 1);
    }
    return undefined;
  },
  play: async () => {
    const audio = getAudio();
    if (audio) {
      if (hlsInstance) {
        hlsInstance.startLoad();
        await audio.play().catch(() => {});
      } else if (!audio.src && queue[activeIndex]?.url) {
        loadAudioSource(audio, queue[activeIndex].url);
      } else {
        await audio.play().catch(() => {});
      }
    }
    currentState = State.Playing;
    emit(Event.PlaybackState, { state: State.Playing });
  },
  pause: async () => {
    const audio = getAudio();
    if (audio) audio.pause();
    currentState = State.Paused;
    emit(Event.PlaybackState, { state: State.Paused });
  },
  stop: async () => {
    if (hlsInstance) {
      hlsInstance.stopLoad();
    }
    const audio = getAudio();
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    currentState = State.Stopped;
    emit(Event.PlaybackState, { state: State.Stopped });
  },
  seekTo: async (position: number) => {
    const audio = getAudio();
    if (audio) audio.currentTime = position;
  },
  getProgress: async () => {
    const audio = getAudio();
    return {
      position: audio?.currentTime || 0,
      duration: audio?.duration || 0,
      buffered: 0,
    };
  },
  setRepeatMode: async (mode: RepeatMode) => {
    repeatMode = mode;
  },
  getRepeatMode: async () => repeatMode,
};

export default TrackPlayer;

export function usePlaybackState(): PlaybackState {
  return { state: currentState };
}

import React, { useState, useEffect, useRef } from "react";

export function useProgress(updateInterval: number = 250) {
  const [progress, setProgress] = useState({
    position: 0,
    duration: 0,
    buffered: 0,
  });

  useEffect(() => {
    const audio = getAudio();
    if (!audio) return;

    const update = () => {
      setProgress({
        position: audio.currentTime || 0,
        duration: audio.duration || 0,
        buffered: 0,
      });
    };

    update();
    audio.addEventListener("timeupdate", update);
    audio.addEventListener("loadedmetadata", update);
    audio.addEventListener("durationchange", update);
    audio.addEventListener("seeking", update);
    audio.addEventListener("seeked", update);

    const intervalId = setInterval(update, updateInterval);

    return () => {
      audio.removeEventListener("timeupdate", update);
      audio.removeEventListener("loadedmetadata", update);
      audio.removeEventListener("durationchange", update);
      audio.removeEventListener("seeking", update);
      audio.removeEventListener("seeked", update);
      clearInterval(intervalId);
    };
  }, [updateInterval]);

  return progress;
}

export function useTrackPlayerEvents(events: Event[], handler: (event: any) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const eventsKey = events.join("|");

  useEffect(() => {
    const listener = (e: any) => {
      if (events.includes(e.type)) handlerRef.current(e);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsKey]);
}
