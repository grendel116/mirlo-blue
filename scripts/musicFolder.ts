import { useEffect, useState } from "react";
import { Directory, File, Paths } from "expo-file-system";
import { copyAsync } from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { readTags } from "./readTags";
import {
  DownloadedTrack,
  forgetDownloadedTracks,
  getDownloadedTracks,
  saveDownloadedTracks,
} from "./downloadManager";
import {
  AUDIO_FILE,
  folderChanges,
  IMAGE_FILE,
  namesFromFile,
  pickCover,
  safeFileName,
  songDetails,
} from "./songFiles";

// The listener's chosen music folder on the phone (Android SAF / iOS directory picker).
// Its URI is kept in AsyncStorage so the app remembers it across visits. The app only indexes
// and plays what's in it; Rescan brings Downloads in line with the folder's audio files

export type MusicFolderStatus = "unsupported" | "none" | "needs-permission" | "ready";

const FOLDER_URI_KEY = "mirlo_blue_music_folder_uri";

let folderUri: string | null = null;
let status: MusicFolderStatus = "none";
const listeners = new Set<() => void>();

function setStatus(next: MusicFolderStatus) {
  status = next;
  listeners.forEach((listener) => listener());
}

function folderDisplayName(uri: string): string {
  const decoded = decodeURIComponent(uri).replace(/\/+$/, "");
  return decoded.split(/[/:]/).pop() || "Music";
}

export function useMusicFolder(): { status: MusicFolderStatus; name: string } {
  const [, redraw] = useState(0);
  useEffect(() => {
    const listener = () => redraw((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return { status, name: folderUri ? folderDisplayName(folderUri) : "" };
}

export async function openMusicFolder(): Promise<void> {
  const saved = await AsyncStorage.getItem(FOLDER_URI_KEY);
  if (!saved) {
    folderUri = null;
    return setStatus("none");
  }
  folderUri = saved;
  try {
    const dir = new Directory(saved);
    if (!dir.exists) return setStatus("needs-permission");
    setStatus("ready");
  } catch {
    setStatus("needs-permission");
  }
}

export async function chooseMusicFolder(): Promise<boolean> {
  let picked: Directory;
  try {
    picked = await Directory.pickDirectoryAsync(folderUri ?? undefined);
  } catch {
    return false;
  }
  folderUri = picked.uri;
  await AsyncStorage.setItem(FOLDER_URI_KEY, picked.uri);
  await rescanMusicFolder();
  setStatus("ready");
  return true;
}

export async function reconnectMusicFolder(): Promise<boolean> {
  return chooseMusicFolder();
}


function cleanEntryName(uri: string): string {
  const decoded = decodeURIComponent(uri).replace(/\/+$/, "");
  return decoded.split(/[/:]/).pop() || "file";
}

function coversFolder(): Directory {
  const folder = new Directory(Paths.document, "downloads", "covers");
  folder.create({ intermediates: true, idempotent: true });
  return folder;
}

// The folder's access grants don't let the tag reader open its files directly, so a song's
// tags are read from a short-lived copy in the cache
async function tagsOf(source: File, name: string, index: number) {
  const temp = new File(Paths.cache, `scan-${index}-${safeFileName(name)}`);
  await copyAsync({ from: source.uri, to: temp.uri });
  const handle = temp.open();
  try {
    return readTags((offset, length) => {
      handle.offset = offset;
      return handle.readBytes(length);
    });
  } finally {
    handle.close();
    if (temp.exists) temp.delete();
  }
}

type FoundItem = {
  path: string;
  file: File;
  dirPath: string;
  dirName: string;
};

function scanTree(dir: Directory, prefix: string): { audio: FoundItem[]; images: FoundItem[] } {
  const audio: FoundItem[] = [];
  const images: FoundItem[] = [];
  const dirName = cleanEntryName(dir.uri);

  for (const entry of dir.list()) {
    const name = cleanEntryName(entry.uri);
    const path = prefix ? `${prefix}/${name}` : name;
    if (entry instanceof Directory) {
      const sub = scanTree(entry, path);
      audio.push(...sub.audio);
      images.push(...sub.images);
    } else if (AUDIO_FILE.test(name)) {
      audio.push({ path, file: entry, dirPath: prefix, dirName });
    } else if (IMAGE_FILE.test(name)) {
      images.push({ path, file: entry, dirPath: prefix, dirName });
    }
  }
  return { audio, images };
}

// Brings Downloads in line with the folder: songs whose files are gone are forgotten, and audio
// files not indexed yet join as your own songs, described by their tags, names and folders.
// The songs stay where they are and play from there
export async function rescanMusicFolder(): Promise<void> {
  if (!folderUri) return;
  const root = new Directory(folderUri);
  if (!root.exists) {
    setStatus("needs-permission");
    return;
  }

  const { audio, images } = scanTree(root, "");
  const { gone, added } = folderChanges(
    await getDownloadedTracks(),
    audio.map((a) => a.path),
  );
  await forgetDownloadedTracks(gone);

  const now = Date.now();
  const coversByAlbum = new Map<string, string>();
  const saved: DownloadedTrack[] = [];

  for (const [index, path] of added.entries()) {
    const item = audio.find((a) => a.path === path)!;
    const name = cleanEntryName(item.file.uri);
    const tags = await tagsOf(item.file, name, index);
    const parent = namesFromFile(item.dirName);
    const details = songDetails(
      tags,
      name,
      index,
      parent.title || item.dirName,
      parent.artist || undefined,
    );
    const albumKey = details.albumTitle.toLowerCase();

    if (!coversByAlbum.has(albumKey)) {
      if (tags.cover) {
        const ext = tags.cover.mime.includes("png") ? "png" : "jpg";
        const cover = new File(coversFolder(), `${now}-${index}.${ext}`);
        cover.write(tags.cover.bytes);
        coversByAlbum.set(albumKey, cover.uri);
      } else {
        const dirImages = images.filter((img) => img.dirPath === item.dirPath);
        const picked = pickCover(dirImages.map((img) => img.path));
        const image = dirImages.find((img) => img.path === picked);
        if (image) coversByAlbum.set(albumKey, image.file.uri);
      }
    }

    saved.push({
      id: -(now + index),
      ...details,
      artwork: coversByAlbum.get(albumKey),
      url: item.file.uri,
      path: item.path,
      bytes: item.file.size,
      downloadedAt: now,
      source: "file",
    });
  }

  if (saved.length > 0) await saveDownloadedTracks(saved);
}
