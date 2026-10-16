import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

// Liked radio stations live on the phone: stations aren't Mirlo tracks, so the account's
// favorites can't hold them

export type StationLike = { stationId: string; likedAt: number };

const STORAGE_KEY = "mirlo_blue_station_likes_v1";

let likes: StationLike[] = [];
let isLoaded = false;
let loaded: Promise<void> | null = null;
const listeners = new Set<(likes: StationLike[]) => void>();

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
      console.error("Failed to load station likes:", err);
    });
  return loaded;
}

export async function toggleStationLike(stationId: string): Promise<void> {
  await load();
  likes = likes.some((like) => like.stationId === stationId)
    ? likes.filter((like) => like.stationId !== stationId)
    : [{ stationId, likedAt: Date.now() }, ...likes];
  listeners.forEach((listener) => listener(likes));
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(likes));
  } catch (err) {
    console.error("Failed to save station likes:", err);
  }
}

export function useStationLikes(): StationLike[] {
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
