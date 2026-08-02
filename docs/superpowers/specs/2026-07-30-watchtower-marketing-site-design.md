# WatchTower Marketing Site Design

**Date:** 2026-07-30  
**Status:** Approved (implementation plan attached and user-requested)  
**Mode:** Persuade (marketing). Dashboard remains Operate.  
**Visual authority:** Expand incumbent Night Watch Desk world from `DESIGN.md`. Do **not** replace `DESIGN.md`.

## Design Read

Reading this as: an open-source ops-tool marketing site for skeptical self-hosting Minecraft server admins, with WatchTower's own Night Watch Desk instrument language, leaning toward Tailwind v4 + Geist/JetBrains Mono + restrained status-keyed motion.

`DESIGN_VARIANCE: 6` · `MOTION_INTENSITY: 4` · `VISUAL_DENSITY: 4`

## Goal

Ship a public multi-page marketing site plus a clickable read-only demo of the real dashboard, both on Vercel from this monorepo, so a visitor can understand WatchTower and poke the real UI before downloading anything.

## Placement

| Piece | Location | Host |
| ----- | -------- | ---- |
| Marketing site | `web/marketing/` (new standalone npm package) | Vercel project A, root `web/marketing` |
| Interactive demo | `web/dashboard` built with `VITE_STATIC_DEMO=1` → `dist-demo/` | Vercel project B, root `web/dashboard`, build `npm run build:demo` |

Both start on `*.vercel.app`. Marketing links to the demo via `NEXT_PUBLIC_DEMO_URL`. No hardcoded hostname. Custom domain later is DNS-only.

Do **not** create a sibling repo outside `mc-status`. Do **not** fork-copy the dashboard into the marketing app.

## Product truth (claims must cite)

Sources: `PRODUCT.md`, `README.md`, `docs/ROADMAP.md`, `CHANGELOG.md`, `docs/wiki/`.

- Tagline: "What's happening on your Minecraft server — and what to do next."
- Two questions: Is the server okay right now? What should I fix next?
- Local ops desk for NeoForge **1.21.x** dedicated servers, Java **21**, Linux hosts common.
- Local-first: no required cloud account; no telemetry by default.
- Advisory only: does not restart the server; never quietly edits mods or the world; Modrinth never downloads jars.
- Not a host panel, not player analytics, not client GPU tooling.
- Display brand spelling: **WatchTower**.
- License: GPL-3.0-or-later. Local dashboard stays free forever.
- Never hardcode a version (README lags behind real releases). Resolve latest tag at build time.
- No fabricated testimonials, download counts beyond live Modrinth shield, or invented features.

## Brand / visual

Inherit `DESIGN.md` verbatim. Dark only in v1.

- Page bg0 `#14171e`, plates bg1 `#222833`
- Signal Blue `#4C8DFF` scarce (≤~10% colour mass)
- Lantern Amber `#F5A524` for brand warmth only
- Radii 2 / 4 / 6 px
- Geist Variable for prose; JetBrains Mono for numbers
- Tonal plates + hairlines; no glassmorphism, periwinkle, sparkle, or 12–16px SaaS radii

Fonts: same packages as the dashboard (`@fontsource-variable/geist`, `@fontsource-variable/jetbrains-mono`). Icons: `lucide-react` (dashboard wins over design-taste icon prefs).

## Pages

| Route | Purpose |
| ----- | ------- |
| `/` | Convince in one screen: hero, two questions, watch→scan→fix loop, promises, not-our-job, CTAs |
| `/how-it-works` | Continuous loop, `watchtower/` on disk, `:8787`, security (localhost/SSH), optional CLI |
| `/features` | One section per surface with real screenshot; alpha labelled alpha |
| `/install` | Three steps, requirements, credential + port warnings, latest release at build time |
| `/demo` | Expectation-setting then launch interactive demo |
| `/faq` | Host panel? Uploads? Restarts? Fabric? Free? Cloud? Cost? |

Docs stay on the GitHub wiki (linked, not duplicated).

### First viewport (home)

One composition: lantern mark + wordmark; one headline; one support line; CTA pair (Modrinth / Try the demo); one real Overview screenshot in a quiet bezel; footnote (free, GPL-3.0, runs on your machine). No stat strip, no three equal feature cards.

### Motion budget (exactly three)

All gated on `prefers-reduced-motion`:

1. Hero visual: rise 12px + fade on load
2. Section reveals: 8px rise + fade, staggered, once via IntersectionObserver
3. Signature: thin Signal Blue line tracing Watching → Scanning → Fix inbox on the how-it-works loop

### Features surfaces (with screenshots)

Overview, Live, Issues, Crashes, Mods, Insights, Backups, Spark (alpha depth), Support pack, CLI. Assets from `docs/assets/screenshots/` synced at prebuild — never duplicated by hand into git.

## Interactive demo

### Problem

`npm run preview` is a Vite **dev** server. Mock API is middleware in `web/dashboard/scripts/vite-fixture-api.ts` and is not present in `vite build` output. Static `dist/` 404s on `/api/*`.

### Solution

1. Extract `createFixtureSession()` + `handleFixtureRequest()` into `scripts/fixture-api-core.ts`. Keep `vite-fixture-api.ts` as a thin plugin wrapper so `npm run preview` behaviour is unchanged.
2. Bake ~50–70 GET responses at build time into `dist-demo/demo-api/` + `manifest.json` via `scripts/bake-demo-api.mjs`, keyed by shared `canonicalKey()` in `src/api/demo-key.mjs`.
3. Build with `VITE_STATIC_DEMO=1` into `dist-demo/` (never `dist/` or `public/`).
4. `apiFetch` looks up GETs in the manifest; POSTs return `{ ok: true, preview: true }`.
5. Slim banner: "Interactive demo. Sample data, and nothing you change is saved."
6. Auth already skipped when `isFixturePreview()`; `isStaticDemo()` implies the same path.

### Circuit breakers

- Spark tree gzip: one debug pass, then honest empty state if broken.
- Bake size > ~100 MB: drop 30d rollups / largest Spark profiles from `demo-routes.mjs`.
- Fixture regression: `npm run preview` is acceptance; revert wrapper if behaviour drifts.

### Freshness

Daily GitHub Action hits a Vercel deploy hook to rebake (baked timestamps otherwise go stale).

## Non-goals

- Not redesigning `web/dashboard` UI
- Not marketing Watchtower Cloud
- Not replacing the GitHub wiki
- No blog, CMS, newsletter, testimonials, invented metrics, or analytics in v1
- Not a writable demo or live-server connect

## Accessibility

WCAG 2.2 AA intent: skip link, visible focus, keyboard nav, contrast on dark palette, `prefers-reduced-motion`.

## Verification

- Both packages build clean; `npm run test:demo` green; existing dashboard tests green
- Manifest covers every `/api/` literal in `client.ts` (or allowlisted)
- Browser walk of all 18 tabs in `route-catalog.json` with zero console 404s
- `:neoforge-1.21:build` jar contains no `demo-api/`, no demo `manifest.json`, no demo banner; jar size unchanged
- `npm run preview` identical after fixture refactor

## Plain-English end-user summary

Visitors land on a site that says WatchTower answers two questions — is my server okay, and what should I fix next. They can open a working copy of the real dashboard with sample data and click every tab before downloading. Install is three steps. Honest pages explain what it refuses to do: no cloud account required, no player tracking, no touching their world or mods.

## Spec self-review

- [x] No TBD / TODO placeholders
- [x] Consistent with approved Cursor plan (placement, demo bake, pages, brand inheritance)
- [x] Scope is one shippable project (marketing + demo + CI); not decomposed further
- [x] Ambiguities resolved: Vercel + `*.vercel.app`, multi-page, static baked demo, dark-only, Modrinth primary CTA
