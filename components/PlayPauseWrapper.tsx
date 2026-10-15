import { usePlayer } from "@/state/PlayerContext";
import { Pressable, StyleSheet } from "react-native";
import { PropsWithChildren } from "react";
import { TrackItem } from "./TrackItem";
import { isTrackOwnedOrPreview } from "@/scripts/utils";
import { useAuthContext } from "@/state/AuthContext";

type PlayPauseWrapperPropsWithChildren = PropsWithChildren<PlayPauseWrapperProps>;

export default function PlayPauseWrapper({
  trackObject,
  style,
  selectedAlbum,
  onTrackScreen,
}: PlayPauseWrapperPropsWithChildren) {
  const { activeTrack, playTrack, playableTracks } = usePlayer();
  const { user } = useAuthContext();

  const canPlayTrack = isTrackOwnedOrPreview(trackObject, user, selectedAlbum);
  const thisSongSelected = Boolean(activeTrack?.url && activeTrack.url === trackObject?.url);

  return (
    <Pressable
      onPress={async () => {
        if (!canPlayTrack) return;
        await playTrack(trackObject, playableTracks);
      }}
      style={style}
      accessibilityLabel={`Play ${trackObject?.title || "track"}`}
    >
      <TrackItem
        track={trackObject}
        album={selectedAlbum ? selectedAlbum : undefined}
        thisSongSelected={thisSongSelected}
        onTrackScreen={onTrackScreen}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  playPauseButtonContainer: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 0,
  },
  playPauseButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    alignSelf: "center",
    textTransform: "uppercase",
  },
});
