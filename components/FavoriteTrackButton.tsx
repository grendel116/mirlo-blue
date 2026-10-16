import { Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/state/AuthContext";
import { queryAuthProfile } from "@/queries/authQueries";
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
import { ViewStyle } from "react-native";

type FavoriteTrackButton = {
  track: RNTrack;
  style?: ViewStyle;
  size?: number;
};

type HeartProps = { liked: boolean; onPress: () => void; style?: ViewStyle; size?: number };

function Heart({ liked, onPress, style, size }: HeartProps) {
  return (
    <Pressable
      onPress={onPress}
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
export default function FavoriteTrackButton({ track, style, size }: FavoriteTrackButton) {
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
  return (
    <SongHeart
      track={{ id: track.id, trackGroupId: track.trackGroupId }}
      style={style}
      size={size}
    />
  );
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

// The heart follows the account's favorites, so hearting a whole album fills every track's
// heart. A tap shows right away and gives way to the account data once it refreshes
function SongHeart({
  track,
  style,
  size,
}: {
  track: { id: number; trackGroupId?: number };
  style?: ViewStyle;
  size?: number;
}) {
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

  return <Heart liked={isInFavorites} onPress={onPress} style={style} size={size} />;
}
