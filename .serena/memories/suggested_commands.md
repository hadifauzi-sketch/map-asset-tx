# Suggested Commands

## Dev
```
npm run dev          # Vite dev server → http://localhost:3000
npm run build        # production build → dist/
npm run preview      # serve dist/
npm test             # node --test --test-concurrency=1 tests/*.test.mjs
```

## Data builders
```
npm run globe:plants            # power plants
npm run globe:grid              # power grid
npm run data:centres            # global data centres
npm run data:centres:malaysia
npm run globe:buildings         # 3D buildings (python, needs data/osm/*.pbf)
```

## Browser extension
```
npm run ext:sync     # regenerate extension-firefox/ from extension-chrome/
npm run ext:check    # verify the mirror is in sync
npm run ext:xpi      # pack Firefox .xpi
```

## Supabase
```
npm run db:start | db:stop | db:status | db:reset | db:diff | db:push | db:pull | db:link
```

## Windows notes
- Shell is PowerShell 5.1: no `&&`; use `;` or `if ($?) { … }`. `$env:VAR` for env vars.
- Quote paths with spaces (project lives under `F:\Project Lab\`).
