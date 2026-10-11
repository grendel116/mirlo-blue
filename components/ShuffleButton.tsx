import { View, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { usePlayer } from "@/state/PlayerContext";
import { theme } from "@/constants/theme";

export default function ShuffleButton() {
  const { shuffled, toggleShuffle } = usePlayer();

  return (
    <View>
      <TouchableOpacity
        style={styles.button}
        onPress={toggleShuffle}
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
