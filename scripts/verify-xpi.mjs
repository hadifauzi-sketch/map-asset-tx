// One-off inspection helper: list what is actually inside a packed .xpi.
//   node scripts/verify-xpi.mjs build/lims-tx-asset-map-0.2.0.xpi

import { readFile } from 'node:fs/promises';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/verify-xpi.mjs <file.xpi>');
  process.exit(1);
}

const buffer = await readFile(path);
const signature = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const names = [];

let index = 0;
while ((index = buffer.indexOf(signature, index)) !== -1) {
  const nameLength = buffer.readUInt16LE(index + 26);
  const extraLength = buffer.readUInt16LE(index + 28);
  names.push(buffer.slice(index + 30, index + 30 + nameLength).toString('utf8'));
  index += 30 + nameLength + extraLength;
}

names.forEach((name) => console.log(`  ${name}`));

const backslashed = names.filter((name) => name.includes('\\'));
const rootManifest = names.includes('manifest.json');

console.log(`\nentries:              ${names.length}`);
console.log(`manifest.json at root: ${rootManifest ? 'yes' : 'NO — AMO will reject'}`);
console.log(`backslash separators:  ${backslashed.length ? `NO — ${backslashed.length} bad` : 'none'}`);

process.exitCode = rootManifest && !backslashed.length ? 0 : 1;
