// Reads song details (title, artist, album, track number, cover) from the tags inside
// MP3 (ID3v2) and FLAC files. Other formats return no tags.

export type Tags = {
  title?: string;
  artist?: string;
  album?: string;
  track?: number;
  cover?: { bytes: Uint8Array; mime: string };
};

// Returns up to `length` bytes starting at `offset` (fewer at the end of the file)
export type ByteReader = (offset: number, length: number) => Uint8Array;

const MAX_TAG_BYTES = 12 * 1024 * 1024;

const latin1 = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join("");

function utf8(b: Uint8Array): string {
  return new TextDecoder("utf-8").decode(b);
}

function utf16(b: Uint8Array, bigEndian: boolean): string {
  let out = "";
  for (let i = 0; i + 1 < b.length; i += 2) {
    out += String.fromCharCode(bigEndian ? (b[i] << 8) | b[i + 1] : b[i] | (b[i + 1] << 8));
  }
  return out;
}

// ID3 text encodings: 0 latin1, 1 utf-16 with byte order mark, 2 utf-16 big endian, 3 utf-8
function decodeText(encoding: number, b: Uint8Array): string {
  let text: string;
  if (encoding === 1 && b.length >= 2) {
    const bigEndian = b[0] === 0xfe && b[1] === 0xff;
    text = utf16(b.subarray(2), bigEndian);
  } else if (encoding === 1 || encoding === 2) {
    text = utf16(b, encoding === 2);
  } else if (encoding === 3) {
    text = utf8(b);
  } else {
    text = latin1(b);
  }
  return text.split("\0")[0].trim();
}

// Position of the zero terminator that ends a string in the given encoding
function terminatorAt(b: Uint8Array, from: number, encoding: number): number {
  const wide = encoding === 1 || encoding === 2;
  for (let i = from; i < b.length; i += wide ? 2 : 1) {
    if (b[i] === 0 && (!wide || b[i + 1] === 0)) return i;
  }
  return b.length;
}

const syncSafe = (b: Uint8Array, at: number) =>
  ((b[at] & 0x7f) << 21) | ((b[at + 1] & 0x7f) << 14) | ((b[at + 2] & 0x7f) << 7) | (b[at + 3] & 0x7f);

const bigEndian32 = (b: Uint8Array, at: number) =>
  ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;

const littleEndian32 = (b: Uint8Array, at: number) =>
  (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

const trackNumber = (text: string) => {
  const n = parseInt(text, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

function readId3(read: ByteReader): Tags {
  const header = read(0, 10);
  const tags: Tags = {};
  const version = header[3];
  if (header.length < 10 || latin1(header.subarray(0, 3)) !== "ID3" || (version !== 3 && version !== 4)) {
    return tags;
  }

  const body = read(10, Math.min(syncSafe(header, 6), MAX_TAG_BYTES));
  let pos = 0;
  if (header[5] & 0x40) {
    pos = version === 4 ? syncSafe(body, 0) : bigEndian32(body, 0) + 4;
  }

  while (pos + 10 <= body.length && body[pos] !== 0) {
    const id = latin1(body.subarray(pos, pos + 4));
    const size = version === 4 ? syncSafe(body, pos + 4) : bigEndian32(body, pos + 4);
    const frame = body.subarray(pos + 10, pos + 10 + size);
    pos += 10 + size;
    if (frame.length === 0) continue;

    const encoding = frame[0];
    if (id === "TIT2") tags.title = decodeText(encoding, frame.subarray(1));
    else if (id === "TPE1") tags.artist = decodeText(encoding, frame.subarray(1));
    else if (id === "TALB") tags.album = decodeText(encoding, frame.subarray(1));
    else if (id === "TRCK") tags.track = trackNumber(decodeText(encoding, frame.subarray(1)));
    else if (id === "APIC" && !tags.cover) {
      // encoding, mime type, picture type, description, then the image
      const mimeEnd = terminatorAt(frame, 1, 0);
      const descEnd = terminatorAt(frame, mimeEnd + 2, encoding);
      const wide = encoding === 1 || encoding === 2;
      const bytes = frame.subarray(descEnd + (wide ? 2 : 1));
      if (bytes.length > 0) tags.cover = { bytes, mime: latin1(frame.subarray(1, mimeEnd)) };
    }
  }
  return tags;
}

function readFlac(read: ByteReader): Tags {
  const tags: Tags = {};
  if (latin1(read(0, 4)) !== "fLaC") return tags;

  let offset = 4;
  let last = false;
  while (!last) {
    const header = read(offset, 4);
    if (header.length < 4) break;
    last = (header[0] & 0x80) !== 0;
    const type = header[0] & 0x7f;
    const length = (header[1] << 16) | (header[2] << 8) | header[3];
    const start = offset + 4;
    offset = start + length;
    if ((type !== 4 && type !== 6) || length > MAX_TAG_BYTES) continue;

    const block = read(start, length);
    if (type === 4) {
      // vendor, then "NAME=value" comments
      let pos = 4 + littleEndian32(block, 0);
      const count = littleEndian32(block, pos);
      pos += 4;
      for (let i = 0; i < count && pos + 4 <= block.length; i++) {
        const size = littleEndian32(block, pos);
        const comment = utf8(block.subarray(pos + 4, pos + 4 + size));
        pos += 4 + size;
        const split = comment.indexOf("=");
        const name = comment.slice(0, split).toUpperCase();
        const value = comment.slice(split + 1).trim();
        if (name === "TITLE") tags.title = value;
        else if (name === "ARTIST") tags.artist = value;
        else if (name === "ALBUM") tags.album = value;
        else if (name === "TRACKNUMBER") tags.track = trackNumber(value);
      }
    } else if (!tags.cover) {
      // picture type, mime, description, width, height, depth, colors, then the image
      const mimeSize = bigEndian32(block, 4);
      const mime = latin1(block.subarray(8, 8 + mimeSize));
      let pos = 8 + mimeSize;
      pos += 4 + bigEndian32(block, pos) + 16;
      const size = bigEndian32(block, pos);
      const bytes = block.subarray(pos + 4, pos + 4 + size);
      if (bytes.length > 0) tags.cover = { bytes, mime };
    }
  }
  return tags;
}

// Tags for a file's bytes; a file we can't read, or one without tags, gives an empty result
export function readTags(read: ByteReader): Tags {
  try {
    const magic = latin1(read(0, 4));
    if (magic === "fLaC") return readFlac(read);
    if (magic.startsWith("ID3")) return readId3(read);
  } catch {}
  return {};
}
