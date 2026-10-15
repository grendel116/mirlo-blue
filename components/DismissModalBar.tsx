import { View, Text, Image, Pressable, StyleSheet } from "react-native";
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
          size={26}
          color={theme.colors.textSecondary}
          style={styles.chevron}
        />
        <View style={styles.brandRow}>
          <Image
            source={require("@/assets/images/Logo-Mirlo_LogoOnly.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View style={styles.brandWordmark}>
            <Text style={styles.brandText}>MIRLO</Text>
            <Text style={[styles.brandText, styles.brandHighlight]}>BLUE</Text>
          </View>
        </View>
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
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  chevron: {
    position: "absolute",
    left: 16,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  brandWordmark: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoImage: {
    width: 22,
    height: 22,
    tintColor: theme.colors.logo,
  },
  brandText: {
    fontFamily: theme.fonts.display,
    fontSize: 18,
    fontWeight: "normal",
    color: theme.colors.textPrimary,
    letterSpacing: 0.5,
  },
  brandHighlight: {
    color: theme.colors.primary,
    paddingRight: 2,
  },
});

