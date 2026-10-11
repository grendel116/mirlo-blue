import {
  Text,
  View,
  Image,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { usePlayer } from "@/state/PlayerContext";
import Player from "@/components/Player";
import { useRouter } from "expo-router";
import TrackPlayer, { useProgress } from "react-native-track-player";
import Slider from "@react-native-community/slider";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import DismissModalBar from "@/components/DismissModalBar";
import { theme } from "@/constants/theme";
import { useQuery } from "@tanstack/react-query";
import { queryRadioPlays, findStation } from "@/queries/radio";
import ShareTrackButton from "@/components/ShareTrackButton";
import FavoriteTrackButton from "@/components/FavoriteTrackButton";
import Ionicons from "@expo/vector-icons/Ionicons";
import { openInBrowser } from "@/scripts/openInBrowser";

export default function NowPlaying() {
  const { activeTrack } = usePlayer() as {
    activeTrack: RNTrack | undefined;
  };
  const progress = useProgress();
  const router = useRouter();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  const albumArtSize = Math.min(width - 48, 380);

  // Live radio: show the song on air from the station's playlist feed (refreshes every minute)
  const station = findStation(activeTrack?.liveStation);
  const isLive = Boolean(station);
  const { data: plays } = useQuery(queryRadioPlays(station));
  const onAir = plays?.[0];
  const artworkUri = isLive ? onAir?.artwork : activeTrack?.trackGroup?.cover?.sizes?.[600];

  return (
    <SafeAreaView style={styles.container}>
      <DismissModalBar />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Glossy Album Art Container */}
        <View style={[styles.artworkContainer, { width: albumArtSize, height: albumArtSize }]}>
          {artworkUri ? (
            <Image
              source={{ uri: artworkUri }}
              style={styles.artworkImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.artworkImage, styles.artworkPlaceholder]}>
              <Text style={styles.placeholderText}>{station?.name ?? "Mirlo"}</Text>
            </View>
          )}
        </View>

        {/* Track & Artist Info */}
        {isLive ? (
          <View style={styles.trackInfoSection}>
            <Text style={styles.trackTitle} numberOfLines={2}>
              {onAir?.song || activeTrack?.title}
            </Text>
            <Text style={styles.cyanLink} numberOfLines={1}>
              {onAir?.artist || activeTrack?.artist}
            </Text>
            <Text style={[styles.infoLabel, styles.liveStation]}>On {activeTrack?.title}</Text>
          </View>
        ) : (
        <View style={styles.trackInfoSection}>
          <View style={styles.titleRow}>
            <Text style={[styles.trackTitle, styles.titleText]} numberOfLines={2}>
              {activeTrack?.title || "No track playing"}
            </Text>
            {activeTrack && activeTrack.id > 0 ? (
              <FavoriteTrackButton track={activeTrack} size={22} style={{ padding: 4 }} />
            ) : null}
            {activeTrack ? <ShareTrackButton track={activeTrack} /> : null}
          </View>

          <View style={styles.artistGroupRow}>
            <Text style={styles.infoLabel}>
              {t("trackGroupDetails.fromAlbum")
                .replace(/<[^>]*>.*?<\/[^>]*>/g, "")
                .trim() + " "}
            </Text>
            <Pressable
              onPress={() => {
                if (!activeTrack?.trackGroup) return;
                router.dismiss();
                router.navigate({
                  pathname: "/artist/[id]/album/[slug]/album-tracks",
                  params: {
                    id: String(activeTrack.trackGroup.artistId),
                    slug: String(activeTrack.trackGroup.urlSlug),
                  },
                });
              }}
              style={styles.linkPressable}
            >
              <Text style={styles.cyanLink} numberOfLines={1}>
                {activeTrack?.trackGroup?.title}
              </Text>
            </Pressable>
          </View>

          <View style={styles.artistGroupRow}>
            <Text style={styles.infoLabel}>
              {t("trackGroupDetails.byArtist")
                .replace(/<[^>]*>.*?<\/[^>]*>/g, "")
                .trim() + " "}
            </Text>
            <Pressable
              onPress={() => {
                if (!activeTrack?.trackGroup) return;
                router.dismiss();
                router.navigate({
                  pathname: "/artist/[id]/artist-page",
                  params: { id: String(activeTrack.trackGroup.artistId) },
                });
              }}
              style={styles.linkPressable}
            >
              <Text style={styles.cyanLink} numberOfLines={1}>
                {activeTrack?.artist}
              </Text>
            </Pressable>
          </View>
        </View>
        )}

        {/* Progress Slider (live streams have no timeline) */}
        {isLive ? (
          <View style={styles.progressContainer}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>
        ) : (
        <View style={styles.progressContainer}>
          <Slider
            style={styles.progressBar}
            value={progress.position}
            minimumValue={0}
            maximumValue={progress.duration || 1}
            thumbTintColor={theme.colors.primary}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor={theme.colors.progressTrack}
            onSlidingComplete={async (value) => await TrackPlayer.seekTo(value)}
          />
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(progress.position)}</Text>
            <Text style={styles.timeText}>{formatTime(progress.duration)}</Text>
          </View>
        </View>
        )}

        {/* Playback Controls */}
        <View style={styles.playerWrapper}>
          <Player />
        </View>

        {/* Listener-supported stations: send listeners to the station's own donation page */}
        {station ? (
          <Pressable
            onPress={() => openInBrowser(station.donatePage)}
            style={styles.donateButton}
            accessibilityRole="button"
            accessibilityLabel={`Donate to ${station.name}`}
          >
            <Ionicons name="heart" size={16} color={theme.colors.playButtonIcon} />
            <Text style={styles.donateText}>Donate to {station.name}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Number(seconds.toFixed(0)) % 60;

  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
  const formattedSeconds =
    remainingSeconds < 10 ? `0${remainingSeconds}` : remainingSeconds;

  return `${formattedMinutes}:${formattedSeconds}`;
}

const styles = StyleSheet.create({
  donateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 28,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
  },
  donateText: {
    color: theme.colors.playButtonIcon,
    fontSize: 15,
    fontWeight: "700",
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  artworkContainer: {
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.surfaceGlassBorder,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 28,
  },
  artworkImage: {
    width: "100%",
    height: "100%",
  },
  artworkPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
  },
  placeholderText: {
    color: theme.colors.textMuted,
    fontSize: 20,
    fontWeight: "700",
  },
  trackInfoSection: {
    width: "100%",
    marginBottom: 20,
    gap: 6,
  },
  trackTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  titleText: {
    flex: 1,
  },
  artistGroupRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoLabel: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  linkPressable: {
    flexShrink: 1,
  },
  cyanLink: {
    color: theme.colors.textCyan,
    fontSize: 14,
    fontWeight: "600",
  },
  progressContainer: {
    width: "100%",
    marginBottom: 20,
  },
  progressBar: {
    width: "100%",
    height: 40,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 4,
  },
  timeText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  liveStation: {
    marginTop: 6,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ff3b5c",
  },
  liveText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  playerWrapper: {
    width: "100%",
    marginTop: 10,
    marginBottom: 30,
  },
});
