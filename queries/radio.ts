import { queryOptions } from "@tanstack/react-query";

// Independent radio stations shown on Home. Each station has a live stream and a
// public feed of recently played songs; both are CORS-open, so web plays them directly.

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

export const RADIO_STATIONS: RadioStation[] = [KEXP, CARBON_SOUND];

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

// The station's live broadcast as a player track. It has no Mirlo track id; the player
// tells stations apart by stream URL. Empty headers keep the Mirlo API key off the
// station's servers
export function liveTrack(station: RadioStation): RNTrack {
  return {
    title: station.liveName,
    artist: `Live from ${station.location}`,
    url: station.streamUrl,
    headers: {},
    type: "default",
    liveStation: station.id,
  } as RNTrack;
}
