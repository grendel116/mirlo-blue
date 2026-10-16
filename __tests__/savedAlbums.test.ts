import {
  DownloadedTrack,
  albumKeyOf,
  findDownload,
  findSavedAlbumPage,
  findSavedArtistPage,
  saveDownloadedTracks,
  savedAlbumSlug,
  savedArtistSlug,
} from "@/scripts/downloadManager";

const file = (id: number, title: string, order: number): DownloadedTrack => ({
  id,
  title,
  artist: "Lou Lou",
  albumTitle: "Night Swim",
  artwork: "file:///covers/night-swim.jpg",
  url: `file:///files/${id}.mp3`,
  order,
  downloadedAt: 1,
  source: "file",
});

describe("pages made from saved files", () => {
  const tracks = [file(-2, "Second Song", 2), file(-1, "First Song", 1)];
  const key = albumKeyOf(tracks[0]);

  beforeAll(() => saveDownloadedTracks(tracks));

  test("an album with no online page gets one made from its files", async () => {
    const page = await findSavedAlbumPage(savedAlbumSlug(key));
    expect(page.title).toBe("Night Swim");
    expect(page.artist.name).toBe("Lou Lou");
    expect(page.artist.urlSlug).toBe(savedArtistSlug("Lou Lou"));
    expect(page.tracks?.map((t) => t.title)).toEqual(["First Song", "Second Song"]);
    expect(page.tracks?.[0].audio?.url).toBe("file:///files/-1.mp3");
  });

  test("its artist gets a page listing the artist's saved albums", async () => {
    const artist = await findSavedArtistPage(savedArtistSlug("lou lou"));
    expect(artist.name).toBe("Lou Lou");
    expect(artist.trackGroups.map((a) => a.title)).toEqual(["Night Swim"]);
  });

  test("a song on the album's online page finds its saved file", () => {
    const online = {
      id: 9001,
      title: "First Song",
      trackGroup: { title: "Night Swim", artist: { name: "Lou Lou" } },
    };
    expect(findDownload(online)?.url).toBe("file:///files/-1.mp3");
    expect(findDownload({ ...online, title: "Not Saved" })).toBeUndefined();
  });
});
