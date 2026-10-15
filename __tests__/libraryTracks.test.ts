jest.mock("@preeternal/react-native-cookie-manager", () => ({
  __esModule: true,
  default: { get: jest.fn(), getAll: jest.fn(), clearAll: jest.fn() },
}));

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("react-native-track-player", () => ({
  __esModule: true,
  default: {
    setupPlayer: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
    getQueue: jest.fn().mockResolvedValue([]),
    getActiveTrack: jest.fn().mockResolvedValue(undefined),
    getActiveTrackIndex: jest.fn().mockResolvedValue(-1),
    getRepeatMode: jest.fn().mockResolvedValue(0),
    addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  },
  State: { None: "none", Ready: "ready", Playing: "playing", Paused: "paused", Stopped: "stopped", Buffering: "buffering" },
  Event: { PlaybackState: "playback-state", PlaybackActiveTrackChanged: "playback-active-track-changed" },
  RepeatMode: { Off: 0, Track: 1, Queue: 2 },
  AppKilledPlaybackBehavior: {
    StopPlaybackAndRemoveNotification: "stopPlaybackAndRemoveNotification",
  },
  Capability: {
    Play: "play",
    Pause: "pause",
    Stop: "stop",
    SkipToNext: "skipToNext",
    SkipToPrevious: "skipToPrevious",
    SeekTo: "seekTo",
  },
  TrackType: {
    Default: "default",
    HLS: "hls",
    Dash: "dash",
  },
  IOSCategory: { Playback: "playback" },
  IOSCategoryOptions: {
    AllowAirPlay: "allowAirPlay",
    AllowBluetoothA2DP: "allowBluetoothA2DP",
    AllowBluetooth: "allowBluetooth",
    DuckOthers: "duckOthers",
  },
  usePlaybackState: jest.fn().mockReturnValue({ state: undefined }),
  useTrackPlayerEvents: jest.fn(),
}));

jest.mock("expo-file-system", () => ({
  documentDirectory: "file:///mock/documents/",
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
}));

import { buildCombinedLibraryTracks } from "@/app/library";
import { createMockRNTrack } from "@/__mocks__/mockRNTrack";
import { createMockUser } from "@/__mocks__/mockUser";
import { createMockArtist } from "@/__mocks__/mockArtist";

describe("buildCombinedLibraryTracks", () => {
  const baseParams = {
    user: null,
    purchases: [],
    wishlist: [],
    fullAlbums: [],
    purchaseDateByAlbumId: new Map<number | string, string>(),
    historyItems: [],
    downloadedTracks: [],
    stationLikes: [],
  };

  test("populates all individual tracks from fullAlbums (purchased albums)", () => {
    const artist = createMockArtist({ name: "Solaris" });
    const fullAlbum: AlbumProps = {
      id: 101,
      trackGroupId: 101,
      title: "Solaris Odyssey",
      artist,
      artistId: 42,
      urlSlug: "solaris-odyssey",
      releaseDate: "2025-01-01T00:00:00.000Z",
      cover: {
        sizes: {
          60: "https://example.com/60.jpg",
          120: "https://example.com/120.jpg",
          300: "https://example.com/300.jpg",
          600: "https://example.com/600.jpg",
          960: "https://example.com/960.jpg",
          1200: "https://example.com/1200.jpg",
          1500: "https://example.com/1500.jpg",
        },
      },
      tracks: [
        createMockRNTrack({ id: 1001, title: "Departure", order: 1, trackGroupId: 101, artist: "Solaris" }),
        createMockRNTrack({ id: 1002, title: "Orbit", order: 2, trackGroupId: 101, artist: "Solaris" }),
        createMockRNTrack({ id: 1003, title: "Deep Space", order: 3, trackGroupId: 101, artist: "Solaris" }),
      ],
    };

    const purchaseDates = new Map<number | string, string>();
    purchaseDates.set(101, "2025-06-01T12:00:00.000Z");

    const tracks = buildCombinedLibraryTracks({
      ...baseParams,
      fullAlbums: [fullAlbum],
      purchaseDateByAlbumId: purchaseDates,
    });

    expect(tracks).toHaveLength(3);
    expect(tracks.map((t) => t.title)).toEqual(["Departure", "Orbit", "Deep Space"]);
    expect(tracks[0].artist).toBe("Solaris");
    expect(tracks[0].trackGroup?.id).toBe(101);
  });

  test("maintains album track order when added at the same time", () => {
    const artist = createMockArtist({ name: "Echoes" });
    const fullAlbum: AlbumProps = {
      id: 202,
      trackGroupId: 202,
      title: "Resonance",
      artist,
      artistId: 50,
      urlSlug: "resonance",
      releaseDate: "2024-05-01T00:00:00.000Z",
      cover: {
        sizes: {
          60: "",
          120: "",
          300: "",
          600: "https://example.com/resonance.jpg",
          960: "",
          1200: "",
          1500: "",
        },
      },
      tracks: [
        createMockRNTrack({ id: 2003, title: "Track Three", order: 3, trackGroupId: 202 }),
        createMockRNTrack({ id: 2001, title: "Track One", order: 1, trackGroupId: 202 }),
        createMockRNTrack({ id: 2002, title: "Track Two", order: 2, trackGroupId: 202 }),
      ],
    };

    const purchaseDates = new Map<number | string, string>();
    purchaseDates.set(202, "2025-01-01T00:00:00.000Z");

    const tracks = buildCombinedLibraryTracks({
      ...baseParams,
      fullAlbums: [fullAlbum],
      purchaseDateByAlbumId: purchaseDates,
    });

    expect(tracks.map((t) => t.order)).toEqual([1, 2, 3]);
    expect(tracks.map((t) => t.title)).toEqual(["Track One", "Track Two", "Track Three"]);
  });

  test("sorts newer album purchases before older album purchases", () => {
    const artist = createMockArtist({ name: "Time Traveler" });
    const albumOld: AlbumProps = {
      id: 301,
      trackGroupId: 301,
      title: "Old Album",
      artist,
      artistId: 10,
      urlSlug: "old-album",
      releaseDate: "2023-01-01T00:00:00.000Z",
      cover: { sizes: { 60: "", 120: "", 300: "", 600: "", 960: "", 1200: "", 1500: "" } },
      tracks: [createMockRNTrack({ id: 3001, title: "Old Song", order: 1, trackGroupId: 301 })],
    };
    const albumNew: AlbumProps = {
      id: 302,
      trackGroupId: 302,
      title: "New Album",
      artist,
      artistId: 10,
      urlSlug: "new-album",
      releaseDate: "2025-01-01T00:00:00.000Z",
      cover: { sizes: { 60: "", 120: "", 300: "", 600: "", 960: "", 1200: "", 1500: "" } },
      tracks: [createMockRNTrack({ id: 3002, title: "New Song", order: 1, trackGroupId: 302 })],
    };

    const purchaseDates = new Map<number | string, string>();
    purchaseDates.set(301, "2023-06-01T00:00:00.000Z");
    purchaseDates.set(302, "2025-06-01T00:00:00.000Z");

    const tracks = buildCombinedLibraryTracks({
      ...baseParams,
      fullAlbums: [albumOld, albumNew],
      purchaseDateByAlbumId: purchaseDates,
    });

    expect(tracks).toHaveLength(2);
    expect(tracks[0].title).toBe("New Song");
    expect(tracks[1].title).toBe("Old Song");
  });

  test("ingests individual track purchases and user favorites without duplication", () => {
    const user = createMockUser({
      id: 1,
      trackFavorites: [
        {
          userId: 1,
          trackId: 501,
          track: createMockRNTrack({ id: 501, title: "Favorited Track" }),
          createdAt: new Date("2025-02-01T00:00:00.000Z"),
        },
      ],
    });

    const purchases = [
      {
        trackId: 502,
        track: createMockRNTrack({ id: 502, title: "Single Purchase" }),
        datePurchased: "2025-03-01T00:00:00.000Z",
      },
    ];

    const tracks = buildCombinedLibraryTracks({
      ...baseParams,
      user,
      purchases,
    });

    expect(tracks).toHaveLength(2);
    const titles = tracks.map((t) => t.title);
    expect(titles).toContain("Favorited Track");
    expect(titles).toContain("Single Purchase");
  });

  test("deduplicates tracks that appear in both fullAlbums and user favorites", () => {
    const artist = createMockArtist({ name: "Duo" });
    const fullAlbum: AlbumProps = {
      id: 401,
      trackGroupId: 401,
      title: "Shared Album",
      artist,
      artistId: 10,
      urlSlug: "shared-album",
      releaseDate: "2025-01-01T00:00:00.000Z",
      cover: { sizes: { 60: "", 120: "", 300: "", 600: "", 960: "", 1200: "", 1500: "" } },
      tracks: [createMockRNTrack({ id: 4001, title: "Shared Song", order: 1, trackGroupId: 401 })],
    };

    const user = createMockUser({
      id: 1,
      trackFavorites: [
        {
          userId: 1,
          trackId: 4001,
          track: createMockRNTrack({ id: 4001, title: "Shared Song" }),
          createdAt: new Date("2025-04-01T00:00:00.000Z"),
        },
      ],
    });

    const tracks = buildCombinedLibraryTracks({
      ...baseParams,
      user,
      fullAlbums: [fullAlbum],
    });

    expect(tracks).toHaveLength(1);
    expect(tracks[0].id).toBe(4001);
  });

  test("ingests liked radio stations and podcast episodes without duplication", () => {
    const tracks = buildCombinedLibraryTracks({
      ...baseParams,
      stationLikes: [{ stationId: "kexp", likedAt: 1000 }],
      podcastEpisodeLikes: [
        {
          episodeId: "ep-42",
          showId: "upstream",
          title: "Worker Cooperatives in Action",
          artist: "Upstream Podcast",
          url: "https://example.com/ep42.mp3",
          likedAt: 2000,
        },
      ],
    });

    expect(tracks).toHaveLength(2);
    // Newer liked item (podcast episode at 2000) should appear first
    expect(tracks[0].podcastEpisodeId).toBe("ep-42");
    expect(tracks[0].title).toBe("Worker Cooperatives in Action");
    expect(tracks[0].url).toBe("https://example.com/ep42.mp3");
    expect(tracks[1].liveStation).toBe("kexp");
    expect(tracks[1].title).toBe("KEXP 90.3 FM");
  });
});


