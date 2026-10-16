import * as api from "@/queries/fetch/fetchWrapper";
import { queryClient } from "@/queries/QueryClientWrapper";
import { queryAlbum } from "@/queries/queries";
import { searchFairplayerAlbums } from "@/queries/fairplayer";
import { nameKey, sameAlbum } from "@/scripts/utils";

// Finds the Mirlo or Faircamp page of a song kept on the phone, and returns that page's copy
// of the song, which the share link is built from. Nothing comes back when no page matches
export async function findOnlineSong(track: RNTrack): Promise<RNTrack | undefined> {
  const wanted = { title: track.trackGroup?.title, artist: track.artist };
  if (!wanted.title) return undefined;

  const [mirlo, faircamp] = await Promise.allSettled([
    api.getMany<AlbumProps>("/v1/trackGroups", {}, { title: wanted.title }),
    searchFairplayerAlbums(wanted.title),
  ]);
  const candidates = [
    ...(mirlo.status === "fulfilled" ? mirlo.value.results : []),
    ...(faircamp.status === "fulfilled" ? faircamp.value : []),
  ];
  const page = candidates.find((c) => sameAlbum(wanted, { title: c.title, artist: c.artist?.name }));
  if (!page) return undefined;

  const { result } = await queryClient.fetchQuery(
    queryAlbum({ slug: page.urlSlug, id: String(page.artist?.urlSlug ?? page.artistId) }),
  );
  const songs = result.tracks ?? [];
  return songs.find((s) => nameKey(s.title) === nameKey(track.title)) ?? songs[0];
}
