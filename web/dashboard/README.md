# Watchtower dashboard

Embedded in the NeoForge mod JAR. **Documentation:** [GitHub Wiki — Dashboard](https://github.com/djinnbanter/WatchTower/wiki/Dashboard-Overview)

Source synced at build: `web/dashboard/` → mod assets.

## CSS build

Edit modules under `css/v3/`, then:

```bash
npm run build:css
```

Gradle `syncDashboard` copies the built `styles.css` into the mod JAR. Run `npm run build:css` after editing `css/` or `css/v3/`.

## Static preview (no Minecraft server)

Browse the full v3 UI with mock reports and live-style metrics:

```bash
cd web/dashboard
npm run build:css   # once, or after CSS edits
npm run preview     # regenerates mock data + serves http://127.0.0.1:8080
```

**After changing files in `assets/`** (logos, favicon), stop the preview server (`Ctrl+C`) and run `npm run preview` again. Use **http://127.0.0.1:8080** (not `file://`). Favicons are cached aggressively — hard-refresh or use a private window if the tab icon looks stale.

`npm run generate:mock` refreshes `data/live-samples.json`, `data/live-envelope.json`, `data/snapshot.json`, `data/performance-rollups.json`, **`data/ops-cache.json`** (activity ledger + lag issues + live crash scan), **`data/overview-meta.json`** (scorecard, crash/lag TLDR), and **`data/issues-peek.json`** with timestamps relative to now. Overview and Live tabs simulate metric ticks every 3s; Crashes and Activity **Scan** buttons reload the ops-cache fixture.

Fixtures live in `data/` (`facts.json`, `reports-index.json`, etc.). No login gate in static mode.
