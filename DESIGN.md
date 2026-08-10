---
name: WatchTower
description: Industrial Ops Print — marketing site design system (light + dark)
colors:
  ink: "#0A0A0A"
  panel: "#121212"
  phosphor: "#EAEAEA"
  mute-dark: "#737373"
  rule-dark: "#3f3f46"
  paper: "#F4F4F0"
  plate: "#EAE8E3"
  carbon: "#111111"
  mute-light: "#5c5c5c"
  hazard: "#E61919"
  ember-dark: "#E8910C"
  ember-light: "#C45F08"
  lantern-dark: "#E8910C"
  lantern-light: "#C45F08"
typography:
  display:
    fontFamily: "Archivo Black, Arial Black, sans-serif"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
  mono:
    fontFamily: "JetBrains Mono Variable, JetBrains Mono, ui-monospace, monospace"
rounded:
  all: "0"
---

# Design System: WatchTower (Marketing)

## How to use this document

This file is the **canonical design system** for the WatchTower **marketing site** (`web/marketing`). Agents and humans treat it as law for marketing UI, tokens, and motion on public pages.

- Live CSS tokens and utility classes: `web/marketing/styles/globals.css`
- Shared chrome: `web/marketing/components/site-header.tsx`, `site-footer.tsx`, `cta.tsx`, `theme-toggle.tsx`
- Board primitives: `web/marketing/components/board/*`
- Home board: `web/marketing/components/home/*`
- Inner routes: `web/marketing/app/features`, `how-it-works`, `install`, `faq`, `demo`

**Dashboard (`web/dashboard`) is not governed by this file.** The embedded ops UI still follows **Night Watch Desk** (Signal Blue, Geist, tonal plates). See archived guidance: `docs/design/night-watch-desk-dashboard.md`.

Generic “premium SaaS / agency” skills may inform craft (focus, a11y, performance) only when they do **not** contradict this document.

## Overview

**Creative north star: Industrial Ops Print**

WatchTower’s marketing site reads like a Swiss-industrial board pack: ruled compartments, zero radius, ember orange for action and brand, hazard red only for true danger. Light mode is print on paper; dark mode is a tactical desk. Public routes share one board frame; Home is a conversion document (desk in the first viewport), not a Shift Log tour.

Personality is **structural** — uppercase display titles, mono stamps and nav, sentence-case body copy. No glass cards, CRT scanlines, purple periwinkle, or decorative glow orbs. Display spelling in chrome: **WatchTower**.

**Key characteristics:**
- Two themes: light (Swiss print) and dark (tactical desk) — never mixed on one page
- Ember orange primary accent for CTAs and wordmark (`--wt-accent` / `--wt-lantern`); hazard red reserved for danger
- `border-radius: 0` everywhere (global enforcement in `globals.css`)
- Blueprint grid: 1px rules and `gap: 1px` compartment separation preferred over soft shadows
- Home board document: 00 Hero (promise + CTAs → What is WatchTower → live gauges → non-negotiable) → 02 Issues → 03 Crashes → 04 Overview + Insights → 05 Close
- Motion: short opacity/translate enters only; honor `prefers-reduced-motion`

## Scope

| Surface | System | Document |
|---------|--------|----------|
| `web/marketing` | Industrial Ops Print | **This file** |
| `web/dashboard` | Night Watch Desk | `docs/design/night-watch-desk-dashboard.md` |
| `web/dashboard-archive`, `web/dr-viewer` | Legacy / out of band | Separate briefs |

Marketing industrial remake **shipped** in `web/marketing` (2026-08-07). Dashboard remake is a future brief.

## Color system

Semantic names map to CSS custom properties in `globals.css`. Hazard and lantern roles are shared across themes; neutrals swap per mode.

### Dark (tactical desk)

| Token | Hex | CSS var (typical) | Role |
|-------|-----|-------------------|------|
| `ink` | `#0A0A0A` | `--wt-bg0` | Page background |
| `panel` | `#121212` | `--wt-bg1` | Compartment / plate fill |
| `phosphor` | `#EAEAEA` | `--wt-text` | Primary text |
| `mute` | `#737373` | `--wt-text-low` | Meta / secondary |
| `rule` | `#3f3f46` | `--wt-line` | 1px grid gaps / borders |
| `ember` / `lantern` | `#E8910C` | `--wt-accent`, `--wt-lantern` | Primary accent — CTAs, wordmark, stamps |

### Light (Swiss industrial print)

| Token | Hex | CSS var (typical) | Role |
|-------|-----|-------------------|------|
| `paper` | `#F4F4F0` | `--wt-bg0` | Page background |
| `plate` | `#EAE8E3` | `--wt-bg1` | Compartment / plate fill |
| `carbon` | `#111111` | `--wt-text` | Primary text |
| `mute` | `#5c5c5c` | `--wt-text-mid`, `--wt-text-low` | Meta / secondary |
| `rule` | `#111111` (hairline) | `--wt-line` | Borders via grid |
| `ember` / `lantern` | `#C45F08` | `--wt-accent`, `--wt-lantern` | Primary accent on paper |

### Status (marketing readouts)

| Role | Dark | Light | Notes |
|------|------|-------|-------|
| OK | `#34d399` | `#1f9d63` | `--wt-ok` |
| Warn | `#e8910c` | `#c45f08` | Ember family |
| Danger | `#e61919` | `#e61919` | Hazard red — severity only |

Channel colours (`--wt-ch-*`) exist for Live chart fixtures; keep desaturated / industrial — no purple heap glow.

### Named rules

**The Ember CTA Rule.** Primary buttons, conversion fills, and wordmark warmth share ember orange (`--wt-accent` / `--wt-lantern`). Bold industrial orange — not neon, not hazard red.

**The Hazard Danger Rule.** Hazard red (`#E61919`) is reserved for true danger / destructive severity — not primary marketing chrome.

**The No Signal Blue Rule.** Marketing does not use dashboard Signal Blue (`#4C8DFF` / `#1B4FE0`). Dashboard accent lives in the archive doc.

## Typography

| Role | Face | CSS | Usage |
|------|------|-----|-------|
| Display | Archivo Black | `--font-display`, `.wt-display`, `.wt-hero`, `.wt-entry` | Structural titles; uppercase; tight tracking (`-0.03em`–`-0.06em`); fluid `clamp` for heroes |
| Body | Inter | `--font-sans`, body default | Sentence-case prose, `.wt-lead` |
| Data / meta | JetBrains Mono | `--font-mono`, `.wt-meta`, `.wt-label` | Nav labels, ports, versions, step IDs, stamps — uppercase, tracked |

### Fluid scale (marketing)

| Class / token | Use |
|---------------|-----|
| `--wt-fs-hero` | Hero headlines |
| `--wt-fs-entry` | Board section / compartment titles |
| `--wt-fs-display-sm` | Section display |
| `--wt-fs-numeral` | Large mono readouts |
| `--wt-fs-lead` | Lead paragraphs |

**Voice:** plain-English sentence case in body copy. Spell **WatchTower** in chrome.

## Grid, shape & plates

| Rule | Value |
|------|-------|
| Border radius | `0` — global `border-radius: 0 !important` on `*` |
| Depth | Tonal `bg0` → `bg1` steps; `--wt-shadow: none` |
| Separation | 1px `--wt-line` rules; grid `gap: 1px` where compartments meet |
| Plates | `panel` / `plate` fills; no card shadow stacks |

### Tour bands (legacy utility)

`.wt-tour-band` — full-bleed tonal bands (`ink`, `plate`, `ember`) with top rule and optional `.wt-tour-band__lantern` accent line. Prefer `BoardSection` / ruled plates on public routes.

### Graticule

`.wt-graticule` — optional blueprint grid (transparent lines in current tokens; decorative grid stripped from hero chrome).

## Site chrome

### Header

- Flat `ink` / `paper` bar, 1px bottom rule
- Mono nav: existing labels in industrial casing (`FEATURES`, `HOW`, `INSTALL`, `FAQ`)
- `Wordmark` — lantern mark + **WatchTower** type
- `ThemeToggle` — hard rectangular control (not a pill)

### Footer

- Ruled link grid + legal
- Mono revision / URL line

### CTAs (`components/cta.tsx`)

- **Primary:** ember-filled rectangle, `var(--wt-accent)` / `var(--wt-accent-ink)`, 1px border, no radius
- **Ghost:** transparent fill, 1–2px outline in phosphor/carbon (`--wt-line` / text colour)

### Focus

`:focus-visible` — 2px hazard outline + soft hazard wash (`--wt-accent-soft`).

## Homepage (board document)

Conversion board — not a Shift Log tour. Section map:

1. **00 Hero** — promise + START HERE → **What is WatchTower** → live gauges → non-negotiable strip  
2. **02 Issues** — short lead + issues inbox mock  
3. **03 Crashes** — short lead + crash review mock  
4. **04 Overview + Insights** — grade readout + schedule chart  
5. **05 Close** — try the demo + Modrinth + GPL footnote  

Shared shell: `BoardFrame` / `BoardPageHeader` / `BoardSection`. Decorative desk glow, faulty terminal, shape-grid, and MagicBento wrappers stay removed.

## Inner pages

| Route | Pattern |
|-------|---------|
| `/features` | Board frame + capability catalog (interlocking peeks; no MagicBento) |
| `/how-it-works` | Board frame + compartmentalized pipeline; flat connectors |
| `/install` | Board frame + numbered procedure blocks; hazard-bordered login warning |
| `/faq` | Board frame + ruled ledger rows |
| `/demo` | Board interstitial; notes ledger + Demo / Modrinth |

Copy authority: `web/marketing/content/*` unless a typo blocks layout.

## Motion

### Removed (do not re-import)

- MagicBento + `components/react-bits/`
- Faulty terminal / `desk-faulty-terminal`
- Border glow / `desk-border-glow`
- Shape grid / `desk-shape-grid`
- Desk spotlight ambient (decorative)
- Sweep/beacon chrome
- `scan-text` decorative effects
- GSAP-driven magnetism / particle chrome

### Kept

- `motion/react` — short opacity + `translateY` enters on sections and hero readouts
- `Reveal` (`components/reveal.tsx`)
- `MagnetHit`, `SparkProvider` / `lantern-spark` — minimal interaction accents where still wired
- `DeskDotGrid` — low-opacity blueprint ambient behind the home hero promise column only
- `useReducedMotion` / `prefers-reduced-motion` global dampening in `globals.css`
- Live chart animation — correctness-first; calm over flashy

Animate `transform` and `opacity` only. No `transition: all`.

## Anti-patterns (reject list)

- Glass / frosted plates, `backdrop-blur` on scrolling marketing sections
- CRT scanlines, faulty-terminal text effects
- Purple / periwinkle / indigo “AI SaaS” accents
- Soft multi-layer card shadows and glow orbs
- Rounded pills on primary CTAs or cards
- Signal Blue or Geist as marketing brand accents
- Decorative motion that competes with Live chart correctness

## Do's and Don'ts

### Do

- Use ember orange for primary actions and wordmark
- Keep hazard red for danger severity only
- Keep radius at zero; separate compartments with rules
- Use Archivo Black for display, Inter for prose, JetBrains Mono for meta
- Honor `prefers-reduced-motion`
- Spell **WatchTower** in chrome you touch
- Point dashboard work at `docs/design/night-watch-desk-dashboard.md`

### Don't

- Mix light and dark token sets on one page
- Reintroduce MagicBento, border-glow, or desk spotlight chrome
- Use hazard red as a primary CTA fill (ember is the CTA)
- Apply Night Watch Desk Signal Blue / Geist rules to marketing without an explicit brief
- Invent Cloud/Panel homepage narrative not in `PRODUCT.md`

## Repo file map

| Path | Role |
|------|------|
| `DESIGN.md` | Marketing system (this file) |
| `docs/design/night-watch-desk-dashboard.md` | Archived dashboard / Night Watch Desk |
| `PRODUCT.md` | Product voice & capabilities |
| `web/marketing/styles/globals.css` | Tokens, typography utilities, motion dampening |
| `web/marketing/components/cta.tsx` | Primary / ghost CTAs |
| `web/marketing/components/board/*` | Shared board frame / page header / section |
| `web/marketing/components/home/*` | Home conversion board compartments |
| `web/marketing/components/motion/` | Residual motion helpers (`magnet-hit`, `spark-context`, `lantern-spark`) |
| `docs/superpowers/specs/2026-08-07-marketing-board-layout-rebuild-design.md` | Board layout rebuild spec |
