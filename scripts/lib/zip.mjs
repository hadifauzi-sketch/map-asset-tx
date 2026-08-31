// Minimal, dependency-free ZIP writer.
//
// Written by hand rather than shelling out because Windows PowerShell's
// Compress-Archive stores entry names with backslash separators, which the ZIP
// spec forbids (4.4.17.1: "The path stored MUST NOT contain a drive or device
// letter... The name MUST use forward slashes"). Firefox tolerates it; the AMO
// linter is stricter, and a rejected upload is a slow way to discover that.
//
// Entries are deflated with a fixed timestamp, so the same input always
// produces a byte-identical archive.

import { deflateRawSync } from 'node:zlib';

// 1 Jan 2026, 00:00:00 in DOS date/time, for reproducible archives.
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
const DOS_TIME = 0;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

/**
 * @param {Array<{name: string, data: Buffer}>} entries
 *   `name` is the path inside the archive, forward-slashed and relative to its
 *   root — for an .xpi, `manifest.json` must be at the top level.
 * @returns {Buffer} the complete archive
 */
export function createZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  entries.forEach(({ name, data }) => {
    if (name.includes('\\')) {
      throw new Error(`Zip entry "${name}" must use forward slashes.`);
    }

    const nameBuffer = Buffer.from(name, 'utf8');
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // local file header signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(8, 8); // method: deflate
    localHeader.writeUInt16LE(DOS_TIME, 10);
    localHeader.writeUInt16LE(DOS_DATE, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    locals.push(localHeader, nameBuffer, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // central directory signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(8, 10); // method: deflate
    centralHeader.writeUInt16LE(DOS_TIME, 12);
    centralHeader.writeUInt16LE(DOS_DATE, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal attributes
    // Unix mode 0644 in the high word. `<< 16` alone overflows int32 and goes
    // negative, which writeUInt32LE rejects — hence the unsigned shift.
    centralHeader.writeUInt32LE((0o100644 << 16) >>> 0, 38); // external attributes
    centralHeader.writeUInt32LE(offset, 42); // offset of local header

    centrals.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + compressed.length;
  });

  const centralDirectory = Buffer.concat(centrals);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  end.writeUInt16LE(0, 4); // this disk
  end.writeUInt16LE(0, 6); // disk with central directory
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...locals, centralDirectory, end]);
}
