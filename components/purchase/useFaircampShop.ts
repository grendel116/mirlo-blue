import { useQuery } from "@tanstack/react-query";
import { queryFaircampShop, type FaircampShop } from "@/queries/fairplayer";

// How a Faircamp release offers downloads, read in the background once the album shows.
// `shop` is null when downloads are off; `pending` is true while the check runs.
// Releases from other sources are never pending and have no shop
export function useFaircampShop(album: Pick<AlbumProps, "source" | "faircampDownloadAccess">): {
  isFaircamp: boolean;
  shop: FaircampShop | null;
  pending: boolean;
} {
  const isFaircamp = album.source === "Faircamp";
  const access = isFaircamp ? album.faircampDownloadAccess : undefined;
  const query = useQuery(queryFaircampShop(access));
  return {
    isFaircamp,
    shop: query.data ?? null,
    pending: Boolean(access) && query.isPending,
  };
}
