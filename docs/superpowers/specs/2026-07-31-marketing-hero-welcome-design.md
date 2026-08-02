# WatchTower marketing hero: brand-first welcome

**Date:** 2026-07-31  
**Surface:** `web/marketing` home Shift Log — Entry 0 (`welcome`)  
**Status:** Design approved; **amended 2026-07-31** by feature-tour  
**Parent:** `docs/superpowers/specs/2026-07-31-marketing-shift-log-design.md`  
**Amendment:** Live gauges move to the **Live** beat (`live.tsx`), not the Welcome
viewport. Scroll cue targets `#live` (`SCROLL_CUE` = "Scroll the desk").
"Most nights, nothing happens." is retired from the home tour.
See `docs/superpowers/specs/2026-07-31-marketing-shift-log-feature-tour-design.md`.

---

## 1. Problem

First-time visitors land mid-story. The current `quiet` hero opens on
**"Most nights, nothing happens."** plus live gauges. That reads as a night
log before the page has said what WatchTower is. The gauges look like
decoration until the product is named and framed.

## 2. Goal

Make the first viewport a **welcome to WatchTower**: brand, plain overview,
enough context to know what you are looking at, CTAs, and a clear invitation
to scroll into the night story. Keep the live gauges as proof of the desk.
Move the calm story hook below the fold so the log still opens on calm.

## 3. Decisions (locked)

| Decision | Choice |
|---|---|
| Headline ownership | **Brand-first** — `h1` is **WatchTower** |
| Hero visual | **Brand + CTAs only** (gauges moved to Live beat — feature-tour amendment) |
| "Most nights, nothing happens." | **Retired** from the home tour (feature-tour) |
| Approach | Welcome hero, then the desk tour starting at Live |

## 4. Design read

Reading this as: **marketing home hero for NeoForge server admins**, with
**Night Watch Desk** language (Geist + JetBrains Mono, Signal Blue / Lantern
Amber, instrument density), refining the existing Shift Log — **not** a
greenfield Awwwards / glass / mesh rebuild.

Attached visual skills inform craft (hierarchy, density, anti-slop), but
**Shift Log + DESIGN.md + PRODUCT.md win** on materials, motion budget, and
chrome. No ethereal glass, purple mesh, pill islands, or blanket scroll
reveals.

## 5. Entry 0 — `quiet` (welcome hero)

### Job

Name the product, say what it is, show a healthy desk, invite scroll into
one night of watching.

### Layout

Unchanged bones: asymmetric split — copy left, gauges right
(`lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`). Rail stamp stays `18:20` /
Live · watching pulse.

### Copy stack (top → bottom)

1. **Live · watching** (or Process stopped) — existing pulse + `MarginNote`
2. **`h1`: WatchTower** — `wt-hero` scale; brand is the hero signal
3. **Lead:** `The ops desk for your Minecraft server.` (`TAGLINE` from
   `content/product.ts`)
4. **Overview (one sentence):** `It watches while the game runs, then tells
   you what to fix - on the machine your server already runs on.`
5. **Context strip (one mono line, not three cards):**  
   `Local-first · NeoForge dedicated · is it okay? · what next?`  
   Sourced from PRODUCT.md / `TWO_QUESTIONS` / promises. No icon squares.
6. **CTAs:** `Open the demo` (primary) · `Get it on Modrinth` (ghost) —
   unchanged
7. **Scroll cue:** text link to `#fills` — `Scroll for one night on the desk`  
   Optional light chevron (inline SVG or existing Cta arrow pattern). Not a
   bouncing mouse icon. User-requested; overrides generic “no scroll cue”
   marketing defaults because the page is a scroll story and the hero no
   longer carries the hook.

### Gauges

Keep `QuietGauges` as today (TPS ~248px, MSPT/Heap ~148px, healthy-band
jitter while alive). Add a quiet caption under the stack:  
`Live vitals · healthy band`  
so first-time readers know the dials are the product, not abstract art.

### Remove from hero

- Headline **"Most nights, nothing happens."**
- Margin note `watchtower/ · local data` (context strip covers local-first)

### Motion

No new authored motion moment. Keep existing pulse + dial jitter only
(Shift Log moments 2). No fade-up reveal on the hero LCP text.

### Copy rules

- Display spelling **WatchTower**
- No em/en dashes in user-facing copy (hyphen `-` only)
- Claims only from `TAGLINE`, `SUPPORT_LINE` / PRODUCT.md, `TWO_QUESTIONS`
- Do not invent features

## 6. Entry 1 — `fills` (night opens)

### Job

Start the night story on calm, then show the evening climb (existing chart).

### Copy stack

1. **`h2`: Most nights, nothing happens.**
2. **Body opener:** keep the climb sentence that currently leads fills  
   (`Players climb and tick time creeps with them - …`). Lead with one short
   bridge if needed: `Then the server fills up. Nothing is wrong yet.` as the
   first body sentence (not a second display headline).
3. Existing margin note, `EveningChart`, and peak-hour cards stay.

### Why not two display headlines

Stacking **"Most nights…"** and **"The server fills up…"** as twin `h2`s
fights hierarchy. One story open (`h2`), then prose into the chart.

### Rail

Stamp remains `19:40`. Scroll cue `#fills` lands here.

## 7. Out of scope

- Rewriting later entries (`spike` … `close`)
- Replacing gauges with Overview chrome
- Adding a new night entry / stamp between hero and fills
- Importing dashboard Bklit into marketing
- Changing global marketing tokens beyond what these two entries need
- High-end “agency” chrome that breaks Night Watch Desk (glass orbs, pill
  nav islands, serif display, purple mesh)

## 8. Success

A new visitor can answer in the first viewport: **what is this product**,
**who it is for**, and **what to do next** (demo / install / scroll). After
one scroll they meet the calm hook and the evening chart without confusion.

## 9. Files likely touched

- `web/marketing/components/entries/quiet.tsx`
- `web/marketing/components/entries/fills.tsx`
- Possibly `content/product.ts` only if a short constant is added for the
  scroll cue / context strip (prefer reuse of `TAGLINE` / existing strings)
- Parent Shift Log spec: amend Entry 0 / Entry 1 sections to match (same PR
  or follow-up note in the plan)

## 10. Self-review

- No placeholders (`TBD`, `TODO`) in required copy
- No contradiction with Approach A / locked decisions
- Scroll cue is explicit and justified against generic anti-cue defaults
- Motion budget unchanged (four Shift Log moments)
- Em-dash free in planned user copy
