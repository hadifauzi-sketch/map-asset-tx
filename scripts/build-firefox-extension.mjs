// Assembles a Firefox-loadable copy of extension/ into extension-firefox/.
//
// The two engines need different manifests and Firefox insists the file be
// named manifest.json, so they cannot share one folder. Everything else — all
// of src/ and icons/ — is identical and copied verbatim: the source uses
// src/shared/browserApi.js rather than touching the `chrome` global, so no code
// transform is needed here.
//
// Run: npm run ext:firefox

import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'extension');
const target = resolve(root, 'extension-firefox');

// A stale file left from a previous run would still be loaded by Firefox, so
// the folder is rebuilt from scratch rather than copied over.
await rm(target, { recursive: true, force: true });

await cp(source, target, {
  recursive: true,
  filter: (path) => !path.endsWith('manifest.json') && !path.endsWith('manifest.firefox.json'),
});

const firefoxManifest = JSON.parse(await readFile(resolve(source, 'manifest.firefox.json'), 'utf8'));
const chromeManifest = JSON.parse(await readFile(resolve(source, 'manifest.json'), 'utf8'));

// One version number for both builds — bumping the Chrome manifest alone and
// shipping a Firefox copy still claiming the old version would be worse than
// failing here.
if (firefoxManifest.version !== chromeManifest.version) {
  throw new Error(
    `Version mismatch: manifest.json is ${chromeManifest.version}, manifest.firefox.json is ${firefoxManifest.version}. Align them and re-run.`
  );
}

await writeFile(resolve(target, 'manifest.json'), `${JSON.stringify(firefoxManifest, null, 2)}\n`, 'utf8');

console.log(`Firefox build ready: ${target}`);
console.log('Load it with about:debugging#/runtime/this-firefox -> Load Temporary Add-on -> pick manifest.json');
