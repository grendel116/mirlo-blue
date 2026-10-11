import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ViewProps,
  Text,
  useWindowDimensions,
  Platform,
  Pressable,
} from "react-native";
import { useProgress } from "react-native-track-player";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { usePlayer } from "@/state/PlayerContext";
import { Link, router, usePathname } from "expo-router";
import { theme } from "@/constants/theme";

export default function Footer({ style }: ViewProps) {
  const progress = useProgress();
  const { bottom } = useSafeAreaInsets();
  const { activeTrack, isPlaying, togglePlayPause, skipNext } = usePlayer();
  const pathname = usePathname();
  const { width } = useWindowDimensions();

  const isTrackScreen =
    pathname === "/now-playing" ||
    pathname.includes("/tracks/") ||
    pathname.endsWith("/tracks");

  const progressPercent =
    progress.duration > 0
      ? Math.min(100, Math.max(0, (progress.position / progress.duration) * 100))
      : 0;

  return (
    <View style={[styles.container, style]}>
      {/* Glossy Docked Mini-Player when a track is active and not on dedicated track / player screen */}
      {activeTrack && !isTrackScreen && (
        <View style={styles.miniPlayer}>
          {/* Progress bar line */}
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>

          <Pressable
            style={styles.miniPlayerContent}
            onPress={() => {
              router.navigate({
                pathname: "/now-playing",
                params: {
                  id: activeTrack.trackGroup?.artistId,
                  slug: activeTrack.trackGroup?.urlSlug,
                },
              });
            }}
            accessibilityRole="button"
            accessibilityLabel="Open now playing"
          >
            {activeTrack.artwork ? (
              <Image source={{ uri: activeTrack.artwork }} style={styles.miniArtwork} />
            ) : (
              <View style={[styles.miniArtwork, styles.artworkPlaceholder]}>
                <Ionicons name="musical-notes" size={18} color={theme.colors.primary} />
              </View>
            )}

            <View style={styles.miniTrackInfo}>
              <Text style={styles.miniTitle} numberOfLines={1}>
                {activeTrack.title}
              </Text>
              <Text style={styles.miniArtist} numberOfLines={1}>
                {activeTrack.artist}
              </Text>
            </View>
          </Pressable>

          <View style={styles.miniControls}>
            <TouchableOpacity
              onPress={togglePlayPause}
              style={styles.miniPlayBtn}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? "Pause" : "Play"}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={22}
                color={theme.colors.playButtonIcon}
                style={!isPlaying && { marginLeft: 2 }}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={skipNext}
              style={styles.miniSkipBtn}
              accessibilityRole="button"
              accessibilityLabel="Skip Next"
            >
              <Ionicons name="play-skip-forward" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Consolidated 3-Tab Bottom Navigation Bar */}
      <View
        style={[
          styles.navBar,
          {
            paddingBottom: Math.max(bottom, 8),
            height: 60 + Math.max(bottom, 8),
          },
        ]}
      >
        {/* Tab 1: Home */}
        <Pressable
          onPress={() => router.dismissTo("/")}
          style={styles.navTab}
          accessibilityRole="button"
          accessibilityLabel="Home"
        >
          <Ionicons
            name={pathname === "/" ? "home" : "home-outline"}
            size={24}
            color={pathname === "/" ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.navLabel,
              pathname === "/" && styles.navLabelActive,
            ]}
          >
            Home
          </Text>
        </Pressable>

        {/* Tab 2: Queue */}
        <Pressable
          onPress={() => {
            if (pathname === "/feed") return;
            router.navigate("/feed");
          }}
          style={styles.navTab}
          accessibilityRole="button"
          accessibilityLabel="Queue"
        >
          <StackedBoxesIcon
            color={pathname === "/feed" ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.navLabel,
              pathname === "/feed" && styles.navLabelActive,
            ]}
          >
            Queue
          </Text>
        </Pressable>

        {/* Tab 3: Consolidated Library (Likes, Wishlist & Purchases) */}
        <Pressable
          onPress={() => {
            if (pathname === "/library") return;
            router.navigate("/library");
          }}
          style={styles.navTab}
          accessibilityRole="button"
          accessibilityLabel="Library"
        >
          <SimpleLibraryIcon
            color={pathname === "/library" ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.navLabel,
              pathname === "/library" && styles.navLabelActive,
            ]}
          >
            Library
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: theme.colors.background,
  },
  miniPlayer: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceGlassBorder,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  progressBarBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: theme.colors.progressTrack,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: theme.colors.primary,
    ...(Platform.OS === "web" ? ({ transition: "width 0.25s linear" } as any) : {}),
  },
  miniPlayerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  miniArtwork: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
  },
  artworkPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  miniTrackInfo: {
    marginLeft: 10,
    flex: 1,
  },
  miniTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
    fontSize: 14,
  },
  miniArtist: {
    color: theme.colors.textCyan,
    fontSize: 12,
    marginTop: 2,
  },
  miniControls: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 10,
    gap: 8,
  },
  miniPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  miniSkipBtn: {
    padding: 6,
  },
  navBar: {
    width: "100%",
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceCardBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 8,
  },
  navTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    fontWeight: "500",
  },
  navLabelActive: {
    color: theme.colors.primary,
    fontWeight: "700",
  },
});

function SimpleLibraryIcon({ color }: { color: string }) {
  return (
    <View style={iconStyles.container}>
      <View style={[iconStyles.bar, { backgroundColor: color, height: 16 }]} />
      <View style={[iconStyles.bar, { backgroundColor: color, height: 20 }]} />
      <View style={[iconStyles.bar, { backgroundColor: color, height: 13, transform: [{ rotate: "18deg" }] }]} />
    </View>
  );
}

function StackedBoxesIcon({ color }: { color: string }) {
  return (
    <View style={stackedBoxStyles.container}>
      {/* Back box (offset upper-right) */}
      <View style={[stackedBoxStyles.backBox, { borderColor: color }]} />
      {/* Front box (offset lower-left) */}
      <View style={[stackedBoxStyles.frontBox, { borderColor: color }]} />
    </View>
  );
}

const iconStyles = StyleSheet.create({
  container: {
    width: 24,
    height: 24,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 3.5,
  },
  bar: {
    width: 3.5,
    borderRadius: 1.5,
  },
});

const stackedBoxStyles = StyleSheet.create({
  container: {
    width: 24,
    height: 24,
    position: "relative",
  },
  backBox: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 2,
    opacity: 0.55,
  },
  frontBox: {
    position: "absolute",
    bottom: 2,
    left: 2,
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 2,
    backgroundColor: theme.colors.surface,
  },
});

