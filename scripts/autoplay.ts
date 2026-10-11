import * as api from "@/queries/fetch/fetchWrapper";
import { API_KEY } from "@/constants/api-key";
import { trackStreamPath } from "@/scripts/utils";

export const AUTOPLAY_SOURCE = "Recent Releases";

// Fetches one preview from each recent release, newest first, to continue playback after
// the current playlist runs out. The artist's featured song leads when it's a preview,
// otherwise the album's first preview
export async function fetchRecentReleaseTracks(
  skip: number,
  take: number,
): Promise<RNTrack[]> {
  const params = new URLSearchParams({
    skip: String(skip),
    take: String(take),
    distinctArtists: "true",
    isReleased: "released",
  });
  const { results } = await api.get<{ results: any[] }>(`/v1/trackGroups?${params}`, {});

  return (results || []).flatMap((album): RNTrack[] => {
    const previews = [...(album.tracks || [])]
      .filter((t: any) => t?.id && t.isPreview)
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    const t = previews.find((p: any) => p.isFeatured) ?? previews[0];
    if (!t) return [];
    return [
      {
        id: t.id,
        title: t.title,
        artist: album.artist?.name || "",
        artwork: album.cover?.sizes?.[600] || "",
        url: "",
        audio: { url: trackStreamPath(t.id), duration: undefined },
        queueIndex: 0,
        trackGroupId: album.id,
        trackGroup: {
          id: album.id,
          trackGroupId: album.id,
          title: album.title,
          artist: album.artist,
          artistId: album.artistId,
          urlSlug: album.urlSlug,
          cover: album.cover,
          releaseDate: album.releaseDate,
          userTrackGroupPurchases: [],
        },
        isPreview: true,
        order: t.order ?? 0,
        allowIndividualSale: Boolean(t.allowIndividualSale),
        headers: { "mirlo-api-key": API_KEY },
        autoplay: true,
      },
    ];
  });
}
