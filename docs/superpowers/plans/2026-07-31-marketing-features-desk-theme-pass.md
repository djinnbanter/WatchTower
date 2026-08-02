# Features desk-theme + chart-forward peeks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retune the Features MagicBento grid to Night Watch Desk chrome (InstrumentPlate radii, desk peeks) so every card — showcase and “Also on the desk” — has layered, webapp-faithful mock UIs (charts, queues, dials) with no super-rounded SaaS corners.

**Architecture:** Keep MagicBento + `FEATURE_CAPABILITIES` content. Shared card CSS twin of `InstrumentPlate`. Showcase peeks polished to `desk-*` vocabulary; secondary peeks each get a unique layered visual (chart / bars / queue / stamp). Mild span variety on secondary so it is not a flat icon wall.

**Tech Stack:** Next.js 15 App Router, React 19, GSAP MagicBento, DeskDial, desk.css tokens, Geist + JetBrains Mono.

## Global Constraints

- Night Watch Desk only: radii `2px / 4px / 6px` (`--wt-radius-*`); outer tray + inner core like InstrumentPlate; max marketing soften `calc(var(--wt-radius-lg) + 4px)` (~10px) — never 22px+ Apple balloons
- Signal Blue glow RGB `76, 141, 255` only — never React Bits purple `132, 0, 255`
- Channel colors `--wt-ch-*` and status `--wt-ok/warn/danger` — Channel ≠ Status rule
- No `ProductDesk` import on Features (audit); peeks may copy desk class names / DeskDial
- No Fabric shipping claims; hyphens only; WatchTower spelling
- Font floor ≥ `0.75rem` (audit-shift-log)
- Do not git commit unless the user explicitly asks
- Inspiration (chart-forward bento): dominant chart/bar/toolbar assets, generous padding, title+subtext hierarchy — expressed in Desk ink, not Graphy’s purple lines or pill-soft UI

---

### Task 1: Design note

**Files:**
- Create: `docs/superpowers/specs/2026-07-31-marketing-features-desk-theme-pass-design.md`

- [ ] **Step 1: Write the design note**

Include: goal (one card craft for all Features cells); radius ban (no 22px); chart-forward peeks matching dashboard; showcase + secondary layout; out of scope (copy rewrite, ProductDesk).

- [ ] **Step 2: Confirm note exists**

Run: `Test-Path docs/superpowers/specs/2026-07-31-marketing-features-desk-theme-pass-design.md`  
Expected: `True`

---

### Task 2: Desk double-bezel card chrome

**Files:**
- Modify: `web/marketing/components/react-bits/MagicBento.css`
- Modify: `web/marketing/components/react-bits/MagicBento.tsx` (only if class hooks needed)

**Interfaces:**
- Produces: `.magic-bento-card` looks like InstrumentPlate (outer tray + inner core); `--wt-radius-lg` / `--wt-radius-sm`; Signal Blue border glow unchanged

- [ ] **Step 1: Replace soft 22px card chrome with Desk bezel**

In `MagicBento.css`, set card shell to:

```css
.magic-bento-card {
  border-radius: var(--wt-radius-lg);
  border: 1px solid var(--wt-line);
  background: var(--wt-plate-outer);
  padding: 5px;
  box-shadow: none; /* ambient on inner only */
  /* keep --glow-* vars */
}

.magic-bento-card__inner {
  height: 100%;
  min-height: inherit;
  display: flex;
  flex-direction: column;
  border-radius: var(--wt-radius-sm);
  background: var(--wt-bg1);
  padding: 1.15rem 1.2rem 1.25rem;
  box-shadow: var(--wt-shadow);
  overflow: hidden;
}
```

Remove `border-radius: 22px` and large soft drop shadows on the outer card.

- [ ] **Step 2: Wrap card body in inner shell**

In `MagicBento.tsx`, wrap `{body}` with:

```tsx
<div className="magic-bento-card__inner">{body}</div>
```

(inside ParticleCard / plain div).

- [ ] **Step 3: Cap peek radii to Desk family**

In `bento-peeks.css`, replace `14px` / `16px` / `18px` / `20px` / `22px` / `28px` / `999px` candy pills with:

```css
border-radius: var(--wt-radius-md); /* or sm / lg */
```

Pills use `desk-pill` classes (radius-sm), not `border-radius: 999px`.

- [ ] **Step 4: Visual smoke**

Run: open `http://localhost:3099/features`  
Expected: cards have tight Desk corners; no balloon rounding; glow still Signal Blue

---

### Task 3: Chart-forward shared peek primitives

**Files:**
- Modify: `web/marketing/components/features/bento-peeks.tsx`
- Modify: `web/marketing/components/features/bento-peeks.css`

**Interfaces:**
- Produces: `PeekSparkline`, `PeekBarSet`, `PeekFloatingToolbar`, `PeekInstrumentGrid` helpers used by showcase + secondary peeks
- Consumes: `DeskDial`, `desk-pill` / optional local plate classes

- [ ] **Step 1: Add sparkline helper (TPS / MSPT style)**

```tsx
function PeekSparkline({
  values,
  channel = 'tps',
  label,
}: {
  values: number[];
  channel?: 'tps' | 'mspt' | 'heap' | 'disk' | 'players';
  label: string;
}) {
  const w = 260;
  const h = 72;
  const max = Math.max(...values, 0.01);
  const d = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = h - (v / max) * (h - 8) - 4;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <div className="bento-peek__chart-shell desk-plate desk-plate--chart">
      <div className="desk-plate__head">
        <span className="bento-peek__kicker">{label}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} aria-hidden>
        <path d={d} fill="none" stroke={`var(--wt-ch-${channel})`} strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Add bar set helper (channel bars like desk-bars)**

```tsx
function PeekBarSet({
  rows,
}: {
  rows: { label: string; pct: number; channel: string }[];
}) {
  return (
    <div className="bento-peek__bars desk-bars" aria-hidden>
      {rows.map((r) => (
        <div key={r.label} className="desk-bars__col" style={{ ['--bar' as string]: `${r.pct}%` }}>
          <span
            className="bento-peek__bar-fill"
            style={{ height: `${r.pct}%`, background: `var(--wt-ch-${r.channel})` }}
          />
          <span className="bento-peek__bar-cap">{r.label}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Add floating toolbar plate (annotation / instrument chrome)**

Desk hairline plate floating over a faint sparkline background — used for activity / spark storytelling cards. Radius `var(--wt-radius-md)`. Icons = existing `CapabilityMark` strokes only (no Lucide).

- [ ] **Step 4: Add instrument tile grid (6 cells)**

Like Graphy’s chart-type picker, but WatchTower instruments (TPS, MSPT, Heap, Disk, Players, CPU) with one cell selected via `--wt-accent` border.

---

### Task 4: Polish showcase peeks to Desk + chart-forward

**Files:**
- Modify: `web/marketing/components/features/bento-peeks.tsx`
- Modify: `web/marketing/components/features/bento-peeks.css`

**Interfaces:**
- Consumes: helpers from Task 3; `desk-pill--ok|warn|danger|info|neutral`
- Produces: updated peeks for health-grade, fix-inbox, world-pressure, join-clinic, live-vitals, support-pack, spark

- [ ] **Step 1: Health grade — desk pills + nested plate**

Replace custom pill classes with:

```tsx
<span className="desk-pill desk-pill--ok">Safe</span>
<span className="desk-pill desk-pill--warn">Caution</span>
<span className="desk-pill desk-pill--neutral">Wait</span>
```

Grade letter stays mono; depth layers use `--wt-radius-md` not soft squircle.

- [ ] **Step 2: Fix inbox — desk-queue row rhythm**

```tsx
<ul className="desk-queue">
  <li className="desk-queue__row">…</li>
</ul>
```

Keep stacked offset via transform; clip inside card inner.

- [ ] **Step 3: Live vitals — sparkline + DeskDial row**

Use `PeekSparkline` + existing dials; label “TPS · last hour”; Steady = `desk-pill desk-pill--ok`.

- [ ] **Step 4: World pressure — bar set + orbit (restrained)**

Orbit dashed ring stays; census uses Desk bar language; `+ Spot loaders` becomes hairline button with `var(--wt-radius-sm)` (not full pill).

- [ ] **Step 5: Support + Spark**

Support: match `.desk-support-peek__row` file/note. Spark: stamp rings at `radius-md`, lantern tone, Alpha chip already on card meta.

---

### Task 5: Secondary layout config (`FEATURE_BENTO_MORE`)

**Files:**
- Modify: `web/marketing/content/features-bento.ts`

**Interfaces:**
- Produces: `FEATURE_BENTO_MORE: { id, media, span: 'one' | 'two' }[]`
- Produces: every non-showcase `FEATURE_CAPABILITIES` id appears exactly once

- [ ] **Step 1: Define MORE list**

```ts
export type MoreSpan = 'one' | 'two';
export type FeatureBentoMoreCell = {
  id: string;
  media: BentoMedia | 'chart' | 'side' | 'stack' | 'overlay';
  span: MoreSpan;
};

export const FEATURE_BENTO_MORE: FeatureBentoMoreCell[] = [
  { id: 'gc-ram', media: 'chart', span: 'one' },
  { id: 'crash-fingerprints', media: 'stack', span: 'two' },
  { id: 'external-kill', media: 'side', span: 'one' },
  { id: 'silent-fails', media: 'stack', span: 'one' },
  { id: 'mods-modrinth', media: 'overlay', span: 'two' },
  { id: 'jar-drift', media: 'side', span: 'one' },
  { id: 'schedule-load', media: 'chart', span: 'one' },
  { id: 'storage-runway', media: 'chart', span: 'two' },
  { id: 'weekly-digest', media: 'overlay', span: 'one' },
  { id: 'config-audit', media: 'overlay', span: 'one' },
  { id: 'backups', media: 'side', span: 'two' },
  { id: 'activity', media: 'overlay', span: 'two' },
  { id: 'logs', media: 'stack', span: 'one' },
  { id: 'startup', media: 'chart', span: 'one' },
  { id: 'sources', media: 'side', span: 'one' },
  { id: 'accounts', media: 'overlay', span: 'two' },
  { id: 'auth', media: 'side', span: 'one' },
  { id: 'help', media: 'overlay', span: 'one' },
  { id: 'cli-dr', media: 'overlay', span: 'one' },
];
```

- [ ] **Step 2: Assert coverage**

In the same file or a one-off node check: every `FEATURE_CAPABILITIES` id is in showcase XOR more. No orphan, no duplicate.

---

### Task 6: Unique peeks for every secondary id

**Files:**
- Modify: `web/marketing/components/features/bento-peeks.tsx`
- Modify: `web/marketing/components/features/bento-peeks.css`

**Interfaces:**
- Produces: `featurePeek(id)` returns a dedicated component for every id; delete `PeekCompact` default path (or keep only as throw)

| id | Peek composition |
|---|---|
| gc-ram | DeskDial heap + GC pause share bar |
| crash-fingerprints | stacked crash cards (title + fingerprint mono) |
| external-kill | two plates: OOM vs panel kill |
| silent-fails | log lines with warn dots |
| mods-modrinth | jar list + “Modrinth hint” chip |
| jar-drift | baseline vs current checksum rows |
| schedule-load | hour heat strip (channel players) |
| storage-runway | disk bar + “~12 days” mono |
| weekly-digest | mini brief (grade / crashes / next) |
| config-audit | keep / tweak / why rows |
| backups | folder rows + fresh/stale pills |
| activity | floating toolbar over faint lag sparkline |
| logs | latest.log 4-line tail |
| startup | boot tick timeline |
| sources | freshness dots + next poll |
| accounts | owner/admin/viewer chips + audit row |
| auth | lock plate + 2FA on chip |
| help | wiki TOC 3 links |
| cli-dr | terminal `watchtower-cli` prompt |

- [ ] **Step 1: Implement peeks for crashes / live / mods cluster**

gc-ram, crash-fingerprints, external-kill, silent-fails, mods-modrinth, jar-drift.

- [ ] **Step 2: Implement peeks for insights / ops cluster**

schedule-load, storage-runway, weekly-digest, config-audit, backups, activity.

- [ ] **Step 3: Implement peeks for system cluster**

logs, startup, sources, accounts, auth, help, cli-dr.

- [ ] **Step 4: Exhaustive switch**

```tsx
export function featurePeek(id: string): ReactNode {
  switch (id) {
    case 'health-grade': return <PeekHealthGrade />;
    // … every id …
    default:
      throw new Error(`Missing feature peek: ${id}`);
  }
}
```

---

### Task 7: Wire catalog — secondary same craft as showcase

**Files:**
- Modify: `web/marketing/components/features/capability-catalog.tsx`
- Modify: `web/marketing/components/react-bits/MagicBento.css` (`.card-grid--more`, `.bento-span--more-two`)

**Interfaces:**
- Consumes: `FEATURE_BENTO_MORE`, `featurePeek`, `TONE_CSS`
- Produces: secondary MagicBento cards with `layoutClass`, `media`, `visual` — never `compact` / icon-only

- [ ] **Step 1: moreCards from FEATURE_BENTO_MORE**

```tsx
function moreCards(): MagicBentoCard[] {
  return FEATURE_BENTO_MORE.map((cell) => {
    const f = byId(cell.id);
    return {
      id: f.id,
      title: f.title,
      description: f.blurb,
      label: f.tag,
      alpha: f.alpha,
      tone: TONE_CSS[f.tone],
      color: 'var(--wt-bg1)',
      layoutClass: cell.span === 'two' ? 'bento-span--more-two' : 'bento-span--more-one',
      media: cell.media,
      visual: featurePeek(f.id),
    };
  });
}
```

- [ ] **Step 2: Secondary MagicBento props**

Match showcase craft: `enableBorderGlow`, `enableMagnetism`, `clickEffect`; `enableStars={false}` (less noise); spotlight false on secondary.

- [ ] **Step 3: CSS for mild asymmetry**

```css
@media (min-width: 1024px) {
  .card-grid--more {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 1rem;
  }
  .bento-span--more-one { grid-column: span 2; min-height: 260px; }
  .bento-span--more-two { grid-column: span 4; min-height: 280px; }
}
```

- [ ] **Step 4: Section heading**

Keep “Also on the desk”; ensure spacing uses Desk rhythm (`gap-10` / hairline), not extra SaaS chrome.

---

### Task 8: Audit + verify

**Files:**
- Modify: `web/marketing/scripts/audit-shift-log.mjs` only if new guards needed

- [ ] **Step 1: Run audit**

Run: `cd web/marketing && node scripts/audit-shift-log.mjs`  
Expected: `audit-shift-log OK`

- [ ] **Step 2: Typecheck**

Run: `cd web/marketing && npx tsc --noEmit -p tsconfig.json`  
Expected: exit 0

- [ ] **Step 3: HTTP + content**

Run: `Invoke-WebRequest http://localhost:3099/features`  
Expected: 200; HTML contains `magic-bento-card__inner`, `bento-span--more-two`, and peeks for `gc-ram` / `crash-fingerprints` (no lone `bento-peek--compact` as the secondary default)

- [ ] **Step 4: Manual visual checklist**

- Showcase + secondary share Desk bezel (tight radii)
- No purple glow / no 22px corners
- Every secondary card has a layered mock (chart, queue, bars, or stamp) — not a lonely icon
- Light theme readable; dark theme tokens hold
- Feels like WatchTower desk, not Graphy clone

---

## Spec coverage (self-review)

| Requirement | Task |
|---|---|
| Match site theme / InstrumentPlate | 2 |
| No super-rounded corners | 2, 4 |
| Chart-forward inspo (graphs, bars, floating chrome) | 3, 4, 6 |
| All cards same craft as top | 6, 7 |
| Bottom not boring | 5, 6, 7 |
| Mocks match webapp Desk | 3, 4, 6 |
| No ProductDesk on Features | Global + audit |
| MagicBento Signal Blue retained | 2, 7 |

## Plain-English end state

Someone opens Features and sees one WatchTower instrument catalog: interlocking hero cells up top and a richer “Also on the desk” band below. Every plate has a small live-looking chart, queue, or stamp that could have been clipped from the real dashboard — sharp Desk corners, Signal Blue glow, no candy SaaS rounding.
