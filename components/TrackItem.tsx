import { useAuthContext } from "@/state/AuthContext";
import { usePlayer } from "@/state/PlayerContext";
import { View, StyleSheet, Text, Image } from "react-native";
import { isTrackOwnedOrPreview } from "@/scripts/utils";
import FavoriteTrackButton from "./FavoriteTrackButton";
import AddToQueueButton from "./AddToQueueButton";
import DownloadTrackButton from "./DownloadTrackButton";
import { theme } from "@/constants/theme";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Number(seconds.toFixed(0)) % 60;

  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
  const formattedSeconds =
    remainingSeconds < 10 ? `0${remainingSeconds}` : remainingSeconds;

  return `${formattedMinutes}:${formattedSeconds}`;
}

type TrackItemComponentProps = {
  track: RNTrack;
  album?: AlbumProps;
  thisSongSelected: boolean;
  onTrackScreen: boolean;
};

export const TrackItem = ({
  track,
  album,
  thisSongSelected,
  onTrackScreen,
}: TrackItemComponentProps) => {
  const { user } = useAuthContext();
  const { disabledTrackIds } = usePlayer();

  const canPlayTrack = isTrackOwnedOrPreview(track, user, album, disabledTrackIds);

  let contributors = "";

  if (track.trackArtists) {
    for (let i = 0; i < track.trackArtists.length; i++) {
      if (i === track.trackArtists.length - 1) {
        contributors += track.trackArtists[i].artistName;
      } else {
        contributors += track.trackArtists[i].artistName + ", ";
      }
    }
  }

  const hasContributor = Boolean(
    track.trackArtists &&
    contributors &&
    track.trackArtists.length &&
    track.trackArtists[0].artistName !== track.artist,
  );

  const textColor = canPlayTrack
    ? thisSongSelected
      ? theme.colors.primary
      : theme.colors.textPrimary
    : theme.colors.textMuted;

  const artworkUri =
    track.artwork ||
    album?.cover?.sizes?.[300] ||
    album?.cover?.sizes?.[120] ||
    album?.cover?.sizes?.[600] ||
    track.trackGroup?.cover?.sizes?.[300] ||
    track.trackGroup?.cover?.sizes?.[120] ||
    track.trackGroup?.cover?.sizes?.[600];

  return (
    <View style={[styles.listItem, thisSongSelected && styles.selectedListItem]}>
      <View style={styles.trackDetailsRow}>
        {artworkUri ? (
          <Image source={{ uri: artworkUri }} style={styles.trackThumb} resizeMode="cover" />
        ) : track ? (
          <Text
            style={[
              styles.orderText,
              {
                color: thisSongSelected ? theme.colors.primary : theme.colors.textSecondary,
                fontWeight: thisSongSelected ? "700" : "500",
              },
            ]}
          >
            {track.order}.
          </Text>
        ) : null}
        <View style={styles.titleContainer}>
          <Text
            style={[
              styles.titleText,
              {
                color: textColor,
                fontWeight: thisSongSelected ? "700" : "500",
              },
            ]}
            ellipsizeMode="tail"
            numberOfLines={1}
          >
            {track.title}
          </Text>
          {hasContributor ? (
            <View style={styles.subtitleRow}>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.contributorText}
              >
                {contributors}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.actionRow}>
        {!onTrackScreen && canPlayTrack && (
          <AddToQueueButton track={track} album={album} size={17} />
        )}
        {!onTrackScreen && <FavoriteTrackButton track={track} size={17} />}
        {!onTrackScreen && album && <DownloadTrackButton track={track} album={album} />}
        <Text
          style={[
            styles.durationText,
            {
              color: thisSongSelected ? theme.colors.primary : theme.colors.textSecondary,
              fontWeight: thisSongSelected ? "700" : "400",
            },
          ]}
        >
          {track.audio?.duration ? formatTime(track.audio.duration) : "0:00"}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: "space-between",
    marginVertical: 2,
    borderRadius: theme.radius.sm,
  },
  selectedListItem: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.surfaceGlassBorder,
  },
  trackDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    flex: 1,
    paddingRight: 10,
  },
  orderText: {
    fontSize: 14,
    width: 26,
    marginLeft: 2,
  },
  trackThumb: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.sm,
    marginRight: 10,
    backgroundColor: theme.colors.surfaceElevated,
  },
  titleContainer: {
    flex: 1,
  },
  titleText: {
    fontSize: 15,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    flexWrap: "nowrap",
  },
  contributorText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  durationText: {
    fontSize: 13,
  },
});
