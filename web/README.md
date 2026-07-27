# Web front-end source

Active UI source for Watchtower — **not** throwaway samples. Built or synced into shipping artifacts.

| Folder | Role |
|--------|------|
| [`dashboard-alpha/`](dashboard-alpha/) | **Production** React + Vite dashboard — Gradle `syncDashboard` builds `dist/` into the mod JAR |
| [`dashboard/`](dashboard/) | Legacy Preact dashboard (archive only — not synced) |
| [`dr-viewer/`](dr-viewer/) | Browser-local disaster recovery viewer (static site) |

## Dashboard (`web/dashboard-alpha/`)

```bash
cd web/dashboard-alpha
npm install
npm run preview          # fixture preview :8081
WATCHTOWER_ORIGIN=http://127.0.0.1:8787 npm run preview:live
npm run build            # → dist/ (what the JAR embeds)
```

See [`dashboard-alpha/README.md`](dashboard-alpha/README.md) and [`dashboard-alpha/scripts/soak-checklist.md`](dashboard-alpha/scripts/soak-checklist.md).

## DR viewer (`web/dr-viewer/`)

```bash
cd web/dr-viewer
npm run sync:dashboard   # copy shared styles/labels/health from web/dashboard
npm run serve            # http://localhost:8790
```

See [../CONTRIBUTING.md](../CONTRIBUTING.md) for smoke tests.
