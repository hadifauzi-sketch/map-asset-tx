# ACTMS → TX Asset Map (Chrome extension)

Captures a transformer and its oil test results from an ACTMS **Sample Result
List** page and hands them to the TX Asset Management app, which opens them in
its normal review form before anything is saved.

## How it reads ACTMS

ACTMS (`actms.tnbr.com.my`) is a classic ASP application that server-renders the
sample result page as HTML tables — there is no JSON API to call. So the
extension reads the page **already open in your tab**, where you are already
signed in. It fetches nothing, stores no credentials, and never sees a password
or session token.

From `SampleResultList.asp` it lifts:

- the **Transformer Identification** block — Site, TX No., Serial No., Mnemonic,
  Load MVA, Voltages, Maker, Year Built
- every **result table** — DGA concentrations, Neutralization Value, Water
  Content, Colour, and any other section laid out as `Test | Result | Flag | …`

## Conventions it matches

These mirror the existing PDF importer on purpose. Diverging on either would
create duplicate oil test rows instead of updating existing ones:

| Convention | Why |
| --- | --- |
| `NIL` → `0` | A gas below detection was *measured*, not *missing*. Same as `parseNumericValue()` in `lib/dga-import/dgaImportShared.js`. |
| Sampling Date preferred over Test Date | Same as `pdfImport.js`, which uses `samplingDate \|\| testDate`. For the sample above that is 20/07/2026, not 30/07/2026. |
| `-` is not a value | ACTMS prints `-` for empty fields (Region, Winding Temp); storing it literally would give a transformer whose state is `-`. |

Job No., Certificate No., and Sampling Point are written into the oil test's
**notes** so every imported row traces back to its ACTMS certificate.

## Install (unpacked)

1. Copy the `extension/` folder onto the machine (or clone the repo there).
2. `chrome://extensions` → enable **Developer mode**.
3. **Load unpacked** → select the `extension/` folder.

That is the whole setup. It targets the deployed app at
`https://map-asset-tx.vercel.app` out of the box, and access to that host, to
its `git-main` preview alias, and to `actms.tnbr.com.my` is declared in the
manifest — so it is granted at install with no permission step and nothing to
configure.

**Developing against a local server?** Open the popup and set *Asset Map origin*
to `http://localhost:3000`; that host is in the manifest too. The value is
stored in `storage.sync`, so it follows your browser profile.

The popup's grant button is only needed for a host that is not in the manifest —
a custom domain, say.

## Firefox

The Firefox build lives in **[`../extension-firefox/`](../extension-firefox/)** —
see its README for install and AMO signing. Firefox has no MV3 service worker
and requires the manifest to be named `manifest.json`, so the two engines cannot
share a folder; both are committed and load directly.

`src/` and `icons/` are identical in the two folders and this one is the source
of truth. After editing anything here:

```bash
npm run ext:sync     # copy src/ and icons/ into extension-firefox/
```

`npm test` fails if you forget — see `tests/extensionParity.test.mjs`.

The one rule that keeps a single source tree working on both engines: **never
touch the `chrome` global directly.** Import `src/shared/browserApi.js`, which
resolves `browser ?? chrome`, so every awaited call gets a promise on either
engine. The parity test enforces this too.

## Use — right-click

ACTMS opens sample results in a **popup window, which has no toolbar**, so there
is no extension icon to click there. The context menu is the primary entry point.
Open a sample result in ACTMS with the Asset Map in another tab, then right-click
the page and pick one of two actions:

### Add or update the asset from this record

Sends the **identity fields only** — Site, TX No., Serial No., Mnemonic, Load
MVA, Voltage, Maker, Year Built, plus the state inferred from the client address.
The app opens the transformer in its normal edit form, matched to an existing
asset or prefilled as a new one. **Nothing is written until you click Save.**

On an asset that already exists this only fills blanks; it never overwrites
details curated in the app.

### Add this test result to the asset

Sends the **readings only** and files them straight into the matched asset's oil
test records. This one writes immediately — there are no identity fields to
review — and the upsert is keyed on test date, so re-sending the same sample
updates that row rather than adding a duplicate.

If no asset matches, nothing is written and the app says so: add the asset first,
then send the result.

### Matching

An incoming record is matched by **serial number** across the whole register
first, using the same normalisation as the database's uniqueness index. Only if
that finds nothing does it fall back to **site and transformer name together** —
never name alone, since names like "T1" repeat across sites. A same-site,
same-name asset holding a different serial is refused rather than merged.

The menu items only appear on the configured ACTMS host. The toolbar popup offers
the same two actions and additionally lists any unrecognised ACTMS labels under
**Unmapped LIMS fields** — add those spellings to `src/lims/fieldMap.js`.

## Safety model

The extension does **not** write to Supabase. It posts into the app tab, and the
app saves through `transformerService` / `oilTestService` exactly as a PDF import
would — so row-level security, the app-user permission model, and the serial
number uniqueness check all still apply, and no database key ships in an
extension.

On an asset that already exists, the LIMS **only fills blank fields**; it never
overwrites details curated in the app.

## Layout

```
manifest.json            MV3 manifest; host permissions requested at runtime
src/background.js        Service worker: scrape the tab, relay into the app tab
src/popup.html|js        Configuration and the "send record" action
src/lims/adapter.js      ACTMS page parsing — the only LIMS-specific file
src/lims/fieldMap.js     Label aliases, mirroring lib/dga-import/dgaImportShared.js
src/shared/canonical.js  Payload contract and value coercion
```

The receiving half lives in the app at `lib/limsBridge.js`. It re-validates every
payload against its own key whitelist — a `postMessage` is untrusted input, so
the app never takes the extension's word for the shape.

Tests: `tests/actmsAdapter.test.mjs` (parsing, against a real ACTMS page) and
`tests/limsBridge.test.mjs` (validation). Run with `npm test`.
