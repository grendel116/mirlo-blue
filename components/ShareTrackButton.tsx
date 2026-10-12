import { Platform, Pressable, Share, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { theme } from "@/constants/theme";
import { songPageUrl } from "@/scripts/utils";

const MIRLO_BLUE_URL = "https://github.com/grendel116/mirlo-blue";

// Shares the current track and Mirlo Blue link through the phone's share sheet.
// Browsers without a share sheet copy the text instead.
export default function ShareTrackButton({
  track,
  size = 22,
  overrideTitle,
  overrideArtist,
}: {
  track: RNTrack;
  size?: number;
  overrideTitle?: string;
  overrideArtist?: string;
}) {
  const url = songPageUrl(track);
  const title = overrideTitle || track.title;
  const artist = overrideArtist || track.artist;
  if (!title) return null;

  const trackLabel =
    track.liveStation && overrideTitle
      ? `${title}${artist ? ` by ${artist}` : ""} (${track.title})`
      : artist
        ? `${title} by ${artist}`
        : title;

  const share = async () => {
    const headline = `Listening to ${trackLabel} on Mirlo Blue - ${MIRLO_BLUE_URL}`;
    const fullText = url ? `${headline}\n${url}` : headline;

    if (Platform.OS === "web" && typeof navigator !== "undefined" && !navigator.share) {
      await Clipboard.setStringAsync(fullText);
      return;
    }
    try {
      await Share.share({ message: fullText, title: headline });
    } catch {}
  };

  return (
    <Pressable
      onPress={share}
      style={styles.button}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Share ${title}`}
    >
      <Ionicons name="share-social-outline" size={size} color={theme.colors.textCyan} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 4,
  },
});

