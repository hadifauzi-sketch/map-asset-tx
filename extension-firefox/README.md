# ACTMS → TX Asset Map (Firefox)

The Firefox build of the extension. What it does, what it reads from ACTMS, and
the conventions it shares with the PDF importer are documented once in
**[../extension-chrome/README.md](../extension-chrome/README.md)** — this file
covers only what differs on Firefox.

## What differs

Just the manifest:

| | Chrome / Brave | Firefox |
| --- | --- | --- |
| Background | `service_worker` | `scripts` (event page) — Firefox has no MV3 service worker |
| Add-on id | not required | `browser_specific_settings.gecko.id`, required for MV3 |

`src/` and `icons/` are byte-identical to the Chrome folder. They are **copies**:
`extension-chrome/` is the source of truth, and `npm run ext:sync` refreshes them
here. `npm test` fails if the two have drifted, so this folder cannot quietly go
stale.

## Install for a quick trial

`about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick
`manifest.json` in this folder.

**This is removed when Firefox closes.** Normal-release Firefox only installs
add-ons permanently if Mozilla has signed them — there is no unpacked-and-
permanent option as there is in Chrome and Brave. For day-to-day use, sign it.

## Install permanently (AMO signing)

Self-distribution signing is free, needs no public listing, and returns a `.xpi`
that installs permanently in normal Firefox.

```bash
npm run ext:xpi      # -> build/lims-tx-asset-map-<version>.xpi
```

Then:

1. Go to [addons.mozilla.org/developers/addon/submit/distribution](https://addons.mozilla.org/developers/addon/submit/distribution).
2. Choose **On your own site** — this is the self-distribution route. It keeps
   the add-on unlisted; nobody browsing AMO will find it.
3. Upload the `.xpi`. The automated validator runs immediately; an unlisted
   add-on is normally signed within minutes.
4. Download the **signed** `.xpi` it returns and open it in Firefox, or drag it
   onto the browser window. That install survives a restart.

Bump `version` in **both** manifests before each submission — AMO refuses a
version number it has already seen, and the parity test refuses a mismatch
between the two builds.

### Notes on the packaging

The `.xpi` is a plain zip with `manifest.json` at the archive root — nested
inside a folder is the usual reason AMO rejects an upload. It is built by
`scripts/pack-firefox-xpi.mjs` using a small dependency-free zip writer rather
than PowerShell's `Compress-Archive`, which stores entry names with backslash
separators that the ZIP spec forbids. To confirm what a packed file contains:

```bash
node scripts/verify-xpi.mjs build/lims-tx-asset-map-0.2.0.xpi
```
