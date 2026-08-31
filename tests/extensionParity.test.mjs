import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { findDrift } from '../scripts/sync-firefox-extension.mjs';

// extension-chrome/ and extension-firefox/ are both committed so each loads
// directly in its browser without a build step. That convenience is only safe
// if they cannot silently diverge: an edit to the Chrome folder that never
// reaches the Firefox one would ship a stale add-on to AMO.
test('extension-firefox is in step with extension-chrome', async () => {
  const problems = await findDrift();

  assert.deepEqual(
    problems,
    [],
    `Run \`npm run ext:sync\`. Drift:\n  - ${problems.join('\n  - ')}`
  );
});

test('the two manifests differ only where the engines require it', async () => {
  const [chromeManifest, firefoxManifest] = await Promise.all([
    readFile(new URL('../extension-chrome/manifest.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../extension-firefox/manifest.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);

  // Firefox has no MV3 service worker; its background is an event page.
  assert.ok(chromeManifest.background.service_worker, 'Chrome build needs a service worker');
  assert.deepEqual(firefoxManifest.background.scripts, ['src/background.js']);
  assert.equal(firefoxManifest.background.service_worker, undefined);

  // Firefox refuses to install an MV3 add-on without an explicit id.
  assert.ok(
    firefoxManifest.browser_specific_settings?.gecko?.id,
    'Firefox build needs browser_specific_settings.gecko.id'
  );
  assert.equal(chromeManifest.browser_specific_settings, undefined);

  // Everything else that governs what the add-on can reach must match.
  assert.equal(chromeManifest.version, firefoxManifest.version);
  assert.deepEqual(chromeManifest.permissions, firefoxManifest.permissions);
  assert.deepEqual(chromeManifest.host_permissions, firefoxManifest.host_permissions);
});

test('neither build reaches for a browser global directly', async () => {
  // src/shared/browserApi.js is the one place allowed to touch them; everywhere
  // else must import it, or the Firefox build breaks on promise-less calls.
  const sources = [
    'extension-chrome/src/background.js',
    'extension-chrome/src/popup.js',
    'extension-chrome/src/lims/adapter.js',
    'extension-chrome/src/shared/canonical.js',
  ];

  for (const source of sources) {
    const text = await readFile(new URL(`../${source}`, import.meta.url), 'utf8');
    const code = text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    assert.ok(
      !/\bchrome\.\w/.test(code),
      `${source} uses the chrome global directly — import browserApi instead`
    );
  }
});
