import { readTags } from "@/scripts/readTags";

const bytes = (...parts: (number[] | string)[]) =>
  Uint8Array.from(
    parts.flatMap((p) => (typeof p === "string" ? Array.from(p, (c) => c.charCodeAt(0)) : p)),
  );
const readerOf = (data: Uint8Array) => (offset: number, length: number) =>
  data.subarray(offset, offset + length);

const syncSafe = (n: number) => [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le32 = (n: number) => be32(n).reverse();

function id3Frame(id: string, payload: number[], version = 4) {
  return [...bytes(id), ...(version === 4 ? syncSafe(payload.length) : be32(payload.length)), 0, 0, ...payload];
}
const text = (s: string) => [3, ...bytes(s)];

function id3File(frames: number[][], version = 4) {
  const body = frames.flat();
  return bytes("ID3", [version, 0, 0], syncSafe(body.length), body, [0, 0, 0, 0]);
}

describe("readTags", () => {
  it("reads ID3v2.4 text frames and cover", () => {
    const image = [1, 2, 3, 4];
    const apic = [3, ...bytes("image/png"), 0, 3, ...bytes("front"), 0, ...image];
    const file = id3File([
      id3Frame("TIT2", text("Song")),
      id3Frame("TPE1", text("Band")),
      id3Frame("TALB", text("Record")),
      id3Frame("TRCK", text("3/12")),
      id3Frame("APIC", apic),
    ]);
    const tags = readTags(readerOf(file));
    expect(tags).toMatchObject({ title: "Song", artist: "Band", album: "Record", track: 3 });
    expect(tags.cover?.mime).toBe("image/png");
    expect(Array.from(tags.cover!.bytes)).toEqual(image);
  });

  it("reads ID3v2.3 utf-16 text", () => {
    const utf16 = [1, 0xff, 0xfe, ...[..."Hé"].flatMap((c) => [c.charCodeAt(0), 0])];
    const file = id3File([id3Frame("TIT2", utf16, 3)], 3);
    expect(readTags(readerOf(file)).title).toBe("Hé");
  });

  it("reads FLAC comments and picture", () => {
    const comment = (s: string) => [...le32(s.length), ...bytes(s)];
    const comments = [
      ...le32(3),
      ...bytes("abc"),
      ...le32(3),
      ...comment("TITLE=Song"),
      ...comment("artist=Band"),
      ...comment("TRACKNUMBER=2"),
    ];
    const picture = [
      ...be32(3),
      ...be32(9),
      ...bytes("image/png"),
      ...be32(0),
      ...be32(0),
      ...be32(0),
      ...be32(0),
      ...be32(0),
      ...be32(2),
      9,
      8,
    ];
    const block = (type: number, last: boolean, data: number[]) => [
      (last ? 0x80 : 0) | type,
      (data.length >> 16) & 255,
      (data.length >> 8) & 255,
      data.length & 255,
      ...data,
    ];
    const file = bytes("fLaC", block(4, false, comments), block(6, true, picture));
    const tags = readTags(readerOf(file));
    expect(tags).toMatchObject({ title: "Song", artist: "Band", track: 2 });
    expect(Array.from(tags.cover!.bytes)).toEqual([9, 8]);
  });

  it("reads Opus comments spanning pages", () => {
    const comment = (s: string) => [...le32(s.length), ...bytes(s)];
    const packet = [
      ...bytes("OpusTags"),
      ...le32(2),
      ...bytes("ab"),
      ...le32(2),
      ...comment("TITLE=Song"),
      ...comment("ALBUM=Record"),
    ];
    const head = bytes("OpusHead", [1, 2, 3]);
    const page = (lacing: number[], data: number[]) => [
      ...bytes("OggS"),
      ...new Array(22).fill(0),
      lacing.length,
      ...lacing,
      ...data,
    ];
    // the comment packet is split over two pages (first page ends on a 255 byte segment)
    const padded = [...packet, ...new Array(300).fill(0)];
    const file = bytes(
      page([head.length], Array.from(head)),
      page([255], padded.slice(0, 255)),
      page([padded.length - 255], padded.slice(255)),
    );
    expect(readTags(readerOf(file))).toMatchObject({ title: "Song", album: "Record" });
  });

  it("reads M4A items", () => {
    const atom = (type: string, body: ArrayLike<number>) => [...be32(body.length + 8), ...bytes(type), ...Array.from(body)];
    const item = (type: string, flags: number, payload: ArrayLike<number>) =>
      atom(type, atom("data", [...be32(flags), 0, 0, 0, 0, ...Array.from(payload)]));
    const ilst = atom("ilst", [
      ...item("\u00a9nam", 1, bytes("Song")),
      ...item("\u00a9alb", 1, bytes("Record")),
      ...item("trkn", 0, [0, 0, 0, 5, 0, 9, 0, 0]),
      ...item("covr", 14, [7, 7]),
    ]);
    const moov = atom("moov", atom("udta", atom("meta", [0, 0, 0, 0, ...ilst])));
    const file = bytes(atom("ftyp", bytes("M4A ", [0, 0, 0, 0])), moov);
    const tags = readTags(readerOf(file));
    expect(tags).toMatchObject({ title: "Song", album: "Record", track: 5 });
    expect(tags.cover?.mime).toBe("image/png");
  });
  it("returns nothing for other files", () => {
    expect(readTags(readerOf(bytes("RIFF....WAVE")))).toEqual({});
  });
});
