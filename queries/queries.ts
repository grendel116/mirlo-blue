import {
  keepPreviousData,
  QueryFunction,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import * as api from "./fetch/fetchWrapper";
import { MirloFetchError } from "./fetch/MirloFetchError";
import { findChorusAlbum, findChorusArtist } from "./chorus";
import {
  fairplayerReleaseSlug,
  fetchFairplayerAlbum,
  fetchFairplayerArtist,
  isKnownFairplayerArtistId,
} from "./fairplayer";

type UserPurchase = UserTrackPurchase | UserTrackGroupPurchase;

const fetchTrackGroups: QueryFunction<
  { results: AlbumProps[] },
  [
    "fetchTrackGroups",
    {
      skip?: number;
      take?: number;
      orderBy?: "random";
      tag?: string;
      distinctArtists?: boolean;
      isReleased?: "released";
    },
    ...any,
  ]
> = ({
  queryKey: [_, { skip, take, orderBy, tag, distinctArtists, isReleased }],
  signal,
  pageParam = 0,
}) => {
  const params = new URLSearchParams();
  if (skip || pageParam) params.append("skip", String(pageParam || skip));
  if (take) params.append("take", String(take));
  if (orderBy) params.append("orderBy", orderBy);
  if (tag) params.append("tag", tag);
  if (isReleased) params.append("isReleased", isReleased);
  params.append("distinctArtists", String(distinctArtists ?? false));
  return api.get(`/v1/trackGroups?${params}`, { signal });
};

export function queryTrackGroups(opts: {
  skip?: number;
  take?: number;
  orderBy?: "random";
  tag?: string;
  distinctArtists: boolean;
  isReleased?: "released";
}) {
  return queryOptions({
    queryKey: ["fetchTrackGroups", opts],
    queryFn: fetchTrackGroups,
    placeholderData: keepPreviousData,
  });
}

const fetchTopSold: QueryFunction<
  { results: AlbumProps[] },
  [
    "fetchTopSold",
    {
      take?: number;
      datePurchased?: string;
    },
  ]
> = ({ queryKey: [_, { take, datePurchased }], signal }) => {
  const params = new URLSearchParams();
  if (take) params.append("take", String(take));
  if (datePurchased) params.append("datePurchased", String(datePurchased));
  return api.get(`/v1/trackGroups/topSold?${params}`, { signal });
};

export function queryTopSold(opts: { take?: number; datePurchased?: string }) {
  return queryOptions({
    queryKey: ["fetchTopSold", opts],
    queryFn: fetchTopSold,
  });
}

const fetchMostPlayed: QueryFunction<
  { results: AlbumProps[] },
  [
    "fetchMostPlayed",
    {
      take?: number;
    },
  ]
> = ({ queryKey: [_, { take }], signal }) => {
  const params = new URLSearchParams();
  if (take) params.append("take", String(take));
  return api.get(`/v1/trackGroups/mostPlayed?${params}`, { signal });
};

export function queryMostPlayed(opts: { take?: number }) {
  return queryOptions({
    queryKey: ["fetchMostPlayed", opts],
    queryFn: fetchMostPlayed,
  });
}
const fetchUserPurchases: QueryFunction<
  { results: UserTransaction[] },
  ["fetchUserPurchases", { userId: number | undefined }, ...any]
> = ({ queryKey: [_, { userId }], signal }) => {
  return api.get(`/v1/users/${userId}/purchases`, {});
};

export function queryUserPurchases(userId: number | undefined) {
  return queryOptions({
    queryKey: ["fetchUserPurchases", { userId }],
    queryFn: fetchUserPurchases,
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}

const fetchUserCollection: QueryFunction<
  { results: UserPurchase[] },
  ["fetchUserCollection", { userId: number | undefined }, ...any]
> = ({ queryKey: [_, { userId }], signal }) => {
  return api.get(`/v1/users/${userId}/collection`, {});
};

export function queryUserCollection(userId: number | undefined) {
  return queryOptions({
    queryKey: ["fetchUserCollection", { userId }],
    queryFn: fetchUserCollection,
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}

const fetchAlbum: QueryFunction<
  { result: AlbumProps },
  [
    "fetchAlbum",
    {
      slug: string | string[];
      id: string | string[];
    },
  ]
> = ({ queryKey: [_, { slug, id }], signal }) => {
  const safeSlug = Array.isArray(slug) ? slug[0] : slug;
  const safeId = Array.isArray(id) ? id[0] : id;

  if (safeId === "fairplayer" || fairplayerReleaseSlug.decode(safeSlug)) {
    return fetchFairplayerAlbum(safeSlug, signal).then((result) => ({
      result,
    }));
  }

  const attachMirloSource = (res: { result: AlbumProps }) => {
    if (res?.result) {
      res.result.source = res.result.source || "Mirlo Space";
      res.result.sourceUrl = res.result.sourceUrl || "https://mirlo.space";
      if (res.result.tracks) {
        res.result.tracks.forEach((track) => {
          track.source = track.source || "Mirlo Space";
          track.sourceUrl = track.sourceUrl || "https://mirlo.space";
        });
      }
    }
    return res;
  };

  if (/^\d+$/.test(safeSlug)) {
    return api.get<{ result: AlbumProps }>(`/v1/trackGroups/${safeSlug}`, { signal }).then(attachMirloSource);
  }

  return api
    .get<{ result: AlbumProps }>(`/v1/trackGroups/${safeSlug}/?artistId=${safeId}`, { signal })
    .then(attachMirloSource)
    .catch(async (err) => {
      if (/^\d+$/.test(safeId)) {
        try {
          return await api.get<{ result: AlbumProps }>(`/v1/trackGroups/${safeId}`, { signal }).then(attachMirloSource);
        } catch {
          // fall through to Chorus
        }
      }
      const federated = await findChorusAlbum(safeSlug, safeId);
      if (federated) {
        return { result: federated };
      }
      throw err;
    });
};

export function queryAlbum(opts: {
  slug: string | string[];
  id: string | string[];
}) {
  return queryOptions({
    queryKey: ["fetchAlbum", opts],
    queryFn: fetchAlbum,
    enabled: !!opts.slug && !!opts.id,
    staleTime: 5 * 60 * 1000,
  });
}

const fetchArtist: QueryFunction<
  Artist,
  ["fetchArtist", { artistSlug: string }]
> = async ({ queryKey: [_, { artistSlug }], signal }) => {
  if (fairplayerReleaseSlug.decodeArtist(artistSlug)) {
    const fairArtist = await fetchFairplayerArtist(artistSlug, signal);
    if (fairArtist) return fairArtist;
  }

  try {
    const response = await api.get<{ result: Artist }>(`/v1/artists/${artistSlug}`, {
      signal,
    });
    return response.result;
  } catch (err) {
    const numericId = /^\d+$/.test(artistSlug) ? Number(artistSlug) : undefined;
    if (numericId !== undefined && isKnownFairplayerArtistId(numericId)) {
      try {
        const fairArtist = await fetchFairplayerArtist(artistSlug, signal);
        if (fairArtist) return fairArtist;
      } catch {
        // Ignore Fairplayer fallback error
      }
    }
    if (numericId !== undefined) {
      try {
        const chorusArtist = await findChorusArtist(artistSlug, signal);
        if (chorusArtist) return chorusArtist;
      } catch {
        // Ignore Chorus fallback error
      }
    }
    throw err;
  }
};

export function queryArtist(opts: { artistSlug: string }) {
  return queryOptions({
    queryKey: [
      "fetchArtist",
      {
        artistSlug: opts.artistSlug,
      },
    ],
    queryFn: fetchArtist,
    enabled: !!opts.artistSlug,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
const fetchTags: QueryFunction<
  { results: Tag[]; total?: number },
  [
    "fetchTags",
    {
      skip?: number;
      take?: number;
      orderBy?: "asc" | "count";
    },
    ...any,
  ]
> = ({ queryKey: [_, { skip, take, orderBy }], signal }) => {
  const params = new URLSearchParams();
  if (skip) params.append("skip", String(skip));
  if (take) params.append("take", String(take));
  if (orderBy) params.append("orderBy", orderBy);

  return api.get(`/v1/tags?${params}`, { signal });
};

export function queryTags(opts: {
  skip?: number;
  take?: number;
  orderBy?: "asc" | "count";
}) {
  return queryOptions({
    queryKey: ["fetchTags", opts, "tags"],
    queryFn: fetchTags,
  });
}

const fetchWishlist: QueryFunction<
  {
    results: {
      userId: number;
      trackGroupId: number;
      trackGroup: AlbumProps;
      createdAt: Date;
    }[];
  },
  ["fetchWishlist", { userId: number | undefined }, ...any]
> = ({ queryKey: [_, { userId }], signal }) => {
  return api.get(`/v1/users/${userId}/wishlist`, {});
};

export function queryWishlist(userId: number | undefined) {
  return queryOptions({
    queryKey: ["fetchWishlist", { userId }],
    queryFn: fetchWishlist,
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}
