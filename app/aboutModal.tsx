import { Linking, Pressable, StyleSheet, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import SwipeDownSheet, { SheetScrollView } from "@/components/SwipeDownSheet";
import { Card } from "@/components/purchase/ui";
import { theme } from "@/constants/theme";
import { openInBrowser } from "@/scripts/openInBrowser";

const LINKS = [
  { label: "mirlo.space", url: "https://mirlo.space" },
  { label: "About", url: "https://docs.mirlo.space" },
  { label: "Contact", url: "mailto:hi@mirlo.space" },
  { label: "Instagram", url: "https://instagram.com/mirlo.space" },
  { label: "Mastodon", url: "https://musician.social/@mirlo" },
  { label: "Bluesky", url: "https://bsky.app/profile/mirlo.space" },
  { label: "Terms", url: "https://mirlo.space/pages/terms" },
  { label: "Privacy", url: "https://mirlo.space/pages/privacy" },
];

// Linking.openURL would route mirlo.space links back into the app, so web pages open in the
// in-app browser
function open(url: string) {
  if (url.startsWith("mailto:")) Linking.openURL(url);
  else openInBrowser(url);
}

// Where to find Mirlo online. Opened from the Library header, next to Sign in and Log out
export default function AboutModal() {
  return (
    <SwipeDownSheet resetKey="about">
      <SheetScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          {LINKS.map((link, index) => (
            <Pressable
              key={link.label}
              onPress={() => open(link.url)}
              style={[styles.row, index === 0 && styles.firstRow]}
              accessibilityRole="link"
            >
              <Text style={styles.label}>{link.label}</Text>
              <Ionicons name="open-outline" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          ))}
        </Card>
      </SheetScrollView>
    </SwipeDownSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceCardBorder,
  },
  firstRow: {
    borderTopWidth: 0,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.textPrimary,
  },
});
