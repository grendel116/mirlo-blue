import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import Ionicons from "@expo/vector-icons/Ionicons";
import SwipeDownSheet, { SheetScrollView } from "@/components/SwipeDownSheet";
import { theme } from "@/constants/theme";
import { openInBrowser } from "@/scripts/openInBrowser";

type AboutLink = {
  label: string;
  subtitle?: string;
  url: string;
  icon: string;
  brand?: boolean;
};

const LINKS: AboutLink[] = [
  {
    label: "mirlo.space",
    subtitle: "Official website",
    url: "https://mirlo.space",
    icon: "globe",
    brand: false,
  },
  {
    label: "About Mirlo",
    subtitle: "Mission & documentation",
    url: "https://docs.mirlo.space",
    icon: "circle-info",
    brand: false,
  },
  {
    label: "Contact",
    subtitle: "hi@mirlo.space",
    url: "mailto:hi@mirlo.space",
    icon: "envelope",
    brand: false,
  },
  {
    label: "Instagram",
    subtitle: "@mirlo.space",
    url: "https://instagram.com/mirlo.space",
    icon: "instagram",
    brand: true,
  },
  {
    label: "Mastodon",
    subtitle: "@mirlo@musician.social",
    url: "https://musician.social/@mirlo",
    icon: "mastodon",
    brand: true,
  },
  {
    label: "Bluesky",
    subtitle: "@mirlo.space",
    url: "https://bsky.app/profile/mirlo.space",
    icon: "bluesky",
    brand: true,
  },
  {
    label: "Terms of Service",
    url: "https://mirlo.space/pages/terms",
    icon: "file-lines",
    brand: false,
  },
  {
    label: "Privacy Policy",
    url: "https://mirlo.space/pages/privacy",
    icon: "shield-halved",
    brand: false,
  },
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
        <View style={styles.container}>
          {/* Link Cards */}
          <View style={styles.linkList}>
            {LINKS.map((link) => (
              <Pressable
                key={link.label}
                onPress={() => open(link.url)}
                style={({ pressed }) => [styles.linkCard, pressed && styles.linkCardPressed]}
                accessibilityRole="link"
                accessibilityLabel={link.label}
              >
                <View style={styles.iconContainer}>
                  <FontAwesome6
                    name={link.icon}
                    size={18}
                    color={theme.colors.primary}
                    brand={link.brand}
                    solid={!link.brand}
                  />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.linkLabel}>{link.label}</Text>
                  {link.subtitle ? (
                    <Text style={styles.linkSubtitle} numberOfLines={1}>
                      {link.subtitle}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>
      </SheetScrollView>
    </SwipeDownSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  container: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  linkList: {
    gap: 10,
  },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.surfaceCardBorder,
    borderRadius: theme.radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  linkCardPressed: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.primary,
    opacity: 0.85,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(0, 210, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
  },
  linkLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.textPrimary,
  },
  linkSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});
