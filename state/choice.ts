import { useSyncExternalStore } from "react";
import type { AlertButton } from "react-native";

// The choice the phone is showing, if any. askChoice sets it; ChoiceSheet draws it
export type Choice = { title: string; message?: string; buttons: AlertButton[] };

let current: Choice | null = null;
const listeners = new Set<() => void>();

export function showChoice(next: Choice | null): void {
  current = next;
  listeners.forEach((listener) => listener());
}

export function useChoice(): Choice | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => current,
  );
}
