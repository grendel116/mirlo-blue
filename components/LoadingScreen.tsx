import { ActivityIndicator, StyleSheet, View } from "react-native";
import { theme } from "@/constants/theme";

// Full-screen loading state: a centered spinner on the app background
export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
});
