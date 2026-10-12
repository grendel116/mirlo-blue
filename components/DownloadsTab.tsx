import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import AlbumSongs from "@/components/AlbumSongs";
import { showError } from "@/scripts/showError";
import { theme } from "@/constants/theme";
import { usePlayer } from "@/state/PlayerContext";
import {
  DownloadedAlbum,
  downloadToTrack,
  groupTracksIntoAlbums,
  useDownloads,
} from "@/scripts/downloadManager";
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

// Everything saved on this phone, shown as albums: play, expand, set a cover, delete, add more.
// `openAlbum` is an album key to show expanded, as when History links here
export default function DownloadsTab({ openAlbum }: { openAlbum?: string }) {
  const { playTrack, activeTrack } = usePlayer();
  const tracks = useDownloads();
  const albums = useMemo(() => groupTracksIntoAlbums(tracks), [tracks]);
  const [expandedKey, setExpandedKey] = useState<string | null>(openAlbum ?? null);
  useEffect(() => {
    if (openAlbum) setExpandedKey(openAlbum);
  }, [openAlbum]);
  const [importing, setImporting] = useState<"files" | "folder" | null>(null);

  const playAlbum = (album: DownloadedAlbum, start = album.tracks[0]) =>
    playTrack(downloadToTrack(start), album.tracks.map(downloadToTrack), album.title);

  const handleImportFiles = async () => {
    setImporting("files");
    try {
      const key = await importFiles();
      if (key) setExpandedKey(key);
    } catch (err) {
      showError("Couldn't add files")(err);
    } finally {
      setImporting(null);
    }
  };

  const handleImportFolder = async () => {
    setImporting("folder");
    try {
      const key = await importFolder();
      if (key) setExpandedKey(key);
    } catch (err) {
      showError("Couldn't add folder")(err);
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
              onPress={handleImportFiles}
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
              onPress={handleImportFolder}
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
          contentContainerStyle={styles.list}
          renderItem={({ item: album }) => {
            const expanded = expandedKey === album.key;
            const toggle = () => setExpandedKey(expanded ? null : album.key);
            return (
              <View style={[styles.card, expanded && styles.cardExpanded]}>
                <View style={styles.header}>
                  <TouchableOpacity
                    onPress={() => chooseAlbumCover(album).catch(showError("Couldn't set cover"))}
                    style={styles.coverWrap}
                    accessibilityLabel="Change album cover"
                  >
                    {album.artwork ? (
                      <Image source={{ uri: album.artwork }} style={styles.cover} />
                    ) : (
                      <View style={[styles.cover, styles.coverEmpty]}>
                        <Ionicons name="image-outline" size={22} color={theme.colors.primary} />
                        <Text style={styles.coverHint}>+ Cover</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <Pressable style={styles.meta} onPress={toggle}>
                    <Text style={styles.albumTitle} numberOfLines={1}>
                      {album.title}
                    </Text>
                    <Text style={styles.albumArtist} numberOfLines={1}>
                      {album.artist}
                    </Text>
                    <Text style={styles.albumInfo}>
                      {album.tracks.length} {album.tracks.length === 1 ? "song" : "songs"} •{" "}
                      {formatBytes(album.totalBytes)}
                    </Text>
                  </Pressable>

                  <TouchableOpacity
                    onPress={() => playAlbum(album)}
                    style={styles.playButton}
                    accessibilityLabel={`Play ${album.title}`}
                  >
                    <Ionicons name="play" size={18} color={theme.colors.playButtonIcon} style={{ marginLeft: 2 }} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={toggle}
                    style={styles.chevron}
                    accessibilityLabel={expanded ? "Collapse" : "Expand"}
                  >
                    <Ionicons
                      name={expanded ? "chevron-up" : "chevron-down"}
                      size={20}
                      color={theme.colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>

                {expanded && (
                  <AlbumSongs
                    album={album}
                    activeId={activeTrack?.id}
                    onPlay={(track) => playAlbum(album, track)}
                    onKeyChange={setExpandedKey}
                  />
                )}
              </View>
            );
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

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
  list: { padding: 12, paddingBottom: 40 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.surfaceCardBorder,
  },
  cardExpanded: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceElevated,
  },
  header: { flexDirection: "row", alignItems: "center" },
  coverWrap: {
    width: 60,
    height: 60,
    borderRadius: theme.radius.sm,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceElevated,
  },
  cover: { width: "100%", height: "100%" },
  coverEmpty: { justifyContent: "center", alignItems: "center" },
  coverHint: { fontSize: 9, fontWeight: "700", color: theme.colors.primary, marginTop: 2 },
  meta: { flex: 1, marginLeft: 12, justifyContent: "center" },
  albumTitle: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: "700" },
  albumArtist: { color: theme.colors.textCyan, fontSize: 13, marginTop: 2 },
  albumInfo: { color: theme.colors.textSecondary, fontSize: 11, marginTop: 3 },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginLeft: 8,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  chevron: { padding: 6 },
});

