import { Directory, File, Paths } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import { unzip } from "react-native-zip-archive";
import { API_ROOT } from "@/constants/api-root";
import * as api from "@/queries/fetch/fetchWrapper";
import {
  DownloadedTrack,
  DownloadFormat,
  DownloadStage,
  forgetDownloadedTrack,
  getDownloadedTracks,
  saveDownloadedTracks,
} from "./downloadManager";

// Saving files to the phone. The web build uses offlineFiles.web.ts instead
export const OFFLINE_SUPPORTED = true;

const AUDIO_FILE = /\.(mp3|flac|m4a|opus|ogg|wav|aac)$/i;
const IMAGE_FILE = /\.(jpe?g|png|webp)$/i;
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

// Mirlo builds an album zip on request: start it, wait until it's ready, then ask for it.
// The answer is a temporary download link, or the zip itself when Mirlo serves it directly
async function mirloZipUrl(albumId: number, format: DownloadFormat): Promise<string> {
  const album = `/v1/trackGroups/${albumId}`;
  const generated = await api.get<MirloJobResponse>(`${album}/generate?format=${format}`, {});
  if (typeof generated.result === "object" && "jobId" in generated.result) {
    await waitForMirloJob(generated.result.jobId);
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const download = await api.get<MirloJobResponse>(`${album}/download?format=${format}`, {});
    if (typeof download.result === "object" && "url" in download.result) return download.result.url;
    if (typeof download.result === "object" && "jobId" in download.result) {
      await waitForMirloJob(download.result.jobId);
      continue;
    }
    break;
  }
  return `${API_ROOT}${album}/download?format=${format}`;
}

// Downloads an album you own from Mirlo and unpacks it into the app's storage. Mirlo names
// each song "<track number>-<title>", which ties every file back to its Mirlo track
export async function downloadAlbum(
  album: AlbumProps,
  format: DownloadFormat,
  onStage: (stage: DownloadStage) => void,
): Promise<number> {
  onStage("preparing");
  const url = await mirloZipUrl(album.id, format);

  onStage("downloading");
  const zip = new File(Paths.cache, `album-${album.id}.zip`);
  const headers = url.startsWith(API_ROOT) ? await api.mirloHeaders() : undefined;
  try {
    await File.downloadFileAsync(url, zip, { headers, idempotent: true });

    onStage("unpacking");
    const folder = new Directory(Paths.document, "downloads", `album-${album.id}`);
    if (folder.exists) folder.delete();
    folder.create({ intermediates: true });
    await unzip(pathOf(zip.uri), pathOf(folder.uri));

    const files = filesIn(folder);
    const cover = files.find((f) => IMAGE_FILE.test(f.name));
    const tracks = album.tracks ?? [];
    const now = Date.now();
    const saved: DownloadedTrack[] = files
      .filter((f) => AUDIO_FILE.test(f.name))
      .sort((a, b) => parseInt(a.name, 10) - parseInt(b.name, 10))
      .map((file, i) => {
        const order = parseInt(file.name, 10);
        const track = tracks.find((t) => t.order === order);
        return {
          id: track?.id ?? -(now + i),
          title: track?.title ?? namesFromFile(file.name).title,
          artist: album.artist?.name ?? "",
          albumTitle: album.title,
          artwork: cover?.uri ?? album.cover?.sizes?.[600],
          url: file.uri,
          folder: folder.uri,
          duration: track?.audio?.duration,
          bytes: file.size,
          downloadedAt: now,
          source: "mirlo" as const,
        };
      });
    await saveDownloadedTracks(saved);
    return saved.length;
  } finally {
    if (zip.exists) zip.delete();
  }
}

// "01 - Artist - Title.mp3" → artist and title; anything else becomes the title
function namesFromFile(fileName: string): { title: string; artist: string } {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/^\d+\s*[-.]\s*/, "");
  const split = base.indexOf(" - ");
  if (split === -1) return { title: base, artist: "" };
  return { artist: base.slice(0, split), title: base.slice(split + 3) };
}

// Adds audio files from the phone into a designated album, copied into app storage
export async function importFiles(albumTitle?: string, artistName?: string): Promise<number> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: "audio/*",
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.length) return 0;

  const folder = downloadsFolder("files");
  const now = Date.now();
  const title = albumTitle?.trim() || "Imported Audio";
  const artist = artistName?.trim() || "";

  const saved: DownloadedTrack[] = picked.assets.map((asset, i) => {
    const file = new File(folder, `${now}-${i}-${asset.name}`);
    new File(asset.uri).copy(file);
    const parsed = namesFromFile(asset.name);
    return {
      id: -(now + i),
      title: parsed.title,
      artist: artist || parsed.artist || "Unknown Artist",
      albumTitle: title,
      order: i + 1,
      url: file.uri,
      bytes: file.size,
      downloadedAt: now,
      source: "file" as const,
    };
  });
  await saveDownloadedTracks(saved);
  return saved.length;
}

// Deletes a saved song, and its album folder once nothing else from that album is left
export async function removeDownload(dl: DownloadedTrack): Promise<void> {
  const file = new File(dl.url);
  if (file.exists) file.delete();
  await forgetDownloadedTrack(dl.id);
  if (!dl.folder) return;
  const remaining = await getDownloadedTracks();
  if (remaining.some((t) => t.folder === dl.folder)) return;
  const folder = new Directory(dl.folder);
  if (folder.exists) folder.delete();
}

// Selects an image from the phone and saves it to app storage for offline artwork
export async function pickCoverImage(): Promise<string | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: "image/*",
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.[0]) return null;

  const asset = picked.assets[0];
  const covers = downloadsFolder("covers");
  const ext = asset.name.split(".").pop() || "jpg";
  const dest = new File(covers, `${Date.now()}.${ext}`);
  new File(asset.uri).copy(dest);
  return dest.uri;
}
