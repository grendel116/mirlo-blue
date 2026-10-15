import type { ByteReader } from "./readTags";

// Adds a front cover to a FLAC file. Mirlo embeds the cover in its MP3 downloads but not in
// its FLACs, and music apps read the cover from inside the file

const PADDING = 1;
const PICTURE = 6;
const FRONT_COVER = 3;
const MIME = "image/jpeg";

function blockHeader(type: number, length: number, last: boolean): Uint8Array {
  return Uint8Array.of((last ? 0x80 : 0) | type, (length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff);
}

// Picture type, mime type, description, width, height, depth, colors, then the image.
// Zero size and depth mean "read them from the image"
function pictureBody(jpeg: Uint8Array): Uint8Array {
  const body = new Uint8Array(32 + MIME.length + jpeg.length);
  const view = new DataView(body.buffer);
  let pos = 0;
  view.setUint32(pos, FRONT_COVER);
  pos += 4;
  view.setUint32(pos, MIME.length);
  pos += 4;
  body.set(Array.from(MIME, (c) => c.charCodeAt(0)), pos);
  pos += MIME.length + 4 + 16;
  view.setUint32(pos, jpeg.length);
  body.set(jpeg, pos + 4);
  return body;
}

// The file's header rebuilt with the cover as its last block, and where its audio starts.
// A file that isn't FLAC, or already has a picture, gives null
export function flacHeaderWithCover(
  read: ByteReader,
  jpeg: Uint8Array,
): { header: Uint8Array; audioStart: number } | null {
  if (String.fromCharCode(...read(0, 4)) !== "fLaC") return null;

  const blocks: Uint8Array[] = [];
  let offset = 4;
  let last = false;
  while (!last) {
    const header = read(offset, 4);
    if (header.length < 4) return null;
    last = (header[0] & 0x80) !== 0;
    const type = header[0] & 0x7f;
    const length = (header[1] << 16) | (header[2] << 8) | header[3];
    if (type === PICTURE) return null;
    if (type !== PADDING) {
      const block = read(offset, 4 + length).slice();
      block[0] = type;
      blocks.push(block);
    }
    offset += 4 + length;
  }

  const picture = pictureBody(jpeg);
  blocks.push(blockHeader(PICTURE, picture.length, true), picture);

  const header = new Uint8Array(4 + blocks.reduce((sum, b) => sum + b.length, 0));
  header.set(read(0, 4), 0);
  let pos = 4;
  for (const block of blocks) {
    header.set(block, pos);
    pos += block.length;
  }
  return { header, audioStart: offset };
}
