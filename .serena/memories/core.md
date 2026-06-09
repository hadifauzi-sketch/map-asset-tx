# Core — Asset Tx Map V2

## App Identity
Transformer substation asset management system. Single-page React app (SPA, no routing). v4.0.1.

## Entry Points
- `index.html` → `main.jsx` → `App.jsx`
- `App.jsx` is the monolithic state hub: all transformer/map/modal/auth state lives here.

## Top-Level Source Map
```
App.jsx                  — main state + event handlers; ~80+ imports
App.css                  — all CSS (variables, global, component styles)
components/              — all React components
  ui/                    — shared primitives (Radix-based + custom)
  Authentic/             — auth: sign-in.jsx, register.jsx, roles.jsx
  dga-workbench/         — DGA analysis UI (AnalysisBoard, DuvalDiagram, DgaTrendingSection)
  location-register/     — LocationRegisterModule
  standards/             — oil standard panels (IEC 60422, DGA assessment, supplementary refs)
  transformer/           — TransformerFormFields, TransformerPdfImportPanel
lib/                     — service + utility layer (no React)
  *Service.js            — Supabase CRUD per domain (transformer, oilTest, document, floorPlan, companyBoundary, location, weather, lst)
  dga/                   — DGA logic (diagnostics, heptagon, duval geometry, appConfig)
  dga-import/            — file import parsers (excel, pdf, image, shared)
  standards/             — oil profile data (IEC 62975, 61203, 60422, modified ester, oilQuality)
  transformer-import/    — transformerPdfImport
supabase/
  migrations/            — numbered SQL migrations (format: YYYYMMDDNNNNNN_description.sql)
  seed.sql
```

## Key Invariants
- State flows one-way: `App.jsx` → props → children. No Redux/Zustand/Context for app state.
- All Supabase calls go through `lib/*Service.js` — never call supabaseClient directly from components.
- Malaysia-specific geography: `lib/malaysiaStates.js`.
- Supabase project ref: `rgtwfmhnnmkbsdjgtxjb`.
- Auth: custom session via `components/Authentic/sign-in.jsx`; roles in `roles.jsx`.

## Domain References
- Oil analysis standards: `mem:tech_stack` for packages; `lib/standards/` for profile data
- DB schema: read migration files in `supabase/migrations/` chronologically
- UI components: `mem:conventions` for which primitive to use where
