---
name: conventions
description: Code style, naming, and design patterns specific to Asset Tx Map V2
type: project
---

# Conventions

## Component Style
- Function components only (no class components)
- Files: `.jsx` by default; only `DGAToolsV2.tsx` uses TypeScript
- One component per file; file name matches default export

## Naming
- Components: PascalCase (`TransformerSidebar`, `OilTestSection`)
- Services / utilities in `lib/`: camelCase module files
- CSS variables: kebab-case (`--card`, `--primary-foreground`)
- Supabase column names: snake_case in DB; services map to camelCase for UI consumption

## Styling
- Tailwind 4 utility classes inline on JSX elements
- Design tokens come from CSS variables in `App.css`; Tailwind uses `var(--token)` references
- No CSS Modules; component-scoped styles handled via Tailwind or inline style props

## State Management
- No Redux/Zustand; all state via `useState`/`useEffect` in App.jsx or local component state
- Supabase real-time not fully wired for live push; data re-fetched on relevant mutations

## Data Layer
- All DB access goes through service modules in `lib/` (not direct Supabase calls from components)
- Services return camelCase objects; DB migrations use snake_case columns
- Env-gated: `isSupabaseConfigured` flag from `lib/supabaseClient.js` guards calls

## UI Primitives
- Shared low-level components in `components/ui/` (button, card, dialog, input, badge, switch, tabs, textarea)
- Built on `@radix-ui` primitives; styled with Tailwind

## DGA Domain
- Duval Triangle, Duval Pentagon, Roger's Ratio, and IEC 60599 methods coexist
- DGA assessment profiles live in `lib/standards/`
- Per-transformer DGA method preferences are resolved in `App.jsx` via `resolveTransformerDgaPreferences`
