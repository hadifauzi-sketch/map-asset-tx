---
name: suggested_commands
description: Commands to develop, build, and manage the project on Windows
type: project
---

# Suggested Commands (Windows / PowerShell)

## Dev & Build
```powershell
npm run dev          # Start Vite dev server on http://localhost:3000
npm run build        # Production build → dist/
npm run preview      # Serve dist/ locally
```

## Supabase CLI (DB)
```powershell
npm run db:start     # supabase start (local Docker stack)
npm run db:stop      # supabase stop
npm run db:status    # supabase status
npm run db:reset     # supabase db reset (re-run migrations + seed)
npm run db:diff      # supabase db diff (generate migration from schema changes)
npm run db:push      # supabase db push (apply migrations to remote)
npm run db:pull      # supabase db pull (pull remote schema)
npm run db:link      # link to project rgtwfmhnnmkbsdjgtxjb
```

## File Search (Windows alternatives to unix commands)
```powershell
Get-ChildItem -Recurse -Filter "*.jsx"     # find files
Get-Content path\to\file.js                # read file
rg "pattern"                               # ripgrep search (preferred)
rg --files                                 # list tracked files
```

## Notes
- No lint or test script; `npm run build` is the minimum verification step
- `.env.local` required at project root with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
