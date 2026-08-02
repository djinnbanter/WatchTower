# Marketing Minecraft Motif Pass — Design

**Date:** 2026-08-02  
**Status:** Approved (brainstorm Approach 1; A + bit of C)  
**Surfaces:** `web/marketing` only  
**Visual authority:** Night Watch Desk (`DESIGN.md`) — do not replace

## 1. Goal

Make the WatchTower marketing site read as a Minecraft mod ops product on first glance via materials (A) and a light night-overworld mood (C), without redesigning layout or abandoning Night Watch Desk.

Plain-English end state: someone who does not know WatchTower, on the dark first viewport, thinks “Minecraft servers / a mod,” not “generic ops SaaS,” while the desk still feels like WatchTower.

## 2. Locked approach

| Decision | Choice |
| --- | --- |
| Scope | Approach 1 — token + motif pass (whole site inherits) |
| Flavor | A (materials + geometry) + a bit of C (atmosphere) |
| Atmosphere | Hero + soft echo on close only |
| Grass tell | Once, under hero CTAs |
| Layout | No Features / How / Install / Shift Log redesign |
| Dashboard / DESIGN.md | Untouched |

## 3. Constraints

**Keep**

- Geist + JetBrains Mono; signal blue `#4C8DFF`; lantern amber `#F5A524`
- Radii `2px / 4px / 6px` (sitewide `0` forbidden except tiny pixel ticks / grass strip ends)
- Existing page structure, InstrumentPlate nesting, Shift Log, Features bento

**Hard no**

- Dirt/ore bitmaps, creeper faces, hotbar/inventory cosplay
- Glassmorphism, periwinkle orbs, `rounded-full` CTA pills
- Cream + serif terracotta look; new display fonts
- Fabric shipping claims; invented features
- Awwwards glass islands / pill nav / 2rem squircles

**Motion**

- Stars and grid are static; no twinkle; honor `prefers-reduced-motion`

## 4. Token recipe (marketing `globals.css`)

### Dark

- `--wt-bg0: #12151c`
- `--wt-bg1: #1e2430`
- `--wt-bg2: #2a3140`
- `--wt-bg3: #373f50`
- `--wt-grat: rgba(232, 237, 246, 0.05)`
- `--wt-grass: #34d399`
- `--wt-zenith: rgba(76, 141, 255, 0.08)`
- `--wt-glow-lantern` / `--wt-glow-accent` via `color-mix` (define if missing)

### Light (cooler paper, not cream)

- `--wt-bg0: #f2f3f5`
- `--wt-bg1: #ffffff`
- `--wt-bg2: #e8eaee`
- `--wt-bg3: #dcdfe5`
- `--wt-grat: rgba(22, 24, 29, 0.06)`
- `--wt-grass: #1f9d63`
- `--wt-zenith: rgba(27, 79, 224, 0.06)`

### Utilities

- `.wt-block-grid` — 16px hairline block grid
- `.wt-plate-stone` — heavier stone lip for InstrumentPlate outer tray
- `.wt-grass-strip` — 3px emerald bar
- `.wt-hero-night` / `.wt-hero-stars` — night wash + sparse static stars

## 5. Motifs by surface

| Motif | Where |
| --- | --- |
| Night wash + stars + block grid | Home hero |
| Soft zenith echo | Close band (no grass, no full star field) |
| Stone lip | All `InstrumentPlate` instances |
| Grass strip | Under hero CTAs only |
| Copy | `HERO_CONTEXT` → `NeoForge · dedicated host · no cloud required` |

## 6. Out of scope

Version/demo sync, screenshot recapture, homepage Shift Log content refresh for 1.2 features, Features/How layout rewrite.

## 7. Success check

Dark home first viewport: NeoForge named, grass tell visible, cooler stone plates, quiet stars — still WatchTower desk, not a resource pack.
