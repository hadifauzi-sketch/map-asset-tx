# Conventions

## Component Rules
- Functional components + hooks only; no class components.
- All app-wide state lives in `App.jsx`; children receive props.
- No global state library (Redux, Zustand, Context) for app state — props drill down.
- `data-tour="<key>"` attributes on elements to register spotlight tour stops (see `AppOnboardingTour.jsx`).

## UI Primitives — Always Use These
| Need | Component |
|------|-----------|
| Dropdown select | `components/ui/combobox.jsx` — replaces all `<select>` |
| Date input | `components/ui/date-picker.jsx` — replaces all `<input type="date">` |
| Action button tooltips | `<AppTooltip>` from `components/ui/app-tooltip.jsx` |
| Dialogs/modals | `<Dialog>` from `components/ui/dialog.jsx` (Radix) |
| Tabs | `components/ui/tabs.jsx` (Radix) |
| Badges | `components/ui/badge.jsx` |

## Animation Pattern (framer-motion)
- Modal enter: scale + fade in
- Modal exit: slide out + fade
- Collapsible panels: height animation + chevron rotation

## Service Layer
- Supabase calls MUST go through `lib/*Service.js`; never import supabaseClient directly into components.
- Each domain has one service file: `transformerService`, `oilTestService`, `documentService`, `floorPlanService`, `companyBoundaryService`, `locationService`, `weatherService`, `lstService`.

## File Naming
- Components: PascalCase `.jsx`
- Lib utilities: camelCase `.js`
- One `.tsx` exception: `components/DGAToolsV2.tsx`

## DB Migrations
- File format: `supabase/migrations/YYYYMMDDNNNNNN_description.sql`
- Always write a new migration file; never edit existing ones.

## DGA Analysis
- Standards data lives in `lib/standards/`
- Diagnostic logic in `lib/dga/diagnostics.js`
- Heptagon geometry: `lib/dga/heptagonGeometry.js` + `heptagonAnalysis.js`
- Duval geometry: `lib/dga/duvalGeometry.js`
- Per-oil-type config: `lib/dga/appConfig.js` — `getStandardOptionsForOilType()`
