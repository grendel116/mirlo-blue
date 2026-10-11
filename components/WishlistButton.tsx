import { Pressable, Text, View, ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useState } from "react";
import { useAuthContext } from "@/state/AuthContext";
import { useTranslation } from "react-i18next";
import * as api from "../queries/fetch/fetchWrapper";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

type WishlistButton = {
  trackGroup: {
    id: number;
    tracks?: RNTrack[];
  };
  style?: ViewStyle;
  size?: number;
};

export default function WishlistButton({
  trackGroup,
  style,
  size,
}: WishlistButton) {
  const { user, refreshLoggedInUser } = useAuthContext();
  const queryClient = useQueryClient();
  // Follows the account's wishlist and track hearts; a tap shows right away until the account data refreshes
  const [tapped, setTapped] = useState<boolean | null>(null);
  useEffect(() => setTapped(null), [user]);
  const isWishlisted = !!user?.wishlist?.some((w) => w.trackGroupId === trackGroup.id);
  const allTracksHearted =
    !!trackGroup.tracks?.length &&
    trackGroup.tracks.every((t) => user?.trackFavorites?.some((f) => f.trackId === t.id));
  const isInWishlist = tapped ?? (isWishlisted || allTracksHearted);
  const router = useRouter();

  const onPress = useCallback(async () => {
    if (!user) {
      router.push({
        pathname: "/emailVerificationModal",
      });
      return null;
    }

    const nextState = !isInWishlist;
    setTapped(nextState);

    try {
      await api.post(`/v1/trackGroups/${trackGroup.id}/wishlist`, {
        wishlist: nextState,
      });

      // If liking the album, also automatically like all album tracks
      if (trackGroup.tracks && Array.isArray(trackGroup.tracks)) {
        await Promise.allSettled(
          trackGroup.tracks.map((t) =>
            api.post(`/v1/tracks/${t.id}/favorite`, {
              favorite: nextState,
            }),
          ),
        );
      }
    } catch (err) {
      console.error("Failed to update wishlist / track favorites:", err);
    }

    queryClient.invalidateQueries({
      queryKey: ["fetchWishlist", { userId: user.id }],
    });
    refreshLoggedInUser();
  }, [isInWishlist, trackGroup, user, queryClient, refreshLoggedInUser, router]);

  return (
    <Pressable onPress={onPress} style={style}>
      <Ionicons
        name={isInWishlist ? "heart" : "heart-outline"}
        color={isInWishlist ? "#BE3455": "#ababab"}
        size={size}
      />
    </Pressable>
  );
}
