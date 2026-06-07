---
name: tech_stack
description: Languages, frameworks, build tools, and key library versions for Asset Tx Map V2
type: project
---

# Tech Stack

## Runtime & Language
- JavaScript (JSX) primary; one TypeScript file (`components/DGAToolsV2.tsx`)
- React 18.2, React DOM 18.2
- Node.js required (v16+)

## Build
- Vite 5.0 (`vite.config.mjs`)
- `@vitejs/plugin-react` 4.2 (Babel transform)
- `@tailwindcss/vite` 4.2 (Tailwind 4 via Vite plugin — no `tailwind.config.js`)
- Dev server: port 3000

## Styling
- Tailwind CSS 4.2 — utility classes
- Custom CSS variables in `App.css` for theme tokens (`--card`, `--primary`, `--foreground`, etc.)
- `framer-motion` 12.40 — animation (page transitions, modal enters, interactive feedback)

## Data / Backend
- `@supabase/supabase-js` 2.103 — database + auth + storage client
- Supabase project ref: `rgtwfmhnnmkbsdjgtxjb`
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (`.env.local`, not committed)

## UI Libraries
- `@radix-ui/react-dialog` 1.1, `@radix-ui/react-tabs` 1.1, `@radix-ui/react-tooltip` 1.2 — headless primitives
- `lucide-react` 0.563 — icons
- `recharts` 3.7 — charts (trending, DGA)
- `@xyflow/react` 12.10 — SOP flowchart

## Map
- `leaflet` 1.9, `react-leaflet` 4.2 — interactive map
- `react-leaflet-cluster` 3.1 — marker clustering
- `@dagrejs/dagre` 3.0 — graph layout (SOP flowchart)

## Document / File Processing
- `pdfjs-dist` 5.6 — PDF rendering and text extraction
- `tesseract.js` 7.0 + `@tesseract.js-data/eng` — OCR for image DGA import
- `react-dropzone` 15.0 — file drop zone
- `xlsx` 0.18 — Excel import

## Package Manager
- npm (lockfile: `package-lock.json`)
- No separate lint, test, or type-check script in `package.json`
