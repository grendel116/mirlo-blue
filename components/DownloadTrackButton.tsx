import { useState } from "react";
import { ActivityIndicator, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuthContext } from "@/state/AuthContext";
import { theme } from "@/constants/theme";
import { useDownloads } from "@/scripts/downloadManager";
import { OFFLINE_SUPPORTED, downloadTrack, removeDownloads } from "@/scripts/offlineFiles";
import { chooseFormat } from "@/scripts/chooseFormat";
import { showError } from "@/scripts/showError";
import { ownsAlbum } from "@/scripts/utils";

// Saves one song of an album you own to the phone, or removes it again
export default function DownloadTrackButton({
  track,
  album,
  size = 17,
}: {
  track: RNTrack;
  album: AlbumProps;
  size?: number;
}) {
  const { user } = useAuthContext();
  const saved = useDownloads().find((d) => d.id === track.id);
  const [busy, setBusy] = useState(false);

  if (!OFFLINE_SUPPORTED || !ownsAlbum(user, album) || track.isPreview) return null;

  const onPress = () => {
    if (busy) return;
    if (saved) {
      removeDownloads([saved]).catch(showError("Couldn't remove song"));
      return;
    }
    chooseFormat(`Download ${track.title}`, (format) => {
      setBusy(true);
      downloadTrack(album, track, format, () => {})
        .catch(showError("Download failed"))
        .finally(() => setBusy(false));
    });
  };

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={saved ? `Remove ${track.title} download` : `Download ${track.title}`}
    >
      {busy ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <Ionicons
          name={saved ? "checkmark-circle" : "arrow-down-circle-outline"}
          size={size}
          color={saved ? theme.colors.primary : "#ababab"}
        />
      )}
    </Pressable>
  );
}