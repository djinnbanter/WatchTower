# Watchtower Dashboard (React)

Production dashboard shipped in the mod JAR via NeoForge `syncDashboard`.

- **Stack:** React + Vite + Bklit charts (MIT)
- **Fixture preview:** `npm run preview` → http://127.0.0.1:8081/
- **README screenshots:** in fixture preview, open **System → Visuals** (`?tab=visuals`) — live page previews + **Save all as PNGs**. Not included in production JAR builds.
- **Live soak:** `WATCHTOWER_ORIGIN=http://127.0.0.1:8787 npm run preview:live`
- **Build:** `npm run build` → `dist/` (copied into the JAR)

Legacy Preact UI lives in [`../dashboard-archive`](../dashboard-archive) as an archive reference only — it is **not** synced into the JAR anymore.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Wiki + Vite on :8081 (fixtures) |
| `npm run build` | Wiki + production build + static assets → `dist/` |
| `npm run preview` | Fixture preview (`normal` profile) |
| `npm run preview:live` | Proxy `/api` to `WATCHTOWER_ORIGIN` (no fixtures) |
| `npm run smoke` | Build + static checks |
| `npm run audit:parity` | Page / API / license / Gradle gates |
| `npm run audit:packaging` | Gradle sync points at this tree |

## Live soak

See [scripts/soak-checklist.md](./scripts/soak-checklist.md).

## Attribution

See [ATTRIBUTION.md](./ATTRIBUTION.md).
