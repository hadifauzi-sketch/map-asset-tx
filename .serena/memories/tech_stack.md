# Tech Stack

## Language & Build
- JavaScript (JSX); one TS file `components/DGAToolsV2.tsx`; no tsconfig/eslint.
- React 18.2 (function components + hooks), Vite 5 + @vitejs/plugin-react, `vite.config.mjs` (Cesium static copy, vendor manualChunks).
- Tests: Node built-in test runner (`node --test`), files `tests/*.test.mjs`.

## Styling
- Tailwind CSS v4 via `@tailwindcss/vite`; tokens in `App.css` (`:root` light, `.dark` dark: `--card`, `--card-muted`, `--foreground`, `--muted`, `--border`, `--primary`, `--primary-soft`, `--primary-strong`, `--ring`).
- 3D view has its own scoped tokens in `components/globe3d/globe3d.css` (`.g3d`, `.g3d--dark/--light`, `--g3d-*`).

## Map / 3D
- 2D: leaflet 1.9 + react-leaflet 4 + react-leaflet-cluster.
- 3D: cesium 1.14x (lazy `Globe3DView` chunk, ~4 MB).

## Backend
- Supabase (supabase-js 2.x), client `lib/supabaseClient.js`.

## UI / data libs
- Radix (dialog, tabs, tooltip), lucide-react, framer-motion 12 (used by `ui/dialog.jsx`), recharts 3.
- Loaded on demand only: @xyflow/react + dagre (SOP flowchart), xlsx, pdfjs-dist, tesseract.js (vendored worker files in `public/tesseract`), openmeteo.
