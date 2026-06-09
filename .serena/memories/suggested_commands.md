# Suggested Commands

## Dev Workflow
```
npm run dev          # start Vite dev server → http://localhost:3000
npm run build        # production build → dist/
npm run preview      # serve dist/ locally
```

## Supabase / DB
```
npm run db:start     # start local Supabase stack (Docker required)
npm run db:stop      # stop local stack
npm run db:status    # check local stack status
npm run db:reset     # reset local DB and re-run all migrations
npm run db:diff      # diff local schema against remote
npm run db:push      # apply pending migrations to remote
npm run db:pull      # pull remote schema changes
npm run db:link      # link to remote project ref rgtwfmhnnmkbsdjgtxjb
```

## Git (Windows PowerShell)
```powershell
git status
git log --oneline -10
git add <files>
git commit -m "message"
```

## Windows-Specific Notes
- Shell is PowerShell; use `$env:VAR` not `export VAR=`
- Path separator is `\`; double-quote paths with spaces
- `ls` aliases to `Get-ChildItem` in PS (different flags than Unix)
- No test runner configured — no `npm test` script
