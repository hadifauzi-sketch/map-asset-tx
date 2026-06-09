# Task Completion

## No Test Suite
No jest/vitest config; no `npm test` script. No automated tests to run.

## No Linter
No `.eslintrc` or ESLint config; no `npm run lint` script.

## Definition of Done — Frontend Changes
1. `npm run build` — must complete with no errors (Vite build validates JSX/imports)
2. `npm run dev` + manual browser test of the changed flow

## Definition of Done — DB / Schema Changes
1. Write new migration file: `supabase/migrations/YYYYMMDDNNNNNN_description.sql`
2. `npm run db:reset` (local) to verify migration applies cleanly
3. `npm run db:push` to apply to remote Supabase project
4. Update TypeScript types if needed: `supabase gen types typescript --project-id rgtwfmhnnmkbsdjgtxjb`

## Commit Convention
Observed format from git log:
```
<type>: <description> — <subtitle or version>
```
Examples:
- `release: v4.0.1 — Weather Intelligence & LST Update`
- `docs: add v3.9 release notes`
- `fix: <short description>`
No enforced tooling (no commitlint/husky).
