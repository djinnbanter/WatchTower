# Marketing Shift Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `web/marketing/app/page.tsx` as one incident night (The Shift Log), with shared design-system fixes (paper light, no glow, no elevation shadows, 12px label floor), verified against the anti-slop checklist.

**Architecture:** One `<ol>` of eight entries. Each entry owns its stamp/tick in the gutter. An absolute rail track paints the lantern fill from scroll progress; a sticky shortcut nav is the only pinned chrome. Desk fixtures come only from `web/marketing/content/baked/desk.ts`. Old section components stay in the tree but become unreferenced.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v4, `motion/react`, `@number-flow/react`, Geist + JetBrains Mono, existing `ProductDesk` / `HeroReadout`.

**Spec of truth:** `docs/superpowers/specs/2026-07-31-marketing-shift-log-design.md`

## Global Constraints

- Spelling: **WatchTower**
- Zero em-dash / en-dash in user-visible strings; hyphen only
- Radii: 2 / 4 / 6px only; no pills
- No invented metrics; every number from `DESK` in `content/baked/desk.ts`
- Clock times only in narrative; crash filenames verbatim only inside crash ledger
- `PROMISES` / `NOT_OUR_JOB` / `FOOTNOTE` verbatim from `content/product.ts`
- Home page: zero decorative `radial-gradient`, zero elevation `box-shadow`, zero Lucide-in-square icons, zero text below 12px (`0.75rem`)
- Light theme: paper tokens from spec; `--wt-lantern` not used for normal-size text
- Motion budget: exactly four moments; `transform`/`opacity` only; honor `prefers-reduced-motion`
- Full CTA pair appears twice in page body + once as rail shortcuts
- Home only; do not break `/features` or `/how-it-works` use of `Reveal`

## Skills while building

| Phase | Skill |
|---|---|
| Execution | `subagent-driven-development` or `executing-plans` |
| Copy | `human-writing` then `anti-ai-writing-humanizer` |
| Visual | `impeccable`, `high-end-visual-design`, `design-taste-frontend` |
| React | `vercel-react-best-practices` |
| A11y | `web-design-guidelines` |
| Perf | `web-performance-optimization` |
| Done gate | `verification-before-completion` |

---

### Task 0: Foundation tokens + chrome

**Files:**
- Modify: `web/marketing/styles/globals.css`
- Modify: `web/marketing/components/instrument-plate.tsx`
- Modify: `web/marketing/app/layout.tsx`
- Modify: `web/marketing/components/site-footer.tsx`

- [ ] **Step 1:** Add `--wt-fs-hero`, `--wt-fs-entry`, `--wt-fs-numeral`; paper light tokens; remove glow tokens; add `[data-temp='hot']`
- [ ] **Step 2:** `InstrumentPlate` `elevation?: 'shadow' | 'flat'` (default flat for new usage)
- [ ] **Step 3:** Remove `.wt-field` from layout; update thesis comment; strip footer glows
- [ ] **Step 4:** `cd web/marketing && npm run build`

### Task 1: `content/night.ts` + audit script

**Files:**
- Create: `web/marketing/content/night.ts`
- Create: `web/marketing/scripts/audit-shift-log.mjs`

- [ ] **Step 1:** Define `NightEntryId`, `NightEntry`, `NIGHT` array for eight entries
- [ ] **Step 2:** Audit script fails on glow, atmosphere radial-gradient, elevation shadow, sub-12px, em-dash in content

### Task 2: 12px label floor

**Files:**
- Modify: `web/marketing/components/desk/desk.css`
- Modify: desk-related TSX (`hero-readout.tsx`, etc.)

- [ ] **Step 1:** Raise all `0.5625/0.625/0.6875rem` to `≥0.75rem`
- [ ] **Step 2:** Light theme: lantern micro-labels → `--wt-text-mid`

### Task 3: Shift-log shell

**Files:**
- Create: `web/marketing/components/shift-log/use-log-progress.ts`
- Create: `web/marketing/components/shift-log/rail-track.tsx`
- Create: `web/marketing/components/shift-log/rail-shortcuts.tsx`
- Create: `web/marketing/components/shift-log/entry.tsx`
- Create: `web/marketing/components/shift-log/log.tsx`
- Create: `web/marketing/components/shift-log/live-pulse-context.tsx` (pulse → flatline)

- [ ] **Step 1:** Progress hook + IntersectionObserver active id
- [ ] **Step 2:** Rail track + shortcuts + ShiftEntry + ShiftLog
- [ ] **Step 3:** Desktop 88px gutter; tablet/mobile inline stamps

### Task 4: Type primitives

**Files:**
- Create: `web/marketing/components/type/display-numeral.tsx`
- Create: `web/marketing/components/type/margin-note.tsx`

- [ ] **Step 1:** Display numeral with optional count-up; reduced-motion final value
- [ ] **Step 2:** Margin note mono ≥12px

### Task 5–11: Eight entries

**Files:**
- Create: `web/marketing/components/entries/quiet.tsx`
- Create: `web/marketing/components/entries/fills.tsx`
- Create: `web/marketing/components/evening-chart.tsx`
- Create: `web/marketing/components/entries/spike.tsx`
- Create: `web/marketing/components/entries/killed.tsx`
- Create: `web/marketing/components/entries/answer.tsx`
- Create: `web/marketing/components/entries/pattern.tsx`
- Create: `web/marketing/components/entries/orders.tsx`
- Create: `web/marketing/components/entries/close-entry.tsx`

- [ ] **Step 1:** Entry 0 quiet (healthy desk + CTAs + vital tick)
- [ ] **Step 2:** Entry 1 fills + evening chart
- [ ] **Step 3:** Entry 2 spike 118ms count-up + hot temp
- [ ] **Step 4:** Entry 3 killed OOM + flatline + hot temp
- [ ] **Step 5:** Entry 4 answer dual-pane desk
- [ ] **Step 6:** Entry 5 pattern ledger
- [ ] **Step 7:** Entry 6 orders + Entry 7 close

### Task 12: Wire page

**Files:**
- Modify: `web/marketing/app/page.tsx`
- Modify: `web/marketing/components/site-header.tsx` (anchors if needed)

- [ ] **Step 1:** Compose ShiftLog with eight entries
- [ ] **Step 2:** Fix nav anchors for home sections

### Task 13: Verify

- [ ] **Step 1:** `npm run build`
- [ ] **Step 2:** `node scripts/audit-shift-log.mjs`
- [ ] **Step 3:** Browser dark/light/mobile/keyboard/reduced-motion
- [ ] **Step 4:** Anti-slop negative list + silhouette check
