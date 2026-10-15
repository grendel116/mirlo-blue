import { View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@/constants/theme";

export default function DismissModalBar() {
  const router = useRouter();

  return (
    <View style={styles.bar}>
      <Pressable
        onPress={() => router.dismiss()}
        style={styles.pressable}
        accessibilityRole="button"
        accessibilityLabel="Dismiss modal"
      >
        <Ionicons
          name="chevron-down"
          size={28}
          color={theme.colors.textSecondary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: "100%",
    height: 48,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceCardBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  pressable: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
});
