# Archived: Night Watch Desk (dashboard)

**Status:** Archived 2026-08-07. This document preserved the **ops dashboard** (`web/dashboard`) design system before the marketing industrial remake replaced root `DESIGN.md` with **Industrial Ops Print**.

The embedded dashboard UI may still follow this guidance until a separate dashboard remake brief ships. For marketing (`web/marketing`), use root `DESIGN.md`.

---

---
name: WatchTower
description: Night Watch Desk — precise local ops UI for modded Minecraft servers
colors:
  signal-blue: "#4C8DFF"
  signal-blue-light: "#1B4FE0"
  signal-blue-black: "#5B9BFF"
  lantern-amber: "#F5A524"
  lantern-amber-light: "#B4690E"
  accent-ink-dark: "#0A0F1C"
  accent-ink-light: "#ffffff"
  bg0-dark: "#0e1016"
  bg1-dark: "#1a1f29"
  bg2-dark: "#252b36"
  bg3-dark: "#323946"
  bg0-black: "#000000"
  bg1-black: "#090b0f"
  bg0-light: "#f2f3f5"
  bg1-light: "#ffffff"
  text-dark: "#f3f5f8"
  text-mid-dark: "#b8bfcc"
  text-low-dark: "#8a92a1"
  text-light: "#171a20"
  text-mid-light: "#4d5562"
  text-low-light: "#747d8b"
  ok: "#34d399"
  ok-light: "#1f9d63"
  warn: "#F5A524"
  danger: "#f87171"
  danger-light: "#d14343"
  info: "#9DB2CE"
  info-light: "#48607F"
  ch-tps: "#4FB286"
  ch-mspt: "#E0A458"
  ch-players: "#7FA9D6"
  ch-heap: "#9B8BD9"
  ch-disk: "#5FB3C4"
  ch-cpu: "#C77FA6"
typography:
  display:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.14em"
  mono:
    fontFamily: "JetBrains Mono Variable, ui-monospace, monospace"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
rounded:
  sm: "2px"
  md: "4px"
  lg: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.signal-blue}"
    textColor: "{colors.accent-ink-dark}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.signal-blue-black}"
    textColor: "{colors.accent-ink-dark}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-dark}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  plate-card:
    backgroundColor: "{colors.bg1-dark}"
    textColor: "{colors.text-dark}"
    rounded: "{rounded.md}"
    padding: "16px"
  form-row:
    backgroundColor: "{colors.bg2-dark}"
    textColor: "{colors.text-dark}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  hero-card:
    backgroundColor: "{colors.bg1-dark}"
    rounded: "{rounded.md}"
  rail-nav:
    backgroundColor: "{colors.bg1-dark}"
    textColor: "{colors.text-mid-dark}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  rail-nav-active:
    backgroundColor: "{colors.signal-blue}"
    textColor: "{colors.accent-ink-dark}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  metric-readout:
    backgroundColor: "transparent"
    textColor: "{colors.text-dark}"
    typography: "{typography.mono}"
    rounded: "{rounded.sm}"
    padding: "0"
  vital-tile:
    backgroundColor: "transparent"
    textColor: "{colors.text-dark}"
    typography: "{typography.mono}"
    rounded: "{rounded.sm}"
    padding: "0"
  chip-status:
    backgroundColor: "{colors.bg2-dark}"
    textColor: "{colors.text-mid-dark}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
---

# Design System: WatchTower

## How to use this document

This file is the **canonical design system** for the WatchTower ops dashboard (`web/dashboard`). Agents and humans treat it as law for dashboard UI.

- Live CSS tokens: `web/dashboard/src/index.css`
- Shared React primitives: `web/dashboard/src/ui/patterns/`
- Consistency regression: `npm run test:ui-consistency` in `web/dashboard`
- Consistency pass notes: `docs/superpowers/specs/2026-08-02-dashboard-ui-consistency-design.md`

Generic “premium SaaS / agency” skills may inform **craft** (focus, motion performance, a11y) only when they do **not** contradict this document. Do not invent a parallel aesthetic.

## Overview

**Creative North Star: "Night Watch Desk"**

WatchTower’s dashboard is a night-shift ops desk: precise instruments under lantern warmth, Signal Blue for control chrome, and quiet tonal plates instead of loud SaaS glass. The operator arrives under stress (lag, crash, disk pressure); every surface must answer “is it okay?” and “what next?” before it tries to look impressive.

Personality is **precise** — dense enough to triage, never cluttered for decoration. Form language mixes **tight instruments** (sharp 2–6px corners, mono metrics, high scanability) with **quiet glass** (tonal bg0→bg3 layering, soft inset hairlines, restrained hero glow keyed to status — not periwinkle mush or sparkle spam). Brand mark is the lantern / stone tower; display spelling is **WatchTower**.

**Key Characteristics:**
- Operate-mode density: list+detail inboxes, mission band, Live charts
- Signal Blue accent + Lantern Amber brand warmth (lantern ≠ status warn when both appear — warn and lantern share amber intentionally; use lantern for brand, warn for severity copy)
- Status colours (ok / warn / danger) never share hues with instrument channel colours (TPS / MSPT / heap / …)
- Three themes: light, dark (default ops), black (OLED)
- Motion respects `prefers-reduced-motion`; glow intensity ~0.55 on heroes
- Ruthless plate/hero parity across tabs — one machined instrument cluster, not a collage of page-local styles

## Creative north star

One aesthetic risk worth taking: **identical plate + hero chrome** across every rail tab and operator chrome surface, so the product feels like one desk. Signature element: `HeroCard` / mission vitals. Everything else stays quiet.

## Color system

A cool instrument neutrals stack, one scarce Signal Blue control accent, Lantern Amber for brand warmth, and a strict split between **status** and **channel** hues.

### Primary
- **Signal Blue** (`#4C8DFF` dark / `#1B4FE0` light / `#5B9BFF` black): active rail, primary CTAs, focus/selection wash, soft accent spotlight. Soft fill via `--wt-accent-soft`. Ink on accent fills uses `--wt-accent-ink` (near-black on dark themes, white on light).

### Secondary
- **Lantern Amber** (`#F5A524` dark/black / `#B4690E` light): logo warmth and brand moments; also maps to `--wt-warn` for severity — prefer lantern for identity chrome, warn semantics for Issues/Crashes/Overview severity.

### Tertiary
- Omit as a third brand accent. **Info steel** (`#9DB2CE` / `#48607F` light) is a quiet informational tone, not a competing brand colour.

### Neutral
- **Page / card / well / raised** — dark: bg0 `#0e1016`, bg1 `#1a1f29`, bg2 `#252b36`, bg3 `#323946`; black: bg0 `#000000`, cards barely lifted (`#090b0f`…); light: bg0 `#f2f3f5`, bg1 `#ffffff`, …
- **Text** — dark: `#f3f5f8` / mid `#b8bfcc` / low `#8a92a1`; light: `#171a20` / mid `#4d5562` / low `#747d8b`
- **Lines** — translucent hairlines (`--wt-line`, `--wt-line-strong`), not heavy rules

### Status & channels
- **Status:** ok `#34d399` (light `#1f9d63`), warn = lantern amber family, danger `#f87171` (light `#d14343`)
- **Channels (never equal status hex):** TPS, MSPT, players, heap, disk, CPU — CSS `--wt-ch-*`

### Named Rules
**The Channel ≠ Status Rule.** Instrument channel colours must not reuse ok/warn/danger hexes.

**The Scarce Accent Rule.** Signal Blue is control chrome (≤~10% of a screen’s colour mass).

**The No AI-SaaS Chrome Rule.** No periwinkle-on-glass clichés, sparkle-as-brand, or decorative purple/indigo defaults.

## Typography

**Display / UI Font:** Geist Variable  
**Body Font:** Geist Variable  
**Label/Mono Font:** JetBrains Mono Variable for metrics, IDs, tabular readouts

### Hierarchy (CSS vars)
| Step | Token | Size | Use |
|---|---|---|---|
| Display | `--wt-fs-display` | 2.5rem | Rare page-scale titles |
| Headline | `--wt-fs-xl` | 1.5rem | Section / mission titles |
| Title | `--wt-fs-lg` | 1.125rem | Card and section heads |
| Body | `--wt-fs-md` | 0.9375rem | Primary copy |
| Small | `--wt-fs-sm` | 0.8125rem | Secondary hints |
| XS / Label | `--wt-fs-xs` | 0.6875rem | Chips; uppercase metric captions |

**The Mono-for-Numbers Rule.** Live vitals, gauges, and KPI values use JetBrains Mono + `tabular-nums`. Prose stays Geist.

**Voice:** plain-English **sentence case** in UI. Spell the product **WatchTower**.

## Spacing & density

Prefer `8 / 12 / 16 / 24` (`spacing.sm` → `xl`). Operate-mode density — not marketing `py-24` whitespace. Section stacks commonly `space-y-3`. Plate internal padding ~16px; form rows ~12×16.

## Shape & radius

| Token | Value | Use |
|---|---|---|
| `--radius-wt-sm` | 2px | Chips, rail items, tight controls |
| `--radius-wt` | 4px | Default plates, buttons, inputs, HeroCard |
| `--radius-wt-lg` | 6px | Larger shells only |

**The Tight Corner Rule.** New cards and controls default to 4px. Do not introduce `rounded-xl` / `rounded-2xl` / rem-soup (`.85rem`, `14px`) without an explicit exception below.

Banlist test: `npm run test:ui-consistency` forbids `rounded-xl` / `rounded-2xl` on in-scope surfaces (Visuals/lab allowed).

## Elevation, plates & shadows

**Tonal layering first.** Depth comes from bg0 (page) → bg1 (rail/cards) → bg2/bg3 (wells).

### Shared plate recipe
`.wt-plate` in `index.css`:
- `border: 1px solid var(--wt-line)`
- `border-radius: var(--radius-wt)`
- `background: color-mix(in srgb, var(--wt-bg1) 92%, transparent)`
- `box-shadow: var(--wt-shadow)`

### Form row recipe
`.wt-form-row` — Settings/Wizard shells: hairline + `--radius-wt` + bg2 mix + 12×16 padding.

### Shadow vocabulary
- **Plate lift** (`var(--wt-shadow)`): one inset hairline + one soft drop
- **Black theme:** slightly deeper drop so OLED cards separate from pure black
- **Hero glow:** `HeroCard` / BorderGlow only (~0.55 intensity), status-keyed
- **Specular CTA:** multi-layer shadow allowed on `.wt-specular-cta` primary CTAs only

**The Flat-at-Rest Rule.** No multi-layer marketing shadows on ordinary cards. No `--wt-shadow-lg` forks on resting chrome.

## Themes & accents

### Themes
Cycle: light → dark → black (footer / appearance controls). Default ops theme is **dark**. System mode resolves to light or dark only (never black).

### Accent presets
`web/dashboard/src/app/accents.ts`: signal (default), amber, teal, violet, rose, green, coral, slate. Accent remaps `--wt-accent` / soft / ink — do not invent a second Skin (Aero/Sass).

## Motion

- Animate `transform` / `opacity` only (compositor-friendly)
- Never `transition: all` / `transition-all` (banlist enforced)
- List transition properties explicitly
- Honor `prefers-reduced-motion` for enters, glow, shimmer
- No new `backdrop-blur` on scrolling page content (fixed/sticky chrome only if already present)
- Page enter helpers: `PageEnter`, `FadeIn`, `Stagger` in `web/dashboard/src/ui/motion/`

## Accessibility & interaction craft

- Interactive controls: visible `:focus-visible` ring (accent-soft). Never bare `outline-none` without a replacement.
- Icon-only buttons: `aria-label`. Decorative icons: `aria-hidden`.
- Buttons/links: hover feedback; `cursor-pointer` on clickable chrome we ship.
- Loading: disable primary actions while pending; labels use `…` not `...`.
- Forms: real `<label>`s; auth `autoComplete` / `name`; `spellCheck={false}` on usernames/codes.
- Modals: `overscroll-behavior: contain` on scroll bodies (Support pack modal).
- Flex text rows: `min-w-0` + truncate/break for long mod names/paths.
- Light theme: keep mid/low text readable; borders must remain visible (not invisible glass).

## Shared primitives (code map)

| Primitive | Where | Role |
|---|---|---|
| `.wt-plate` | `src/index.css` | Resting card chrome |
| `.wt-form-row` | `src/index.css` | Settings/Wizard form shells |
| `.wt-specular-cta` | `src/index.css` | Specular button chrome |
| `HeroCard` | `ui/patterns/hero-card.tsx` | Status-keyed mission hero wrapper |
| `HeroTabNav` | `ui/patterns/hero-tab-nav.tsx` | Mission/inbox section tabs |
| `PillNav` | `components/pill-nav/` | Insights segment control |
| `VitalTile` | `ui/patterns/index.tsx` | Shared metric tile (null → —, optional `text`) |
| `MetricReadout` | `ui/patterns/index.tsx` | Mono metric value + label |
| `Button` / `SpecularCtaButton` | `ui/patterns/` | Default/primary/ghost actions |
| `EmptyState` / `ErrorState` | `ui/patterns/index.tsx` | Empty and error plates |
| `StatusPill` | `ui/patterns/index.tsx` | Tight severity/status chip (`--radius-wt-sm`) |
| `Section` | `ui/patterns/index.tsx` | Titled section stack |
| `QueueRow` | `ui/patterns/index.tsx` | Inbox list row |

Do not redefine local `VitalTile` helpers in feature views. Leave non-VitalTile KPI widgets (e.g. Backups/Activity `Kpi`) as-is unless extracting later with intent.

## Page patterns

### Mission hero
Outer: `HeroCard` (tone + ~0.55 glow). Inner: `wt-hero-shell` + optional `HeroWatermark` + title/StatusPill + hint + vitals/`VitalTile` or page KPIs + optional `HeroTabNav`.

Used on: Overview, Live, Issues, Crashes, Mods, Spark, Startup, Session, Backups, Activity, Sources. Insights section banners: `HeroCard` if status-toned, else `.wt-plate`.

### List + detail inboxes
Issues / Crashes / Mods: flat inset rows, Fix | Details panes, severity bands — not thematic colour circus.

### Insights
Keep `PillNav` (Overview · Schedule · Load · … · World · Storage · Digest). Do not force `HeroTabNav`.

### Settings / Wizard
Left panel list (Settings IA) + `.wt-form-row` shells. No soft SaaS radii.

### Operator chrome
Boot, auth gate, wizard, support-pack modal — same radius/button/plate rules. Auth: labels, autocomplete, focus-visible.

## Navigation patterns

- **Rail:** 220px, logo + **WatchTower** wordmark, groups Monitor / Triage / Ops / System, solid Signal Blue active item
- **HeroTabNav:** Issues, Crashes, Mods, Spark (and similar mission tabs)
- **PillNav:** Insights only (segment control on tonal well)
- **Settings:** left panel list

## Forms & settings rows

Use `.wt-form-row` or equivalent token classes. Inputs: `--radius-wt`, hairline border, bg1/bg2, focus-visible accent ring. Pending submits disabled until request completes.

## Empty, error & loading

Prefer shared `EmptyState` / `ErrorState`. Copy: what happened + what to do next (active voice, no apology fluff). Skeletons: `animate-pulse` + `rounded-[var(--radius-wt)]` (never `rounded-xl`).

## Copy & voice

- Sentence case in UI chrome
- Spell **WatchTower**
- Loading / progress ends with `…`
- Numerals for counts
- Specific action labels (“Save changes”, “Scan now”)
- Advisory product constraint: do not imply auto-restart, jar download, or silent world mutation

## Allowed exceptions

| Exception | Allowed where |
|---|---|
| `999px` / full round | Insights `PillNav`, scroll thumbs, true toggles — **not** cards or primary CTAs |
| `StatusPill` radius | `--radius-wt-sm` (tight chip, not full round pill) |
| Hero BorderGlow | `HeroCard` only, ~0.55 intensity |
| Specular multi-shadow | `.wt-specular-cta` primary CTAs |
| Visuals/lab | Out of product rail; banlist allowlisted |

## Reject list (do not ship)

- Double-Bezel / `rounded-[2rem]` squircles, floating island nav, full-pill primary CTAs
- Ethereal glass: purple/indigo orbs, heavy blur on scrolling cards, frosted marketing plates
- Marketing macro-whitespace (`py-24`–`py-40` as default section padding)
- Soft cream-serif / broadsheet “AI default” looks
- New display fonts or icon-set swaps
- `rounded-xl` / `rounded-2xl` on plates/forms/buttons/skeletons
- `transition: all` / `transition-all`
- Multi-layer resting-card shadows / `--wt-shadow-lg` forks
- Channel colours used as status (or the reverse)

## Do's and Don'ts

### Do
- Keep Signal Blue scarce and purposeful
- Separate channel colours from status colours
- Use Geist for UI copy and JetBrains Mono for comparable numbers
- Prefer tonal bg steps + hairlines over heavy glass blur stacks
- Respect `prefers-reduced-motion`
- Spell **WatchTower** in chrome you touch
- Prefer shared patterns (`HeroCard`, `VitalTile`, `Button`, `.wt-plate`, `.wt-form-row`)
- Run `npm run test:ui-consistency` after chrome edits

### Don't
- Reintroduce periwinkle / purple-indigo “AI dashboard” palettes
- Use large pill radii or multi-layer drop shadows as default card chrome
- Put decorative gradients or sparkle text on triage surfaces
- Invent a second Skin; themes are light / dark / black only
- Imply the UI can restart the server, download jars, or auto-clean the world
- Fight this document with generic high-end SaaS playbooks

## Repo file map

| Path | Role |
|---|---|
| `DESIGN.md` | This system (canonical) |
| `PRODUCT.md` | Product voice & capabilities |
| `web/dashboard/src/index.css` | Tokens, `.wt-plate`, `.wt-form-row`, specular CTAs |
| `web/dashboard/src/ui/patterns/` | Shared React primitives |
| `web/dashboard/src/ui/motion/` | Enter / reduced-motion helpers |
| `web/dashboard/src/app/theme.tsx` | Theme provider |
| `web/dashboard/src/app/accents.ts` | Accent presets |
| `web/dashboard/src/app/shell.tsx` + `shell.css` | App chrome / rail |
| `web/dashboard/src/features/*` | Page views + feature CSS |
| `web/dashboard/scripts/ui-consistency-banlist.test.ts` | Radii + transition-all regression |
| `docs/superpowers/specs/2026-08-02-dashboard-ui-consistency-design.md` | Consistency pass design notes |
| `docs/superpowers/plans/2026-08-02-dashboard-ui-consistency.md` | Consistency implementation plan |

Marketing (`web/marketing`), archive, and DR viewer are **out of scope** for this dashboard system unless a separate brief says otherwise.
