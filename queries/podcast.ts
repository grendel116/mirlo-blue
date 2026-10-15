import { Platform } from "react-native";
import { queryOptions } from "@tanstack/react-query";
import type { TrackType } from "react-native-track-player";

// Podcast and talk shows shown under Discussion on Home. Episodes are parsed from
// standard open podcast RSS feeds with direct audio enclosures.

export type PodcastEpisode = {
  id: string;
  title: string;
  pubDate: string;
  audioUrl: string;
  description: string;
  duration?: number;
  artwork?: string;
};

export type PodcastShow = {
  id: string;
  name: string;
  author: string;
  description: string;
  artwork: string;
  feedUrl: string;
  webUrl: string;
  supportUrl?: string;
  fetchEpisodes: (signal?: AbortSignal) => Promise<PodcastEpisode[]>;
};

const XML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#8216": "'",
  "#8217": "'",
  "#8220": '"',
  "#8221": '"',
  "#8211": "–",
  "#8212": "—",
  "#8230": "…",
};

export function decodeXml(text: string): string {
  if (!text) return "";
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#\d+|[a-z]+);/gi, (match, entity: string) => {
      const code = entity.toLowerCase();
      if (XML_ENTITIES[code]) return XML_ENTITIES[code];
      if (code.startsWith("#")) {
        const num = Number(code.slice(1));
        return !isNaN(num) ? String.fromCharCode(num) : match;
      }
      return match;
    })
    .trim();
}

export function parseDuration(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const parts = raw.split(":").map(Number);
  if (parts.some((p) => isNaN(p))) {
    const num = Number(raw);
    return isNaN(num) ? undefined : num;
  }
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function parsePodcastRss(xml: string, limit: number = 30): PodcastEpisode[] {
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;
  const episodes: PodcastEpisode[] = [];

  while ((match = itemRegex.exec(xml)) !== null && episodes.length < limit) {
    const item = match[1];
    const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
    const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const descMatch =
      item.match(/<description>([\s\S]*?)<\/description>/i) ||
      item.match(/<itunes:summary>([\s\S]*?)<\/itunes:summary>/i);
    const guidMatch = item.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
    const encUrlMatch = item.match(/<enclosure[^>]+url="([^"]+)"/i);
    const encTypeMatch = item.match(/<enclosure[^>]+type="([^"]+)"/i);
    const durationMatch = item.match(/<itunes:duration>([\s\S]*?)<\/itunes:duration>/i);
    const itunesImgMatch = item.match(/<itunes:image\s+href="([^"]+)"/i);

    const enclosureUrl = encUrlMatch ? encUrlMatch[1] : undefined;
    const enclosureType = encTypeMatch ? encTypeMatch[1] : undefined;

    const isAudio =
      enclosureType?.startsWith("audio/") ||
      enclosureUrl?.includes(".mp3") ||
      enclosureUrl?.includes(".m4a");

    if (enclosureUrl && isAudio) {
      episodes.push({
        id: guidMatch ? decodeXml(guidMatch[1]) : enclosureUrl,
        title: titleMatch ? decodeXml(titleMatch[1]) : "Episode",
        pubDate: pubDateMatch ? decodeXml(pubDateMatch[1]) : "",
        audioUrl: enclosureUrl,
        description: descMatch
          ? decodeXml(descMatch[1]).replace(/<[^>]*>/g, "").trim()
          : "",
        duration: durationMatch ? parseDuration(durationMatch[1]) : undefined,
        artwork: itunesImgMatch ? itunesImgMatch[1] : undefined,
      });
    }
  }

  return episodes;
}

export function resolveFeedUrl(url: string): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `/feed-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export async function fetchFeedEpisodes(
  feedUrl: string,
  signal?: AbortSignal,
  limit: number = 30,
): Promise<PodcastEpisode[]> {
  const url = resolveFeedUrl(feedUrl);
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Podcast feed failed: ${res.status}`);
  const xml = await res.text();
  return parsePodcastRss(xml, limit);
}

function createPodcastShow(data: Omit<PodcastShow, "fetchEpisodes">): PodcastShow {
  return {
    ...data,
    fetchEpisodes: (signal) => fetchFeedEpisodes(data.feedUrl, signal),
  };
}

export const COLONIAL_OUTCASTS: PodcastShow = createPodcastShow({
  id: "colonial-outcasts",
  name: "Colonial Outcasts",
  author: "Greg Stoker & Mark Wayne",
  description:
    "Anti-imperialist, anti-war, and anti-establishment podcast digging into history, anthropology, geopolitics, and military science.",
  artwork:
    "https://substackcdn.com/image/fetch/w_600,c_limit,f_auto,q_auto:good/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fce66ed85-78f8-46e1-bfc9-e0c267d7e708_3000x3000.png",
  feedUrl: "https://www.rfemedia.com/feed?section=colonial-outcasts",
  webUrl: "https://www.rfemedia.com/s/colonial-outcasts",
  supportUrl: "https://www.rfemedia.com/subscribe",
});

export const BLACK_AUTONOMY: PodcastShow = createPodcastShow({
  id: "black-autonomy",
  name: "Black Autonomy Podcast",
  author: "Lorenzo Kom'boa Ervin & JoNina Abron-Ervin",
  description:
    "Discussions on anarchism and the revolutionary ideals of Black autonomy and liberation, hosted by veteran organizers and former Black Panther Party members Lorenzo Kom'boa Ervin and JoNina Abron-Ervin.",
  artwork:
    "https://static.libsyn.com/p/assets/8/4/7/9/847958a34c0d9a21/Black-Autonomy-Profile_100.png",
  feedUrl: "https://blackautonomy.libsyn.com/rss",
  webUrl: "https://blackautonomy.libsyn.com",
  supportUrl: "https://www.patreon.com/blackautonomy",
});

export const EVERYTHING_COOP: PodcastShow = createPodcastShow({
  id: "everything-coop",
  name: "Everything Co-op",
  author: "Vernon Oakes",
  description:
    "Weekly conversations exploring the cooperative movement, worker-owned businesses, and community wealth building through an economic democracy lens.",
  artwork:
    "https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/18/65/f3/1865f3cb-1370-282c-a5d3-d2f021b6e66b/mza_12938009896173436902.jpg/600x600bb.jpg",
  feedUrl: "https://feeds.soundcloud.com/users/soundcloud:users:381264350/sounds.rss",
  webUrl: "https://everything.coop",
  supportUrl: "https://everything.coop",
});

export const PODCAST_SHOWS: PodcastShow[] = [
  COLONIAL_OUTCASTS,
  BLACK_AUTONOMY,
  EVERYTHING_COOP,
];

export function findPodcastShow(id: string | undefined): PodcastShow | undefined {
  return PODCAST_SHOWS.find((show) => show.id === id);
}

export function queryPodcastEpisodes(show: PodcastShow | undefined) {
  return queryOptions({
    queryKey: ["podcastEpisodes", show?.id],
    queryFn: ({ signal }) => show!.fetchEpisodes(signal),
    enabled: Boolean(show),
    staleTime: 10 * 60 * 1000,
  });
}

export function episodeTrack(
  episode: PodcastEpisode,
  show: PodcastShow,
  index: number = 0,
): RNTrack {
  const artwork = episode.artwork || show.artwork;
  return {
    id: -(Math.abs(hashString(episode.id)) || 100000 + index),
    title: episode.title,
    artist: show.author,
    artwork,
    url: episode.audioUrl,
    headers: {},
    type: "default" as TrackType,
    duration: episode.duration,
    order: index + 1,
    queueIndex: index,
    allowIndividualSale: false,
    isPreview: false,
    audio: {
      url: episode.audioUrl,
      duration: episode.duration,
    },
    trackGroupId: 0,
    trackGroup: {
      id: 0,
      trackGroupId: 0,
      title: show.name,
      artistId: 0,
      urlSlug: show.id,
      releaseDate: episode.pubDate,
      artist: {
        name: show.author,
        bio: show.description,
      },
      cover: {
        sizes: {
          60: artwork,
          120: artwork,
          300: artwork,
          600: artwork,
          960: artwork,
          1200: artwork,
          1500: artwork,
        },
      },
    },
    podcastId: show.id,
    podcastEpisodeId: episode.id,
  } as RNTrack;
}
