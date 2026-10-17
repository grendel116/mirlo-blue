import { useEffect, useState } from "react";
import { Directory, File, Paths } from "expo-file-system";
import { copyAsync } from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { unzip } from "react-native-zip-archive";
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
// Its URI is kept in AsyncStorage so the app remembers it across visits, and Rescan brings
// Downloads in line with the files and zip archives inside it

export type MusicFolderStatus = "unsupported" | "none" | "needs-permission" | "ready";

const FOLDER_URI_KEY = "mirlo_blue_music_folder_uri";
const ZIP_FILE = /\.zip$/i;

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

function pathOf(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ""));
}

function downloadsFolder(name: string): Directory {
  const folder = new Directory(Paths.document, "downloads", name);
  folder.create({ intermediates: true, idempotent: true });
  return folder;
}

function tagsOf(file: File) {
  const handle = file.open();
  try {
    return readTags((offset, length) => {
      handle.offset = offset;
      return handle.readBytes(length);
    });
  } finally {
    handle.close();
  }
}

function filesIn(folder: Directory): File[] {
  return folder
    .list()
    .flatMap((entry) => (entry instanceof Directory ? filesIn(entry) : [entry]));
}

type FoundItem = {
  path: string;
  file: File;
  dirPath: string;
  dirName: string;
};

function scanTree(dir: Directory, prefix: string): { audio: FoundItem[]; images: FoundItem[]; zips: FoundItem[] } {
  const audio: FoundItem[] = [];
  const images: FoundItem[] = [];
  const zips: FoundItem[] = [];
  const dirName = cleanEntryName(dir.uri);

  for (const entry of dir.list()) {
    const name = cleanEntryName(entry.uri);
    const path = prefix ? `${prefix}/${name}` : name;
    if (entry instanceof Directory) {
      const sub = scanTree(entry, path);
      audio.push(...sub.audio);
      images.push(...sub.images);
      zips.push(...sub.zips);
    } else if (AUDIO_FILE.test(name)) {
      audio.push({ path, file: entry, dirPath: prefix, dirName });
    } else if (IMAGE_FILE.test(name)) {
      images.push({ path, file: entry, dirPath: prefix, dirName });
    } else if (ZIP_FILE.test(name)) {
      zips.push({ path, file: entry, dirPath: prefix, dirName });
    }
  }
  return { audio, images, zips };
}

export async function rescanMusicFolder(): Promise<void> {
  if (!folderUri) return;
  const root = new Directory(folderUri);
  if (!root.exists) {
    setStatus("needs-permission");
    return;
  }

  const { audio, images, zips } = scanTree(root, "");
  const foundPaths = [
    ...audio.map((a) => a.path),
    ...zips.map((z) => z.path),
  ];

  const currentTracks = await getDownloadedTracks();
  // Tracks imported from a zip archive share a path prefix `<zipPath>::<innerName>`
  const goneIds = currentTracks
    .filter((t) => {
      if (!t.path) return false;
      const basePath = t.path.split("::")[0];
      return !foundPaths.includes(basePath);
    })
    .map((t) => t.id);

  if (goneIds.length > 0) {
    const goneTracks = currentTracks.filter((t) => goneIds.includes(t.id));
    for (const t of goneTracks) {
      try {
        const f = new File(t.url);
        if (f.exists) f.delete();
      } catch {}
    }
    await forgetDownloadedTracks(goneIds);
  }

  const remaining = await getDownloadedTracks();
  const { added } = folderChanges(remaining, audio.map((a) => a.path));
  const knownZipPaths = new Set(
    remaining
      .map((t) => t.path?.split("::")[0])
      .filter((p): p is string => Boolean(p)),
  );
  const addedZips = zips.filter((z) => !knownZipPaths.has(z.path));

  const now = Date.now();
  const destFolder = downloadsFolder("files");
  const coversFolder = downloadsFolder("covers");
  const coversByAlbum = new Map<string, string>();
  const dirCoverCache = new Map<string, string>();
  const saved: DownloadedTrack[] = [];
  let index = 0;

  for (const path of added) {
    const item = audio.find((a) => a.path === path)!;
    const origName = cleanEntryName(item.file.uri);
    const destFile = new File(destFolder, `${now}-${index}-${safeFileName(origName)}`);
    await copyAsync({ from: item.file.uri, to: destFile.uri });

    let folderCover = dirCoverCache.get(item.dirPath);
    if (!folderCover) {
      const dirImages = images.filter((img) => img.dirPath === item.dirPath);
      const pickedImgPath = pickCover(dirImages.map((img) => img.path));
      const pickedImg = dirImages.find((img) => img.path === pickedImgPath);
      if (pickedImg) {
        const ext = cleanEntryName(pickedImg.file.uri).split(".").pop() || "jpg";
        const destCover = new File(coversFolder, `${now}-${index}-cover.${ext}`);
        await copyAsync({ from: pickedImg.file.uri, to: destCover.uri });
        folderCover = destCover.uri;
        dirCoverCache.set(item.dirPath, folderCover);
      }
    }

    const tags = tagsOf(destFile);
    const parent = namesFromFile(item.dirName);
    const details = songDetails(
      tags,
      origName,
      index,
      parent.title || item.dirName,
      parent.artist || undefined,
    );
    const albumKey = details.albumTitle.toLowerCase();

    if (tags.cover && !coversByAlbum.has(albumKey)) {
      const ext = tags.cover.mime.includes("png") ? "png" : "jpg";
      const cover = new File(coversFolder, `${now}-${index}.${ext}`);
      cover.write(tags.cover.bytes);
      coversByAlbum.set(albumKey, cover.uri);
    } else if (folderCover && !coversByAlbum.has(albumKey)) {
      coversByAlbum.set(albumKey, folderCover);
    }

    saved.push({
      id: -(now + index),
      ...details,
      artwork: coversByAlbum.get(albumKey),
      url: destFile.uri,
      path: item.path,
      bytes: destFile.size,
      downloadedAt: now,
      source: "file",
    });
    index++;
  }

  for (const zipItem of addedZips) {
    const origZipName = cleanEntryName(zipItem.file.uri);
    const tempZip = new File(Paths.cache, `folder-zip-${now}-${index}.zip`);
    const tempDir = new Directory(Paths.cache, `folder-unzip-${now}-${index}`);
    tempDir.create({ intermediates: true, idempotent: true });
    try {
      await copyAsync({ from: zipItem.file.uri, to: tempZip.uri });
      await unzip(pathOf(tempZip.uri), pathOf(tempDir.uri));
      const unpacked = filesIn(tempDir);
      const unpackedAudio = unpacked.filter((f) => AUDIO_FILE.test(f.name));
      const unpackedImg = unpacked.find((f) => IMAGE_FILE.test(f.name));

      let zipCover: string | undefined;
      if (unpackedImg && unpackedAudio.length > 0) {
        const ext = unpackedImg.name.split(".").pop() || "jpg";
        const destCover = new File(coversFolder, `${now}-${index}-cover.${ext}`);
        unpackedImg.copy(destCover);
        zipCover = destCover.uri;
      }

      const namedZip = namesFromFile(origZipName);
      const parent = namesFromFile(zipItem.dirName);
      const fallbackAlbum = namedZip.title || parent.title || zipItem.dirName;
      const fallbackArtist = namedZip.artist || parent.artist || undefined;

      for (const audioFile of unpackedAudio) {
        const destFile = new File(destFolder, `${now}-${index}-${safeFileName(audioFile.name)}`);
        audioFile.copy(destFile);
        const tags = tagsOf(destFile);
        const details = songDetails(tags, audioFile.name, index, fallbackAlbum, fallbackArtist);
        const albumKey = details.albumTitle.toLowerCase();

        if (tags.cover && !coversByAlbum.has(albumKey)) {
          const ext = tags.cover.mime.includes("png") ? "png" : "jpg";
          const cover = new File(coversFolder, `${now}-${index}.${ext}`);
          cover.write(tags.cover.bytes);
          coversByAlbum.set(albumKey, cover.uri);
        } else if (zipCover && !coversByAlbum.has(albumKey)) {
          coversByAlbum.set(albumKey, zipCover);
        }

        saved.push({
          id: -(now + index),
          ...details,
          artwork: coversByAlbum.get(albumKey),
          url: destFile.uri,
          path: `${zipItem.path}::${audioFile.name}`,
          bytes: destFile.size,
          downloadedAt: now,
          source: "file",
        });
        index++;
      }
    } finally {
      if (tempDir.exists) tempDir.delete();
      if (tempZip.exists) tempZip.delete();
    }
  }

  if (saved.length > 0) {
    await saveDownloadedTracks(saved);
  }
}
