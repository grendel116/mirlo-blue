import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

// Liked podcast episodes live on the phone: episodes aren't Mirlo tracks,
// so local storage holds their favorited state.

export type PodcastEpisodeLike = {
  episodeId: string;
  showId: string;
  title: string;
  artist: string;
  url: string;
  artwork?: string;
  duration?: number;
  pubDate?: string;
  likedAt: number;
};

const STORAGE_KEY = "mirlo_blue_podcast_episode_likes_v1";

let likes: PodcastEpisodeLike[] = [];
let isLoaded = false;
let loaded: Promise<void> | null = null;
const listeners = new Set<(likes: PodcastEpisodeLike[]) => void>();

function load(): Promise<void> {
  loaded ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      const parsed = raw ? JSON.parse(raw) : [];
      likes = Array.isArray(parsed) ? parsed : [];
      isLoaded = true;
      listeners.forEach((listener) => listener(likes));
    })
    .catch((err) => {
      isLoaded = true;
      console.error("Failed to load podcast episode likes:", err);
    });
  return loaded;
}

export async function togglePodcastEpisodeLike(item: {
  podcastEpisodeId: string;
  podcastId?: string;
  title?: string;
  artist?: string;
  url?: string;
  artwork?: string;
  duration?: number;
  pubDate?: string;
}): Promise<void> {
  await load();
  const exists = likes.some((l) => l.episodeId === item.podcastEpisodeId);
  if (exists) {
    likes = likes.filter((l) => l.episodeId !== item.podcastEpisodeId);
  } else {
    likes = [
      {
        episodeId: item.podcastEpisodeId,
        showId: item.podcastId || "",
        title: item.title || "Episode",
        artist: item.artist || "Podcast",
        url: item.url || "",
        artwork: item.artwork || "",
        duration: item.duration || 0,
        pubDate: item.pubDate || "",
        likedAt: Date.now(),
      },
      ...likes,
    ];
  }
  listeners.forEach((listener) => listener(likes));
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(likes));
  } catch (err) {
    console.error("Failed to save podcast episode likes:", err);
  }
}

export function usePodcastEpisodeLikes(): PodcastEpisodeLike[] {
  const [current, setCurrent] = useState(likes);
  useEffect(() => {
    listeners.add(setCurrent);
    if (isLoaded) {
      setCurrent((prev) => (prev === likes ? prev : likes));
    } else {
      load();
    }
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);
  return current;
}
