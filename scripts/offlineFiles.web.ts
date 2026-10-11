import { DownloadedTrack, DownloadFormat, DownloadStage, forgetDownloadedTrack } from "./downloadManager";

// Browsers can't save music for offline use, so the web build hides download controls
export const OFFLINE_SUPPORTED = false;

export async function downloadAlbum(
  _album: AlbumProps,
  _format: DownloadFormat,
  _onStage: (stage: DownloadStage) => void,
): Promise<number> {
  throw new Error("Downloads work in the phone app");
}

export async function importFiles(): Promise<number> {
  throw new Error("Adding files works in the phone app");
}

export async function removeDownload(dl: DownloadedTrack): Promise<void> {
  await forgetDownloadedTrack(dl.id);
}
