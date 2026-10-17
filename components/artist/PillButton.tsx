import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@/constants/theme";

// A rounded action button for the artist page. `filled` marks the main action; without
// onPress it shows as a plain label
export default function PillButton({
  icon,
  label,
  detail,
  onPress,
  filled = false,
  loading = false,
  accessibilityLabel,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  detail?: string;
  onPress?: () => void;
  filled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
}) {
  const color = filled ? theme.colors.playButtonIcon : theme.colors.textPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || loading}
      style={({ pressed }) => [
        styles.pill,
        filled && styles.filled,
        pressed && styles.pressed,
      ]}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={accessibilityLabel ?? (detail ? `${label}, ${detail}` : label)}
      accessibilityState={{ busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} style={styles.icon} />
      ) : (
        <Ionicons name={icon} size={16} color={filled ? color : theme.colors.primary} />
      )}
      <Text style={[styles.label, { color }]}>{label}</Text>
      {detail ? (
        <Text style={[styles.detail, filled && { color: theme.colors.playButtonIcon }]}>
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.surfaceGlassBorder,
    backgroundColor: theme.colors.surfaceElevated,
  },
  filled: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  pressed: {
    opacity: 0.75,
  },
  icon: {
    width: 16,
    height: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  detail: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
});
