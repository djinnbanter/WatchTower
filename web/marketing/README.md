# WatchTower marketing site

Standalone Next.js App Router package for the public WatchTower marketing site.

## Generated assets (do not commit)

`prebuild` / `dev` run `scripts/sync-brand-assets.mjs`, which writes:

- `public/screenshots/` — copied from `docs/assets/screenshots/`
- `public/brand/` — copied from `web/dashboard/assets/` (falls back to `web/dashboard/dist/assets/`)

These directories are build artefacts. Keep them out of git.

## Scripts

```bash
npm install
npm run dev      # sync assets + next dev :3000
npm run build    # prebuild sync + next build
npm run start
npm run lint
```

Optional env:

- `NEXT_PUBLIC_DEMO_URL` — origin of the **static** interactive demo (`web/dashboard` → `npm run build:demo` → `dist-demo/`). Do **not** point this at fixture preview `:8081`. Unset falls back to the marketing `/demo` interstitial.
- `NEXT_PUBLIC_SITE_URL` — canonical site URL for sitemap / robots / Open Graph

Local static demo:

```bash
cd web/dashboard
npm run build:demo
npx --yes serve dist-demo -p 4173
# web/marketing/.env.local → NEXT_PUBLIC_DEMO_URL=http://127.0.0.1:4173
```

## Vercel (two projects)

1. **Marketing** — root directory `web/marketing`, framework Next.js. Set `NEXT_PUBLIC_DEMO_URL` and `NEXT_PUBLIC_SITE_URL`.
2. **Demo** — root directory `web/dashboard`, build command `npm run build:demo`, output `dist-demo`. Set repo secret `VERCEL_DEMO_DEPLOY_HOOK` so `.github/workflows/demo-rebake.yml` can refresh baked fixtures daily.
