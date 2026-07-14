# Watchtower dashboard (Lantern UI)

Embedded in the NeoForge mod JAR and served at `:8787`.  
**Documentation:** [GitHub Wiki — Dashboard](https://github.com/djinnbanter/WatchTower/wiki/Dashboard-Overview)

Source synced at build: `web/dashboard/` → mod assets (`src/**`, `vendor/**`, `assets/**`, `styles.css`, `index.html`).

## Architecture

Framework-first **Lantern** UI (`ui-` / `--ui-*`):

- `src/styles/` — design tokens, themes, primitives, patterns, features CSS
- `src/ui/primitives` → `src/ui/patterns` → `src/features/*`
- `src/state/` — Preact signals stores + poll scheduler
- `src/api/` — live HTTP source or static fixture source
- Vendored Preact + signals + HTM + uPlot (no npm runtime deps, no bundler)

## Build

```bash
cd web/dashboard
npm run build          # CSS concat + wiki ES module + modulepreload inject
npm run vendor         # (rare) re-download Preact/uPlot/fonts into vendor/ + assets/fonts/
```

Gradle `syncDashboard` runs `node scripts/build.mjs` then copies the shipped tree into the mod JAR.

## Static preview (no Minecraft server)

```bash
cd web/dashboard
npm run preview        # build + mock data + http://127.0.0.1:8080
```

Optional:

- `PREVIEW_PROFILE=fresh npm run preview` — empty-install / no-reports demo
- `PREVIEW_CSP=1 npm run preview` — mirror embedded Content-Security-Policy
- `OPEN_BROWSER=0` — skip auto-open

Fixtures live in `data/`. Preview mode has no login gate and simulates live metric ticks.

## Extending

See the rebuild plan cookbook: register pages via `src/app/registry.js`, compose `Page`/`Section`/`MetricTile` patterns, use `--ui-*` tokens only (no magic colors/durations in feature CSS).
