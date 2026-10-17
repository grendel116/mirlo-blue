import {
  albumFolderPath,
  folderChanges,
  matchTrack,
  namesFromFile,
  pickCover,
  songDetails,
  songFileName,
} from "@/scripts/songFiles";
import { DownloadedTrack, linkedTrack, storedTrack } from "@/scripts/downloadManager";

const tracks = [
  { id: 11, title: "Opening", order: 1 },
  { id: 12, title: "Second Song", order: 2 },
];

describe("matchTrack", () => {
  it("ties a song to its Mirlo track by tagged title", () => {
    expect(matchTrack({ title: " second song " }, "xx.flac", tracks)?.id).toBe(12);
  });

  it("falls to the track number from tags, then from Mirlo's file name", () => {
    expect(matchTrack({ track: 1 }, "x.mp3", tracks)?.id).toBe(11);
    expect(matchTrack({}, "2-Second Song.mp3", tracks)?.id).toBe(12);
    expect(matchTrack({}, "Bonus.mp3", tracks)).toBeUndefined();
  });
});

describe("names and paths", () => {
  it("reads track number, artist and title from a file name", () => {
    expect(namesFromFile("01 - Band - Tune.mp3")).toEqual({ track: 1, artist: "Band", title: "Tune" });
    expect(namesFromFile("Tune.flac")).toEqual({ track: undefined, artist: "", title: "Tune" });
  });

  it("builds safe album folders and song names", () => {
    expect(albumFolderPath("AC/DC", "Back: In Black...")).toBe("AC_DC/Back_ In Black");
    expect(albumFolderPath("", undefined)).toBe("Unknown Artist/Untitled");
    expect(songFileName(3, "Why?", "flac")).toBe("03 Why_.flac");
    expect(songFileName(undefined, "Tune", "mp3")).toBe("Tune.mp3");
  });

  it("describes a song by tags, then file name, then folder", () => {
    expect(songDetails({ title: "T" }, "05 - A - Name.mp3", 0, "Folder Album")).toEqual({
      title: "T",
      artist: "A",
      albumTitle: "Folder Album",
      order: 5,
    });
    expect(songDetails({}, "Name.mp3", 2)).toEqual({
      title: "Name",
      artist: "Unknown Artist",
      albumTitle: "Imported Audio",
      order: 3,
    });
  });
});

describe("music folder scans", () => {
  it("finds songs whose files are gone and files not saved yet", () => {
    const saved = [
      { id: 1, path: "A/B/1.mp3" },
      { id: 2, path: "A/B/2.mp3" },
      { id: 3 }, // a song outside the music folder stays
    ];
    expect(folderChanges(saved, ["A/B/1.mp3", "C/new.flac"])).toEqual({
      gone: [2],
      added: ["C/new.flac"],
    });
  });

  it("prefers a cover image by name", () => {
    expect(pickCover(["A/back.jpg", "A/Cover.PNG"])).toBe("A/Cover.PNG");
    expect(pickCover(["A/back.jpg"])).toBe("A/back.jpg");
    expect(pickCover([])).toBeUndefined();
  });
});

describe("saved song records", () => {
  const base: DownloadedTrack = {
    id: 5,
    title: "Tune",
    artist: "Band",
    url: "blob:old",
    artwork: "blob:cover",
    downloadedAt: 1,
    source: "mirlo",
  };

  it("stores songs in the music folder by path alone", () => {
    const inFolder = { ...base, path: "Band/Album/01 Tune.mp3", coverPath: "Band/Album/cover.jpg" };
    expect(storedTrack(inFolder)).toEqual({ ...inFolder, url: "", artwork: undefined });
    expect(storedTrack(base)).toBe(base);
  });

  it("links stored songs to browser files when the folder is open", () => {
    const stored = { ...base, url: "", artwork: undefined, path: "p.mp3", coverPath: "c.jpg" };
    const links = { audio: new Map([["p.mp3", "blob:a"]]), covers: new Map([["c.jpg", "blob:c"]]) };
    expect(linkedTrack(stored, links)).toMatchObject({ url: "blob:a", artwork: "blob:c" });
    expect(linkedTrack(stored, { audio: new Map(), covers: new Map() }).url).toBe("");
    expect(linkedTrack(base, links)).toBe(base);
  });
});
