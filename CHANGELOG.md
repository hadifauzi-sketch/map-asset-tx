# Changelog

## Unreleased

## 4.1.4 - Company & Area on the Asset Record

### Added

- **`Company / Parent` and `Area` fields at the top of the Information tab** (`components/TransformerDetailModal.jsx`). The transformer record previously showed the site and the state but never named the company that owns the asset or the drawn area it sits in — both were only visible by opening the boundary on the map.
- `lib/assetPlacement.js` with `resolveAssetPlacement(transformer, floorPlans, companyBoundaries)`, resolving both values in one pass:
  1. the area plan whose saved `transformer_ids` contains the asset — what was ticked in *Transformers inside this Area*;
  2. failing that, the area polygon that geometrically contains the asset, so an asset never ticked into an area is still labelled;
  3. the company name falls back to the `Company / Parent` boundary containing the asset when no area covers it.
- `tests/assetPlacement.test.mjs` — six cases over the row shapes `floorPlanService.getAll()` returns, covering the saved assignment, the geometric fallback, boundary-only company resolution, an asset outside every polygon, and malformed overlay rows.
- **Owner column in the Asset Access tree** — a `TNB` / `Non-TNB` segmented switch on every row of Asset Management. Retyping an asset previously meant opening its edit form one at a time; the switch writes it in place, and a state or site row retypes its whole subtree in one write.
- Branch owner state: a row reads `TNB`, `Non-TNB`, or *mixed* (dashed outline, with the `n TNB · n Non-TNB` split in its tooltip). Both targets stay one click away, so a mixed branch can be settled either way directly.
- `branchOwnerState(ids, ownerById)` in `lib/assetAccessTree.js`, with tests covering the all/all/mixed cases and the TNB fallback for unknown or missing values.
- `onAssetOwnerChanged` prop on `AssetManagementDialog`; `App.jsx` patches the loaded transformer list with it, so map badges and the owner filters follow a bulk retype without a reload behind the open dialog.

### Changed

- Per-row `TNB` / `NON-TNB` chip replaced by the switch, and the owner filter counts now read the panel's live owner map, so they move the moment a row is retyped.
- Owner switch labels stay in natural case (`Non-TNB`, not `NON-TNB`) at 9px on a fixed `h-5` track, clipped to the pill. Upper-cased at body size the label was wider than its segment and painted over the pill's own border.
- Owner segments are weighted 2:3 rather than split down the middle: `Non-TNB` is more than twice the length of `TNB`, so equal halves truncated the longer label to `Non-…` while the shorter one sat in empty space.
- Tree column headers `Owner`, `Granted`, and `Access` dropped to 9px: at the body size `Access` was wider than the 44px column it names and ran into `Granted`.
- Owner-type writes are chunked at 80 ids per request — a state-wide retype would otherwise put ~300 uuids in one PostgREST query string. Chunks that land before a failure are still applied to the on-screen rows.
- Asset ids are compared as strings on both sides of the area lookup, so an area holding a numeric `transformer_id` still matches its asset.
- Malformed overlay rows (an area or boundary with no `points` or no `transformer_ids`) are skipped rather than throwing while the resolver walks the list.
- Package, README, and App Info version metadata are aligned at v4.1.4.

## 4.1.3 - Asset Management, Access Tree & Owner Filter

### Added

- **Asset Management** — a standalone admin window (`components/Authentic/AssetManagement.jsx`) holding per-user asset access, opened from the sidebar instead of from Settings.
- `Asset` button in the sidebar — full-width in the expanded sidebar and as an icon tile in the collapsed rail. Rendered only when `onOpenAssetManagement` is passed, which `App.jsx` does for admins only.
- Tabbed layout in Asset Management driven by the `ASSET_MANAGEMENT_TABS` array, so a future asset-wide tool is one array entry plus one `<Tabs.Content>`.
- Header summary in Asset Management: total assets, managed (non-admin) user count, and a reload button.
- Granted-asset count beside each account in the user picker, and a header strip confirming the selected account, username, and role above the tree.
- Collapsible State → Site → Transformer tree, replacing the flat paginated permission table.
- Tri-state branch switches (none / partial / full) that grant or revoke an entire state or site in one action.
- `granted/total` coverage counters on every state and site row.
- Expand / Collapse control for all branches.
- All / TNB / Non-TNB owner filter above the tree, with counts tallied before the filter is applied.
- `TNB` / `NON-TNB` tag on each transformer row.
- Hover preview card for transformer rows, with a static Map/Satellite minimap, asset details, and on-demand oil-test and document counts.
- `lib/assetAccessTree.js` with the grouping and branch-state logic as pure functions, plus regression tests.

### Changed

- `components/Authentic/roles.jsx` is now a Users-only panel: the tab bar and the ~270-line `PermissionsPanel` were removed, and it loads only `admin_list_users` instead of fetching users, transformers, and permissions in parallel.
- Settings is now account, asset owner visibility, App Tour, and Users; its description points to Asset Management for access assignment.
- Asset Management loads its data on open rather than on mount, so access changed elsewhere is current on the next open.
- The `[data-asset-hover-card]` outside-interaction guard moved from the Settings dialog to Asset Management, where the hover card is now rendered.
- Asset Access search now matches transformer name, site, state, and mnemonic; an active search auto-expands matching branches.
- `Grant all`, `Revoke all`, and branch switches operate on the active owner filter and search.
- Bulk grants and revokes send only the transformer ids that would actually change.
- Permission writes re-read only the permissions table instead of reloading users, transformers, and permissions.
- Pagination removed from Asset Access; the tree body scrolls in place.
- Package, README, and App Info version metadata are aligned at v4.1.3.

### Fixed

- The access tree no longer collapses back to its default layout after every grant or revoke. The full reload was flipping the panel's loading state and unmounting the tree.
- Access switches and counters now update immediately on click instead of after the server round-trip, and revert if the write fails.

## 4.1.2 - Single-Sample PDF Test Import

### Added

- OCR fallback for scanned single-sample PDF laboratory certificates.
- Multi-page result extraction for supported DGA gases and additional oil-quality tests.
- Sampling Date detection with Test Date fallback.
- One-sample review workflow before creating or updating a dated Oil Test record.
- Regression coverage for scanned certificates, historical PDF formats, imported fields, TDCG, and Storage retries.

### Changed

- Single-sample and historical imports now share the same Oil Test payload normalization and comparison logic.
- The Documents upload guidance now describes both scanned single-sample PDFs and historical result tables.
- Package, README, and App Info version metadata are aligned at v4.1.2.

### Fixed

- Appearance values are preserved when a reviewed Documents import is saved.
- Temporary Supabase Storage HTTP 520 and related server failures retry safely using one object path.
- Ambiguous Storage responses are checked before retrying to prevent duplicate PDF objects.
- Reviewed results remain open with a clearer message when document storage cannot be completed.

## 4.0.1 - Weather Intelligence Update

### Added

- Open-Meteo weather tool on the map toolbar.
- Weather history panel with date selection, oil sample date dropdown, and selected-site weather records.
- Weather map overlay with toggles for Temperature, Humidity, Rain, Condition, Wind speed, and Dewpoint.
- Hourly weather chart drawer showing 12 AM through 11 PM for the selected site and date.
- Cursor-following chart tooltip with Temp, Dewpoint, Humidity, time, and condition.
- Hourly weather chips with condition icons for Sunny, Cloudy, Rain, Drizzle, Fog, Storm, and Snow.

### Changed

- Weather panel now opens at the bottom right by default and can be dragged around the map.
- Hourly weather chart can be collapsed, expanded, dragged, and shown without vertical panel scrolling.
- Weather date picker follows the app's themed calendar UI.
- Sample date selection now uses oil test dates from the selected transformer and defaults the lookup time to 12:00 PM.
- Weather toolbar button is icon-only to match the surrounding map tools.
- Sidebar company/floor asset counts now clarify visible assets versus assigned assets.

### Fixed

- Weather history modal no longer lists every weather asset when a site is selected.
- Company and floor hierarchy messaging now helps identify assigned assets hidden by filters or Supabase permissions.
- Weather chart tooltip now follows the cursor while reading the nearest hourly point.

### Notes

- Weather data uses the `openmeteo` npm package and Open-Meteo archive/forecast APIs.
- If Open-Meteo returns `Minutely API request limit exceeded`, wait one minute and refresh the weather panel.

## 4.0.0 - Major Release

- App-wide animation refresh with framer-motion.
- New shared tooltip, combobox, and date picker UI.
- Guided onboarding tour, SOP flowchart, and app information dialogs.
- Oil test form, DGA analysis, sidebar, comparison, floor plan, company boundary, document, and image workflow improvements.
