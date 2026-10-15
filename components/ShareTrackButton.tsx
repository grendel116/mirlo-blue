import { Platform, Pressable, Share, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { theme } from "@/constants/theme";
import { songPageUrl } from "@/scripts/utils";

// Shares the song's Mirlo page through the phone's share sheet. Browsers without a share
// sheet copy the link instead
export default function ShareTrackButton({ track, size = 22 }: { track: RNTrack; size?: number }) {
  const url = songPageUrl(track);
  if (!url) return null;

  const share = async () => {
    const message = `${track.title} by ${track.artist} on Mirlo`;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && !navigator.share) {
      await Clipboard.setStringAsync(url);
      return;
    }
    try {
      await Share.share(
        Platform.OS === "ios" ? { message, url } : { message: `${message}\n${url}`, title: message },
      );
    } catch {}
  };

  return (
    <Pressable
      onPress={share}
      style={styles.button}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Share ${track.title}`}
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
