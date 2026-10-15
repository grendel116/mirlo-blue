import { flacHeaderWithCover } from "@/scripts/flacCover";
import { readTags } from "@/scripts/readTags";

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

function block(type: number, body: number[], last = false): number[] {
  const n = body.length;
  return [(last ? 0x80 : 0) | type, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, ...body];
}

// "TITLE=Song" Vorbis comment block body
function comments(title: string): number[] {
  const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
  const entry = ascii(`TITLE=${title}`);
  return [...le32(0), ...le32(1), ...le32(entry.length), ...entry];
}

const reader = (bytes: Uint8Array) => (offset: number, length: number) => bytes.subarray(offset, offset + length);

const AUDIO = [0xff, 0xf8, 1, 2, 3, 4, 5];
const JPEG = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 9, 9, 0xff, 0xd9);

function flac(...blocks: number[][]): Uint8Array {
  return Uint8Array.from([...ascii("fLaC"), ...blocks.flat(), ...AUDIO]);
}

describe("flacHeaderWithCover", () => {
  it("adds the cover as a front-cover picture and keeps tags and audio", () => {
    const file = flac(block(0, new Array(34).fill(7)), block(4, comments("Song")), block(1, [0, 0, 0], true));
    const rebuilt = flacHeaderWithCover(reader(file), JPEG)!;
    const out = Uint8Array.from([...rebuilt.header, ...file.subarray(rebuilt.audioStart)]);

    const tags = readTags(reader(out));
    expect(tags.title).toBe("Song");
    expect(tags.cover?.mime).toBe("image/jpeg");
    expect(Array.from(tags.cover!.bytes)).toEqual(Array.from(JPEG));
    expect(Array.from(out.subarray(out.length - AUDIO.length))).toEqual(AUDIO);
  });

  it("leaves a FLAC that already has a picture alone", () => {
    const file = flac(block(0, new Array(34).fill(7)), block(6, [0, 0, 0, 3], true));
    expect(flacHeaderWithCover(reader(file), JPEG)).toBeNull();
  });

  it("leaves other files alone", () => {
    expect(flacHeaderWithCover(reader(Uint8Array.from(ascii("ID3\u0003rest"))), JPEG)).toBeNull();
  });
});
