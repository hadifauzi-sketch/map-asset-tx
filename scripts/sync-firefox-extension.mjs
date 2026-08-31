// Keeps extension-firefox/ in step with extension-chrome/.
//
// Both folders are committed and load directly in their browser — Brave and
// Chrome take extension-chrome/, Firefox takes extension-firefox/. Only the
// manifest genuinely differs between them (Firefox has no MV3 service worker
// and requires a gecko id), so each folder owns its own manifest.json and
// everything else is copied from the Chrome folder, which is the source of
// truth for all shared code.
//
//   npm run ext:sync    apply the copy
//   npm run ext:check   fail if the folders have drifted (run by npm test)

import { cp, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chromeDir = resolve(root, 'extension-chrome');
const firefoxDir = resolve(root, 'extension-firefox');

// Shared verbatim. manifest.json is deliberately absent: it is the one file
// that must differ, and each folder maintains its own.
const SHARED = ['src', 'icons'];

async function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFiles(full, base)));
    } else {
      out.push(relative(base, full).split('\\').join('/'));
    }
  }
  return out.sort();
}

async function readManifests() {
  const [chromeManifest, firefoxManifest] = await Promise.all([
    readFile(join(chromeDir, 'manifest.json'), 'utf8').then(JSON.parse),
    readFile(join(firefoxDir, 'manifest.json'), 'utf8').then(JSON.parse),
  ]);
  return { chromeManifest, firefoxManifest };
}

/** Differences that must never exist between the two builds. */
export async function findDrift() {
  const problems = [];

  const { chromeManifest, firefoxManifest } = await readManifests();

  // One version for both. Shipping a Firefox copy still claiming the previous
  // version would be worse than failing here.
  if (chromeManifest.version !== firefoxManifest.version) {
    problems.push(
      `version: extension-chrome is ${chromeManifest.version}, extension-firefox is ${firefoxManifest.version}`
    );
  }

  for (const key of ['name', 'description', 'permissions', 'host_permissions', 'optional_host_permissions']) {
    if (JSON.stringify(chromeManifest[key]) !== JSON.stringify(firefoxManifest[key])) {
      problems.push(`manifest "${key}" differs between the two builds`);
    }
  }

  for (const folder of SHARED) {
    const [chromeFiles, firefoxFiles] = await Promise.all([
      listFiles(join(chromeDir, folder)),
      listFiles(join(firefoxDir, folder)).catch(() => []),
    ]);

    for (const file of chromeFiles) {
      if (!firefoxFiles.includes(file)) {
        problems.push(`${folder}/${file} is missing from extension-firefox`);
        continue;
      }

      const [left, right] = await Promise.all([
        readFile(join(chromeDir, folder, file)),
        readFile(join(firefoxDir, folder, file)),
      ]);

      if (!left.equals(right)) {
        problems.push(`${folder}/${file} differs between the two builds`);
      }
    }

    for (const file of firefoxFiles) {
      if (!chromeFiles.includes(file)) {
        problems.push(`${folder}/${file} exists only in extension-firefox`);
      }
    }
  }

  return problems;
}

async function sync() {
  for (const folder of SHARED) {
    const target = join(firefoxDir, folder);
    // Rebuilt rather than copied over: a file deleted from the Chrome folder
    // would otherwise linger here and still be packaged into the .xpi.
    await rm(target, { recursive: true, force: true });
    await cp(join(chromeDir, folder), target, { recursive: true });
  }

  const remaining = await findDrift();
  if (remaining.length) {
    console.error('Synced the shared files, but the manifests still disagree:');
    remaining.forEach((problem) => console.error(`  - ${problem}`));
    console.error('\nThese are hand-maintained in each folder. Fix them and re-run.');
    process.exitCode = 1;
    return;
  }

  console.log('extension-firefox/ is in step with extension-chrome/.');
}

async function check() {
  const problems = await findDrift();
  if (!problems.length) {
    console.log('extension-firefox/ is in step with extension-chrome/.');
    return;
  }

  console.error('extension-firefox/ has drifted from extension-chrome/:');
  problems.forEach((problem) => console.error(`  - ${problem}`));
  console.error('\nRun `npm run ext:sync` to copy the shared files across.');
  process.exitCode = 1;
}

// Only act when run directly, so the test can import findDrift() without
// triggering a sync or setting an exit code.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await (process.argv.includes('--check') ? check() : sync());
}

export { chromeDir, firefoxDir, SHARED };
