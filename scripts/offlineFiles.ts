import { Platform } from "react-native";
import { Directory, File, type FileHandle, Paths } from "expo-file-system";
import { copyAsync } from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import * as MediaLibrary from "expo-media-library";
import { unzip } from "react-native-zip-archive";
import { readTags } from "./readTags";
import { MirloSource, mirloZipUrl } from "./mirloZip";
import { flacHeaderWithCover } from "./flacCover";
import {
  AUDIO_FILE,
  fetchCoverJpeg,
  IMAGE_FILE,
  matchTrack,
  MirloTrack,
  namesFromFile,
  safeFileName,
  songDetails,
} from "./songFiles";
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

// Saving files to the phone. The web build uses offlineFiles.web.ts instead.
// The phone picks its own files: the Add files and Add folder buttons, and album covers
export const PICKS_PHONE_FILES = true;
export const CAN_DOWNLOAD = true;

const ZIP_FILE = /\.zip$/i;
const COPY_CHUNK = 1024 * 1024;

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
  return folder
    .list()
    .flatMap((entry) =>
      entry instanceof Directory ? filesIn(entry) : [entry],
    );
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
  const headers = url.startsWith(API_ROOT)
    ? await api.mirloHeaders()
    : undefined;
  try {
    await File.downloadFileAsync(url, zip, { headers, idempotent: true });

    onStage("unpacking");
    // A song joins the album's folder; a whole album replaces it
    const folder = new Directory(
      Paths.document,
      "downloads",
      `album-${album.id}`,
    );
    if (source === "trackGroups" && folder.exists) folder.delete();
    folder.create({ intermediates: true, idempotent: true });
    await unzip(pathOf(zip.uri), pathOf(folder.uri));

    const files = filesIn(folder);
    return {
      folder,
      audio: files.filter((f) => AUDIO_FILE.test(f.name)),
      cover:
        files.find((f) => IMAGE_FILE.test(f.name))?.uri ??
        album.cover?.sizes?.[600],
    };
  } finally {
    if (zip.exists) zip.delete();
  }
}

// An unpacked song and the Mirlo track it belongs to
type Song = { file: File; track: MirloTrack | undefined; fallbackId: number };

// A song whose id matches its Mirlo track shows once in All Tracks
const matchFile = (file: File, tracks: MirloTrack[]) => matchTrack(tagsOf(file), file.name, tracks);

function readerOf(handle: FileHandle) {
  return (offset: number, length: number) => {
    handle.offset = offset;
    return handle.readBytes(length);
  };
}

// Writes the cover into a FLAC file; other files, and FLACs that have one, stay as they are
function withFlacCover(file: File, jpeg: Uint8Array): File {
  const source = file.open();
  try {
    const rebuilt = flacHeaderWithCover(readerOf(source), jpeg);
    if (!rebuilt) return file;
    const covered = new File(Paths.cache, `covered-${file.name}`);
    if (covered.exists) covered.delete();
    covered.create();
    const out = covered.open();
    try {
      out.writeBytes(rebuilt.header);
      source.offset = rebuilt.audioStart;
      for (
        let chunk = source.readBytes(COPY_CHUNK);
        chunk.length > 0;
        chunk = source.readBytes(COPY_CHUNK)
      ) {
        out.writeBytes(chunk);
      }
    } finally {
      out.close();
    }
    deleteQuietly(file.uri);
    return covered;
  } finally {
    source.close();
  }
}

// On Android a song lives in the phone's Music folder as "Artist - Title", where any music app
// finds it and sorts it by its tags. iOS has no shared Music folder, so songs stay in the app
async function moveToMusic(file: File, name: string): Promise<string> {
  if (Platform.OS !== "android") return file.uri;
  const { granted } = await MediaLibrary.requestPermissionsAsync(false, [
    "audio",
  ]);
  if (!granted)
    throw new Error(
      "Allow MirloBlue to access music to save songs to your Music folder",
    );
  const extension = file.name.split(".").pop();
  const named = new File(Paths.cache, `${safeFileName(name)}.${extension}`);
  if (named.exists) named.delete();
  file.move(named);
  try {
    const asset = await MediaLibrary.createAssetAsync(
      fileUriOf(pathOf(named.uri)),
    );
    // The Music folder answers with the bare path
    return fileUriOf(asset.uri.replace(/^file:\/\//, ""));
  } finally {
    deleteQuietly(named.uri);
  }
}

// Android reads a file's type from its uri only when the name holds plain letters, digits,
// "-_.()" and percent escapes, so every other character of each path segment goes in escaped
function fileUriOf(path: string): string {
  const escape = (segment: string) =>
    encodeURIComponent(segment).replace(
      /[!'*~]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  return `file://${path.split("/").map(escape).join("/")}`;
}

// Saves unpacked songs: earlier copies go first, then each song gets its cover and moves into
// the Music folder. `replaces` picks out earlier downloads this one supersedes
async function keepSongs(
  songs: Song[],
  album: AlbumProps,
  folder: Directory,
  cover: string | undefined,
  replaces: (t: DownloadedTrack) => boolean,
): Promise<void> {
  const ids = new Set(songs.map((s) => s.track?.id ?? s.fallbackId));
  const replaced = (await getDownloadedTracks()).filter(
    (t) => ids.has(t.id) || replaces(t),
  );
  replaced.forEach((t) => deleteQuietly(t.url));
  await forgetDownloadedTracks(replaced.map((t) => t.id));

  const hasFlac = songs.some((s) => /\.flac$/i.test(s.file.name));
  const jpeg = hasFlac ? await fetchCoverJpeg(album) : undefined;
  const artist = album.artist?.name ?? "";
  const saved: DownloadedTrack[] = [];
  for (const { file, track, fallbackId } of songs) {
    const ready = jpeg ? withFlacCover(file, jpeg) : file;
    const title = track?.title ?? namesFromFile(file.name).title;
    const bytes = ready.size;
    const url = await moveToMusic(
      ready,
      artist ? `${artist} - ${title}` : title,
    );
    saved.push({
      id: track?.id ?? fallbackId,
      title,
      artist,
      albumTitle: album.title,
      artwork: cover,
      url,
      folder: folder.uri,
      duration: track?.audio?.duration,
      bytes,
      order: track?.order,
      downloadedAt: Date.now(),
      source: "mirlo",
    });
  }
  await saveDownloadedTracks(saved);
}

// Downloads an album you own from Mirlo. It replaces any earlier download of the album
export async function downloadAlbum(
  album: AlbumProps,
  format: DownloadFormat,
  onStage: (stage: DownloadStage) => void,
): Promise<number> {
  const { folder, audio, cover } = await fetchMirloFiles(
    "trackGroups",
    album.id,
    album,
    format,
    onStage,
  );
  const tracks = album.tracks ?? [];
  const now = Date.now();
  const songs = audio.map((file, i) => ({
    file,
    track: matchFile(file, tracks),
    fallbackId: -(now + i),
  }));
  await keepSongs(songs, album, folder, cover, (t) => t.folder === folder.uri);
  return songs.length;
}

// Downloads one song of an album you own
export async function downloadTrack(
  album: AlbumProps,
  track: MirloTrack,
  format: DownloadFormat,
  onStage: (stage: DownloadStage) => void,
): Promise<void> {
  const { folder, audio, cover } = await fetchMirloFiles(
    "tracks",
    track.id,
    album,
    format,
    onStage,
  );
  const file = audio[0];
  if (!file) throw new Error("Mirlo didn't send this song");
  await keepSongs(
    [{ file, track, fallbackId: track.id }],
    album,
    folder,
    cover,
    () => false,
  );
}

function cleanEntryName(uri: string): string {
  const decoded = decodeURIComponent(uri).replace(/\/+$/, "");
  return decoded.split(/[/:]/).pop() || "file";
}

// A phone file is the same file when its name and size match. Saved copies are named
// `<time>-<index>-<original name>`, so files added earlier are recognized too
function sourceKey(name: string, bytes: number | null | undefined): string {
  return `${safeFileName(name)}:${bytes ?? ""}`;
}

async function addedFileKeys(): Promise<Set<string>> {
  const tracks = await getDownloadedTracks();
  return new Set(
    tracks
      .filter((t) => t.source === "file")
      .map((t) => {
        const savedName = decodeURIComponent(t.url.split("/").pop() || "");
        return sourceKey(savedName.replace(/^\d+-\d+-/, ""), t.bytes);
      }),
  );
}

// True the first time a file is seen; later copies, in Downloads or in this pick, are skipped
function isNewFile(known: Set<string>, name: string, bytes: number | null | undefined) {
  const key = sourceKey(name, bytes);
  if (known.has(key)) return false;
  known.add(key);
  return true;
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
    return readTags(readerOf(handle));
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
  const details = songDetails(tags, originalName, index, fallbackAlbum, fallbackArtist);
  const albumKey = details.albumTitle.toLowerCase();

  if (tags.cover && !covers.has(albumKey)) {
    const extension = tags.cover.mime.includes("png") ? "png" : "jpg";
    const cover = new File(
      downloadsFolder("covers"),
      `${now}-${index}.${extension}`,
    );
    cover.write(tags.cover.bytes);
    covers.set(albumKey, cover.uri);
  } else if (fallbackCover && !covers.has(albumKey)) {
    covers.set(albumKey, fallbackCover);
  }

  return {
    id: -(now + index),
    ...details,
    artwork: covers.get(albumKey),
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
  known: Set<string>,
): Promise<DownloadedTrack[]> {
  const allFiles = filesIn(dir);
  const audioFiles = allFiles.filter(
    (f) => AUDIO_FILE.test(f.name) && isNewFile(known, f.name, f.size),
  );
  if (audioFiles.length === 0) return [];

  let folderCover: string | undefined;
  const imageFile = allFiles.find((f) => IMAGE_FILE.test(f.name));
  if (imageFile) {
    const ext = imageFile.name.split(".").pop() || "jpg";
    const destCover = new File(
      downloadsFolder("covers"),
      `${now}-${startIndex}-cover.${ext}`,
    );
    adopt(imageFile.uri, destCover);
    folderCover = destCover.uri;
  }

  const destFolder = downloadsFolder("files");
  return audioFiles.map((audioFile, offset) => {
    const idx = startIndex + offset;
    const destFile = new File(
      destFolder,
      `${now}-${idx}-${safeFileName(audioFile.name)}`,
    );
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
  const known = await addedFileKeys();
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
          known,
        );
        saved.push(...zipTracks);
        index += zipTracks.length + 1;
      } finally {
        if (tempDir.exists) tempDir.delete();
        deleteQuietly(asset.uri);
      }
      continue;
    }

    if (!isNewFile(known, asset.name, asset.size)) {
      deleteQuietly(asset.uri);
      continue;
    }
    const file = new File(
      folder,
      `${now}-${index}-${safeFileName(asset.name)}`,
    );
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
  const known = await addedFileKeys();
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
        if (isNewFile(known, name, entry.size)) audioEntries.push(entry);
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
      const destCover = new File(
        downloadsFolder("covers"),
        `${now}-${index}-cover.${ext}`,
      );
      await copyAsync({ from: imageEntry.uri, to: destCover.uri });
      folderCover = destCover.uri;
    }

    for (const audioEntry of audioEntries) {
      const origName = cleanEntryName(audioEntry.uri);
      const destFile = new File(
        destFolder,
        `${now}-${index}-${safeFileName(origName)}`,
      );
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
      const tempDir = new Directory(
        Paths.cache,
        `folder-unzip-${now}-${index}`,
      );
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
          known,
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
  const inUse = new Set(
    (await getDownloadedTracks()).map((t) => t.artwork && nameOf(t.artwork)),
  );
  for (const entry of covers.list()) {
    if (entry instanceof File && !inUse.has(nameOf(entry.uri)))
      deleteQuietly(entry.uri);
  }
}

// Deletes saved songs, then the album folders and covers nothing uses any more
export async function removeDownloads(
  tracks: DownloadedTrack[],
): Promise<void> {
  tracks.forEach((t) => deleteQuietly(t.url));
  await forgetDownloadedTracks(tracks.map((t) => t.id));

  const remaining = await getDownloadedTracks();
  const folders = new Set(
    tracks.map((t) => t.folder).filter((f): f is string => !!f),
  );
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
  const cover = new File(
    downloadsFolder("covers"),
    `${Date.now()}.${extension}`,
  );
  adopt(asset.uri, cover);
  await updateAlbum(album.key, { artwork: cover.uri });
  await pruneCovers();
}