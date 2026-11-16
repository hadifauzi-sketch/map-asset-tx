# Task Completion

## Definition of Done — Frontend Changes
1. `npm run build` — no errors.
2. `npm test` — node --test over `tests/*.test.mjs`; all must pass. Pure logic in `lib/` gets a test there (plain `.mjs`, no React rendering, no test framework).
3. Manual browser check of the changed flow (`npm run dev`, port 3000). Sign-in required for app screens.

## Definition of Done — DB / Schema Changes
1. New migration `supabase/migrations/YYYYMMDDNNNNNN_description.sql` (never edit existing ones).
2. `npm run db:reset` locally, then `npm run db:push`.

## No Linter
No ESLint config. React hook-order mistakes are not caught automatically: hooks in `App()` must be declared before its early returns (auth/loading screens around the `if (!currentUser …)` block).

## Repo State
Not a git repository at the moment; back up files (e.g. `.backups/<date>-<topic>/`) before large edits.

## Commit Convention (when git is used)
`<type>: <description>`, e.g. `fix: …`, `release: v4.0.1 — …`.
