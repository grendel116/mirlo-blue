import { memo, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import AlbumEditor, { confirmDeleteAlbum } from "@/components/AlbumEditor";
import { showError } from "@/scripts/showError";
import { theme } from "@/constants/theme";
import { DownloadedAlbum, groupTracksIntoAlbums, useDownloads } from "@/scripts/downloadManager";
import { openDownloadedAlbum } from "@/scripts/albumLookup";
import {
  OFFLINE_SUPPORTED,
  chooseAlbumCover,
  importFiles,
  importFolder,
} from "@/scripts/offlineFiles";

export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${Math.round(bytes / 1e3)} KB`;
}

// Everything saved on this phone, one row per album like the other Library boxes. Tapping an
// album opens its page; holding it offers the cover, editing, and delete
export default memo(function DownloadsTab() {
  const tracks = useDownloads();
  const albums = useMemo(() => groupTracksIntoAlbums(tracks), [tracks]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const [importing, setImporting] = useState<"files" | "folder" | null>(null);

  const open = async (album: DownloadedAlbum) => {
    setOpeningKey(album.key);
    try {
      await openDownloadedAlbum(album.key);
    } finally {
      setOpeningKey(null);
    }
  };

  const showTools = (album: DownloadedAlbum) =>
    Alert.alert(
      album.title,
      undefined,
      [
        {
          text: "Change cover",
          onPress: () => chooseAlbumCover(album).catch(showError("Couldn't set cover")),
        },
        { text: "Edit", onPress: () => setEditingKey(album.key) },
        { text: "Delete", style: "destructive", onPress: () => confirmDeleteAlbum(album) },
        // Android shows three buttons at most and closes on a tap outside instead
        ...(Platform.OS === "ios" ? [{ text: "Cancel", style: "cancel" as const }] : []),
      ],
      { cancelable: true },
    );

  const runImport = async (kind: "files" | "folder") => {
    setImporting(kind);
    try {
      await (kind === "files" ? importFiles() : importFolder());
    } catch (err) {
      showError(kind === "files" ? "Couldn't add files" : "Couldn't add folder")(err);
    } finally {
      setImporting(null);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.pane} behavior="padding">
      <View style={styles.bar}>
        <Text style={styles.total}>
          {albums.length > 0
            ? `${albums.length} ${albums.length === 1 ? "album" : "albums"} • ${formatBytes(
                tracks.reduce((sum, t) => sum + (t.bytes || 0), 0),
              )}`
            : ""}
        </Text>
        {OFFLINE_SUPPORTED && (
          <View style={styles.barActions}>
            <TouchableOpacity
              onPress={() => runImport("files")}
              disabled={importing !== null}
              style={styles.addButton}
              accessibilityLabel="Add audio or zip files from this phone"
            >
              {importing === "files" ? (
                <ActivityIndicator size="small" color={theme.colors.playButtonIcon} />
              ) : (
                <Ionicons name="add" size={15} color={theme.colors.playButtonIcon} />
              )}
              <Text style={styles.addButtonText}>Add files</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => runImport("folder")}
              disabled={importing !== null}
              style={styles.folderButton}
              accessibilityLabel="Add folder from this phone"
            >
              {importing === "folder" ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Ionicons name="folder-open-outline" size={14} color={theme.colors.primary} />
              )}
              <Text style={styles.folderButtonText}>Add folder</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {albums.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="download-outline" size={48} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>No downloads yet</Text>
          <Text style={styles.emptyText}>
            {OFFLINE_SUPPORTED
              ? "Tap the download arrow on an album you own, or add files and folders from your phone."
              : "Downloads work in the Android app."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={albums}
          keyExtractor={(album) => album.key}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          contentContainerStyle={styles.list}
          renderItem={({ item: album }) => (
            <View style={[styles.card, editingKey === album.key && styles.cardEditing]}>
              <Pressable
                android_ripple={{ color: theme.colors.ripple }}
                onPress={() => open(album)}
                onLongPress={() => showTools(album)}
                disabled={openingKey !== null}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
                accessibilityHint="Hold for cover, edit, and delete"
              >
                {album.artwork ? (
                  <Image source={{ uri: album.artwork }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.placeholder]}>
                    <Ionicons name="musical-notes" size={20} color={theme.colors.primary} />
                  </View>
                )}
                <View style={styles.info}>
                  <Text style={styles.title} numberOfLines={1}>
                    {album.title}
                  </Text>
                  <Text style={styles.artist} numberOfLines={1}>
                    {album.artist}
                  </Text>
                  <Text style={styles.meta}>
                    {album.tracks.length} {album.tracks.length === 1 ? "song" : "songs"} •{" "}
                    {formatBytes(album.totalBytes)}
                  </Text>
                </View>
                {openingKey === album.key ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                )}
              </Pressable>

              {editingKey === album.key && (
                <AlbumEditor
                  album={album}
                  onKeyChange={setEditingKey}
                  onDone={() => setEditingKey(null)}
                />
              )}
            </View>
          )}
        />
      )}
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  pane: { flex: 1 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  total: { color: theme.colors.textSecondary, fontSize: 12 },
  barActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
  },
  addButtonText: { color: theme.colors.playButtonIcon, fontSize: 12, fontWeight: "700" },
  folderButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  folderButtonText: { color: theme.colors.primary, fontSize: 12, fontWeight: "700" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 10 },
  emptyTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "700" },
  emptyText: { color: theme.colors.textSecondary, fontSize: 13, textAlign: "center" },
  list: { padding: 12, paddingBottom: 80 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.surfaceCardBorder,
  },
  cardEditing: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceElevated,
  },
  row: { flexDirection: "row", alignItems: "center" },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceElevated,
  },
  placeholder: { justifyContent: "center", alignItems: "center" },
  info: { flex: 1, marginLeft: 12 },
  title: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" },
  artist: { color: theme.colors.textCyan, fontSize: 12, marginTop: 2 },
  meta: { color: theme.colors.textSecondary, fontSize: 11, marginTop: 2 },
});
