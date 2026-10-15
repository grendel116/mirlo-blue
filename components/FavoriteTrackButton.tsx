import { Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/state/AuthContext";
import { queryAuthProfile } from "@/queries/authQueries";
import { queryWishlist } from "@/queries/queries";
import * as api from "../queries/fetch/fetchWrapper";
import { ViewStyle } from "react-native";

type FavoriteTrackButton = {
  track: {
    id: number;
    trackGroupId?: number;
  };
  style?: ViewStyle;
  size?: number;
};

// The heart follows the account's favorites, so hearting a whole album fills every track's
// heart. A tap shows right away and gives way to the account data once it refreshes
export default function FavoriteTrackButton({ track, style, size }: FavoriteTrackButton) {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const [tapped, setTapped] = useState<boolean | null>(null);
  useEffect(() => setTapped(null), [user]);

  const isInFavorites =
    tapped ?? !!user?.trackFavorites?.some((w) => w.trackId === track.id);

  const onPress = useCallback(async () => {
    if (!user) return;
    const next = !isInFavorites;
    setTapped(next);
    await api.post(`/v1/tracks/${track.id}/favorite`, { favorite: next });
    const fresh = await queryClient.fetchQuery({ ...queryAuthProfile(), staleTime: 0 });

    // Hearting the last unhearted track on an album adds the album to your wishlist
    const albumId = track.trackGroupId;
    if (!next || !fresh || !albumId) return;
    if (fresh.wishlist?.some((w) => w.trackGroupId === albumId)) return;
    const { result: album } = await api.get<{ result: AlbumProps }>(
      `/v1/trackGroups/${albumId}`,
      {},
    );
    const hearted = new Set(fresh.trackFavorites?.map((f) => f.trackId));
    if (!album.tracks?.length || !album.tracks.every((t) => hearted.has(t.id))) return;
    await api.post(`/v1/trackGroups/${albumId}/wishlist`, { wishlist: true });
    queryClient.invalidateQueries({ queryKey: queryAuthProfile().queryKey });
    queryClient.invalidateQueries({ queryKey: queryWishlist(user.id).queryKey });
  }, [user, isInFavorites, track.id, track.trackGroupId, queryClient]);

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
