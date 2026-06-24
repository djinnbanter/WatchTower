# Web front-end source

Active UI source for Watchtower — **not** throwaway samples. Built or synced into shipping artifacts.

| Folder | Role |
|--------|------|
| [`dashboard/`](dashboard/) | Embedded server dashboard — synced into the mod JAR via Gradle `syncDashboard` |
| [`dr-viewer/`](dr-viewer/) | Browser-local disaster recovery viewer (static site) |

## Dashboard (`web/dashboard/`)

Gradle `syncDashboard` (in `mods/neoforge-1.21.1/build.gradle`) copies `*.html`, `*.js`, `*.css`, and `assets/**` into the mod JAR.

Local static preview:

```bash
cd web/dashboard
python -m http.server 8080
```

## DR viewer (`web/dr-viewer/`)

```bash
cd web/dr-viewer
npm run sync:dashboard   # copy shared styles/labels/health from web/dashboard
npm run serve            # http://localhost:8790
```

See [../CONTRIBUTING.md](../CONTRIBUTING.md) for smoke tests.
