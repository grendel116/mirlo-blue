import { Pressable, ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useAuthContext } from "@/state/AuthContext";
import { AUTH_PROFILE_QUERY_KEY } from "@/queries/authQueries";
import { queryWishlist } from "@/queries/queries";
import { toggleStationLike, useStationLikes } from "@/scripts/stationLikes";
import { togglePodcastEpisodeLike, usePodcastEpisodeLikes } from "@/scripts/podcastLikes";
import {
  isFaircampTrack,
  isFaircampTrackLiked,
  toggleFaircampTrackLike,
  useFaircampSaves,
} from "@/scripts/faircampSaves";
import * as api from "../queries/fetch/fetchWrapper";

type FavoriteTrackButtonProps = {
  track: RNTrack;
  style?: ViewStyle;
  size?: number;
};

type HeartProps = { liked: boolean; onPress: () => void; style?: ViewStyle; size?: number };

function Heart({ liked, onPress, style, size }: HeartProps) {
  return (
    <Pressable
      onPress={(e) => {
        e?.stopPropagation?.();
        onPress();
      }}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={liked ? "Unlike" : "Like"}
    >
      <Ionicons
        name={liked ? "heart" : "heart-outline"}
        color={liked ? "#BE3455" : "#ababab"}
        size={size}
      />
    </Pressable>
  );
}

// Mirlo songs are account favorites; federated tracks, radio stations and podcast episodes are device-only
export default function FavoriteTrackButton({
  track,
  style,
  size,
}: FavoriteTrackButtonProps) {
  if (track.liveStation) {
    return <StationHeart stationId={track.liveStation} style={style} size={size} />;
  }
  if (track.podcastEpisodeId) {
    return <PodcastEpisodeHeart track={track} style={style} size={size} />;
  }
  if (isFaircampTrack(track)) {
    return <FaircampTrackHeart track={track} style={style} size={size} />;
  }
  if (!track.id || track.id <= 0) return null;
  return <SongHeart track={track} style={style} size={size} />;
}

function FaircampTrackHeart({
  track,
  style,
  size,
}: {
  track: RNTrack;
  style?: ViewStyle;
  size?: number;
}) {
  useFaircampSaves();
  const liked = isFaircampTrackLiked(track);
  return (
    <Heart
      liked={liked}
      onPress={() => toggleFaircampTrackLike(track)}
      style={style}
      size={size}
    />
  );
}

function StationHeart({
  stationId,
  style,
  size,
}: {
  stationId: string;
  style?: ViewStyle;
  size?: number;
}) {
  const likes = useStationLikes();
  const liked = likes.some((like) => like.stationId === stationId);
  return (
    <Heart liked={liked} onPress={() => toggleStationLike(stationId)} style={style} size={size} />
  );
}

function PodcastEpisodeHeart({
  track,
  style,
  size,
}: {
  track: any;
  style?: ViewStyle;
  size?: number;
}) {
  const likes = usePodcastEpisodeLikes();
  const liked = likes.some((like) => like.episodeId === track.podcastEpisodeId);
  return (
    <Heart
      liked={liked}
      onPress={() => togglePodcastEpisodeLike(track)}
      style={style}
      size={size}
    />
  );
}

function favoriteAlbumId(fav: any): number | undefined {
  return (
    fav?.track?.trackGroupId ??
    fav?.track?.trackGroup?.id ??
    fav?.track?.trackGroup?.trackGroupId ??
    fav?.trackGroupId
  );
}

// Liking any track on an album adds the whole album to the wishlist;
// unliking the last liked track on the album removes the album from the wishlist.
function SongHeart({
  track,
  style,
  size,
}: {
  track: RNTrack;
  style?: ViewStyle;
  size?: number;
}) {
  const { user, refreshLoggedInUser } = useAuthContext();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [tapped, setTapped] = useState<boolean | null>(null);
  useEffect(() => setTapped(null), [user]);

  const isInFavorites =
    tapped ?? !!user?.trackFavorites?.some((w) => w.trackId === track.id);

  const albumId =
    track.trackGroupId || track.trackGroup?.id || track.trackGroup?.trackGroupId;

  const onPress = useCallback(async () => {
    if (!user) {
      router.push({
        pathname: "/emailVerificationModal",
      });
      return;
    }

    const next = !isInFavorites;
    setTapped(next);

    const wasListed = Boolean(
      albumId && user.wishlist?.some((w) => w.trackGroupId === albumId),
    );
    const otherTrackStillLiked = Boolean(
      albumId &&
        user.trackFavorites?.some(
          (f) => f.trackId !== track.id && favoriteAlbumId(f) === albumId,
        ),
    );
    const shouldList = next ? true : otherTrackStillLiked;

    // Optimistically update AUTH_PROFILE_QUERY_KEY so both the track heart and the album's
    // big WishlistButton heart respond immediately
    queryClient.setQueryData<LoggedInUser | null>(
      AUTH_PROFILE_QUERY_KEY,
      (prevUser) => {
        if (!prevUser) return prevUser;

        let updatedFavorites = prevUser.trackFavorites
          ? [...prevUser.trackFavorites]
          : [];
        if (next) {
          if (!updatedFavorites.some((f) => f.trackId === track.id)) {
            updatedFavorites.push({
              userId: prevUser.id,
              trackId: track.id,
              track: { ...track, trackGroupId: albumId ?? track.trackGroupId },
              createdAt: new Date(),
            });
          }
        } else {
          updatedFavorites = updatedFavorites.filter((f) => f.trackId !== track.id);
        }

        let updatedWishlist = prevUser.wishlist ? [...prevUser.wishlist] : [];
        if (albumId) {
          const anyLikedAfter =
            next ||
            updatedFavorites.some((f) => favoriteAlbumId(f) === albumId);
          if (anyLikedAfter) {
            if (!updatedWishlist.some((w) => w.trackGroupId === albumId)) {
              updatedWishlist.push({
                userId: prevUser.id,
                trackGroupId: albumId,
              });
            }
          } else {
            updatedWishlist = updatedWishlist.filter(
              (w) => w.trackGroupId !== albumId,
            );
          }
        }

        return {
          ...prevUser,
          wishlist: updatedWishlist,
          trackFavorites: updatedFavorites,
        };
      },
    );

    if (albumId) {
      queryClient.setQueryData(
        queryWishlist(user.id).queryKey,
        (prev: any) => {
          if (!prev || !prev.results) return prev;
          if (shouldList) {
            if (
              track.trackGroup &&
              !prev.results.some((r: any) => r.trackGroupId === albumId)
            ) {
              return {
                ...prev,
                results: [
                  {
                    userId: user.id,
                    trackGroupId: albumId,
                    trackGroup: track.trackGroup,
                    createdAt: new Date(),
                  },
                  ...prev.results,
                ],
              };
            }
            return prev;
          }
          return {
            ...prev,
            results: prev.results.filter((r: any) => r.trackGroupId !== albumId),
          };
        },
      );
    }

    try {
      const calls: Promise<unknown>[] = [
        api.post(`/v1/tracks/${track.id}/favorite`, { favorite: next }),
      ];

      if (albumId && (shouldList !== wasListed || next)) {
        calls.push(
          api.post(`/v1/trackGroups/${albumId}/wishlist`, {
            wishlist: shouldList,
          }),
        );
      }

      await Promise.allSettled(calls);
    } catch (err) {
      console.error("Failed to update track favorite / wishlist:", err);
    } finally {
      queryClient.invalidateQueries({ queryKey: AUTH_PROFILE_QUERY_KEY });
      if (albumId) {
        queryClient.invalidateQueries({
          queryKey: queryWishlist(user.id).queryKey,
        });
      }
      refreshLoggedInUser();
    }
  }, [
    user,
    isInFavorites,
    track,
    albumId,
    queryClient,
    refreshLoggedInUser,
    router,
  ]);

  return <Heart liked={isInFavorites} onPress={onPress} style={style} size={size} />;
}
