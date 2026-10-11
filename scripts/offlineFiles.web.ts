import { DownloadedAlbum, DownloadedTrack, DownloadFormat, DownloadStage, forgetDownloadedTracks } from "./downloadManager";

// Browsers can't save music for offline use, so the web build hides download controls
export const OFFLINE_SUPPORTED = false;

export async function downloadAlbum(
  _album: AlbumProps,
  _format: DownloadFormat,
  _onStage: (stage: DownloadStage) => void,
): Promise<number> {
  throw new Error("Downloads work in the phone app");
}

export async function importFiles(_albumTitle?: string, _artistName?: string): Promise<string | null> {
  throw new Error("Adding files works in the phone app");
}

export async function removeDownloads(tracks: DownloadedTrack[]): Promise<void> {
  await forgetDownloadedTracks(tracks.map((t) => t.id));
}

export async function chooseAlbumCover(_album: DownloadedAlbum): Promise<void> {}
