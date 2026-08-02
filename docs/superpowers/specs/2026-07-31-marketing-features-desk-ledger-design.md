# Features page: desk ledger catalog

**Date:** 2026-07-31  
**Status:** Approved (Approach A — desk ledger)  
**Surfaces:** `web/marketing` Features page (`/features`)

## 1. Goal

Replace the equal SaaS capability **cards** (icon wells, pastel washes, hover lift, multi-col grid) with one Night Watch Desk **instrument ledger**: numbered hairline rows inside a single `InstrumentPlate`.

Content inventory stays (`FEATURE_CAPABILITIES`). Visual language matches desk / How-it-works chrome, not a feature-card template.

## 2. Why

The colorize craft pass on the capability grid read as generic AI marketing cards and fought DESIGN.md (scarce Signal Blue, no decorative icon rows, no AI-SaaS chrome).

## 3. Job / not job

**Job:** Scannable numbered catalog of shipped insides (Alpha labeled when true).

**Not this page:** ProductDesk peeks, room tour, install guide, promises / not-our-job, rainbow per-row tones, SVG mark wells, floating equal-height cards.

## 4. Composition

```
[ Features ]  lede

┌─ InstrumentPlate ─────────────────────────┐
│  CAPABILITY CATALOG · NN                  │
├───────────────────────────────────────────┤
│  01  OVERVIEW                             │  lead (more air)
│      Title                                │
│      Blurb                                │
│  …                                        │
├───────────────────────────────────────────┤
│  06  LIVE  Title  Blurb  [Alpha?]         │  standard (denser)
└───────────────────────────────────────────┘

[ Demo + Modrinth ]
```

## 5. Craft

- Geist + JetBrains Mono; radii via InstrumentPlate; hairlines between rows
- Ink hierarchy only; lantern Alpha chip; no tone rainbow
- Reveal stagger; hover = quiet bg2 wash; no card lift
- Prefer reduced-motion honored via existing Reveal

## 6. Content

Keep titles, blurbs, tags, weights, alpha. Drop `tone` / marks.
