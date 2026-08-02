# Settings UI Clarity — Design Spec

**Date:** 2026-08-02  
**Surface:** `web/dashboard` Settings panels only (`?tab=settings`)  
**Identity:** Night Watch Desk (`DESIGN.md`) — iterate, do not rewrite the product

## Problem

Settings currently wraps **every field** in its own bordered `.wt-form-row` plate inside uneven `md:grid-cols-2` grids. That reads as a pile of mini-cards: orphan cells, ragged bottoms, competing borders, and long hints under every control. Operators cannot scan “what lives in this section” at a glance. Backups also shows two primary-looking Saves without hierarchy.

## Goals

1. Make every Settings panel easy to **follow and understand** — one section = one plate, fields as desk rows.
2. Keep **Night Watch Desk** craft (tight radii, scarce Signal Blue, Geist + JetBrains Mono) — raise clarity, not SaaS gloss.
3. **No product behavior change** — same panels, keys, dirty tracking, dual Backups save semantics (folders vs thresholds).

## Non-goals

- New settings keys / API / roles
- Moving panels to a left sidebar (horizontal pill panel nav stays)
- Wizard redesign, Visuals/lab, marketing
- Double-Bezel, `rounded-[2rem]`, pill primary CTAs, glass orbs, purple gradients (reject high-end SaaS defaults even when design skills suggest them)

## Locked design

### 1. Section plate (signature)

Each `Section`’s field group sits in **one** `.wt-plate` (class `.st-stack` for settings-specific internals):

```
┌─ Section title ─────────────────────────────────────┐
│  one-line hint                                        │
│  ┌─ .st-stack (.wt-plate) ─────────────────────────┐ │
│  │ label …                              [control]  │ │
│  │─────────────────────────────────────────────────│ │
│  │ label …                              [control]  │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

- Hairline dividers between rows (`border-top` on siblings), **not** a full border per field.
- Padding: `12px 16px` row; plate uses existing `--wt-shadow` / `--radius-wt`.
- Odd last fields **span full width** inside the stack — never a lonely half-card floating in a 2-col grid.

### 2. Field row layouts

| Kind | Layout |
|------|--------|
| Toggle | Label + short hint left; switch right (already close — drop outer plate border) |
| Number | Label + short hint left; `input` + unit right, tabular mono |
| Text / password | Label above; full-width input (still inside stack, no nested plate chrome) |
| Read-only | Label left; mono value right (or value under label on narrow) |
| Segmented (theme / timezone mode) | Label row, then control — still **inside** the section plate |

Two-column **only** when pairing true couples (TPS/MSPT, two toggles). Prefer a single stack for 3+ related numbers if pairing leaves orphans.

### 3. Page chrome

- Keep horizontal panel pills (`--radius-wt-sm`).
- **Save changes** stays on the panel row (right on wide; wraps under on narrow). Show dirty / Saved / error pills beside it.
- Panels without global save (Security, Accounts, Audit, About): no orphan Save slot.
- Primary CTA specular glow: **one** global Save on conf panels — do not stack a second specular primary on Backups folder save.

### 4. Backups hierarchy (UX only)

Keep both saves (product requires folder scan vs threshold write):

| Control | Weight |
|---------|--------|
| Global **Save changes** | Primary — `backup_stale_hours` + other dirty conf keys |
| **Save folders & scan** | Secondary (`kind="default"`) — caption under button: “Folders save here. Thresholds use Save changes above.” |
| External / panel tracking save | Stay secondary; Alpha callout remains `.wt-plate` warn tint |

Shorten the Backups section intro to two short sentences max.

### 5. Copy rules

- Section hints: **one sentence**, plain English, WatchTower spelling in chrome.
- Field hints: only when they add a number/typical or consequence; delete “explains the label again.”
- Sentence case; no ALL-CAPS section banners except existing micro labels (`label` token / ledger chips).
- Units always present for numeric fields that have units (`scans`, `reports` where missing today).

### 6. Accounts / Audit / About

- **Accounts:** table wrap already plate-like — add shadow via `.wt-plate` or keep border; put “Add account” in a footer band of the same plate (not a floating form under empty space). Tighten action link spacing; keep behavior.
- **Audit:** keep ledger; ensure filter chips sit flush above ledger; no extra card wrappers around each row.
- **About:** facts as stack rows inside one plate; **Relaunch setup wizard** = primary but not louder than Settings Save (same Button primary, no extra glow fork).

### 7. Craft bar (from skills — keep)

- `:focus-visible` rings on inputs/selects/switches; no bare `outline-none` without replacement.
- No `transition: all` / `transition-all`.
- Motion: opacity/transform only; respect `prefers-reduced-motion`.
- Touch: controls ≥ 44px tall where practical; icon-only → `aria-label`.
- Loading copy uses `…`.

### 8. Themes

Ship for **dark** primary; spot-check **light** and **black**. Stack hairlines must remain visible in light (`--wt-line`).

## Success criteria

- Operator can open Monitoring / Alerts / Backups and name each section’s job in under 5 seconds.
- No orphan half-width field cards.
- At most one primary Save visual weight per viewport on Backups.
- Banlist still green; no new `rounded-xl` / `rounded-2xl`.
- Fixture preview: all nine panels render without layout jump or broken focus.

## End-user plain English

Settings should feel like a clear ops desk: pick a topic tab, read a short section title, tweak rows in one tidy box, hit Save when thresholds change. Folder backups still save on their own button — but it won’t look like a second “main” Save fighting the first.
