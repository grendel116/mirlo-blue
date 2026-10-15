import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getHistory,
  recordHistoryItem,
  clearHistory,
  subscribeHistory,
} from "@/scripts/historyManager";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

describe("History Manager", () => {
  beforeEach(async () => {
    await clearHistory();
    jest.clearAllMocks();
  });

  test("returns empty array initially", async () => {
    const history = await getHistory();
    expect(history).toEqual([]);
  });

  test("records and prepends viewed item", async () => {
    await recordHistoryItem({
      id: "album-1",
      artistId: "artist-1",
      urlSlug: "first-album",
      title: "First Album",
      artistName: "Artist One",
      coverUri: "https://example.com/cover1.jpg",
    });

    const history = await getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].title).toBe("First Album");
    expect(history[0].artistName).toBe("Artist One");
    expect(history[0].urlSlug).toBe("first-album");
  });

  test("deduplicates existing item and promotes to most recent", async () => {
    await recordHistoryItem({
      id: "album-1",
      artistId: "artist-1",
      urlSlug: "first-album",
      title: "First Album",
      artistName: "Artist One",
    });

    await recordHistoryItem({
      id: "album-2",
      artistId: "artist-2",
      urlSlug: "second-album",
      title: "Second Album",
      artistName: "Artist Two",
    });

    // Re-view the first album
    await recordHistoryItem({
      id: "album-1",
      artistId: "artist-1",
      urlSlug: "first-album",
      title: "First Album",
      artistName: "Artist One",
    });

    const history = await getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].id).toBe("album-1");
    expect(history[1].id).toBe("album-2");
  });

  test("notifies subscribers when items are added", async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeHistory(listener);

    await recordHistoryItem({
      id: "album-test",
      artistId: "artist-test",
      urlSlug: "test-album",
      title: "Test Album",
      artistName: "Test Artist",
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0][0].title).toBe("Test Album");

    unsubscribe();
  });

  test("keeps saved albums apart and leaves out entries that open nothing", async () => {
    await AsyncStorage.setItem(
      "mirlo_blue_viewing_history_v1",
      JSON.stringify([
        { id: 0, artistId: 0, urlSlug: "", title: "Old saved song", artistName: "", viewedAt: 1 },
      ]),
    );

    await recordHistoryItem({ downloadAlbum: "album:first", title: "First", artistName: "A" });
    await recordHistoryItem({ downloadAlbum: "album:second", title: "Second", artistName: "B" });
    await recordHistoryItem({ downloadAlbum: "album:first", title: "First", artistName: "A" });

    const history = await getHistory();
    expect(history.map((h) => h.title)).toEqual(["First", "Second"]);
    expect(history[0].downloadAlbum).toBe("album:first");
  });

  test("clears history cleanly", async () => {
    await recordHistoryItem({
      id: "album-1",
      artistId: "artist-1",
      urlSlug: "first-album",
      title: "First Album",
      artistName: "Artist One",
    });

    await clearHistory();
    const history = await getHistory();
    expect(history).toEqual([]);
  });
});
