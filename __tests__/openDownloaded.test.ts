jest.mock("@preeternal/react-native-cookie-manager", () => ({
  __esModule: true,
  default: { get: jest.fn(), getAll: jest.fn(), clearAll: jest.fn() },
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

import { router } from "expo-router";
import { queryClient } from "@/queries/QueryClientWrapper";
import { openDownloadedAlbum, openDownloadedArtist } from "@/scripts/albumLookup";
import {
  albumKeyOf,
  saveDownloadedTracks,
  savedAlbumSlug,
  savedArtistSlug,
} from "@/scripts/downloadManager";

const track = {
  id: -1,
  title: "First Song",
  artist: "Lou Lou",
  albumTitle: "Night Swim",
  url: "file:///files/-1.mp3",
  downloadedAt: 1,
  source: "file" as const,
};
const key = albumKeyOf(track);

describe("opening a downloaded album with no connection", () => {
  beforeAll(async () => {
    await saveDownloadedTracks([track]);
    jest.spyOn(global, "fetch").mockRejectedValue(new TypeError("Network request failed"));
  });

  afterAll(() => queryClient.clear());

  test("the album opens the page made from its files", async () => {
    await openDownloadedAlbum(key);
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/artist/[id]/album/[slug]/album-tracks",
      params: { id: savedArtistSlug("Lou Lou"), slug: savedAlbumSlug(key) },
    });
  });

  test("its artist opens the page of saved albums", async () => {
    await openDownloadedArtist(key);
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/artist/[id]/artist-page",
      params: { id: savedArtistSlug("Lou Lou") },
    });
  });
});
