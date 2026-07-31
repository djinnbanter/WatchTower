# Features page: capability instrument grid

**Date:** 2026-07-31  
**Status:** Approved in brainstorm (Approach 1 — capability instrument grid)  
**Surfaces:** `web/marketing` Features page (`/features`)

## 1. Goal

Rebuild Features so it answers **what is inside WatchTower**, not which dashboard rooms exist.

Home Shift Log already tours rooms (Live, Issues, Overview…). Features becomes a dense **capability catalog**: Fix inbox ranking, join clinic, world pressure, support redaction, and the rest of the shipped insides.

Plain-English end state: someone who already saw the home tour can scan Features and learn the smaller main tools without reading another copy of Overview / Live / Issues cards.

## 2. Why

The current Features page is messy and half-done: it lists page-level surfaces with `ProductDesk` peeks and note tiles, which duplicates the homepage and undersells depth (join clinic, external kill, digest, accounts, etc.).

## 3. Job / not job

**Job:** Scannable Night Watch Desk grid of shipped capabilities (Alpha labeled when true).

**Not this page:**

- Second room tour or ProductDesk peeks of Overview / Live / Issues / …
- Install / first-run wizard / setup guide copy (Install + How it works)
- Promises / not-our-job / Standing Orders
- Coming next / Later roadmap bets (no inventing)
- Sticky job filters (deferred; Approach 2)

## 4. Capability inventory

Each tile: short title, one sentence, parent **tag** (room for wayfinding), optional **Alpha**, weight `lead` | `standard`.

### Lead (wider grid cells)

| Title | Tag |
| --- | --- |
| Health grade + restart advice | Overview |
| Fix inbox ranking | Issues |
| Join / pack sync clinic | Session |
| World pressure | Insights |
| Support pack redaction | Support |

### Standard

| Title | Tag | Alpha? |
| --- | --- | --- |
| Live vitals charts | Live | |
| GC / JVM + RAM advice | Live | |
| Crash fingerprints | Crashes | |
| External kill / OOM | Crashes | |
| Silent script fails | Issues | |
| Mod inventory + Modrinth hints | Mods | |
| Pack / jar drift | Mods / Issues | |
| Schedule + load trends | Insights | |
| Storage + disk runway | Insights | |
| Weekly ops digest | Insights | |
| Config audit | Insights | |
| Spark lag proof | Spark | Yes (deep workspace) |
| Backup health | Backups | Panel/cloud tracking Alpha in blurb |
| Activity / incident stories | Activity | |
| Log tail | Logs | |
| Startup watch | Startup | |
| Sources freshness | Sources | |
| Named accounts + audit log | Settings | |
| Secure login + optional 2FA | Settings | |
| Help Center | Help | |
| Disaster-recovery CLI + viewer | CLI | |

**Fold into blurbs (not separate tiles):** Watching + Scanning; needs-attention list; Spark auto-capture; client-only jar hints; Discord copy presets; honest hosted-panel metrics.

**Sources of truth:** `docs/ROADMAP.md` Works today, `README.md` What you get, `PRODUCT.md`. Do not invent capabilities.

Approximate count: ~26 tiles.

## 5. Layout + tile anatomy

### Page

```
[ Features ]          wt-display-sm
  One-line lede: insides of the desk, not another room tour.

[ Capability grid ]   InstrumentPlate tiles
  Desktop: 12-col — lead span 6, standard span 4 (3-up)
  Mobile: single column

[ Optional close ]    Demo + Modrinth CTAs (How-close pattern, short)
```

### Tile

```
┌─ InstrumentPlate ───────────────────────┐
│  TAG · Overview           [Alpha?]      │  mono eyebrow
│  Health grade + restart                 │  title
│  One plain sentence…                    │  blurb
└─────────────────────────────────────────┘
```

- Tag = parent room label only (not section headers).
- Alpha = lantern mono chip when `alpha: true`.
- No decorative icon rows; no full desk peeks; no screenshot collage as the primary visual.
- Motion: existing `Reveal` enter; hover = scarce Signal Blue border; respect `prefers-reduced-motion`.

### Visual craft

Night Watch Desk: Geist + JetBrains Mono; radii 2/4/6; hairlines; paper/ink tokens; Signal Blue scarce; Lantern Amber for Alpha only. No generic glass/periwinkle SaaS chrome.

### Copy

Hyphens only. Plain English. No Fabric shipping claims. No promises / not-our-job on this page.

## 6. Architecture

| Piece | Change |
| --- | --- |
| `web/marketing/content/features.ts` | Replace `FEATURE_SURFACES` with `FEATURE_CAPABILITIES` (`id`, `title`, `blurb`, `tag`, `weight`, `alpha?`) |
| `web/marketing/app/features/page.tsx` | Intro + grid (+ optional close CTAs); remove ProductDesk / DESK_BY_ID |
| Tile UI | Small presentational component or inline plate using `InstrumentPlate` + `Reveal` |
| Screenshots | Keep assets in repo; unused on this page unless a later polish adds one optional visual |
| Audit | Features must not mount ProductDesk peeks; hyphen check on blurbs; no setup-vocab dump |

**Out of scope:** Home Shift Log, How it works, FAQ, Standing Orders relocation, roadmap “Coming next” tiles.

## 7. Verification

- `cd web/marketing && node scripts/audit-shift-log.mjs` (and any Features-specific checks added)
- `npx tsc --noEmit`
- Manual: Features ≠ home tour; mobile single column; Alpha only on Spark / backup panel-cloud note as specified
- Grep Features for `ProductDesk` — should be absent after ship

## 8. Success criteria

- Visitor can name several *inside* capabilities without seeing duplicate room peeks
- Page reads as WatchTower Desk craft, not a SaaS feature bento clone of home
- Inventory matches shipped product; Alpha honest; no invented features
