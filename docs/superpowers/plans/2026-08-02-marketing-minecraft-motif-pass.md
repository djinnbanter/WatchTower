# Marketing Minecraft Motif Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the WatchTower marketing site read as a Minecraft mod ops product on first glance via materials (A) and a light night-overworld mood (C), without redesigning layout or abandoning Night Watch Desk.

**Architecture:** Marketing-only token + motif pass. Shared CSS in `web/marketing/styles/globals.css` carries stone plates, block grid, and grass accent. Hero/close add night wash + static stars. `InstrumentPlate` gets a heavier stone lip. One copy string names NeoForge. No Features/How/Install restructure; no `DESIGN.md` or dashboard token changes.

**Tech Stack:** Next.js App Router marketing package, CSS custom properties, existing Framer Motion / `DeskDotGrid`, plain-English product copy.

## Global Constraints

- Night Watch Desk only: Geist + JetBrains Mono; signal blue `#4C8DFF`; lantern amber `#F5A524`; radii stay `2px / 4px / 6px` (sitewide `0` radius forbidden except tiny pixel ticks).
- Marketing-only: do not edit `DESIGN.md` or `web/dashboard` theme tokens.
- Hard no: dirt/ore bitmaps, creeper faces, hotbar/inventory cosplay, glassmorphism, periwinkle orbs, `rounded-full` CTA pills, cream+serif terracotta look, new display fonts.
- Hyphens only in user-facing copy; no Fabric shipping claims; no invented features.
- Atmosphere (stars / night wash) on hero + soft echo on close only; grass strip once (hero CTAs).
- Stars/grid are static; honor `prefers-reduced-motion` (no twinkle).
- High-end-visual-design Awwwards defaults are **out of scope** — do not apply glass islands, pill nav, or 2rem squircles.
- Spec: `docs/superpowers/specs/2026-08-02-marketing-minecraft-motif-pass-design.md`

## File map

| File | Responsibility |
| --- | --- |
| `docs/superpowers/specs/2026-08-02-marketing-minecraft-motif-pass-design.md` | Locked design |
| `docs/superpowers/plans/2026-08-02-marketing-minecraft-motif-pass.md` | This plan |
| `web/marketing/styles/globals.css` | Stone tokens, block-grid utility, grass/zenith vars, glow token defs |
| `web/marketing/components/instrument-plate.tsx` | Stone-lip outer tray |
| `web/marketing/components/sections/hero.tsx` | Night wash, block grid, stars, grass strip |
| `web/marketing/components/sections/close.tsx` | Soft night echo (no grass) |
| `web/marketing/content/product.ts` | `HERO_CONTEXT` NeoForge tell |
| `web/marketing/scripts/audit-minecraft-motif.mjs` | Presence audit for new classes/tokens |

---

### Task 1: Persist design spec + plan

**Files:**
- Create: `docs/superpowers/specs/2026-08-02-marketing-minecraft-motif-pass-design.md`
- Create: `docs/superpowers/plans/2026-08-02-marketing-minecraft-motif-pass.md`

- [x] **Step 1: Write the design spec**
- [x] **Step 2: Copy this implementation plan**
- [ ] **Step 3: Commit**

---

### Task 2: Audit script (fail first)

**Files:**
- Create: `web/marketing/scripts/audit-minecraft-motif.mjs`

- [ ] **Step 1: Write the audit script**
- [ ] **Step 2: Run audit — expect FAIL**
- [ ] **Step 3: Commit** the failing audit only

---

### Task 3: Stone tokens + block grid utilities

**Files:**
- Modify: `web/marketing/styles/globals.css`

Locked dark tokens: bg0 `#12151c`, bg1 `#1e2430`, bg2 `#2a3140`, bg3 `#373f50`, grass `#34d399`, zenith `rgba(76, 141, 255, 0.08)`.

Locked light tokens: bg0 `#f2f3f5`, bg1 `#ffffff`, bg2 `#e8eaee`, bg3 `#dcdfe5`, grass `#1f9d63`, zenith `rgba(27, 79, 224, 0.06)`.

Utilities: `.wt-block-grid`, `.wt-plate-stone`, `.wt-grass-strip`, `.wt-hero-night`, `.wt-hero-stars`.

- [ ] **Step 1: Apply token + utility CSS**
- [ ] **Step 2: Spot-check**
- [ ] **Step 3: Commit**

---

### Task 4: InstrumentPlate stone lip

**Files:**
- Modify: `web/marketing/components/instrument-plate.tsx`

- [ ] **Step 1: Add `wt-plate-stone`** to outer tray
- [ ] **Step 2: Visual check**
- [ ] **Step 3: Commit**

---

### Task 5: Hero night wash, stars, grass, NeoForge context

**Files:**
- Modify: `web/marketing/content/product.ts`
- Modify: `web/marketing/components/sections/hero.tsx`

- [ ] **Step 1: Update `HERO_CONTEXT`** to `NeoForge · dedicated host · no cloud required`
- [ ] **Step 2: Restyle hero atmosphere** (`wt-hero-night`, `wt-hero-stars`, `wt-block-grid`, `wt-grass-strip`)
- [ ] **Step 3: Browser smoke**
- [ ] **Step 4: Commit**

---

### Task 6: Close band night echo

**Files:**
- Modify: `web/marketing/components/sections/close.tsx`

- [ ] **Step 1: Soften close atmosphere** with zenith echo
- [ ] **Step 2: Smoke**
- [ ] **Step 3: Commit**

---

### Task 7: Audit green + end-to-end verify

- [ ] **Step 1: Run motif audit — expect PASS**
- [ ] **Step 2: Manual checklist** (dark/light, inherit pages, reduced-motion, hard nos)
- [ ] **Step 3: Final commit** only if tweaks needed
