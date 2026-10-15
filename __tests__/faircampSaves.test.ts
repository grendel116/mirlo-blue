jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  toggleFaircampAlbumWishlist,
  toggleFaircampTrackLike,
} from "@/scripts/faircampSaves";

describe("device-only Faircamp saves", () => {
  test("persists track likes and album wishlists without Mirlo IDs", async () => {
    const album: AlbumProps = {
      id: 151801310,
      trackGroupId: 151801310,
      title: "sjX",
      urlSlug: "fairplayer-sjX%40sockpuppet.band",
      source: "Faircamp",
      cover: { sizes: { 60: "", 120: "", 300: "", 600: "", 960: "", 1200: "", 1500: "" } },
      artist: {
        id: 1,
        name: "Sockpuppet",
        bio: "",
        activityPub: false,
        userId: 1,
        enabled: true,
        createdAt: "",
        trackGroups: [],
      },
      artistId: 1,
      releaseDate: "",
      tracks: [],
    };
    const track: RNTrack = {
      id: 10483,
      trackGroupId: album.id,
      title: "The War Machine",
      artist: "Sockpuppet",
      url: "https://sockpuppet.band/sjx/01-war-machine.opus",
      source: "Faircamp",
      trackGroup: album,
      order: 1,
      queueIndex: 0,
      allowIndividualSale: false,
      isPreview: true,
      headers: {},
      audio: {
        url: "https://sockpuppet.band/sjx/01-war-machine.opus",
        duration: 252,
      },
    };
    album.tracks = [track];

    await toggleFaircampTrackLike(track);
    await toggleFaircampAlbumWishlist(album, [track]);

    const stored = JSON.parse(
      (await AsyncStorage.getItem("mirlo_blue_faircamp_saves_v1")) || "{}",
    );
    expect(stored.tracks).toHaveLength(1);
    expect(stored.tracks[0].track.url).toBe(track.url);
    expect(stored.albums).toHaveLength(1);
    expect(stored.albums[0].album.urlSlug).toBe(album.urlSlug);

    await toggleFaircampAlbumWishlist(album, [track]);
    const removed = JSON.parse(
      (await AsyncStorage.getItem("mirlo_blue_faircamp_saves_v1")) || "{}",
    );
    expect(removed.tracks).toHaveLength(0);
    expect(removed.albums).toHaveLength(0);
  });
});
