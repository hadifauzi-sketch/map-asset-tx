---
name: task_completion
description: Steps to verify a coding task is complete in Asset Tx Map V2
type: project
---

# Task Completion Checklist

1. **Build check** (always): `npm run build` — catches JSX/import/syntax errors; no separate linter configured
2. **UI verification** (for UI changes): `npm run dev` → open http://localhost:3000 → manually verify the changed screen/modal and check for regressions in adjacent features
3. **DB changes**: if adding columns or tables, create a migration file in `supabase/migrations/` following the naming convention `YYYYMMDDNNNNNN_description.sql` and run `npm run db:push` to apply to remote
4. **No automated tests**: there is no test runner; manual browser testing is the only functional verification path
