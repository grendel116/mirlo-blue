import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuthContext } from "@/state/AuthContext";
import { theme } from "@/constants/theme";
import {
  DOWNLOAD_FORMATS,
  DownloadedTrack,
  DownloadStage,
  getDownloadedTracks,
  subscribeDownloads,
} from "@/scripts/downloadManager";
import { OFFLINE_SUPPORTED, downloadAlbum, removeDownload } from "@/scripts/offlineFiles";

const STAGE_LABELS: Record<DownloadStage, string> = {
  preparing: "Preparing",
  downloading: "Downloading",
  unpacking: "Unpacking",
};

// Saves an album you own to the phone for offline listening, or removes it again
export default function DownloadAlbumButton({ album, size = 32 }: { album: AlbumProps; size?: number }) {
  const { user } = useAuthContext();
  const [downloads, setDownloads] = useState<DownloadedTrack[]>([]);
  const [stage, setStage] = useState<DownloadStage | null>(null);

  useEffect(() => {
    getDownloadedTracks().then(setDownloads);
    return subscribeDownloads(setDownloads);
  }, []);

  const owned =
    !!user &&
    (album.userTrackGroupPurchases?.some((p) => p.userId === user.id) ||
      (album.artist as any)?.userId === user.id);
  if (!OFFLINE_SUPPORTED || !owned) return null;

  const saved = downloads.filter((d) => album.tracks?.some((t) => t.id === d.id));
  const isDownloaded = saved.length > 0;

  const start = (format: (typeof DOWNLOAD_FORMATS)[number]["id"]) => {
    setStage("preparing");
    downloadAlbum(album, format, setStage)
      .catch((err) => Alert.alert("Download failed", err instanceof Error ? err.message : String(err)))
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
          onPress: async () => {
            for (const dl of saved) await removeDownload(dl);
          },
        },
      ]);
      return;
    }
    Alert.alert("Download album", "Choose a format", [
      ...DOWNLOAD_FORMATS.map((f) => ({ text: f.label, onPress: () => start(f.id) })),
      { text: "Cancel", style: "cancel" as const },
    ]);
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
    marginHorizontal: 4,
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
