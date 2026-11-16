# Conventions

## Component Rules
- Function components + hooks only.
- App-wide state lives in `App.jsx`; children get props. No Redux/Zustand/Context. Narrow cross-view state may use a tiny external store in `lib/` with a `use…` hook (pattern: `lib/hiddenFuelsStore.js`).
- `data-tour="<key>"` registers spotlight tour stops (`AppOnboardingTour.jsx`).
- Asset grouping/search: always use `lib/assetHierarchy.js` (`buildHierarchy`, `filterHierarchy`) so 2D and 3D lists stay identical.

## UI Primitives — Always Use These
| Need | Component |
|------|-----------|
| Dropdown select | `components/ui/combobox.jsx` (`{value,label}` options) — never native `<select>` |
| Date input | `components/ui/date-picker.jsx` |
| Action tooltips | `<AppTooltip>` (`components/ui/app-tooltip.jsx`) |
| Dialogs | `<Dialog>` (`components/ui/dialog.jsx`) |
| Tabs / Badges | `components/ui/tabs.jsx`, `components/ui/badge.jsx` |
| Lazy dialog mount | `components/MountWhenOpened.jsx` |
| Status counts / meter in trees | `components/assetTree.jsx` (2D); 3D uses `g3d-tree-*` in globe3d.css |

## Styling
- 2D: Tailwind + `App.css` tokens. 3D: classes prefixed `g3d-` in `components/globe3d/globe3d.css`; check for name collisions there (e.g. `.g3d-asset-title` belongs to ResultPanel).
- Status colours: critical `#dc2626`, warning `#eab308`, normal `#16a34a`.

## Service Layer
- Supabase calls only via `lib/*Service.js` (transformer, oilTest, document, floorPlan, companyBoundary, location, weather, lst, …).

## File Naming
- Components PascalCase `.jsx`; lib camelCase `.js`; tests `tests/<name>.test.mjs`.

## DB Migrations
- `supabase/migrations/YYYYMMDDNNNNNN_description.sql`; never edit existing ones.

## DGA Analysis
- Standards data `lib/standards/`; diagnostics `lib/dga/diagnostics.js`; heptagon `lib/dga/heptagonGeometry.js` + `heptagonAnalysis.js`; Duval `lib/dga/duvalGeometry.js`; per-oil-type config `lib/dga/appConfig.js` (`getStandardOptionsForOilType()`).
