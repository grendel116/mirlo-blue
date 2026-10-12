import { queryOptions } from "@tanstack/react-query";
import { TrackType } from "react-native-track-player";

// Independent radio stations shown on Home. Each station has a live stream and a
// public feed of what's on air. All feeds except WFMU's are CORS-open, so web reads them directly.

export type RadioPlay = {
  key: string;
  song: string;
  artist: string;
  airdate: string;
  artwork: string;
};

export type RadioStation = {
  id: string;
  name: string;
  liveName: string;
  location: string;
  // A line or two for the station screen's About section
  about: string;
  streamUrl: string;
  playlistPage: string;
  donatePage: string;
  fetchPlays: (signal: AbortSignal) => Promise<RadioPlay[]>;
};

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return res.json();
}

// KEXP: "trackplay" entries are songs, other play types are air breaks
type KexpPlay = {
  id: number;
  airdate: string;
  play_type: string;
  song: string;
  artist: string;
  thumbnail_uri: string;
  image_uri: string;
};

const KEXP: RadioStation = {
  id: "kexp",
  name: "KEXP",
  liveName: "KEXP 90.3 FM",
  location: "Seattle",
  about:
    "Listener-powered, non-profit radio from Seattle, championing new and independent music since 1972.",
  streamUrl: "https://kexp.streamguys1.com/kexp160.aac",
  playlistPage: "https://www.kexp.org/playlist/",
  donatePage: "https://www.kexp.org/donate/",
  fetchPlays: async (signal) => {
    const data = await getJson<{ results: KexpPlay[] }>(
      "https://api.kexp.org/v2/plays/?format=json&limit=30",
      signal,
    );
    return data.results
      .filter((p) => p.play_type === "trackplay")
      .map((p) => ({
        key: String(p.id),
        song: p.song,
        artist: p.artist,
        airdate: p.airdate,
        artwork: p.image_uri || p.thumbnail_uri,
      }));
  },
};

// Carbon Sound (MPR): the same now-playing service behind carbonsound.fm/playlist
type PublicRadioSong = {
  song_id: number;
  title: string;
  artist: string;
  played_at: string;
  art_url: string | null;
};

const CARBON_SOUND: RadioStation = {
  id: "carbon-sound",
  name: "Carbon Sound",
  liveName: "Carbon Sound",
  location: "Minneapolis",
  about:
    "Minnesota Public Radio's stream for Black music past and present: hip-hop, soul, R&B and more.",
  streamUrl: "https://carbonsound.stream.publicradio.org/carbonsound.aac",
  playlistPage: "https://www.carbonsound.fm/playlist",
  donatePage: "https://support.mpr.org/carbon-sound-web",
  fetchPlays: async (signal) => {
    const data = await getJson<{ data: { songs: PublicRadioSong[] } }>(
      "https://nowplaying.publicradio.org/carbon-sound/playlist",
      signal,
    );
    return data.data.songs.map((s) => ({
      key: `${s.song_id}-${s.played_at}`,
      song: s.title,
      artist: s.artist,
      airdate: s.played_at,
      artwork: s.art_url || "",
    }));
  },
};

// WFMU: the feed holds only what's on now. When the DJ logs songs live, that's the
// current song; otherwise it's the show. Text fields arrive HTML-escaped
type WfmuNow = {
  program: { id: string; title_html: string | null };
  episode: { id: number };
  segment: {
    id: number;
    title_html: string | null;
    artist_html: string | null;
    set_break_flag: boolean;
    image: string | null;
  };
};

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeHtml(text: string): string {
  return text.replace(/&(#\d+|[a-z]+);/gi, (entity, code: string) =>
    code.startsWith("#")
      ? String.fromCharCode(Number(code.slice(1)))
      : (HTML_ENTITIES[code.toLowerCase()] ?? entity),
  );
}

const WFMU: RadioStation = {
  id: "wfmu",
  name: "WFMU",
  liveName: "WFMU 91.1 FM",
  location: "Jersey City",
  about:
    "Listener-supported freeform radio since 1958, with no playlists, no formats and DJs who play whatever they love.",
  streamUrl: "https://stream0.wfmu.org/freeform-128k.mp3",
  playlistPage: "https://wfmu.org/playlists/",
  donatePage: "https://pledge.wfmu.org/",
  fetchPlays: async (signal) => {
    const { program, episode, segment } = await getJson<WfmuNow>(
      "https://wfmu.org/currentliveshows.php?json=1&c=1",
      signal,
    );
    const now = new Date().toISOString();
    if (segment.id && !segment.set_break_flag && segment.title_html) {
      return [
        {
          key: String(segment.id),
          song: decodeHtml(segment.title_html),
          artist: decodeHtml(segment.artist_html ?? ""),
          airdate: now,
          artwork: segment.image ?? "",
        },
      ];
    }
    if (!program.title_html) return [];
    return [
      {
        key: `show-${program.id}-${episode.id}`,
        song: decodeHtml(program.title_html),
        artist: "WFMU",
        airdate: now,
        artwork: "",
      },
    ];
  },
};

// NTS: show-based, so the current show stands in for the song on air
type NtsBroadcast = {
  start_timestamp: string;
  embeds: {
    details: {
      name: string;
      show_alias: string;
      episode_alias: string;
      location_long: string | null;
      media: { picture_medium: string };
    };
  };
};

const NTS_1: RadioStation = {
  id: "nts-1",
  name: "NTS",
  liveName: "NTS Radio 1",
  location: "London",
  about:
    "Independent radio from London with shows by artists and selectors around the world. Don't assume.",
  streamUrl: "https://stream-relay-geo.ntslive.net/stream",
  playlistPage: "https://www.nts.live/schedule",
  donatePage: "https://www.nts.live/supporters",
  fetchPlays: async (signal) => {
    const data = await getJson<{ results: { channel_name: string; now: NtsBroadcast }[] }>(
      "https://www.nts.live/api/v2/live",
      signal,
    );
    const now = data.results.find((c) => c.channel_name === "1")?.now;
    if (!now) return [];
    const show = now.embeds.details;
    return [
      {
        key: `${show.show_alias}-${show.episode_alias}`,
        song: show.name,
        artist: show.location_long || "NTS",
        airdate: now.start_timestamp,
        artwork: show.media.picture_medium,
      },
    ];
  },
};

// SomaFM: songs carry no artwork, so each shows the channel logo. `date` is unix seconds
type SomaSong = { title: string; artist: string; date: string; albumArt: string };

const SOMAFM_INDIE_POP: RadioStation = {
  id: "somafm-indiepop",
  name: "SomaFM",
  liveName: "SomaFM Indie Pop Rocks!",
  location: "San Francisco",
  about:
    "Listener-supported, commercial-free radio from San Francisco. Indie Pop Rocks! plays new and classic indie pop.",
  streamUrl: "https://ice2.somafm.com/indiepop-128-aac",
  playlistPage: "https://somafm.com/indiepop/songhistory.html",
  donatePage: "https://somafm.com/support/",
  fetchPlays: async (signal) => {
    const data = await getJson<{ songs: SomaSong[] }>(
      "https://api.somafm.com/songs/indiepop.json",
      signal,
    );
    return data.songs.map((s) => ({
      key: `${s.date}-${s.title}`,
      song: s.title,
      artist: s.artist,
      airdate: new Date(Number(s.date) * 1000).toISOString(),
      artwork: s.albumArt || "https://api.somafm.com/logos/256/indiepop256.png",
    }));
  },
};

// Refuge Worldwide: titles read "Show - Hosts"; only the current show carries a start time
type RadioCoStatus = {
  current_track: { title: string; start_time: string; artwork_url: string };
};

const REFUGE: RadioStation = {
  id: "refuge",
  name: "Refuge Worldwide",
  liveName: "Refuge Worldwide",
  location: "Berlin",
  about:
    "Community radio and fundraising platform from Berlin-Neukölln, giving airtime to grassroots causes and the artists around them.",
  streamUrl: "https://streaming.radio.co/s3699c5e49/listen",
  playlistPage: "https://refugeworldwide.com/radio",
  donatePage: "https://refugeworldwide.com/support",
  fetchPlays: async (signal) => {
    const { current_track: show } = await getJson<RadioCoStatus>(
      "https://public.radio.co/stations/s3699c5e49/status",
      signal,
    );
    const [title, ...hosts] = show.title.split(" - ");
    return [
      {
        key: `${show.start_time}-${show.title}`,
        song: title,
        artist: hosts.join(" - ") || "Refuge Worldwide",
        airdate: show.start_time,
        artwork: show.artwork_url,
      },
    ];
  },
};

export const RADIO_STATIONS: RadioStation[] = [
  KEXP,
  CARBON_SOUND,
  WFMU,
  NTS_1,
  SOMAFM_INDIE_POP,
  REFUGE,
];

export function findStation(id: string | undefined): RadioStation | undefined {
  return RADIO_STATIONS.find((s) => s.id === id);
}

// Recently played songs, refreshed every minute. Idle when no station is given
export function queryRadioPlays(station: RadioStation | undefined) {
  return queryOptions({
    queryKey: ["fetchRadioPlays", station?.id],
    queryFn: ({ signal }) => station!.fetchPlays(signal),
    enabled: Boolean(station),
    refetchInterval: 60_000,
  });
}

// A station plays as a 10-minute set in the queue, then playback moves on to what's next
import { RADIO_SET_SECONDS } from "@/scripts/radioTimer";
export { RADIO_SET_SECONDS };

// The station's live broadcast as a player track. It has no Mirlo track id; the player
// tells stations apart by stream URL. Empty headers keep the Mirlo API key off the
// station's servers
export function liveTrack(station: RadioStation): RNTrack {
  return {
    title: station.liveName,
    artist: `Live from ${station.location}`,
    url: station.streamUrl,
    headers: {},
    type: TrackType.Default,
    duration: RADIO_SET_SECONDS,
    liveStation: station.id,
  } as RNTrack;
}
