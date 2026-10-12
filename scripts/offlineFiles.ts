import { Directory, File, Paths } from "expo-file-system";
import { copyAsync } from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import { unzip } from "react-native-zip-archive";
import { readTags } from "./readTags";
import { API_ROOT } from "@/constants/api-root";
import * as api from "@/queries/fetch/fetchWrapper";
import {
  albumKeyOf,
  DownloadedAlbum,
  DownloadedTrack,
  DownloadFormat,
  DownloadStage,
  forgetDownloadedTracks,
  getDownloadedTracks,
  saveDownloadedTracks,
  updateAlbum,
} from "./downloadManager";

// Saving files to the phone. The web build uses offlineFiles.web.ts instead
export const OFFLINE_SUPPORTED = true;

const AUDIO_FILE = /\.(mp3|flac|m4a|opus|ogg|wav|aac)$/i;
const IMAGE_FILE = /\.(jpe?g|png|webp)$/i;
const ZIP_FILE = /\.zip$/i;
const POLL_MS = 4000;
const PREPARE_TIMEOUT_MS = 10 * 60 * 1000;

type MirloJobResponse = { result: true | { jobId: string } | { url: string } };

function downloadsFolder(name: string): Directory {
  const folder = new Directory(Paths.document, "downloads", name);
  folder.create({ intermediates: true, idempotent: true });
  return folder;
}

// The zip library takes plain paths rather than file:// uris
function pathOf(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ""));
}

function filesIn(folder: Directory): File[] {
  return folder.list().flatMap((entry) => (entry instanceof Directory ? filesIn(entry) : [entry]));
}

async function waitForMirloJob(jobId: string): Promise<void> {
  const deadline = Date.now() + PREPARE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { results } = await api.get<{ results: { jobStatus: string }[] }>(
      `/v1/jobs?queue=generateAlbum&ids=${jobId}`,
      {},
    );
    const status = results[0]?.jobStatus;
    if (status === "completed") return;
    if (status === "failed") throw new Error("Mirlo couldn't prepare this download");
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error("Mirlo took too long to prepare this download");
}

type MirloSource = "trackGroups" | "tracks";

// The parts of a Mirlo track we save
type MirloTrack = { id: number; title: string; order?: number; audio?: { duration?: number } };

// Mirlo builds a zip on request: start it, wait until it's ready, then ask for it.
// The answer is a temporary download link, or the zip itself when Mirlo serves it directly
async function mirloZipUrl(source: MirloSource, id: number, format: DownloadFormat): Promise<string> {
  const resource = `/v1/${source}/${id}`;
  const generated = await api.get<MirloJobResponse>(`${resource}/generate?format=${format}`, {});
  if (typeof generated.result === "object" && "jobId" in generated.result) {
    await waitForMirloJob(generated.result.jobId);
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const download = await api.get<MirloJobResponse>(`${resource}/download?format=${format}`, {});
    if (typeof download.result === "object" && "url" in download.result) return download.result.url;
    if (typeof download.result === "object" && "jobId" in download.result) {
      await waitForMirloJob(download.result.jobId);
      continue;
    }
    break;
  }
  return `${API_ROOT}${resource}/download?format=${format}`;
}

// Downloads a Mirlo zip and unpacks it into the album's folder, returning the folder, its
// audio files and its cover. Mirlo names each song "<track number>-<title>"
async function fetchMirloFiles(
  source: MirloSource,
  id: number,
  album: AlbumProps,
  format: DownloadFormat,
  onStage: (stage: DownloadStage) => void,
) {
  onStage("preparing");
  const url = await mirloZipUrl(source, id, format);

  onStage("downloading");
  const zip = new File(Paths.cache, `${source}-${id}.zip`);
  const headers = url.startsWith(API_ROOT) ? await api.mirloHeaders() : undefined;
  try {
    await File.downloadFileAsync(url, zip, { headers, idempotent: true });

    onStage("unpacking");
    // A song joins the album's folder; a whole album replaces it
    const folder = new Directory(Paths.document, "downloads", `album-${album.id}`);
    if (source === "trackGroups" && folder.exists) folder.delete();
    folder.create({ intermediates: true, idempotent: true });
    await unzip(pathOf(zip.uri), pathOf(folder.uri));

    const files = filesIn(folder);
    return {
      folder,
      audio: files.filter((f) => AUDIO_FILE.test(f.name)),
      cover: files.find((f) => IMAGE_FILE.test(f.name))?.uri ?? album.cover?.sizes?.[600],
    };
  } finally {
    if (zip.exists) zip.delete();
  }
}

function savedFromMirlo(
  file: File,
  folder: Directory,
  album: AlbumProps,
  track: MirloTrack | undefined,
  cover: string | undefined,
  fallbackId: number,
): DownloadedTrack {
  return {
    id: track?.id ?? fallbackId,
    title: track?.title ?? namesFromFile(file.name).title,
    artist: album.artist?.name ?? "",
    albumTitle: album.title,
    artwork: cover,
    url: file.uri,
    folder: folder.uri,
    duration: track?.audio?.duration,
    bytes: file.size,
    order: track?.order,
    downloadedAt: Date.now(),
    source: "mirlo",
  };
}

// Downloads an album you own from Mirlo and unpacks it into the app's storage, tying every
// file back to its Mirlo track by track number
export async function downloadAlbum(
  album: AlbumProps,
  format: DownloadFormat,
  onStage: (stage: DownloadStage) => void,
): Promise<number> {
  const { folder, audio, cover } = await fetchMirloFiles("trackGroups", album.id, album, format, onStage);
  const tracks = album.tracks ?? [];
  const saved = audio
    .sort((a, b) => parseInt(a.name, 10) - parseInt(b.name, 10))
    .map((file, i) =>
      savedFromMirlo(
        file,
        folder,
        album,
        tracks.find((t) => t.order === parseInt(file.name, 10)),
        cover,
        -(Date.now() + i),
      ),
    );
  await saveDownloadedTracks(saved);
  return saved.length;
}

// Downloads one song of an album you own, into that album's folder
export async function downloadTrack(
  album: AlbumProps,
  track: MirloTrack,
  format: DownloadFormat,
  onStage: (stage: DownloadStage) => void,
): Promise<void> {
  const { folder, audio, cover } = await fetchMirloFiles("tracks", track.id, album, format, onStage);
  const file = audio[0];
  if (!file) throw new Error("Mirlo didn't send this song");
  await saveDownloadedTracks([savedFromMirlo(file, folder, album, track, cover, track.id)]);
}

// "01 - Artist - Title.mp3" → track number, artist, and title; anything else becomes the title
function namesFromFile(fileName: string): { title: string; artist: string; track?: number } {
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  const numMatch = withoutExt.match(/^(\d+)\s*[-._\s]\s*/);
  const track = numMatch ? parseInt(numMatch[1], 10) : undefined;
  const base = withoutExt.replace(/^\d+\s*[-._\s]\s*/, "");
  const split = base.indexOf(" - ");
  if (split === -1) return { title: base, artist: "", track };
  return { artist: base.slice(0, split), title: base.slice(split + 3), track };
}

function cleanEntryName(uri: string): string {
  const decoded = decodeURIComponent(uri).replace(/\/+$/, "");
  return decoded.split(/[/:]/).pop() || "file";
}

function safeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
}

// Moves a file the picker handed us into app storage, so no copy is left in the cache
function adopt(pickedUri: string, destination: File): void {
  const source = new File(pickedUri);
  source.copy(destination);
  try {
    source.delete();
  } catch {}
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

function buildImportedTrack(
  file: File,
  originalName: string,
  index: number,
  now: number,
  covers: Map<string, string>,
  fallbackAlbum?: string,
  fallbackArtist?: string,
  fallbackCover?: string,
): DownloadedTrack {
  const tags = tagsOf(file);
  const named = namesFromFile(originalName);
  const album = tags.album || fallbackAlbum || "Imported Audio";
  const albumKey = album.toLowerCase();

  if (tags.cover && !covers.has(albumKey)) {
    const extension = tags.cover.mime.includes("png") ? "png" : "jpg";
    const cover = new File(downloadsFolder("covers"), `${now}-${index}.${extension}`);
    cover.write(tags.cover.bytes);
    covers.set(albumKey, cover.uri);
  } else if (fallbackCover && !covers.has(albumKey)) {
    covers.set(albumKey, fallbackCover);
  }

  return {
    id: -(now + index),
    title: tags.title || named.title,
    artist: tags.artist || named.artist || fallbackArtist || "Unknown Artist",
    albumTitle: album,
    artwork: covers.get(albumKey),
    order: tags.track ?? named.track ?? index + 1,
    url: file.uri,
    bytes: file.size,
    downloadedAt: now,
    source: "file" as const,
  };
}

async function ingestUnpackedDir(
  dir: Directory,
  fallbackAlbum: string,
  fallbackArtist: string,
  now: number,
  startIndex: number,
  covers: Map<string, string>,
): Promise<DownloadedTrack[]> {
  const allFiles = filesIn(dir);
  const audioFiles = allFiles.filter((f) => AUDIO_FILE.test(f.name));
  if (audioFiles.length === 0) return [];

  let folderCover: string | undefined;
  const imageFile = allFiles.find((f) => IMAGE_FILE.test(f.name));
  if (imageFile) {
    const ext = imageFile.name.split(".").pop() || "jpg";
    const destCover = new File(downloadsFolder("covers"), `${now}-${startIndex}-cover.${ext}`);
    adopt(imageFile.uri, destCover);
    folderCover = destCover.uri;
  }

  const destFolder = downloadsFolder("files");
  return audioFiles.map((audioFile, offset) => {
    const idx = startIndex + offset;
    const destFile = new File(destFolder, `${now}-${idx}-${safeFileName(audioFile.name)}`);
    adopt(audioFile.uri, destFile);
    return buildImportedTrack(
      destFile,
      audioFile.name,
      idx,
      now,
      covers,
      fallbackAlbum,
      fallbackArtist,
      folderCover,
    );
  });
}

// Adds audio files or .zip album archives from the phone. Song details and covers come from
// each file's tags or filename, automatically grouping into one or more albums
export async function importFiles(): Promise<string | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ["audio/*", "application/zip", "application/x-zip-compressed"],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.length) return null;

  const folder = downloadsFolder("files");
  const now = Date.now();
  const covers = new Map<string, string>();
  const saved: DownloadedTrack[] = [];
  let index = 0;

  for (const asset of picked.assets) {
    if (ZIP_FILE.test(asset.name)) {
      const tempDir = new Directory(Paths.cache, `unzip-${now}-${index}`);
      tempDir.create({ intermediates: true, idempotent: true });
      try {
        await unzip(pathOf(asset.uri), pathOf(tempDir.uri));
        const namedZip = namesFromFile(asset.name);
        const zipTracks = await ingestUnpackedDir(
          tempDir,
          namedZip.title || "Imported Album",
          namedZip.artist,
          now,
          index,
          covers,
        );
        saved.push(...zipTracks);
        index += zipTracks.length + 1;
      } finally {
        if (tempDir.exists) tempDir.delete();
        deleteQuietly(asset.uri);
      }
      continue;
    }

    const file = new File(folder, `${now}-${index}-${safeFileName(asset.name)}`);
    adopt(asset.uri, file);
    saved.push(buildImportedTrack(file, asset.name, index, now, covers));
    index++;
  }

  if (saved.length === 0) return null;
  await saveDownloadedTracks(saved);
  return albumKeyOf(saved[0]);
}

// Picks a device folder and imports all albums, audio files, and .zip archives inside it
export async function importFolder(): Promise<string | null> {
  let rootDir: Directory;
  try {
    rootDir = await Directory.pickDirectoryAsync();
  } catch {
    return null;
  }

  const destFolder = downloadsFolder("files");
  const now = Date.now();
  const covers = new Map<string, string>();
  const saved: DownloadedTrack[] = [];
  let index = 0;

  async function scanDir(dir: Directory): Promise<void> {
    const entries = dir.list();
    const dirName = cleanEntryName(dir.uri);
    const parsedDir = namesFromFile(dirName);
    const subDirs: Directory[] = [];
    const audioEntries: File[] = [];
    const zipEntries: File[] = [];
    let imageEntry: File | undefined;

    for (const entry of entries) {
      if (entry instanceof Directory) {
        subDirs.push(entry);
        continue;
      }
      const name = cleanEntryName(entry.uri);
      if (AUDIO_FILE.test(name)) {
        audioEntries.push(entry);
      } else if (ZIP_FILE.test(name)) {
        zipEntries.push(entry);
      } else if (!imageEntry && IMAGE_FILE.test(name)) {
        imageEntry = entry;
      }
    }

    let folderCover: string | undefined;
    if (imageEntry && audioEntries.length > 0) {
      const imgName = cleanEntryName(imageEntry.uri);
      const ext = imgName.split(".").pop() || "jpg";
      const destCover = new File(downloadsFolder("covers"), `${now}-${index}-cover.${ext}`);
      await copyAsync({ from: imageEntry.uri, to: destCover.uri });
      folderCover = destCover.uri;
    }

    for (const audioEntry of audioEntries) {
      const origName = cleanEntryName(audioEntry.uri);
      const destFile = new File(destFolder, `${now}-${index}-${safeFileName(origName)}`);
      await copyAsync({ from: audioEntry.uri, to: destFile.uri });
      saved.push(
        buildImportedTrack(
          destFile,
          origName,
          index,
          now,
          covers,
          parsedDir.title || dirName,
          parsedDir.artist,
          folderCover,
        ),
      );
      index++;
    }

    for (const zipEntry of zipEntries) {
      const origName = cleanEntryName(zipEntry.uri);
      const tempZip = new File(Paths.cache, `folder-zip-${now}-${index}.zip`);
      const tempDir = new Directory(Paths.cache, `folder-unzip-${now}-${index}`);
      tempDir.create({ intermediates: true, idempotent: true });
      try {
        await copyAsync({ from: zipEntry.uri, to: tempZip.uri });
        await unzip(pathOf(tempZip.uri), pathOf(tempDir.uri));
        const namedZip = namesFromFile(origName);
        const zipTracks = await ingestUnpackedDir(
          tempDir,
          namedZip.title || parsedDir.title || dirName,
          namedZip.artist || parsedDir.artist,
          now,
          index,
          covers,
        );
        saved.push(...zipTracks);
        index += zipTracks.length + 1;
      } finally {
        if (tempDir.exists) tempDir.delete();
        if (tempZip.exists) tempZip.delete();
      }
    }

    for (const subDir of subDirs) {
      await scanDir(subDir);
    }
  }

  await scanDir(rootDir);
  if (saved.length === 0) return null;
  await saveDownloadedTracks(saved);
  return albumKeyOf(saved[0]);
}

function deleteQuietly(uri: string): void {
  try {
    const entry = new File(uri);
    if (entry.exists) entry.delete();
  } catch {}
}

// Covers you picked live in one folder; remove the ones no saved song uses any more
async function pruneCovers(): Promise<void> {
  const covers = new Directory(Paths.document, "downloads", "covers");
  if (!covers.exists) return;
  const nameOf = (uri: string) => uri.split("/").pop();
  const inUse = new Set((await getDownloadedTracks()).map((t) => t.artwork && nameOf(t.artwork)));
  for (const entry of covers.list()) {
    if (entry instanceof File && !inUse.has(nameOf(entry.uri))) deleteQuietly(entry.uri);
  }
}

// Deletes saved songs, then the album folders and covers nothing uses any more
export async function removeDownloads(tracks: DownloadedTrack[]): Promise<void> {
  tracks.forEach((t) => deleteQuietly(t.url));
  await forgetDownloadedTracks(tracks.map((t) => t.id));

  const remaining = await getDownloadedTracks();
  const folders = new Set(tracks.map((t) => t.folder).filter((f): f is string => !!f));
  for (const folder of folders) {
    if (remaining.some((t) => t.folder === folder)) continue;
    try {
      const dir = new Directory(folder);
      if (dir.exists) dir.delete();
    } catch {}
  }
  await pruneCovers();
}

// Lets you pick an image from the phone as an album's cover
export async function chooseAlbumCover(album: DownloadedAlbum): Promise<void> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: "image/*",
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.[0]) return;

  const asset = picked.assets[0];
  const extension = asset.name.split(".").pop() || "jpg";
  const cover = new File(downloadsFolder("covers"), `${Date.now()}.${extension}`);
  adopt(asset.uri, cover);
  await updateAlbum(album.key, { artwork: cover.uri });
  await pruneCovers();
}
