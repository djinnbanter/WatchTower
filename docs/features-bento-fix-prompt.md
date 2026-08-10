# Prompt: Fix WatchTower marketing Features page bento grid + fixtures

Copy everything below the line into Antigravity.

---

## Role

You are fixing the **Features page** of the WatchTower marketing site (`web/marketing`). The page already has sectioned bento grids with mock dashboard fixtures (“peeks”). The **grid cell sizes are still wrong** and the **fixtures look broken/clipped/cramped**. Your job is to make each section’s bento look intentional, readable, and correctly sized for its fixture — desktop first (≥1024px), then tablet/mobile.

Do **not** rewrite marketing copy. Do **not** redesign the whole site. Do **not** invent new product features. Fix layout + peek presentation.

---

## Repo / stack

- Path: `web/marketing` (Next.js App Router, React, Tailwind + custom CSS)
- Dev: `cd web/marketing && npm run dev` → `http://localhost:3000/features`
- Brand: Industrial Ops Print — flat plates, 1px rules, zero radius, hazard red / lantern accents, Archivo Black + Inter + JetBrains Mono
- Display spelling: **WatchTower**

---

## Files you must touch (primary)

| File | Role |
|------|------|
| `web/marketing/app/features/page.tsx` | Page shell; renders `CapabilityCatalog` |
| `web/marketing/components/features/capability-catalog.tsx` | Renders one bento grid per section |
| `web/marketing/components/features/capability-catalog.css` | Grid spans, row tracks, card overflow, clamps |
| `web/marketing/content/features-bento.ts` | Cell order, span, media, title/body, peek `id` |
| `web/marketing/components/features/bento-peeks.tsx` | Fixture components + `featurePeek(id)` switch |
| `web/marketing/components/features/bento-peeks.css` | Peek internal layout / min-heights |

Related (usually leave alone unless needed):
- `web/marketing/content/features.ts` — page lede + capability blurbs
- `web/marketing/components/desk/desk.css` — desk plate vocabulary used inside peeks
- `web/marketing/components/board/*` — page frame / header

---

## Current architecture (how it works)

1. `FEATURE_BENTO_SECTIONS` in `features-bento.ts` defines **4 sections**: Monitor, Triage, Operations, System & Sharing.
2. Each cell has:
   - `id` → passed to `featurePeek(id)` in `bento-peeks.tsx`
   - `title` / `body` → card copy (already set; keep wording)
   - `media`: `overlay` | `chart` | `strip` | `side` | `stack` (controls copy/visual order in `CardBody`)
   - `span`: CSS class like `cap-span--tall-left`, `cap-span--more-half`, etc.
3. `CapabilityCatalog` wraps each section in `.cap-grid--monitor` / `--triage` / `--ops` / `--system`.
4. Desktop grid is **12 columns**, `gap: 1px`, background `var(--wt-line)` so seams look like rules.

### Monitor cell map (current)

Intended interlocking showcase (12-col):

| Cell | Peek id | Span | Intended placement |
|------|---------|------|--------------------|
| Overview | `health-grade` | `tall-left` | cols 1–4, rows 1–3 |
| Live Console | `live-vitals` | `mid-top` | cols 5–8, rows 1–2 |
| Insights | `world-pressure` | `tall-right` | cols 9–12, rows 1–3 |
| Session & Join Clinic | `join-clinic` | `mid-strip` | cols 5–8, row 3 |
| Schedule + Load | `schedule-load` | `wide-bottom` | cols 1–8, rows 4–5 |
| Storage Runway | `storage-runway` | `stamp` | cols 9–12, row 4 |
| Startup Analyzer | `startup` | `rules` | cols 9–12, row 5 |

CSS currently tries fixed tracks roughly:
`grid-template-rows: 210px 210px 176px 200px 200px` on `.cap-grid--monitor`.

### Other sections (current)

- **Triage:** Issues + Crash (`lead-tall` = span 6), Spark + Logs (`more-half` = span 6). Fixed rows ~`400px 340px`.
- **Operations:** Mod Manager (`lead-wide` span 8) + Jar Drift (`more-one` span 4); Backup + Activity (`more-half`); Sources (`more-one`) + Config (`more-two`).
- **System:** Support + Accounts (`more-half`); Help + Security + Roadmap (`more-one` ×3); CLI (`full` = 1 / -1).

Peek ids available in `featurePeek()` include: `health-grade`, `fix-inbox`, `world-pressure`, `join-clinic`, `live-vitals`, `support-pack`, `spark`, `spark-map`, `gc-ram`, `crash-fingerprints`, `external-kill`, `silent-fails`, `mods-modrinth`, `jar-drift`, `jar-disable`, `mod-configs`, `schedule-load`, `storage-runway`, `storage-space-map`, `weekly-digest`, `config-audit`, `backups`, `activity`, `logs`, `startup`, `sources`, `accounts`, `theme-accent`, `auth`, `help`, `cli-dr`.

Note: Roadmap currently reuses peek id `theme-accent` (theme fixture). That mismatch is part of why fixtures feel wrong — either make a small roadmap peek or swap to a better existing peek / compact plate.

---

## What’s broken (observed)

### A. Grid sizing still feels wrong

Even after locking Monitor to fixed tracks, the **visual balance is off**:

1. **Fixtures were designed for larger cells** than the current fixed tracks. Cards now clip peeks hard (`overflow: hidden` on `.cap-card`, `.cap-card__inner`, `.cap-card__visual`). Result: charts cut mid-gauge, lists cut mid-row, grades stacked with dead empty space OR crushed.
2. **Copy + fixture fight for height.** Line-clamps (`-webkit-line-clamp: 3–4`) truncate body mid-sentence while the peek still needs vertical room. Cards look either empty (Overview grades don’t fill tall cell) or crushed (Live chart / Join strip / Storage stamp).
3. **Join strip (`mid-strip` ~176px)** is too short for title + 2–3 lines + `PeekJoinStrip` chips. Text ellipsizes badly (“…missing game…”).
4. **Stamp/rules cells (~200px)** are too short for Storage / Startup peeks that assume ~300px cards.
5. **Interlocking Monitor pattern** may be the wrong layout for these peeks. If peeks can’t readably fit the classic tall-left / mid-top / tall-right tessellation, **prefer a simpler equal-height bento per section** over forcing the old MagicBento interlocking map.
6. Tablet/mobile: spans collapse to 1–2 cols with `min-height: 280px` — check that peeks don’t still overflow or look tiny.

### B. Fixtures look broken

Inside clipped cells, peeks show as “borked”:

- **Live (`PeekLiveChart`)** — large multi-panel chart; only a fragment visible; gauges cut off.
- **Insights (`PeekWorldPressure`)** — dense donut + census bars; cramped or clipped in tall-right.
- **Health (`PeekHealthGrade`)** — three grade plates; either empty dead space under them or uneven fill after `min-height: 220px` was removed.
- **Join (`PeekJoinStrip`)** — strip media with `max-height: 88px` on visual; chips squashed.
- **Schedule / Storage / Startup** — bottom row fixtures don’t match stamp/rules budgets.
- **Spark / Logs / Mods / Activity** — work better in 340–400px rows but still need peek CSS to `min-height: 0`, `height: 100%`, and internal scroll **only if necessary** (prefer resizing peeks to fit, not scrollbars on a marketing page).

Root tension to resolve: **either grow the grid cells to fit the peeks, or compact the peeks to fit the cells.** Do both where needed. Peeks must look complete at a glance — not cropped demos.

---

## Success criteria

At `http://localhost:3000/features` on a ~1440–1920px desktop viewport:

1. Each section (Monitor / Triage / Operations / System) reads as a **clean bento**: shared seams, aligned row bottoms within each row, no huge empty voids, no clipped mid-widget fixtures.
2. Every visible peek shows a **complete, intentional miniature** (full grade stack, readable chart, full issue list, etc.) — not a cropped accident.
3. Card copy remains the current wording; shorten **display** with clamp only if the full sentence still exists in the source string (or slightly shorten body in `features-bento.ts` if a cell truly needs it — prefer layout fix first).
4. No horizontal page overflow; no scrollbars inside peeks unless unavoidable.
5. Mobile: stacked cards still look good; peeks remain usable (≥ ~240–280px card height).
6. Typecheck passes: `cd web/marketing && npx tsc --noEmit`.

---

## Recommended approach (do this in order)

### 1. Diagnose with measurements, not vibes

On `/features` at desktop width, measure each `.cap-card` (`getBoundingClientRect`: title, width, height, top, left, gridColumn/Row). Screenshot each section. List which peeks are clipped vs which cells are too empty.

### 2. Decide Monitor layout

Pick **one** and commit:

**Option A — Keep interlocking showcase**  
Increase Monitor row tracks until peeks fit (likely ~240–280px per track, Join strip ≥ 200px). Compact peeks that still overflow. Explicit `grid-row` / `grid-column` placements (not only `span`) if dense packing drifts.

**Option B — Simpler section bento (recommended if A keeps fighting)**  
Replace Monitor interlocking with a clearer grid, e.g.:
- Row 1: Overview | Live | Insights (equal height ~380–420px, spans 4/4/4 or 5/4/3)
- Row 2: Join | Schedule (spans 5/7 or 6/6)
- Row 3: Storage | Startup (spans 6/6)
Or similar equal-height rows. Update `features-bento.ts` spans + CSS accordingly.

Either option is fine; **readable fixtures beat preserving the old tessellation.**

### 3. Fix card chrome CSS

In `capability-catalog.css`:
- Keep 12-col desktop grid, 1px gap, stretch alignment.
- Prefer **explicit row templates per section** over unbounded `auto` growth (auto growth previously blew Live/Schedule to 700–900px).
- Avoid crushing peeks with too-small fixed tracks.
- `.cap-card__visual` should be `flex: 1 1 0; min-height: 0; overflow: hidden` **only after** the peek itself can shrink gracefully.
- Tune line-clamp by span (strip shorter, lead taller). Don’t mid-word chop if possible.

### 4. Fix peeks to be responsive inside cards

In `bento-peeks.tsx` / `bento-peeks.css`:
- Remove hard `min-height` values that fight parent constraints (or gate them).
- Make root `.bento-peek` fill parent: `height: 100%; min-height: 0;`.
- For chart peeks (`PeekLiveChart`, schedule, storage): use flexible heights, `preserveAspectRatio` / percentage heights, fewer stacked panels in small cells.
- For list peeks: show 3 solid rows that always fit rather than 6 clipped rows.
- For strip peeks: design a **true compact strip** (one row of chips + short label), not a full card crushed into 88px.
- Add a dedicated tiny peek for Roadmap if still using `theme-accent`, or change the cell `id` to something that fits.

### 5. Rebalance `features-bento.ts` if needed

You may:
- Change `span` / `media` / cell **order**
- Swap peek `id`s to better-fitting fixtures
- Drop a Monitor cell into another section only if it improves balance (say why)
- Slightly shorten `body` strings for strip/stamp cells

Do **not** change the page hero copy in `FEATURE_PAGE` unless required.

### 6. Verify

- Desktop screenshots: Monitor, Triage, Ops, System (full section in frame)
- Narrow to ~768px and ~390px; fix regressions
- `npx tsc --noEmit`

---

## Design constraints (marketing site)

- Industrial Ops Print: flat, ruled, zero radius, no glassmorphism / purple SaaS glow
- Peeks should feel like **Night Watch Desk** dashboard fragments (desk plates, mono kickers, channel colours)
- Motion: none required for this fix
- Accessibility: headings stay `h3` in cards; section labels remain

---

## Out of scope

- Rewriting Home / How it works / FAQ / Install copy
- Rebuilding the dashboard product UI
- Adding new marketing pages
- Fabric / Cloud claims

---

## Deliverable

1. Fixed Features bento layout + peeks that look complete.
2. Short summary of what you changed (files + layout decision A vs B).
3. Optional: note any peek that still needs a dedicated compact variant later.

Start by opening `/features`, measuring cards, and picking Monitor Option A or B before editing CSS blindly.
