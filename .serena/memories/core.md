# Core — Asset-tx-ver3 (TX Asset Management)

## App Identity
Transformer substation asset management SPA (no router), package version 5.x. 2D Leaflet map + lazy 3D Cesium globe. Backed by Supabase.

## Entry Points
- `index.html` → `main.jsx` → `App.jsx` (`#sop` hash → lazy `SOPStandalonePage`)
- `App.jsx` is the state hub (~3.6k lines): auth, transformers, selection, modals, map navigation. Feature state lives in hooks it calls:
  - `lib/useLstTool.js`, `lib/useWeatherTool.js` (map tools; both use `lib/useDraggablePanel.js` for the floating panel)
  - `lib/useCompanyBoundaries.js`, `lib/useFloorPlans.js` (lists, drafts, dialogs, CRUD). Called in that order; boundary↔floor drawing is mutually exclusive via passed-in cancel functions. Selection ids (`selectedFloorPlanId`, `selectedCompanyBoundaryId`) and `focus*` stay in App.
  - Hooks return App's original names and App destructures them, so JSX call sites never changed.
- 2D map = `components/MapView.jsx` (`React.memo`). Every prop must stay identity-stable (state, useMemo, ref, primitive); callbacks go through `mapHandlers = useStableHandlers({...})` (`lib/useStableHandlers.js`). An inline object/array/lambda prop silently disables the memo.

## Source Map
```
App.jsx                    state hub; map tools (weather, LST, floor plans, boundaries)
components/
  ui/                      shared primitives — see `mem:conventions`
  TransformerSidebar.jsx   2D sidebar; hierarchy tree uses assetTree.jsx/.css
  globe3d/                 3D view: Globe3DView (lazy), CesiumScene, TxListPanel, ResultPanel, layers
  Authentic/               sign-in, roles, AssetManagement, access tree
  dga-workbench/ standards/ transformer/ location-register/
  *MapLayer.jsx            2D overlays (power grid, data centres, weather, LST, floor plan, boundary)
lib/
  *Service.js              Supabase CRUD per domain
  assetHierarchy.js        State→Company→Area→Tx grouping/search, shared by 2D sidebar + 3D Tx list
  globe3d/                 3D helpers (assetSummary STATUS_META, layerRegistry, settingsStore)
  dga/ dga-import/ standards/ transformer-import/
  hiddenFuelsStore.js      external store shared by 2D legend + 3D power-plant filter
extension-chrome/          LIMS bridge extension (extension-firefox/ is a generated mirror: `npm run ext:sync`)
scripts/                   data builders (power grid/plants, data centres, buildings3d)
supabase/migrations/       numbered SQL migrations
tests/*.test.mjs           node --test suite
```

## Key Invariants
- State flows one-way `App.jsx` → props. Exceptions are small external stores in `lib/` (e.g. `hiddenFuelsStore`) used via a hook, not React Context.
- All Supabase calls go through `lib/*Service.js`.
- Transformer status (critical/warning/normal) is computed once in App (`transformerMarkerStatuses`) and passed down as `statusById`; 2D pins, 2D sidebar and 3D view must agree.
- Performance: on-demand dialogs/panels are `lazy()` and wrapped in `MountWhenOpened` (components/MountWhenOpened.jsx) or `Suspense`; heavy libs (pdfjs, xlsx, tesseract, openmeteo, @xyflow, cesium) must stay out of the main bundle via dynamic import. Vendor chunks (leaflet/supabase/react) set in `vite.config.mjs`.
- `TransformerMarker` is `React.memo`; MapView builds markers with cached icons and the stable `handlers` — don't pass inline lambdas/new icons to it.
- Hooks inside App must stay above its early returns (sign-in / loading / config screens). Values passed into a feature hook that App declares later must be wrapped (`(x) => focusFloorPlan(x)`) — they are only called on user actions.
- Refactor safety net (no git): `.backups/<date>-<step>/` checkpoints; verify with build + `npm test` + an undefined-identifier scan (Babel, `@babel/traverse` is installed via @vitejs/plugin-react).
- Malaysia geography: `lib/malaysiaStates.js`. Supabase project ref `rgtwfmhnnmkbsdjgtxjb`.

## Domain References
- UI primitives, service layer, file naming, DGA file locations: `mem:conventions`
- Packages and versions: `mem:tech_stack`
- Commands (dev, build, test, db, extension): `mem:suggested_commands`
- Definition of done: `mem:task_completion`
