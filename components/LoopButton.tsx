import { Text, View, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { usePlayer } from "@/state/PlayerContext";
import { theme } from "@/constants/theme";

const LABELS = { none: "Repeat off", queue: "Repeat all", track: "Repeat one" };

export default function LoopButton() {
  const { looping, cycleRepeat } = usePlayer("looping", "cycleRepeat");
  const color = looping === "none" ? theme.colors.textSecondary : theme.colors.primary;

  return (
    <View>
      <TouchableOpacity
        style={styles.button}
        onPress={cycleRepeat}
        accessibilityRole="button"
        accessibilityLabel={LABELS[looping]}
      >
        <Ionicons name="repeat" size={24} color={color} />
        {looping === "track" && (
          <View style={styles.indicatorContainer}>
            <Text style={styles.loopIndicator}>1</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

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
