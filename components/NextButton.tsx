import { TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { usePlayer } from "@/state/PlayerContext";
import { theme } from "@/constants/theme";

export default function NextButton() {
  const { skipNext } = usePlayer("skipNext");

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={skipNext}
      accessibilityRole="button"
      accessibilityLabel="Next Track"
    >
      <Ionicons name="play-skip-forward" size={32} color={theme.colors.textPrimary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
  },
});
