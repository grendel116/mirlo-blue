import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuthContext } from "@/state/AuthContext";
import { theme } from "@/constants/theme";
import {
  DownloadFormat,
  DownloadStage,
  useDownloads,
} from "@/scripts/downloadManager";
import { chooseFormat } from "@/scripts/chooseFormat";
import { showError } from "@/scripts/showError";
import { ownsAlbum } from "@/scripts/utils";
import { OFFLINE_SUPPORTED, downloadAlbum, removeDownloads } from "@/scripts/offlineFiles";

const STAGE_LABELS: Record<DownloadStage, string> = {
  preparing: "Preparing",
  downloading: "Downloading",
  unpacking: "Unpacking",
};

// Saves an album you own to the phone for offline listening, or removes it again
export default function DownloadAlbumButton({ album, size = 32 }: { album: AlbumProps; size?: number }) {
  const { user } = useAuthContext();
  const downloads = useDownloads();
  const [stage, setStage] = useState<DownloadStage | null>(null);

  if (!OFFLINE_SUPPORTED || !ownsAlbum(user, album)) return null;

  const saved = downloads.filter((d) => album.tracks?.some((t) => t.id === d.id));
  const isDownloaded = saved.length > 0 && saved.length >= (album.tracks?.length ?? 0);

  const start = (format: DownloadFormat) => {
    setStage("preparing");
    downloadAlbum(album, format, setStage)
      .catch(showError("Download failed"))
      .finally(() => setStage(null));
  };

  const onPress = () => {
    if (stage) return;
    if (isDownloaded) {
      Alert.alert("Remove download?", `${album.title} will only play online.`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeDownloads(saved),
        },
      ]);
      return;
    }
    chooseFormat("Download album", start);
  };

  return (
    <Pressable
      onPress={onPress}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={
        stage ? STAGE_LABELS[stage] : isDownloaded ? "Remove download" : "Download album"
      }
    >
      {stage ? (
        <View style={styles.progress}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.stage}>{STAGE_LABELS[stage]}</Text>
        </View>
      ) : (
        <Ionicons
          name={isDownloaded ? "checkmark-circle" : "arrow-down-circle-outline"}
          size={size}
          color={isDownloaded ? theme.colors.primary : "#ababab"}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
  },
  progress: {
    alignItems: "center",
    gap: 2,
  },
  stage: {
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
});
