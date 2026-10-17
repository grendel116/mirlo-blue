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

import { transactionItems } from "@/app/activity";

describe("transactionItems", () => {
  test("lists a transaction's albums, songs and merch, and links music to its release", () => {
    const release = {
      id: 701,
      title: "Full Album",
      urlSlug: "full-album",
      artistId: 10,
      artist: { name: "Duo", urlSlug: "duo" },
      cover: { sizes: { 120: "https://img.example/full-120.jpg" } },
    };
    const single = {
      id: 702,
      title: "Single Source",
      urlSlug: "single-source",
      artistId: 10,
      artist: { name: "Duo", urlSlug: "duo" },
      cover: { sizes: {} },
    };

    const items = transactionItems({
      id: "tx-1",
      amount: 1500,
      currency: "usd",
      trackGroupPurchases: [{ trackGroupId: 701, trackGroup: release }],
      trackPurchases: [{ trackId: 55, track: { id: 55, title: "Lone Song", trackGroup: single } }],
      merchPurchases: [
        {
          id: "m-1",
          merch: { title: "Tote Bag", images: [{ sizes: { 120: "https://img.example/tote.jpg" } }] },
        },
      ],
    });

    expect(items.map((i) => i.title)).toEqual(["Full Album", "Lone Song", "Tote Bag"]);
    expect(items[0]).toMatchObject({
      subtitle: "Duo",
      cover: "https://img.example/full-120.jpg",
      trackGroup: release,
    });
    expect(items[1]).toMatchObject({ subtitle: "Duo · Single Source", trackGroup: single });
    expect(items[2].cover).toBe("https://img.example/tote.jpg");
    expect(items[2].trackGroup).toBeUndefined();
  });

  test("a transaction without items lists nothing", () => {
    expect(transactionItems({ id: "tx-2", amount: 500, currency: "eur" })).toEqual([]);
  });
});
