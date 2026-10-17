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

import {
  buildBookmarks,
  buildCollection,
  buildFollowedArtists,
  buildWishlistAlbums,
} from "@/app/library";
import { createMockRNTrack } from "@/__mocks__/mockRNTrack";
import { createMockArtist } from "@/__mocks__/mockArtist";
import { createMockUser } from "@/__mocks__/mockUser";

const album = (id: number, urlSlug: string, title: string) =>
  ({
    id,
    trackGroupId: id,
    title,
    artist: createMockArtist({ name: "Duo" }),
    artistId: 10,
    urlSlug,
    releaseDate: "2025-01-01T00:00:00.000Z",
    cover: { sizes: { 60: "", 120: "", 300: "", 600: "", 960: "", 1200: "", 1500: "" } },
  }) as AlbumProps;

describe("buildWishlistAlbums", () => {
  test("lists Mirlo wishlist albums and Faircamp albums, newest first", () => {
    const albums = buildWishlistAlbums({
      wishlist: [
        {
          userId: 1,
          trackGroupId: 701,
          trackGroup: album(701, "mirlo-album", "Mirlo Album"),
          createdAt: "2025-02-01T00:00:00.000Z",
        },
      ],
      faircampSaves: {
        albums: [
          {
            album: album(801, "fairplayer-saved", "Saved Faircamp Album"),
            savedAt: Date.parse("2025-03-01T00:00:00.000Z"),
          },
        ],
        tracks: [],
        artists: [],
      },
    });

    expect(albums.map((a) => a.trackGroup.title)).toEqual([
      "Saved Faircamp Album",
      "Mirlo Album",
    ]);
  });

  test("leaves out albums the listener has bought", () => {
    const user = createMockUser({ id: 1, userTrackGroupPurchases: [{ trackGroupId: 701 }] });
    const albums = buildWishlistAlbums({
      user,
      wishlist: [
        { userId: 1, trackGroupId: 701, trackGroup: album(701, "bought", "Bought Album") },
        { userId: 1, trackGroupId: 702, trackGroup: album(702, "wanted", "Wanted Album") },
      ],
      faircampSaves: { albums: [], tracks: [], artists: [] },
    });

    expect(albums.map((a) => a.trackGroup.title)).toEqual(["Wanted Album"]);
  });

  test("a liked Faircamp song brings its album, listed once", () => {
    const faircampAlbum = album(901, "fairplayer-liked", "Liked Faircamp Album");
    const song = (id: number, likedAt: string) => ({
      track: createMockRNTrack({ id, source: "Faircamp", trackGroup: faircampAlbum }),
      likedAt: Date.parse(likedAt),
    });

    const albums = buildWishlistAlbums({
      wishlist: [],
      faircampSaves: {
        albums: [],
        tracks: [song(1, "2025-04-01T00:00:00.000Z"), song(2, "2025-05-01T00:00:00.000Z")],
        artists: [],
      },
    });

    expect(albums).toHaveLength(1);
    expect(albums[0].trackGroup.title).toBe("Liked Faircamp Album");
    expect(albums[0].savedAt).toBe(Date.parse("2025-05-01T00:00:00.000Z"));
  });

  test("leaves out albums already downloaded to the phone", () => {
    const albums = buildWishlistAlbums({
      wishlist: [],
      faircampSaves: {
        albums: [
          { album: album(801, "owned", "Bought & Saved!"), savedAt: 2 },
          { album: album(802, "wanted", "Still Wanted"), savedAt: 1 },
        ],
        tracks: [],
        artists: [],
      },
      downloads: [
        {
          id: -1,
          title: "Song",
          artist: "Duo",
          albumTitle: "bought & saved",
          url: "file:///music/song.mp3",
          downloadedAt: 3,
          source: "file",
        },
      ],
    });

    expect(albums.map((a) => a.trackGroup.title)).toEqual(["Still Wanted"]);
  });
});

describe("buildFollowedArtists", () => {
  test("lists Mirlo followed artists and Faircamp followed artists", () => {
    const mirloArtist = createMockArtist({ id: 10, name: "Mirlo Band", urlSlug: "mirlo-band" });
    const faircampArtist = createMockArtist({
      id: 99,
      name: "Sockpuppet",
      urlSlug: "fairplayer-artist-Sockpuppet",
      onMirlo: false,
    });
    const user = createMockUser({
      id: 1,
      artistUserSubscriptions: [
        {
          artistSubscriptionTier: {
            isDefaultTier: true,
            name: "Follow",
            artist: mirloArtist,
          },
        } as any,
      ],
    });

    const followed = buildFollowedArtists({
      user,
      faircampSaves: {
        albums: [],
        tracks: [],
        artists: [{ artist: faircampArtist, followedAt: 1000 }],
      },
    });

    expect(followed.map((f) => f.artist.name)).toEqual(["Mirlo Band", "Sockpuppet"]);
    expect(followed[1].artist.onMirlo).toBe(false);
  });
});

describe("buildBookmarks", () => {
  test("lists liked radio stations and podcast episodes, newest first", () => {
    const tracks = buildBookmarks({
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
    expect(tracks[0].podcastEpisodeId).toBe("ep-42");
    expect(tracks[0].title).toBe("Worker Cooperatives in Action");
    expect(tracks[0].url).toBe("https://example.com/ep42.mp3");
    expect(tracks[1].liveStation).toBe("kexp");
    expect(tracks[1].title).toBe("KEXP 90.3 FM");
  });
});

describe("buildCollection", () => {
  const songPurchase = (trackId: number, title: string, trackGroup: AlbumProps) => ({
    userId: 1,
    trackId,
    track: { id: trackId, title, trackGroup },
  });

  test("lists bought albums and single songs in Mirlo's order", () => {
    const entries = buildCollection({
      collection: [
        songPurchase(55, "Lone Song", album(702, "single-src", "Single Source")),
        { userId: 1, trackGroupId: 701, trackGroup: album(701, "full", "Full Album") },
      ],
    });

    expect(entries.map((e) => e.kind)).toEqual(["track", "album"]);
    expect(entries[0]).toMatchObject({ kind: "track", track: { title: "Lone Song" } });
    expect(entries[0].trackGroup.title).toBe("Single Source");
    expect(entries[1].trackGroup.title).toBe("Full Album");
  });

  test("a song sits under its album when the album is owned too", () => {
    const owned = album(701, "owned", "Owned Album");
    const entries = buildCollection({
      collection: [
        songPurchase(55, "Song From It", owned),
        { userId: 1, trackGroupId: 701, trackGroup: owned },
      ],
    });

    expect(entries.map((e) => e.key)).toEqual(["album-701"]);
  });

  test("albums saved on the phone, and their songs, sit in Downloads", () => {
    const saved = album(701, "saved", "Saved Album");
    const entries = buildCollection({
      collection: [
        { userId: 1, trackGroupId: 701, trackGroup: saved },
        songPurchase(56, "Saved Song", album(703, "saved-single", "Saved Single")),
        { userId: 1, trackGroupId: 702, trackGroup: album(702, "cloud", "Cloud Album") },
      ],
      downloads: [
        {
          id: -1,
          title: "Track",
          artist: "Duo",
          albumTitle: "Saved Album",
          url: "file:///music/a.mp3",
          downloadedAt: 1,
          source: "file",
        },
        {
          id: -2,
          title: "Saved Song",
          artist: "Duo",
          albumTitle: "Saved Single",
          url: "file:///music/b.mp3",
          downloadedAt: 2,
          source: "file",
        },
      ],
    });

    expect(entries.map((e) => e.trackGroup.title)).toEqual(["Cloud Album"]);
  });
});
