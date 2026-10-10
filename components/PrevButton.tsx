import { TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { usePlayer } from "@/state/PlayerContext";
import { theme } from "@/constants/theme";

export default function PrevButton() {
  const { skipPrevious } = usePlayer();

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={skipPrevious}
      accessibilityRole="button"
      accessibilityLabel="Previous Track"
    >
      <Ionicons name="play-skip-back" size={32} color={theme.colors.textPrimary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
  },
});
