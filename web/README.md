# Web front-end source

Active UI source for Watchtower — **not** throwaway samples. Built or synced into shipping artifacts.

| Folder | Role |
|--------|------|
| [`dashboard/`](dashboard/) | **Production** React + Vite dashboard — Gradle `syncDashboard` builds `dist/` into the mod JAR |
| [`dashboard-archive/`](dashboard-archive/) | Legacy Preact dashboard (archive only — not synced) |
| [`dr-viewer/`](dr-viewer/) | Browser-local disaster recovery viewer (static site) |

## Dashboard (`web/dashboard/`)

```bash
cd web/dashboard
npm install
npm run preview          # fixture preview :8081
WATCHTOWER_ORIGIN=http://127.0.0.1:8787 npm run preview:live
npm run build            # → dist/ (what the JAR embeds)
```

See [`dashboard/README.md`](dashboard/README.md) and [`dashboard/scripts/soak-checklist.md`](dashboard/scripts/soak-checklist.md).

## DR viewer (`web/dr-viewer/`)

```bash
cd web/dr-viewer
npm run sync:dashboard   # copy shared styles/labels/health from web/dashboard-archive
npm run serve            # http://localhost:8790
```

See [../CONTRIBUTING.md](../CONTRIBUTING.md) for smoke tests.
