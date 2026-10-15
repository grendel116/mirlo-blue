import { Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useState } from "react";
import { useAuthContext } from "@/state/AuthContext";
import * as api from "../queries/fetch/fetchWrapper";
import { ViewStyle } from "react-native";

type FavoriteTrackButton = {
  track: {
    id: number;
  };
  style?: ViewStyle;
  size?: number;
};

// The heart follows the account's favorites, so hearting a whole album fills every track's
// heart. A tap shows right away and gives way to the account data once it refreshes
export default function FavoriteTrackButton({ track, style, size }: FavoriteTrackButton) {
  const { user, refreshLoggedInUser } = useAuthContext();
  const [tapped, setTapped] = useState<boolean | null>(null);
  useEffect(() => setTapped(null), [user]);

  const isInFavorites =
    tapped ?? !!user?.trackFavorites?.some((w) => w.trackId === track.id);

  const onPress = useCallback(async () => {
    if (!user) return;
    const next = !isInFavorites;
    setTapped(next);
    await api.post(`/v1/tracks/${track.id}/favorite`, { favorite: next });
    refreshLoggedInUser();
  }, [user, isInFavorites, track.id, refreshLoggedInUser]);

  if (!user) {
    return null;
  }

  return (
    <Pressable onPress={onPress} style={style}>
      <Ionicons
        name={isInFavorites ? "heart" : "heart-outline"}
        color={isInFavorites ? "#BE3455" : "#ababab"}
        size={size}
      />
    </Pressable>
  );
}
