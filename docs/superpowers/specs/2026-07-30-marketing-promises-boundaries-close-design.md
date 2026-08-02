# Marketing homepage: Promises, Boundaries, Close — visual pass

**Date:** 2026-07-30  
**Surface:** `web/marketing` homepage sections (`Promises`, `Boundaries`, `Close`)  
**Mode:** Persuade (marketing)  
**Approach:** C — split treatments so the page does not become one repeating plate grid  
**Brand:** Night Watch Desk (`DESIGN.md`) — Geist + JetBrains Mono, Signal Blue / Lantern Amber, radii 2/4/6px, spell **WatchTower**  
**Dials:** VARIANCE 7 / MOTION 6 / DENSITY 5  

## Goals

- Make the lower homepage (Promises, Boundaries, Close) feel as intentional as the desk cards and ShippingStrip above.
- Keep all copy product-true from `web/marketing/content/product.ts` (`PROMISES`, `NOT_OUR_JOB`, existing Close strings). No new claims, metrics, or testimonials.
- Zero em-dashes in user-visible copy. No craft-floor eyebrows. Lucide allowed (already in marketing).

## Non-goals

- Do not rewrite PRODUCT.md / ROADMAP promises wording.
- Do not change nav IA, demo URL, or Modrinth link targets.
- Do not import dashboard `PageView`s or heavy chart stacks into marketing.
- Do not use `rounded-2xl` / pill cards as default — WatchTower tight radii win over high-end skill defaults.

## Section designs

### 1. Promises → instrument plates

**Layout family:** 2×2 nested-plate grid (distinct from ShippingStrip’s 5-col chip ledger).

- Section title stays: “Promises that do not change.”
- Four cells from `PROMISES`, each in `InstrumentPlate` (or equivalent outer tray + inner core).
- Top of each inner cell: short lantern amber hairline (horizontal accent, not a left border bar).
- Optional light-stroke Lucide mark per promise (lock / shield-check / eye-off / package) — decorative only; title carries meaning.
- Staggered `Reveal` / motion enter; respect `prefers-reduced-motion`.
- Mobile: single column, `w-full`, tighter `gap-3`.

### 2. Boundaries → denser ledger

**Layout family:** Comparison ledger inside one nested plate (not a card grid).

- Title + lead unchanged.
- Whole table sits in one InstrumentPlate.
- Mono column headers: “We do not replace” / “Use instead”.
- Rows from `NOT_OUR_JOB`: hairline dividers; left = `weDont` + `detail`; right = `useInstead`.
- Optional small “out of scope” mono tag on the left column of each row (functional, not decorative eyebrow spam).
- Mobile: stack columns per row (weDont block, then useInstead).

### 3. Close → instrument CTA tray

**Layout family:** Full-width nested plate CTA (breaks the previous page-only centered close).

- Outer section keeps border-t; content moves into a nested plate spanning `max-w-[84rem]`.
- Desktop: left-aligned headline + support + CTAs (not centered).
- Soft lantern / signal radial wash **inside** the plate only (no page-wide backdrop-blur on scrolling content).
- Primary: existing `Cta` with nested arrow (“Open the demo”).
- Secondary: ghost CTA “Get it on Modrinth” with `ModrinthMark` in the button (reuse `components/brand/modrinth-mark.tsx`).
- Copy unchanged; links unchanged (`DEMO_URL`, `LINKS.modrinth`).
- Mobile: stack CTAs, full-width friendly.

## Visual system notes

- Reuse `InstrumentPlate`, motion easings `cubic-bezier(0.16, 1, 0.3, 1)`, existing theme tokens (`--wt-*`).
- Light + dark themes must both read; desk-night surfaces are not required here (these are marketing chrome, not live desk cards).
- Section-layout repetition: Promises = plate grid; Boundaries = ledger plate; Close = CTA tray — three different families.

## Files likely touched

- `web/marketing/components/sections/promises.tsx`
- `web/marketing/components/sections/boundaries.tsx`
- `web/marketing/components/sections/close.tsx`
- Possibly small shared helper if plate grid markup is duplicated (prefer reuse `InstrumentPlate` first).

## Acceptance

- Desktop + mobile: sections denser, on-brand, no empty floating text slabs.
- Modrinth mark visible on Close secondary CTA.
- Detector clean on touched files; no invented product claims.
- Reduced motion: no stuck opacity / blur.

## Out of scope for this pass

- Hero, Loop, Questions, Showcases, ShippingStrip (already treated).
- Features / Install / FAQ pages.
