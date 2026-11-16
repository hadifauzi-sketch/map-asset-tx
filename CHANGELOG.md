# Changelog

## 5.2 - Faster Map & Floating Glass Sidebar

Version 5.2 makes the 2D map faster to work with and gives the sidebar a
lighter look: the cards float over the map on frosted glass, and the header
takes half the space it did.

### Changed

- **The 2D map no longer re-renders on unrelated changes.** The whole Leaflet map — base layers, ~330 transformer markers, company boundaries, floor plans, power grid, data centres, weather, LST and the search pin — moved out of `App.jsx` into a memoised `components/MapView.jsx`. Opening a dialog, a notice, a tool panel or the sidebar used to redraw every marker; now the map only re-renders when something it draws changes.
  - Map callbacks reach `MapView` through `lib/useStableHandlers.js`, which gives each handler a stable identity while always calling the latest version.
  - `lib/useDataCentreTracker.js` now returns a memoised object, so the data centre layer no longer breaks the map's memo.
- **`App()` split into feature hooks**, one feature at a time, each verified with build, tests and a smoke test. `App.jsx` went from 4,576 to 3,610 lines. Behaviour is unchanged.
  - `lib/useLstTool.js` — LST overlay state and panel.
  - `lib/useWeatherTool.js` — weather state, Open-Meteo loading with saved-reading fallback, and the hourly chart.
  - `lib/useDraggablePanel.js` — the drag and resize-fit logic the Weather and LST panels used to duplicate.
  - `lib/useCompanyBoundaries.js` — company / parent boundaries: list, drawing, reshape, metadata dialog and delete.
  - `lib/useFloorPlans.js` — floor plans / areas: list, drawing, dialogs, floor-detail modal and the derived per-company lookups.
- **Compact sidebar header** (`components/TransformerSidebar.jsx`). The title, user name and the collapse / settings / help / theme buttons share one slim row, with the four icon buttons grouped in a single toolbar. The four large stat tiles are now one 4-column strip (Assets · Areas · Companies · States; each still opens its list). Transformer, GPS and Asset sit on one row, and the search box drops its label. The hierarchy now starts about 235 px from the top instead of about 520 px.
- **Floating frosted-glass sidebar** on desktop (`App.css`). The panel behind the sidebar is now fully transparent, and only its contents float over the map as separate frosted-glass cards: the header, the *Asset hierarchy* heading and each state group, which also holds everything expanded under it. Empty space in the sidebar area passes clicks and scroll-zoom through to the map. The scrollbar is hidden; wheel and touch scrolling still work. Glass strength is set by `--glass-bg` (62 %) and `--glass-blur` (20 px). The mobile drawer and the collapsed icon rail are unchanged.
- The 3D Tx list's sort control uses the shared `Combobox` instead of a native `<select>`.

### Fixed

- **The *Selected company* / *Selected area* card could not be closed.** Clicking empty map now clears it. Clicks on polygons, markers and other map features still select them, and drawing or placing still works. Clicking a transformer, or opening its Details, now replaces the company card with that transformer.
- The search box placeholder no longer scrolls and shows clipped text. It now reads *Search floor, company or TX*, and hovering shows the full wording.

## 5.1 - Detailed Power Equipment (OpenInfraMap-style)

Version 5.1 brings the grid down to equipment level: what stands inside each
substation and along each line, drawn with the same symbols OpenInfraMap uses.

### Added

- **Switchgear, generation and line-support layers** on the 2D map's Power grid menu, drawn with OpenInfraMap-style symbols and each switchable on its own: power plant sites (223, OSM), generators (807, coloured by source with output MW), transformers (two- and three-winding, CT / VT), switches and circuit breakers, reactors / capacitors / converters, portals and line terminals (2,023), towers (46,400), transition towers, power poles and transition poles. Dense layers appear from street zoom and only draw what is in view.
- The menu is grouped into *Generation & sites*, *Switchgear*, *Power line supports* and *Lines & cables*, each with a Show all / Hide all switch.
- `npm run grid:download` (`scripts/download-power-equipment.mjs`) fetches the equipment from the Overpass API into `data/osm/` (git-ignored) and rebuilds `public/data/grid/`.

### Fixed

- Transformer cards now show the full winding ratio from `voltage:primary` / `voltage:secondary` / `voltage:tertiary` (e.g. **500/275 kV** instead of 500 kV), plus rating, phases, frequency, cooling and a link to the feature on OpenStreetMap. Substation, line and cable cards also gained ref, frequency, wires and location where mapped.

## 5.0 - 3D Globe, Power Grid & Data Centre Intelligence

Version 5.0 turns the map from an asset locator into a view of the grid around
each asset: a 3D globe with buildings and terrain, the national power grid,
power plants by fuel, and the data centres driving new load.

### Added

- **3D globe view** (CesiumJS), opened from the new **3D** button beside the Map / Satellite / Hybrid switcher. It is a second way to look at the same fleet, not a replacement: it receives the already-filtered transformers and the same per-transformer DGA status the 2D markers use, so owner filters, access rules and the saved gas limit standard all carry over. See `GLOBE_3D_GUIDE.md`.
  - **Tx list** (left) with search, status filter and state grouping; **DGA & oil result** (right) with the latest gases against their limits, trend sparklines, Duval primary fault and the IEC 60422 / ester oil-quality assessment; *Open full details* opens the existing transformer record on top of the globe.
  - **Data layers** switches: transformers, labels, company boundaries, site areas, 3D buildings, world terrain, sun lighting, plus removable sample feeds (power stations from the WRI Global Power Plant Database, OSM substations, RainViewer radar, USGS earthquakes). Layers are declared in `lib/globe3d/layerRegistry.js`.
  - **3D Tiles feature styling** for Cesium OSM Buildings: teal, OSM colours, by height, by type, industrial focus, and distance from the selected transformer (`lib/globe3d/buildingStyles.js`). Clicking a building shows its properties.
  - **Bottom dock**: location / Tx / coordinate search, camera controls, visual presets (Normal, Teal, NVG, FLIR, CRT, Noir) and map source (Esri satellite / hybrid / dark / light, OSM, bundled offline, Bing via ion, Google Photorealistic 3D). OpenStreetMap place search switches off while Google 3D is shown, because those tiles may only be combined with Google's geocoder.
  - **API keys** dialog for the Cesium ion token, Google Maps key and any extra named keys. Keys are stored in the browser's localStorage only; `VITE_CESIUM_ION_TOKEN` / `VITE_GOOGLE_MAPS_API_KEY` set a default for everyone.
- `npm run globe:plants` (`scripts/build-power-plants.mjs`) rebuilds `public/data/power-plants-mys.json` — the 55 Malaysian plants — from `public/data/global_power_plant_database.csv`, so the Power stations layer loads instantly and makes no third-party request.
- **Power plants by capacity and fuel type** on both the 2D map and the 3D globe. Each plant is coloured by primary fuel (Coal, Oil, Gas, Hydro, Nuclear, Solar, Waste, Wind, Geothermal, Biomass, Others) and sized by installed MW, with a collapsible legend (fuel swatches, plant counts on 2D, and a 50 / 500 / 2,000 MW size key). Clicking a plant shows Country, Name, Fuel Type, Owner, Capacity, Commissioned, Data Source, Reported Generation and Estimated Generation, plus a link to the source. `npm run globe:plants` now also exports country, source, URL, other fuels and the latest reported / estimated generation; styling and info cards live in `lib/powerPlants.js` and are shared by both views.
- **Power grid layers** in the 3D view's Data layers panel (new *Power grid* group, alongside Power stations): **Substations** (4,993 sites), **Individually mapped transformers** (475), **Power-line segments** (2,873, coloured by voltage — 500 / 275 / 132 / ≤ 66 kV, with a legend), **Minor power-line segments** (44) and **Cables** (38). Data is the OpenStreetMap Malaysia export in `public/data/Malaysia_Power_Map` (© OpenStreetMap contributors, ODbL; credit shown on the globe while a grid layer is on). Click any site or segment for its name, type, voltage, circuits, operator and OSM id.
  - `npm run globe:grid` (`scripts/build-power-grid.mjs`) turns the 11 MB of source GeoJSON into five compact files in `public/data/grid/` (~1.5 MB total): polygons become one point per site, tags are trimmed to what the map shows, and coordinates are rounded to ~1 m. Each layer is one same-origin fetch, cached for the session.
  - Drawn with Cesium primitives rather than entities — one point collection per layer and one batched, ground-clamped polyline primitive per line layer — so the whole country loads in under a second and stays visible over terrain. Labels appear only when zoomed in (4 km for substations, 2.5 km for transformers).
  - The Substations switch now uses this local data nationwide; the previous live Overpass query (current view only, "zoom in to load") is removed.
- **Power grid on the 2D map.** A new pylon button in the map toolbar (beside Weather and LST) opens a *Power grid* panel with switches for Power stations, Substations, Individually mapped transformers, Power-line segments, Minor power-line segments and Cables, plus *All on* / *Clear*, live counts, colour keys and a voltage legend. The choice is saved per browser; the button shows how many layers are on.
  - Drawn by `components/PowerGridMapLayer.jsx` on Leaflet canvas renderers in their own panes (lines under points, both under transformer pins), so all ~8,400 features pan and zoom smoothly. Lines get a dark casing so they read apart from the red/orange roads on the street basemap; point size follows zoom. Click a site or line for a popup with its details; hover shows its name.
  - Same data files, colours and info cards as the 3D globe: `describeGridRecord`, `gridRecordColor` and `lineWidthForVoltage` now live in `lib/globe3d/powerGrid.js` and both views use them. Layer list and saved state: `lib/powerGridMap.js`.
- **Local 3D buildings for all of Malaysia — no Cesium ion token needed.** The 3D view's *3D buildings* switch now streams `public/data/buildings3d/` (1,576,727 OpenStreetMap buildings, 10,489 tiles, ~850 MB) when no ion token is set; with a token it still uses Cesium OSM Buildings (worldwide, works with world terrain). Tiles load within ~7 km of the camera — central KL (~42k buildings) appears in about 1.5 s. Every building carries the same properties as Cesium OSM Buildings, so all building styles and the click card work unchanged.
  - `npm run globe:buildings` rebuilds it from `data/osm/malaysia.osm.pbf` (OpenStreetMap France extract, 15 Nov 2026) in about 1½ minutes: `scripts/buildings3d/extract_buildings.py` reads the footprints, `scripts/buildings3d/build_tileset.py` writes 3D Tiles (b3dm, 16-bit quantised positions). Needs Python with `osmium`, `mapbox_earcut`, `numpy`.
  - Heights: OSM `height` (0.5 % of buildings), else `building:levels` × 3.2 m (11 %), else a typical height by building type (house 6 m, factory 10 m, apartments 18 m…). Holes in footprints and roof shapes are not modelled.
  - Buildings sit on the ellipsoid, matching the globe without ion terrain. `data/osm/` and `public/data/buildings3d/` are git-ignored; the tileset adds ~850 MB to `dist/`.
- Cesium is loaded lazily (its own ~1.2 MB gzip chunk, fetched only when the 3D view opens) and its static assets are copied to `/cesium` by `vite-plugin-static-copy`.
- **Fuel-type filter for power plants.** Each fuel in the power plant legend toggles on and off, on the 2D map and in the 3D globe's Power plants tab. One saved setting (`lib/hiddenFuelsStore.js`) drives both views, so hiding Coal on one hides it on the other.
- **Power plant name labels** on both maps (`lib/powerPlantLabelLayout.js`, `lib/powerPlantLabelOverlay.js`). Labels are crisp DOM text placed in screen pixels: each prefers a short leader beside its pin and fans out vertically when crowded, and a label that cannot fit gives up its space while its pin stays.
- **Data centre tracker** on the 2D map and the 3D globe (`lib/dataCentres.js`, `lib/useDataCentreTracker.js`, `components/DataCentreTrackerPanel.jsx`, `components/DataCentreMapLayer.jsx`, `components/globe3d/dataCentreLayer.js`). Two sources: the SEAFIC Malaysia tracker (campuses with per-phase MW and build status, CC BY 4.0) and the Ringmast4r global directory. One tracker instance in `App` shares settings, data and filters across both maps.
  - **Overview** tab: capacity headline and stacked bar by build status (Operating, Under construction, Planned, Canceled, Undisclosed — click one to filter the map), a category × status table in MW or sites, coordinate coverage, and a by-state breakdown (`dataCentreBreakdown()`).
  - **Directory** tab: search plus state, operator, status and location filters, a per-campus phase-mix bar, *View on map* to fly to a site, and CSV export.
  - **Appearance** tab: colour by status or operator, and marker size.
  - The panel opens from the toolbar or the 3D right rail without switching the layer on.
- **Shared asset hierarchy** (`lib/assetHierarchy.js`): State → Company → Area → Transformer grouping and search, moved out of `TransformerSidebar.jsx` so the 2D sidebar and the 3D Tx list group and search identically. Covered by `tests/assetHierarchy.test.mjs`.
- `components/MountWhenOpened.jsx` mounts a lazy dialog the first time it opens and keeps it mounted afterwards, so its code downloads only when needed while close animations and in-dialog state behave as before.
- **Firefox build of the ACTMS extension**, as its own committed folder. `extension/` is now `extension-chrome/` (Brave and Chrome) alongside `extension-firefox/`; both load directly in their browser with no build step. They cannot share one folder because Firefox has no MV3 service worker — its background is an event page — and requires the manifest to be named `manifest.json`.
- `src/shared/browserApi.js` resolves `browser ?? chrome`, so one source tree runs on both engines: Firefox's `browser` is its promise-based namespace, and Chrome's `chrome.*` returns promises under MV3, so every awaited call works either way. All 19 call sites in `background.js` and `popup.js` go through it.
- `npm run ext:sync` copies `src/` and `icons/` from the Chrome folder, which is the source of truth; `npm run ext:check` reports drift and runs as part of `npm test` via `tests/extensionParity.test.mjs`, so an edit that never reaches the Firefox folder fails the suite rather than shipping stale to AMO.
- `npm run ext:xpi` packs the Firefox folder for addons.mozilla.org self-distribution signing — the only way to install permanently in normal-release Firefox. `scripts/lib/zip.mjs` is a small dependency-free zip writer: PowerShell's `Compress-Archive` stores entry names with backslash separators, which the ZIP spec forbids and the AMO linter rejects. `scripts/verify-xpi.mjs` checks a packed file's layout.

### Changed

- **3D Tx list redesigned** (`components/globe3d/TxListPanel.jsx`) as a compact State → Company → Area → Transformer tree with critical / warning / normal counts on every branch. Row classes are `g3d-txrow-*`, which fixes oversized transformer names caused by a clash with `ResultPanel`'s `.g3d-asset-title`.
- **2D sidebar asset list** uses the same compact tree (`components/assetTree.jsx` / `assetTree.css`), with the marker status colours, so the two views look and behave alike.
- Map legends moved to the bottom right in a frosted-glass panel on both the 2D map and the 3D globe.
- **Faster start-up.** On-demand dialogs (transformer detail, add / edit, location register, floor plan and boundary metadata, Asset Management, Users, SOP flowchart), the weather and LST panels, the sidebar gallery and compare dialogs, and the data centre panel are now lazy-loaded. The transformer detail and add / edit dialogs are prefetched while the browser is idle. `openmeteo` loads only when weather is used (`lib/weatherService.js`).
- Panel drags write the position straight to the element's style and commit one React state update when the drag ends, so dragging no longer re-renders the whole app on every pointer move. Icons are cached and frequently passed callbacks are kept stable.
- The Firefox manifest declares `browser_specific_settings.gecko.data_collection_permissions` as `{ "required": ["none"] }` — required for all new AMO submissions. The extension reads the ACTMS page and hands the record to the app tab in-browser; it has no endpoint of its own, so it collects nothing. Firefox only understands the key from 140, so `strict_min_version` stays at 128 (an ESR) and the linter's two "unsupported by min version" warnings are expected — older Firefox ignores the key.
- `npm run ext:xpi` now writes a `.zip` beside the `.xpi` and prints the full path to submit. The bytes are identical; AMO accepts either, but `.xpi` has no icon in Explorer and Windows hides extensions by default, so the `.zip` is the one that is hard to confuse with `manifest.json` in a file dialog. Picking the wrong file is what produces AMO's *"The filetype you uploaded isn't recognized"*.
- Extension `appOrigin` now defaults to the deployed app (`https://map-asset-tx.vercel.app`) rather than `http://localhost:3000`, so a fresh install on a work machine sends records to production without opening the popup first. Both Vercel hosts are declared in `host_permissions`, so there is no grant step either. Point it back at localhost in the popup when developing — that host is still in the manifest.
- Extension version bumped to 0.2.0.
- Package, README, and App Info version metadata are aligned at v5.0.

## 4.2 - Maintenance History & LIMS Capture

The asset record could show what the oil looked like at each sample but not what
had been *done* to it. Without that, a filtration and an incipient fault produce
the same shape on a trend line — a sudden drop in moisture, a DGA baseline that
restarts near zero — and the chart gives no way to tell them apart. This release
adds the maintenance history, draws it onto the trending charts, and measures
whether each job worked.

### Added

- **Maintenance tab** on the transformer record (`components/InterventionSection.jsx`), recording event date, type, compartment, oil volume, who performed it, and notes. The tab header shows the event count for the selected compartment, alongside Oil tests and Documents.
- `lib/interventionTypes.js` — ten event types (filtration, reclamation, degassing, top-up, retrofill, inhibitor dosing, passivator dosing, repair, OLTC maintenance, inspection). Each carries a short code, a colour, a plain-language note on what it does to the oil, and — the field that drives everything else — the list of chart series whose history it invalidates.
- **Maintenance markers on the Trending charts** (`lib/interventionMarkers.js`). Events anchor to the first sample taken on or after them, which is both the only date the category axis can draw and the first reading showing the effect. Events sharing an anchor are grouped into one labelled line rather than three overlapping ones, and events newer than the last sample are reported as pending instead of being dropped.
- **Before/after impact comparison** (`lib/maintenanceImpact.js`, `components/MaintenanceImpactCharts.jsx`) — pairs the last sample before each event with the first sample after it across TDCG, BDV, Moisture, and 2-FAL. Each measure declares whether higher or lower is the improvement, so a rise in BDV and a rise in moisture are not coloured the same.
- **Lifetime furan accumulation** (`lib/furanAccumulation.js`). Filtration and retrofill strip furan from the oil, so the measured 2-FAL curve falls even though the paper degradation that produced it has not reversed. Within one fill the latest reading already contains everything before it, so that fill contributes its peak; a recorded strip starts a new fill that stacks on top. Resets come from recorded maintenance, not from the shape of the curve — treating every dip as a strip would count ordinary sample-to-sample variation as fresh production.
- `supabase/migrations/20260831120658_asset_interventions.sql` — `asset_interventions`, indexed on `(transformer_id, event_date desc)`, with the policy dropped before creation so the migration stays re-runnable.
- **`ethanol` on oil tests** (`supabase/migrations/20260831175401_add_ethanol_to_oil_tests.sql`). Methanol was already stored; ethanol, its companion cellulose-degradation alcohol, had no home.
- **ACTMS Chrome extension** (`extension/`) — captures a transformer and its results from a TNB Research Sample Result List page via right-click. ACTMS is a classic ASP app with no JSON API, so the extension reads the page already open in the signed-in tab: it fetches nothing, stores no credentials, and never sees a session token. The asset action prefills the edit form and saves nothing until reviewed; the result action files the sample directly, keyed on test date so re-sending updates the row instead of duplicating it.
- `lib/limsBridge.js` — validates inbound extension payloads independently of the extension's own sanitiser, since a `postMessage` payload is untrusted input, and matches a record to an asset by serial number first, falling back to site *and* name together. Names like `T1` repeat across sites, so a name alone would attach a Kedah sample to whichever unrelated `T1` loaded first.
- `lib/oilTestChartData.js` and `lib/paperLife.js`, extracted so the Trending tab, the Maintenance tab, the health dashboard, and the oil test table plot and calculate from one source.
- Cancel / Save buttons at the **top** of the oil test form as well as the bottom. The form runs from Test Information to Estimate DP, so reaching the only Save meant scrolling past every section.
- `ND`, `N.D.`, `Not Detected`, and `None Detected` join `NIL` as below-detection-limit notations parsed to 0, in both the extension and the PDF importer.
- Tests: `actmsAdapter`, `limsBridge`, `limsAssetMatching`, `interventionMarkers`, `maintenanceImpact`, `furanAccumulation`, `paperLife`, `oilTestRow`, `belowDetectionLimit` — 108 passing.

### Changed

- `components/DataTrending.jsx` no longer owns its own oil-test-to-chart mapper; it and the Maintenance charts share `mapOilTestsToChartData`. Two mappers would eventually disagree, and a maintenance chart contradicting the trending chart is worse than no maintenance chart.
- `TransformerHealthDashboard` delegates its DP correlations to `lib/paperLife` instead of duplicating the equations inline.
- Interventions load when the record opens rather than when the Maintenance tab is first shown, because the Trending tab needs them too.
- Interventions filter by compartment exactly as oil tests do, so an OLTC filtration cannot annotate main-tank trending.
- `normalizeIdentifier` and `normalizeLookupText` are exported from `lib/transformerMnemonicAssist.js`, and the serial rule is documented as mirroring the `serial_number_normalized` generated column, so a serial matched in the app folds the same way the database's uniqueness index folds it.
- Sidebar quick-stat cards moved the value onto the icon row and tightened their spacing, so more of the asset list is visible above the fold.
- Package, README, and App Info version metadata are aligned at v4.2.

### Fixed

- **A reading of 0 was discarded when saving an oil test.** Every numeric column in `lib/oilTestService.js` was written as `testData.field || null`, and `0` is falsy — so a lab reporting `NIL` acetylene, correctly parsed to 0 by both importers, was stored as *not measured*. For C2H2 those two mean opposite things: no acetylene is a healthy transformer, no acetylene *reading* tells you nothing. `numericOrNull()` now keeps the zero, and `create()` and `update()` share one `buildOilTestRow()` so they cannot drift on coercion again.
- **The furan-based DP estimate returned nothing for realistic readings.** The Dong correlation takes 2-FAL in ppm and was being fed the stored ppb figure, which makes the expression cross zero at about 66 ppb — so every reading in the normal hundreds-to-thousands range produced null. The conversion now lives in `lib/paperLife.js`.
- Non-numeric text such as `Not Specified` no longer reaches a numeric column; it resolves to null instead of being passed to PostgREST as-is.

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
