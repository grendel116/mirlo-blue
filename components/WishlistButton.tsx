import { Pressable, ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useState } from "react";
import { useAuthContext } from "@/state/AuthContext";
import * as api from "../queries/fetch/fetchWrapper";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { AUTH_PROFILE_QUERY_KEY } from "@/queries/authQueries";
import { queryWishlist } from "@/queries/queries";
import {
  isFaircampAlbum,
  toggleFaircampAlbumWishlist,
  useFaircampSaves,
} from "@/scripts/faircampSaves";

type WishlistButtonProps = {
  trackGroup: {
    id: number;
    source?: string;
    urlSlug?: string;
    tracks?: RNTrack[];
    [key: string]: any;
  };
  displayedTracks?: RNTrack[];
  style?: ViewStyle;
  size?: number;
};

export default function WishlistButton({
  trackGroup,
  displayedTracks,
  style,
  size,
}: WishlistButtonProps) {
  if (isFaircampAlbum(trackGroup)) {
    return (
      <FaircampWishlistButton
        trackGroup={trackGroup}
        displayedTracks={displayedTracks}
        style={style}
        size={size}
      />
    );
  }
  return (
    <MirloWishlistButton
      trackGroup={trackGroup}
      displayedTracks={displayedTracks}
      style={style}
      size={size}
    />
  );
}

function FaircampWishlistButton({
  trackGroup,
  displayedTracks,
  style,
  size,
}: WishlistButtonProps) {
  const { albums } = useFaircampSaves();
  const isInWishlist = albums.some(
    (saved) => saved.album.urlSlug === trackGroup.urlSlug,
  );
  const tracks =
    displayedTracks && displayedTracks.length > 0
      ? displayedTracks
      : trackGroup.tracks || [];

  return (
    <Pressable
      onPress={() =>
        toggleFaircampAlbumWishlist(trackGroup as AlbumProps, tracks)
      }
      style={style}
      accessibilityRole="button"
      accessibilityLabel={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Ionicons
        name={isInWishlist ? "heart" : "heart-outline"}
        color={isInWishlist ? "#BE3455" : "#ababab"}
        size={size}
      />
    </Pressable>
  );
}

function MirloWishlistButton({
  trackGroup,
  displayedTracks,
  style,
  size,
}: WishlistButtonProps) {
  const { user, refreshLoggedInUser } = useAuthContext();
  const queryClient = useQueryClient();
  // Follows the account's wishlist; a tap shows right away until the account data refreshes
  const [tapped, setTapped] = useState<boolean | null>(null);
  useEffect(() => setTapped(null), [user]);
  const isInWishlist =
    tapped ?? !!user?.wishlist?.some((w) => w.trackGroupId === trackGroup.id);
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

    // Only target displayed tracks that are valid (or trackGroup.tracks as fallback)
    const rawTracks =
      displayedTracks && displayedTracks.length > 0
        ? displayedTracks
        : trackGroup.tracks || [];
    const targetTracks = rawTracks.filter(
      (t) => t && typeof t.id === "number" && t.id > 0,
    );
    const targetTrackIds = new Set(targetTracks.map((t) => t.id));

    // Optimistically update AUTH_PROFILE_QUERY_KEY so user.trackFavorites and user.wishlist update immediately
    queryClient.setQueryData<LoggedInUser | null>(
      AUTH_PROFILE_QUERY_KEY,
      (prevUser) => {
        if (!prevUser) return prevUser;

        // 1. Update wishlist
        let updatedWishlist = prevUser.wishlist ? [...prevUser.wishlist] : [];
        if (nextState) {
          if (!updatedWishlist.some((w) => w.trackGroupId === trackGroup.id)) {
            updatedWishlist.push({
              userId: prevUser.id,
              trackGroupId: trackGroup.id,
            });
          }
        } else {
          updatedWishlist = updatedWishlist.filter(
            (w) => w.trackGroupId !== trackGroup.id,
          );
        }

        // 2. Update trackFavorites
        let updatedFavorites = prevUser.trackFavorites
          ? [...prevUser.trackFavorites]
          : [];

        if (nextState) {
          for (const track of targetTracks) {
            if (!updatedFavorites.some((f) => f.trackId === track.id)) {
              updatedFavorites.push({
                userId: prevUser.id,
                trackId: track.id,
                track,
                createdAt: new Date(),
              });
            }
          }
        } else {
          updatedFavorites = updatedFavorites.filter(
            (f) =>
              !targetTrackIds.has(f.trackId) &&
              f.track?.trackGroupId !== trackGroup.id &&
              (f as any).trackGroupId !== trackGroup.id,
          );
        }

        return {
          ...prevUser,
          wishlist: updatedWishlist,
          trackFavorites: updatedFavorites,
        };
      },
    );

    // Optimistically update queryWishlist query cache
    queryClient.setQueryData(
      queryWishlist(user.id).queryKey,
      (prev: any) => {
        if (!prev || !prev.results) return prev;
        if (nextState) {
          if (!prev.results.some((r: any) => r.trackGroupId === trackGroup.id)) {
            return {
              ...prev,
              results: [
                {
                  userId: user.id,
                  trackGroupId: trackGroup.id,
                  trackGroup,
                  createdAt: new Date(),
                },
                ...prev.results,
              ],
            };
          }
          return prev;
        } else {
          return {
            ...prev,
            results: prev.results.filter(
              (r: any) => r.trackGroupId !== trackGroup.id,
            ),
          };
        }
      },
    );

    try {
      const calls: Promise<unknown>[] = [
        api.post(`/v1/trackGroups/${trackGroup.id}/wishlist`, {
          wishlist: nextState,
        }),
      ];

      // Dispatch favorite updates for the target tracks concurrently
      const tracksToSyncIds = new Set(targetTrackIds);
      if (!nextState && user.trackFavorites) {
        user.trackFavorites.forEach((f) => {
          if (
            f.track?.trackGroupId === trackGroup.id ||
            (f as any).trackGroupId === trackGroup.id
          ) {
            tracksToSyncIds.add(f.trackId);
          }
        });
      }

      for (const trackId of tracksToSyncIds) {
        calls.push(
          api.post(`/v1/tracks/${trackId}/favorite`, {
            favorite: nextState,
          }),
        );
      }

      await Promise.allSettled(calls);
    } catch (err) {
      console.error("Failed to update wishlist / track favorites:", err);
    } finally {
      queryClient.invalidateQueries({
        queryKey: ["fetchWishlist", { userId: user.id }],
      });
      queryClient.invalidateQueries({
        queryKey: AUTH_PROFILE_QUERY_KEY,
      });
      refreshLoggedInUser();
    }
  }, [
    isInWishlist,
    trackGroup,
    displayedTracks,
    user,
    queryClient,
    refreshLoggedInUser,
    router,
  ]);

  return (
    <Pressable
      onPress={onPress}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Ionicons
        name={isInWishlist ? "heart" : "heart-outline"}
        color={isInWishlist ? "#BE3455" : "#ababab"}
        size={size}
      />
    </Pressable>
  );
}
