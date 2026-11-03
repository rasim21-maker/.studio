import fs from 'node:fs/promises';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { walk } from './util.mjs';
const table = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(data) { let crc = 0xffffffff; for (const b of data) crc = table[(crc ^ b) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
// Standard ZIP (UTF-8 filenames, deflate, CRC32). Only trusted generated dist files.
export async function writeZip(root, target) {
  const chunks = [], central = [];
  let offset = 0;
  for (const rel of await walk(root)) {
    const name = Buffer.from(rel), raw = await fs.readFile(path.join(root, rel)), data = deflateRawSync(raw), crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(33, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(name.length, 26);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6); record.writeUInt16LE(0x800, 8); record.writeUInt16LE(8, 10);
    record.writeUInt16LE(33, 14); record.writeUInt32LE(crc, 16); record.writeUInt32LE(data.length, 20); record.writeUInt32LE(raw.length, 24); record.writeUInt16LE(name.length, 28); record.writeUInt32LE(offset, 42);
    chunks.push(local, name, data); central.push(record, name); offset += local.length + name.length + data.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22), count = central.length / 2;
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  await fs.writeFile(target, Buffer.concat([...chunks, directory, end]));
}
