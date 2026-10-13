import { Platform } from "react-native";
import * as MediaLibrary from "expo-media-library";
import { exportAlbumToMusic, exportFilesToMusic } from "@/scripts/offlineFiles";
import { DownloadedAlbum } from "@/scripts/downloadManager";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("expo-media-library", () => ({
  isAvailableAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getAlbumAsync: jest.fn(),
  createAlbumAsync: jest.fn(),
  addAssetsToAlbumAsync: jest.fn(),
  createAssetAsync: jest.fn(),
}));

describe("offlineFiles music export", () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { value: originalOS });
    jest.clearAllMocks();
  });

  it("returns false on non-Android platforms", async () => {
    Object.defineProperty(Platform, "OS", { value: "ios" });
    const result = await exportFilesToMusic("Test Album", "Test Artist", [{ uri: "file:///song.mp3" }]);
    expect(result).toBe(false);
    expect(MediaLibrary.createAssetAsync).not.toHaveBeenCalled();
  });

  it("exports audio files to Android Music album when permission is granted", async () => {
    Object.defineProperty(Platform, "OS", { value: "android" });
    (MediaLibrary.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (MediaLibrary.getAlbumAsync as jest.Mock).mockResolvedValue(null);
    (MediaLibrary.createAssetAsync as jest.Mock).mockResolvedValue({ id: "asset-1" });
    (MediaLibrary.createAlbumAsync as jest.Mock).mockResolvedValue({ id: "album-1" });

    const result = await exportFilesToMusic("Blue Sky", "The Birds", [
      { uri: "file:///track1.mp3" },
      { uri: "file:///track2.mp3" },
    ]);

    expect(result).toBe(true);
    expect(MediaLibrary.requestPermissionsAsync).toHaveBeenCalledWith(false, ["audio"]);
    expect(MediaLibrary.getAlbumAsync).toHaveBeenCalledWith("The Birds - Blue Sky");
    expect(MediaLibrary.createAssetAsync).toHaveBeenCalledWith("file:///track1.mp3");
    expect(MediaLibrary.createAlbumAsync).toHaveBeenCalledWith("The Birds - Blue Sky", { id: "asset-1" }, false);
    expect(MediaLibrary.addAssetsToAlbumAsync).toHaveBeenCalledWith([{ id: "asset-1" }], { id: "album-1" }, false);
  });

  it("adds to existing album if it already exists", async () => {
    Object.defineProperty(Platform, "OS", { value: "android" });
    const existingAlbum = { id: "existing-1", title: "Solo Artist - Demo" };
    (MediaLibrary.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (MediaLibrary.getAlbumAsync as jest.Mock).mockResolvedValue(existingAlbum);
    (MediaLibrary.createAssetAsync as jest.Mock).mockResolvedValue({ id: "asset-2" });

    const result = await exportFilesToMusic("Demo", "Solo Artist", [{ uri: "file:///track1.flac" }]);

    expect(result).toBe(true);
    expect(MediaLibrary.createAlbumAsync).not.toHaveBeenCalled();
    expect(MediaLibrary.addAssetsToAlbumAsync).toHaveBeenCalledWith([{ id: "asset-2" }], existingAlbum, false);
  });

  it("exportAlbumToMusic maps downloaded album tracks correctly", async () => {
    Object.defineProperty(Platform, "OS", { value: "android" });
    (MediaLibrary.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (MediaLibrary.getAlbumAsync as jest.Mock).mockResolvedValue(null);
    (MediaLibrary.createAssetAsync as jest.Mock).mockResolvedValue({ id: "asset-3" });

    const mockAlbum: DownloadedAlbum = {
      key: "album:test",
      title: "Great Hits",
      artist: "Mirlo Ensemble",
      totalBytes: 1000,
      downloadedAt: Date.now(),
      tracks: [
        {
          id: 1,
          title: "Song 1",
          artist: "Mirlo Ensemble",
          url: "file:///path/song1.mp3",
          downloadedAt: Date.now(),
          source: "mirlo",
        },
      ],
    };

    const result = await exportAlbumToMusic(mockAlbum);
    expect(result).toBe(true);
    expect(MediaLibrary.createAssetAsync).toHaveBeenCalledWith("file:///path/song1.mp3");
  });
});
