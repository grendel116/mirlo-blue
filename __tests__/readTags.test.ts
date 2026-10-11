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

  it("returns nothing for other files", () => {
    expect(readTags(readerOf(bytes("RIFF....WAVE")))).toEqual({});
  });
});
