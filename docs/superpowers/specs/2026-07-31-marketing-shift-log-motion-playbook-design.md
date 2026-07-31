# WatchTower marketing: Shift Log motion / React Bits playbook

**Date:** 2026-07-31  
**Surface:** `web/marketing` home (`/`) — Shift Log feature tour  
**Status:** Design approved for planning (Approach 2)  
**Parent:** `docs/superpowers/specs/2026-07-31-marketing-shift-log-feature-tour-design.md`  
**Brand:** `DESIGN.md` Night Watch Desk · `PRODUCT.md` claims unchanged

---

## 1. Problem

The feature tour reads clearly but feels static. Dials jitter, a few Reveals fire, and Crashes has a kill pulse, yet the page does not feel like a living ops desk. React Bits patterns already inform the dashboard (Border Glow, Animated List, Dot Grid) as WatchTower-owned code. Marketing has only a thin cousin (`DeskDotGrid`, `StatusGlow`, `Reveal`).

## 2. Goal

Make the Shift Log home feel **fun and interactive** without turning it into an agency portfolio or AI-glass landing.

Success:

- Someone scrolling once notices motion on Welcome, product desks, and CTAs.
- Pointer interactions on desks and CTAs feel intentional (glow, magnet, spark).
- Tour structure, copy claims, and entry IDs stay intact.
- `prefers-reduced-motion` collapses everything to a calm static tour.
- No vendor React Bits source in the tree (inspired + owned, same ATTRIBUTION rule as dashboard).

**Design read:** Marketing landing for Minecraft server operators; Night Watch Desk language; playful-but-ops motion; React Bits–inspired owned kit; Geist + JetBrains Mono; signal-blue / lantern-amber.

**Dials:** `DESIGN_VARIANCE: 6` · `MOTION_INTENSITY: 7` · `VISUAL_DENSITY: 5`

---

## 3. Locked decisions

| Decision | Choice |
|---|---|
| Approach | **Night Watch playbook** — Approach 2 (B + selective C) |
| Welcome showpiece | **Radar sweep** (`SweepBeacon`) — night-watch metaphor; not Light Rays, not Aurora |
| Ambient budget | **One** canvas/ambient field on Welcome only (upgrade `DeskDotGrid` + Radar) |
| Vendor policy | **Owned rewrites only** — no `npx` React Bits CLI drop into marketing |
| New deps | Prefer **Motion only** (already present). No three.js / ogl / GSAP unless a later spike proves Radar needs it; default Radar = CSS + canvas 2D |
| Layout / IA | **Preserve** current split tour + bands. No section reorder |
| Copy / claims | **Preserve** `TOUR` / `PROMISES` / fixtures. No invented features |
| Glass / SaaS tells | **Banned** — Fluid Glass, Aurora, Plasma, Liquid Chrome, purple mesh, oversized squircles |

---

## 4. Motion kit (owned)

New leaf components under `web/marketing/components/motion/` (names are WatchTower’s):

| Component | React Bits inspiration | Behavior |
|---|---|---|
| `DeskBorderGlow` | Border Glow | Pointer-tracking edge wash on ProductDesk / InstrumentPlate hosts. Tones: accent / warn / danger / ok |
| `DeskSpotlight` | Spotlight Card | Soft radial lantern follow on desk plates (lower intensity than glow) |
| `LanternSpark` | Click Spark | Short particle burst on primary CTA press and Crashes kill pulse |
| `MagnetHit` | Magnet | Subtle spring pull toward pointer on Welcome + Close primary CTAs only |
| `TourList` | Animated List | Stagger `TourBrings` rows on `whileInView` (once) |
| `ScanText` | DecryptedText / Shuffle | One-shot glyph settle on Crashes `h2` when section becomes active |
| `WatchReveal` | Fade Content / Animated Content | Upgrade path for `Reveal` — same API + optional stagger children |
| `LanternField` | Dot Field / Dot Grid | Evolve existing `DeskDotGrid` (Welcome ambient); cursor proximity only |
| `SweepBeacon` | Radar | Slow rotating sweep + faint rings behind Welcome brand block |

Reuse where possible: port patterns from `web/dashboard/src/ui/motion/BorderGlow` and Animated List into marketing-sized cousins (no dashboard import coupling).

### Motion rules

1. Animate **transform / opacity** only (sparks: canvas or transform particles).
2. **No** `window.addEventListener('scroll')`. Use Motion `whileInView` / intersection already in LogProgress.
3. Every piece honors `useReducedMotion()` — instant final state, no loops, no pointer chase.
4. Easing: `cubic-bezier(0.16, 1, 0.3, 1)` or spring `{ stiffness: 120, damping: 18 }` — never default `ease-in-out`.
5. Max **one** continuous ambient (Welcome). Elsewhere motion is enter / hover / click.
6. Live dials stay correct-first: keep small NumberFlow jitter; do not add chart theater.

---

## 5. Interaction map by entry

| Entry | Motion |
|---|---|
| **Welcome** | `LanternField` + `SweepBeacon` behind brand. Brand / tagline via `WatchReveal`. CTAs: `MagnetHit` + `LanternSpark` on click. Live status dot stays. |
| **Live** | `DeskBorderGlow` around dial grid. `TourList` on brings. Quiet `WatchReveal` on copy. |
| **Issues** | `DeskBorderGlow` (warn tone) on ProductDesk. `TourList` on brings. |
| **Crashes** | `ScanText` on h2 when active. `DeskBorderGlow` (danger). Existing kill pulse + `LanternSpark` burst. Crash desk mock unchanged in structure. |
| **Overview** | `DeskBorderGlow` on grade / desk stack. Soft spotlight on HeroReadout. |
| **Insights** | `TourList` on brings. Chart / desk enter via `WatchReveal`. |
| **Standing orders** | Stagger promise rows with `WatchReveal` (no magnet; keep solemn). |
| **Close** | `MagnetHit` + `LanternSpark` on final CTAs. |

Band rooms (`ink` / `plate` / `ember`) stay; motion intensifies slightly on `ember` (Issues / Crashes) via glow tone only.

---

## 6. Architecture

```
web/marketing/components/motion/
  desk-border-glow.tsx
  desk-spotlight.tsx
  lantern-spark.tsx
  magnet-hit.tsx
  tour-list.tsx          # or fold stagger into TourBrings
  scan-text.tsx
  watch-reveal.tsx       # may replace reveal.tsx
  sweep-beacon.tsx
  index.ts
web/marketing/components/desk-dot-grid.tsx  # evolve → LanternField or wrap
```

Wiring:

- Wrap ProductDesk hosts in entries (or inside `ProductDesk` / `InstrumentPlate`) with `DeskBorderGlow` when `chrome="bare"`.
- `TourBrings` uses `TourList` stagger internally.
- Welcome owns ambient layers as absolute, `pointer-events-none`, behind copy.
- Spark host is a page-level or ShiftLog portal so bursts are not clipped by overflow.

### Non-goals

- Remapping tour order or rail revival
- Rewriting marketing copy for “fun”
- Installing React Bits packages / Commons Clause vendor trees
- three.js / WebGL showpieces
- Custom cursors, marquees, sticky-stack scroll hijacks
- Changing dashboard app UI

---

## 7. Visual constraints (taste + brand)

- Tokens from `DESIGN.md` only (signal-blue, lantern-amber, ok/warn/danger).
- Radii stay Night Watch (`sm/md/lg` from design.json) — InstrumentPlate double-bezel already exists; do not introduce `rounded-[2rem]` glass shells.
- No blur on scrolling content; blur only if a fixed chrome needs it (prefer none).
- Light / dark: desk surfaces stay night ops desk; page theme toggle behavior unchanged.
- Existing Lucide on CTAs stays (project already uses it); do not mix a second icon family this pass.

---

## 8. Performance & a11y

- LCP: Welcome ambient must not block text paint; canvas lazy-init after mount; pause when Welcome not intersecting.
- INP: pointer handlers use motion values / rAF on canvas, not React state per move.
- CLS: ambient layers absolute; no layout-affecting animations.
- Reduced motion: skip Radar rotation, glow chase, magnet, sparks, ScanText scramble, list stagger.
- Spark / ScanText are decorative — final text always in DOM for screen readers (`aria-hidden` on scramble overlay if used).

---

## 9. Verification

- Manual: scroll full tour with motion on / reduced-motion on (OS toggle).
- Pointer: glow tracks on Live + Crashes desks; magnet on Welcome CTA; spark on click + kill.
- `node web/marketing/scripts/audit-shift-log.mjs` still green.
- `npx tsc --noEmit` in `web/marketing`.
- Skim: no purple glow, no glass, no em dash introduced in new UI strings.

---

## 10. Plain-English summary

The Shift Log keeps the same desk tour. Welcome gets a quiet radar and instrument-field dots. Each product desk picks up a lantern-edge glow that follows the mouse. Highlight lists stagger in. Crash titles briefly “scan in.” Buttons tug slightly and spark on click. Reduced motion turns all of that off. Nothing new is claimed about the product — it just feels awake.
