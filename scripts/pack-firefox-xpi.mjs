// Packages extension-firefox/ as an .xpi for addons.mozilla.org.
//
// An .xpi is a plain zip with manifest.json at the ROOT — not nested inside a
// folder. Getting that wrong is the usual cause of an AMO upload being
// rejected, so the archive is built from the folder's contents rather than from
// the folder itself, and the layout is asserted before the file is written.
//
//   npm run ext:xpi
//
// Upload the result at addons.mozilla.org/developers/addon/submit/distribution
// and choose "On your own site" for self-distribution signing: Mozilla returns
// a signed .xpi that installs permanently in normal Firefox, with no public
// listing. Signing is what makes the install permanent — an unsigned folder
// loaded via about:debugging is discarded when Firefox closes.

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createZip } from './lib/zip.mjs';
import { findDrift } from './sync-firefox-extension.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const firefoxDir = resolve(root, 'extension-firefox');
const outDir = resolve(root, 'build');

const drift = await findDrift();
if (drift.length) {
  console.error('Refusing to package: extension-firefox/ has drifted from extension-chrome/.');
  drift.forEach((problem) => console.error(`  - ${problem}`));
  console.error('\nRun `npm run ext:sync` first.');
  process.exit(1);
}

async function collect(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collect(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

const paths = (await collect(firefoxDir)).sort();

const entries = await Promise.all(
  paths.map(async (path) => ({
    // Backslashes on Windows; the ZIP spec requires forward slashes.
    name: relative(firefoxDir, path).split('\\').join('/'),
    data: await readFile(path),
  }))
);

if (!entries.some((entry) => entry.name === 'manifest.json')) {
  throw new Error('manifest.json is not at the root of the archive — AMO will reject it.');
}

const { version } = JSON.parse(await readFile(join(firefoxDir, 'manifest.json'), 'utf8'));
const xpi = join(outDir, `lims-tx-asset-map-${version}.xpi`);
// The same bytes under a .zip name. AMO accepts .zip, .xpi and .crx, but its
// upload form rejects anything else with "The filetype you uploaded isn't
// recognized" — and on Windows, where Explorer hides known extensions and .xpi
// has no icon of its own, picking the wrong file in the browser's file dialog
// is easy. A .zip is unambiguous in that dialog, so it is the one to submit.
const zip = join(outDir, `lims-tx-asset-map-${version}.zip`);

await mkdir(outDir, { recursive: true });
// AMO refuses a version it has already seen, and a stale file here is easy to
// submit by mistake.
await rm(xpi, { force: true });
await rm(zip, { force: true });

const archive = createZip(entries);
await writeFile(xpi, archive);
await writeFile(zip, archive);

console.log(`Packaged ${entries.length} files at version ${version}.\n`);
console.log('Upload THIS file (copy the path into the file dialog):\n');
console.log(`    ${zip}\n`);
console.log(`(${xpi} is the identical archive, for installing the signed copy later.)`);
console.log('\nSubmit at https://addons.mozilla.org/developers/addon/submit/distribution');
console.log('Choose "On your own site" for self-distribution signing, then install the signed');
console.log('.xpi Mozilla returns — that install survives a Firefox restart.');
