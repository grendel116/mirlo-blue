import { useRouter } from "expo-router";
import { Pressable, Text, StyleSheet } from "react-native";
import { theme } from "@/constants/theme";

type TagPillProps = {
  key?: number;
  tagName: string;
};

export default function TagPill({ tagName }: TagPillProps) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/tags/${encodeURIComponent(tagName)}` as const)}
      style={styles.pill}
      accessibilityRole="button"
    >
      <Text style={styles.text}>#{tagName}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.surfaceGlassBorder,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: theme.radius.full,
    marginRight: 6,
    marginVertical: 4,
  },
  text: {
    color: theme.colors.textCyan,
    fontSize: 13,
    fontWeight: "600",
  },
});
