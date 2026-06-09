# Tech Stack

## Language & Runtime
- JavaScript (JSX) throughout; one TypeScript file: `components/DGAToolsV2.tsx`
- No strict TS enforcement — no tsconfig, no eslintrc

## Framework & Build
- React 18.2 (functional components + hooks only)
- Vite 5 + @vitejs/plugin-react; config: `vite.config.mjs`
- Dev server: localhost:3000 (`server.port: 3000`, `open: false`)

## Styling
- Tailwind CSS v4 via `@tailwindcss/vite` plugin (no tailwind.config file needed)
- App.css for component-level styles + CSS variables

## Map
- react-leaflet 4.2 + leaflet 1.9
- react-leaflet-cluster 3.1 (MarkerClusterGroup)
- Geo search: `components/GeoSearchControl.jsx`
- NASA GIBS WMTS tiles (public, no token) for LST/UHI overlays

## Backend
- Supabase (supabase-js ^2.103.0), PostgreSQL
- Project ref: `rgtwfmhnnmkbsdjgtxjb`
- Client: `lib/supabaseClient.js`

## UI Libraries
- Radix UI: @radix-ui/react-dialog, @radix-ui/react-tabs, @radix-ui/react-tooltip
- lucide-react for icons
- framer-motion 12 for animations
- recharts 3.7 for charts

## Data & Analysis
- @xyflow/react 12 + @dagrejs/dagre 3 — flow diagrams (SOP flowchart, DGA workbench)
- xlsx — Excel import
- pdfjs-dist 5 — PDF parsing
- tesseract.js 7 — OCR on images
- openmeteo — weather API (Open-Meteo, no key required)

## Package Manager
- npm (package-lock.json present, no yarn.lock/pnpm-lock)
