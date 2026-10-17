import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useAuthContext } from "@/state/AuthContext";
import {
  artistRelation,
  queryArtistFollowers,
  useFollowArtist,
} from "@/queries/listener";
import {
  isFaircampArtistFollowed,
  toggleFaircampArtistFollow,
  useFaircampSaves,
} from "@/scripts/faircampSaves";
import PillButton from "@/components/artist/PillButton";

// Follow or unfollow an artist. Mirlo artists sync with the listener's Mirlo account;
// Faircamp artists save on the device
export default function FollowArtistButton({ artist }: { artist: Artist }) {
  const { user } = useAuthContext();
  const router = useRouter();
  const isMirlo = Boolean(artist.onMirlo);
  const faircampSaves = useFaircampSaves();
  const { isFollowing: isMirloFollowing, subscriptionTier } = artistRelation(
    user,
    isMirlo ? artist.id : undefined,
  );
  const { data: followers } = useQuery(queryArtistFollowers(isMirlo ? artist.id : undefined));
  const follow = useFollowArtist(isMirlo ? artist.id : undefined);
  const count = isMirlo && typeof followers === "number" ? String(followers) : undefined;

  const isFollowing = isMirlo
    ? isMirloFollowing
    : isFaircampArtistFollowed(artist, faircampSaves);

  if (isMirlo && subscriptionTier) {
    return <PillButton icon="star" label={subscriptionTier.name} detail={count} filled />;
  }

  return (
    <PillButton
      icon={isFollowing ? "checkmark" : "add"}
      label={isFollowing ? "Following" : "Follow"}
      detail={count}
      filled={!isFollowing}
      loading={isMirlo && follow.isPending}
      onPress={() => {
        if (!isMirlo) {
          toggleFaircampArtistFollow(artist);
          return;
        }
        if (user) {
          follow.mutate(!isFollowing);
        } else {
          router.push("/login");
        }
      }}
      accessibilityLabel={
        isFollowing ? `Unfollow ${artist.name}` : `Follow ${artist.name}`
      }
    />
  );
}
