import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@/constants/theme";
import {
  DownloadedAlbum,
  DownloadedTrack,
  moveTrack,
  updateAlbum,
  updateTrackTitle,
} from "@/scripts/downloadManager";
import { removeDownloads } from "@/scripts/offlineFiles";
import { showError } from "@/scripts/showError";

export function confirmDeleteAlbum(album: DownloadedAlbum) {
  const count = album.tracks.length;
  Alert.alert(
    "Delete album?",
    `Remove "${album.title}" and its ${count} ${count === 1 ? "song" : "songs"} from this phone?`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => removeDownloads(album.tracks).catch(showError("Couldn't delete album")),
      },
    ],
  );
}

// Edits a saved album in place: its title and artist, and each song's title, order, or removal
export default function AlbumEditor({
  album,
  onKeyChange,
  onDone,
}: {
  album: DownloadedAlbum;
  onKeyChange: (key: string) => void;
  onDone: () => void;
}) {
  // Imported albums are grouped by title, so renaming one gives it a new key
  const renameAlbum = async (changes: { albumTitle?: string; artist?: string }) => {
    const key = await updateAlbum(album.key, changes).catch((err) => {
      showError("Couldn't save")(err);
      return album.key;
    });
    if (key !== album.key) onKeyChange(key);
  };

  const confirmDeleteSong = (track: DownloadedTrack) =>
    Alert.alert("Delete song?", `Remove "${track.title}" from this phone?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => removeDownloads([track]).catch(showError("Couldn't delete song")),
      },
    ]);

  const saveIfChanged = (current: string, save: (value: string) => void) => (e: {
    nativeEvent: { text: string };
  }) => {
    const value = e.nativeEvent.text.trim();
    if (value && value !== current) save(value);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Editing</Text>
        <TouchableOpacity onPress={onDone} style={styles.headerButton} accessibilityLabel="Done editing">
          <Ionicons name="checkmark" size={14} color={theme.colors.textCyan} />
          <Text style={styles.headerButtonText}>Done</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Album title</Text>
      <TextInput
        style={styles.input}
        defaultValue={album.title}
        onEndEditing={saveIfChanged(album.title, (albumTitle) => renameAlbum({ albumTitle }))}
        placeholderTextColor={theme.colors.textMuted}
      />
      <Text style={styles.label}>Artist</Text>
      <TextInput
        style={styles.input}
        defaultValue={album.artist}
        onEndEditing={saveIfChanged(album.artist, (artist) => renameAlbum({ artist }))}
        placeholderTextColor={theme.colors.textMuted}
      />

      {album.tracks.map((track, index) => (
        <View key={track.id} style={styles.song}>
          <Text style={styles.number}>{track.order || index + 1}</Text>
          <TextInput
            style={[styles.input, styles.songInput]}
            defaultValue={track.title}
            onEndEditing={saveIfChanged(track.title, (title) => updateTrackTitle(track.id, title))}
            placeholderTextColor={theme.colors.textMuted}
          />
          <TouchableOpacity
            onPress={() => moveTrack(album.key, track.id, -1)}
            disabled={index === 0}
            style={[styles.iconButton, index === 0 && styles.disabled]}
            accessibilityLabel="Move up"
          >
            <Ionicons name="chevron-up" size={18} color={theme.colors.textCyan} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => moveTrack(album.key, track.id, 1)}
            disabled={index === album.tracks.length - 1}
            style={[styles.iconButton, index === album.tracks.length - 1 && styles.disabled]}
            accessibilityLabel="Move down"
          >
            <Ionicons name="chevron-down" size={18} color={theme.colors.textCyan} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => confirmDeleteSong(track)}
            style={styles.iconButton}
            accessibilityLabel="Delete song"
          >
            <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceCardBorder,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: "600" },
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  headerButtonText: { fontSize: 12, fontWeight: "600", color: theme.colors.textCyan },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceCardBorder,
    color: theme.colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 8,
  },
  song: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  number: {
    width: 24,
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  songInput: { flex: 1, marginLeft: 8, marginBottom: 0, fontSize: 13 },
  iconButton: { padding: 7 },
  disabled: { opacity: 0.25 },
});
