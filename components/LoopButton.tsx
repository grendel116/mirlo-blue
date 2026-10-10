import { Text, View, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { usePlayer } from "@/state/PlayerContext";
import TrackPlayer, { RepeatMode } from "react-native-track-player";
import { theme } from "@/constants/theme";

export default function LoopButton() {
  const { looping, setLooping } = usePlayer();
  const isLoopActive = looping === "queue" || looping === "track";
  const loopColor = isLoopActive ? theme.colors.primary : theme.colors.textSecondary;

  const onPress = async () => {
    try {
      if (looping === "none") {
        setLooping("queue");
        await TrackPlayer.setRepeatMode(RepeatMode.Queue);
      } else if (looping === "queue") {
        setLooping("track");
        await TrackPlayer.setRepeatMode(RepeatMode.Track);
      } else {
        setLooping("none");
        await TrackPlayer.setRepeatMode(RepeatMode.Off);
      }
    } catch (err) {
      console.error("Issue setting loop mode");
    }
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Loop mode: ${looping}`}
      >
        <Ionicons
          name="repeat"
          size={24}
          color={loopColor}
        />
        {looping === "track" && <LoopIndicator />}
      </TouchableOpacity>
    </View>
  );
}

const LoopIndicator = () => {
  return (
    <View style={styles.indicatorContainer}>
      <Text style={styles.loopIndicator}>1</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 8,
    position: "relative",
  },
  indicatorContainer: {
    position: "absolute",
    right: 2,
    top: 2,
  },
  loopIndicator: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.primary,
  },
});
