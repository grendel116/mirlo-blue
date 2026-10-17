import { API_ROOT } from "@/constants/api-root";
import * as api from "@/queries/fetch/fetchWrapper";
import type { DownloadFormat } from "./downloadManager";

const POLL_MS = 4000;
const PREPARE_TIMEOUT_MS = 10 * 60 * 1000;

type MirloJobResponse = { result: true | { jobId: string } | { url: string } };

export type MirloSource = "trackGroups" | "tracks";

async function waitForMirloJob(jobId: string): Promise<void> {
  const deadline = Date.now() + PREPARE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { results } = await api.get<{ results: { jobStatus: string }[] }>(
      `/v1/jobs?queue=generateAlbum&ids=${jobId}`,
      {},
    );
    const status = results[0]?.jobStatus;
    if (status === "completed") return;
    if (status === "failed")
      throw new Error("Mirlo couldn't prepare this download");
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error("Mirlo took too long to prepare this download");
}

// Mirlo builds a zip on request: start it, wait until it's ready, then ask for it.
// The answer is a temporary download link, or the zip itself when Mirlo serves it directly
// (a URL under API_ROOT, which needs the listener's login headers)
export async function mirloZipUrl(
  source: MirloSource,
  id: number,
  format: DownloadFormat,
): Promise<string> {
  const resource = `/v1/${source}/${id}`;
  const generated = await api.get<MirloJobResponse>(
    `${resource}/generate?format=${format}`,
    {},
  );
  if (typeof generated.result === "object" && "jobId" in generated.result) {
    await waitForMirloJob(generated.result.jobId);
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const download = await api.get<MirloJobResponse>(
      `${resource}/download?format=${format}`,
      {},
    );
    if (typeof download.result === "object" && "url" in download.result)
      return download.result.url;
    if (typeof download.result === "object" && "jobId" in download.result) {
      await waitForMirloJob(download.result.jobId);
      continue;
    }
    break;
  }
  return `${API_ROOT}${resource}/download?format=${format}`;
}
