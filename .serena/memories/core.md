---
name: core
description: Top-level source map and project-wide invariants for Asset Tx Map V2
type: project
---

# Asset Tx Map V2 — Core

Transformer substation asset management SPA (v3.9). Single repo, frontend-only; all persistence via Supabase (PostgreSQL + Storage).

## Entry Points
- `main.jsx` — renders `<App>` or `<SOPStandalonePage>` based on `window.location.hash === '#sop'`
- `App.jsx` — root component; owns map state, transformer list, DGA trend charts, auth idle sign-out, theme
- `index.html` → Vite dev server on port 3000

## Directory Map
```
App.jsx                     Root; map, markers, sidebar orchestration
App.css                     CSS variables (--card, --primary, --foreground, etc.) + global styles
main.jsx                    ReactDOM entry point
lib/
  supabaseClient.js         Supabase client (env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
  transformerService.js     Transformer CRUD
  oilTestService.js         Oil test CRUD
  documentService.js        File upload/download (bucket: transformer-documents)
  floorPlanService.js       Floor plan CRUD
  companyBoundaryService.js Company boundary CRUD
  locationService.js        Location register CRUD
  dga/                      DGA analysis: diagnostics, Duval geometry, heptagon analysis
  dga-import/               DGA import from PDF/Excel/image
  standards/                IEC 60422, 61203, 62975 oil quality profiles
  transformer-import/       Transformer PDF import
  appMetadata.js            App version/metadata
  utils.js                  General utilities
components/
  TransformerSidebar.jsx    Asset list panel
  TransformerMarker.jsx     Leaflet marker
  TransformerModal.jsx      Add/edit form
  TransformerDetailModal.jsx Asset detail view
  OilTestSection.jsx        Oil test management tab
  DocumentSection.jsx       Document management tab
  DGAWorkbenchModal.jsx     Full DGA workbench
  TransformerHealthDashboard.jsx Health overview
  CompanyBoundaryMapLayer.jsx  Company polygon drawing
  FloorPlanMapLayer.jsx     Floor plan overlay
  compareTX.jsx             Multi-asset DGA/oil compare view
  Authentic/                sign-in, register, roles
  dga-workbench/            AnalysisBoard, DuvalDiagram, DgaTrendingSection
  standards/                DgaAssessmentPanel, Iec60422Panel, SupplementaryOilReferencePanel
  transformer/              TransformerFormFields, TransformerPdfImportPanel
  ui/                       badge, button, card, dialog, input, switch, tabs, textarea (Radix-based)
supabase/
  migrations/               All DB migrations (initial + incremental by date)
  seed.sql                  Seed data
```

## Key Invariants
- No SSR; pure CSR SPA via Vite + React 18
- Auth: custom Supabase auth with roles (`app_users` table, RLS policies); idle sign-out timer in App.jsx
- Map: Leaflet + react-leaflet, default center Malaysia (3.139, 101.687), zoom 11
- Data returned from Supabase services is transformed to camelCase before entering UI
- CSS theming via variables in `App.css`; Tailwind 4 utility classes used throughout
- DGA analysis uses IEC 60599 / Duval Triangle / Duval Pentagon / Roger's ratio methods

## Domain References
- Oil test details and DGA logic: `mem:tech_stack` for library versions
- Code style and naming: `mem:conventions`
- DB schema: `supabase/migrations/` (chronological, named by date)
