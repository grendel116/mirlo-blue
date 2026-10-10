import { Text, View, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { usePlayer } from "@/state/PlayerContext";
import TrackPlayer from "react-native-track-player";

import { theme } from "@/constants/theme";

export default function ShuffleButton() {
  const { shuffled, setShuffled, playableTracks } = usePlayer();

  const onPress = async () => {
    try {
      const activeTrack = (await TrackPlayer.getActiveTrack()) as RNTrack | undefined;
      if (!activeTrack) return;

      if (!shuffled) {
        // Shuffle: remove upcoming tracks and add them back in randomized order
        await TrackPlayer.removeUpcomingTracks();
        const otherTracks = playableTracks.filter(
          (t) => t.url !== activeTrack.url,
        );
        const shuffledTracks = [...otherTracks].sort(() => Math.random() - 0.5);
        if (shuffledTracks.length > 0) {
          await TrackPlayer.add(shuffledTracks);
        }
        setShuffled(true);
      } else {
        // Unshuffle: restore natural album track order for upcoming tracks
        await TrackPlayer.removeUpcomingTracks();
        const currentOrder = activeTrack.order ?? 0;
        const remainingTracks = playableTracks
          .filter((t) => t.url !== activeTrack.url && (t.order ?? 0) > currentOrder)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const priorTracks = playableTracks
          .filter((t) => t.url !== activeTrack.url && (t.order ?? 0) <= currentOrder)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        if (remainingTracks.length > 0) {
          await TrackPlayer.add(remainingTracks);
        }
        if (priorTracks.length > 0) {
          await TrackPlayer.add(priorTracks);
        }
        setShuffled(false);
      }
    } catch (err) {
      console.error("Shuffle error:", err);
    }
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={shuffled ? "Disable Shuffle" : "Enable Shuffle"}
      >
        <Ionicons
          name="shuffle"
          size={24}
          color={shuffled ? theme.colors.primary : theme.colors.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
  },
});
