# Dashboard UI Consistency Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align every in-scope WatchTower dashboard surface to Night Watch Desk plate/hero/button tokens and shared primitives — without layout rewrites or new product behavior.

**Architecture:** System-first: add a banlist regression test, extract shared `VitalTile` + `.wt-form-row`, then migrate pages by rail group (Monitor → Triage → Ops → System → chrome). Source of truth is `DESIGN.md` and `docs/superpowers/specs/2026-08-02-dashboard-ui-consistency-design.md`.

**Tech Stack:** React 19 + Vite dashboard (`web/dashboard`), Tailwind v4 + CSS vars in `src/index.css`, shared patterns in `src/ui/patterns/`, node:test for banlist/logic tests, fixture preview on `:8081`.

## Global Constraints

- Identity: Night Watch Desk per `DESIGN.md` — tight radii 2px/4px/6px (`--radius-wt-sm` / `--radius-wt` / `--radius-wt-lg`); plates use `.wt-plate` / `var(--wt-shadow)`; scarce Signal Blue; no AI-SaaS glass/periwinkle.
- Depth: polish + shared primitives only — no page IA/layout rewrites, no new product behavior.
- Scope in: all rail pages + boot, auth gate, wizard, support-pack modal.
- Scope out: `features/visuals/**`, `features/lab/**`, `web/marketing`, `web/dashboard-archive`, `web/dr-viewer`.
- Nav: keep Insights `PillNav`; keep Issues/Crashes/Mods/Spark `HeroTabNav`; Settings keeps left panel list.
- Exceptions for `999px`: PillNav, scroll thumbs, toggles only — not cards. `StatusPill` stays `--radius-wt-sm`.
- Ban: `rounded-xl` / `rounded-2xl` on in-scope plates/forms/buttons/skeletons; rem-soup card radii; `--wt-shadow-lg` resting forks.
- **Reject (high-end SaaS defaults):** Double-Bezel / `rounded-[2rem]`, floating island nav, full-pill primary CTAs, purple/indigo glass orbs, heavy blur on scrolling cards, marketing `py-24+` section padding, new fonts/icon sets.
- **Craft (keep):** `:focus-visible` rings; no bare `outline-none`; no `transition: all`; motion = `transform`/`opacity` + `prefers-reduced-motion`; no new `backdrop-blur` on scrolling content; icon-only → `aria-label`; loading labels use `…`; sentence-case WatchTower voice (not WIG Title Case rewrite).
- **React:** extract shared primitives; do not add `useMemo`/`useCallback`/new deps; do not define components inside `PageView`.
- Copy: spell **WatchTower** in chrome touched.
- Tests: dashboard uses `tsx --test` / node:test (no React Testing Library) — prefer banlist + pure helpers; verify UI via `npm run preview`.
- Commits: frequent, one logical unit per task; do not push unless asked.
- Spec craft bar: `docs/superpowers/specs/2026-08-02-dashboard-ui-consistency-design.md` § Craft quality bar.
- After QA: Task 14 expands root `DESIGN.md` into the deep canonical system matching post-pass WatchTower — future UI work calls that file back; do not invent a parallel aesthetic.

---

## File structure (locked)

| File | Responsibility |
|---|---|
| `docs/superpowers/specs/2026-08-02-dashboard-ui-consistency-design.md` | Approved design (already written) |
| `DESIGN.md` | Deepened in Task 14 into canonical system of record (post-pass) |
| `web/dashboard/scripts/ui-consistency-banlist.test.ts` | Regression: forbid `rounded-xl`/`rounded-2xl` on in-scope paths |
| `web/dashboard/src/ui/patterns/index.tsx` | Append shared `VitalTile` next to `MetricReadout` |
| `web/dashboard/src/index.css` | `.wt-form-row` (+ existing `.wt-plate`) |
| Feature `view.tsx` / `*.css` under Monitor/Triage/Ops/System/chrome | Consume primitives; kill radius/shadow drift |
| `web/dashboard/package.json` | Optional `test:ui-consistency` script |

---

### Task 1: Banlist regression harness

**Files:**
- Create: `web/dashboard/scripts/ui-consistency-banlist.test.ts`
- Modify: `web/dashboard/package.json` (add script)

**Interfaces:**
- Consumes: nothing
- Produces: `npm run test:ui-consistency` fails while in-scope files still contain `rounded-xl` / `rounded-2xl` (and separately fails on `transition: all` / `transition-all`)

- [ ] **Step 1: Write the failing banlist test**

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

/** Paths relative to src/ that may keep rounded-xl (out of scope). */
const ALLOW_PREFIXES = ['features/visuals/', 'features/lab/'];

const BAN = /\brounded-(?:xl|2xl)\b/;
/** Soft craft flags — report in assertion message; still fail the test if any match on in-scope files. */
const CRAFT_BANS: { name: string; re: RegExp }[] = [
  { name: 'transition: all', re: /transition\s*:\s*all\b/ },
  { name: 'transition-all utility', re: /\btransition-all\b/ },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|css)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function rel(p: string): string {
  return path.relative(SRC, p).split(path.sep).join('/');
}

describe('ui consistency banlist', () => {
  it('forbids rounded-xl / rounded-2xl on in-scope dashboard surfaces', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const r = rel(file);
      if (ALLOW_PREFIXES.some((p) => r.startsWith(p))) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (!BAN.test(text)) continue;
      for (const [i, line] of text.split(/\r?\n/).entries()) {
        if (BAN.test(line)) offenders.push(`${r}:${i + 1}:${line.trim()}`);
      }
    }
    assert.equal(
      offenders.length,
      0,
      `Forbidden radii on in-scope surfaces:\n${offenders.join('\n')}`,
    );
  });

  it('forbids transition: all / transition-all on in-scope surfaces', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const r = rel(file);
      if (ALLOW_PREFIXES.some((p) => r.startsWith(p))) continue;
      const text = fs.readFileSync(file, 'utf8');
      for (const { name, re } of CRAFT_BANS) {
        if (!re.test(text)) continue;
        for (const [i, line] of text.split(/\r?\n/).entries()) {
          if (re.test(line)) offenders.push(`${r}:${i + 1} [${name}]: ${line.trim()}`);
        }
      }
    }
    assert.equal(
      offenders.length,
      0,
      `Forbidden transition:all craft smells:\n${offenders.join('\n')}`,
    );
  });
});
```

**Note:** Do **not** hard-ban `outline-none` in this harness — many controls pair it with a custom focus ring. Audit `outline-none` without `:focus-visible` replacement manually in Task 13.

The `transition-all` test is a hard fail for in-scope paths (Visuals/lab allowed). Fix every hit in Task 12 before calling the pass done — do not narrow the allowlist.

- [ ] **Step 2: Add npm script and run to verify it fails**

In `web/dashboard/package.json` scripts:

```json
"test:ui-consistency": "tsx --test scripts/ui-consistency-banlist.test.ts"
```

Run:

```bash
cd web/dashboard && npm run test:ui-consistency
```

Expected: FAIL with offender list including at least `app/auth-gate.tsx`, `features/settings/view.tsx`, `features/wizard/view.tsx`, `features/insights/view.tsx`, `features/logs/view.tsx`.

- [ ] **Step 3: Commit**

```bash
git add web/dashboard/scripts/ui-consistency-banlist.test.ts web/dashboard/package.json
git commit -m "$(cat <<'EOF'
test: add dashboard UI radius banlist harness

EOF
)"
```

---

### Task 2: Shared `VitalTile` + `.wt-form-row`

**Files:**
- Modify: `web/dashboard/src/ui/patterns/index.tsx` (append `VitalTile` after `MetricReadout`)
- Modify: `web/dashboard/src/index.css` (add `.wt-form-row` near `.wt-plate`)

**Interfaces:**
- Consumes: `MetricReadout`, `cn` from `@/lib/utils`
- Produces:

```ts
export type VitalTileTone = 'default' | 'ok' | 'warn' | 'danger';
export type VitalTileProps = {
  label: string;
  value?: number | null;
  format?: (n: number) => string;
  tone?: VitalTileTone;
  size?: 'sm' | 'md';
  /** String override (Startup); skips MetricReadout when set. */
  text?: string | null;
  className?: string;
};
export function VitalTile(props: VitalTileProps): JSX.Element;
```

- CSS class `.wt-form-row` — plate-tight form/settings row shell

- [ ] **Step 1: Implement `VitalTile` in `index.tsx`**

Append immediately after the existing `MetricReadout` function in `web/dashboard/src/ui/patterns/index.tsx` (same module — no circular import):

```tsx
export type VitalTileTone = 'default' | 'ok' | 'warn' | 'danger';

export type VitalTileProps = {
  label: string;
  value?: number | null;
  format?: (n: number) => string;
  tone?: VitalTileTone;
  size?: 'sm' | 'md';
  text?: string | null;
  className?: string;
};

export function VitalTile({
  label,
  value,
  format,
  tone = 'default',
  size = 'md',
  text,
  className,
}: VitalTileProps) {
  if (text != null) {
    const textTone =
      tone === 'ok'
        ? 'text-wt-ok'
        : tone === 'warn'
          ? 'text-wt-warn'
          : tone === 'danger'
            ? 'text-wt-danger'
            : 'text-wt-text';
    return (
      <div className={cn(className)}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wt-text-low">
          {label}
        </div>
        <div
          className={cn(
            'mt-1 font-mono font-semibold tabular-nums',
            size === 'sm' ? 'text-lg' : 'text-3xl',
            textTone,
          )}
        >
          {text}
        </div>
      </div>
    );
  }

  if (value == null || !Number.isFinite(value)) {
    return (
      <div className={cn(className)}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wt-text-low">
          {label}
        </div>
        <div className="mt-1 font-mono text-lg font-semibold text-wt-text-low">—</div>
      </div>
    );
  }

  return (
    <div className={cn(className)}>
      <MetricReadout
        label={label}
        value={value}
        format={format ?? ((n) => String(Math.round(n)))}
        size={size}
        tone={tone}
      />
    </div>
  );
}
```

- [ ] **Step 2: Add `.wt-form-row` next to `.wt-plate` in `index.css`**

Find `.wt-plate {` in `web/dashboard/src/index.css` (~line 787) and add after it:

```css
/* Shared settings/wizard form row — tight plate, not rounded-xl SaaS */
.wt-form-row {
  border: 1px solid var(--wt-line);
  border-radius: var(--radius-wt);
  background: color-mix(in srgb, var(--wt-bg2) 50%, transparent);
  padding: 0.75rem 1rem;
}
```

- [ ] **Step 3: Typecheck**

```bash
cd web/dashboard && npx tsc -b --pretty false
```

Expected: PASS (or only pre-existing errors unrelated to this change).

- [ ] **Step 4: Commit**

```bash
git add web/dashboard/src/ui/patterns/ web/dashboard/src/index.css
git commit -m "$(cat <<'EOF'
feat(dashboard): add shared VitalTile and wt-form-row

EOF
)"
```

---

### Task 3: Consume `VitalTile` on Issues + Crashes + Mods

**Files:**
- Modify: `web/dashboard/src/features/issues/view.tsx` (delete local `VitalTile` ~41–61; import shared; keep `className="is-vital"`)
- Modify: `web/dashboard/src/features/crashes/view.tsx` (delete local ~41–63; `className="cr-vital"`; default `size="sm"`)
- Modify: `web/dashboard/src/features/mods/view.tsx` (delete local VitalTile; `className="md-vital"`)

**Interfaces:**
- Consumes: `VitalTile` from `@/ui/patterns`
- Produces: no local VitalTile copies on these three pages

- [ ] **Step 1: Issues — replace local helper**

Remove local `function VitalTile...`. Update import:

```tsx
import { Button, ErrorState, HeroCard, HeroTabNav, MetricReadout, StatusPill, VitalTile } from '@/ui/patterns';
```

Call sites become:

```tsx
<VitalTile className="is-vital" label="Critical" value={heroCritical} tone={heroCritical ? 'danger' : 'default'} />
```

(Match existing props; Issues uses default size/`Math.round` via shared default format.)

- [ ] **Step 2: Crashes — same pattern**

```tsx
<VitalTile
  className="cr-vital"
  label="…"
  value={…}
  size="sm"
  format={…} // keep call-site formats when present
  tone={…}
/>
```

- [ ] **Step 3: Mods — same pattern with `className="md-vital"`**

- [ ] **Step 4: Typecheck**

```bash
cd web/dashboard && npx tsc -b --pretty false
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/dashboard/src/features/issues/view.tsx web/dashboard/src/features/crashes/view.tsx web/dashboard/src/features/mods/view.tsx
git commit -m "$(cat <<'EOF'
refactor(dashboard): use shared VitalTile on Issues Crashes Mods

EOF
)"
```

---

### Task 4: Session + Startup — `VitalTile` and Session `HeroCard`

**Files:**
- Modify: `web/dashboard/src/features/session/view.tsx`
- Modify: `web/dashboard/src/features/startup/view.tsx`

**Interfaces:**
- Consumes: `VitalTile`, `HeroCard` from `@/ui/patterns`
- Produces: Session hero wrapped in `HeroCard`; both pages use shared `VitalTile` (Startup keeps `text=` override)

- [ ] **Step 1: Session — delete local VitalTile; import shared**

Replace local helper (~125–149). Call sites:

```tsx
<VitalTile className="ss-vital" label="…" value={…} format={…} size="sm" tone={…} />
```

- [ ] **Step 2: Session — wrap hero with `HeroCard`**

Find:

```tsx
<div className={`ss-hero ss-hero--${…}`}>
  <div className="ss-hero__body wt-hero-shell">
```

Replace outer shell with:

```tsx
<HeroCard tone={heroTone === 'neutral' ? 'info' : heroTone} className={`ss-hero ss-hero--${heroTone}`}>
  <div className="ss-hero__body wt-hero-shell">
    {/* unchanged inner */}
  </div>
</HeroCard>
```

Map page tone → `HeroTone` (`'ok' | 'warn' | 'danger' | 'info' | 'accent' | 'neutral'`). If page uses `'default'`, map to `'info'`.

- [ ] **Step 3: Startup — delete local VitalTile (~610+); use shared with `text` / null value**

```tsx
<VitalTile className="su-vital" label="…" value={…} text={…} size="sm" tone={…} format={…} />
```

Do **not** wrap Startup hero again if it already uses `HeroCard` (it does).

- [ ] **Step 4: Typecheck + commit**

```bash
cd web/dashboard && npx tsc -b --pretty false
git add web/dashboard/src/features/session/view.tsx web/dashboard/src/features/startup/view.tsx
git commit -m "$(cat <<'EOF'
refactor(dashboard): shared VitalTile on Session Startup; Session HeroCard

EOF
)"
```

---

### Task 5: Insights — skeletons + quiet heroes to plate tokens

**Files:**
- Modify: `web/dashboard/src/features/insights/view.tsx` (`rounded-xl` skeleton → `rounded-[var(--radius-wt)]`)
- Modify: `web/dashboard/src/features/insights/panels/storage.tsx` (skeleton `rounded-xl`)
- Modify: `web/dashboard/src/features/insights/panels/digest.tsx` (ensure hero uses plate/HeroCard, not ad-hoc shadow soup)
- Modify: `web/dashboard/src/features/insights/panels/mod-changes.tsx` (quiet heroes → `wt-plate` or `HeroCard`)
- Modify: `web/dashboard/src/features/insights/panels/configs.tsx` if `wt-hero-shell` banner lacks plate tokens
- Keep: `PillNav` unchanged

**Interfaces:**
- Consumes: `HeroCard` / `.wt-plate`
- Produces: no `rounded-xl` under `features/insights/` (except none)

- [ ] **Step 1: Replace skeleton radii in `insights/view.tsx` and `storage.tsx`**

```tsx
// before
className="… animate-pulse rounded-xl …"
// after
className="… animate-pulse rounded-[var(--radius-wt)] …"
```

- [ ] **Step 2: Align digest / mod-changes / configs banners**

For quiet banners currently like:

```tsx
<div className="… wt-hero-shell relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 p-5">
```

Add `wt-plate` (or `shadow-[var(--wt-shadow)]` if not redundant) — do not introduce glow unless status-toned. Status-toned banners may use:

```tsx
<HeroCard tone="warn" className="…">
  <div className="wt-hero-shell …">…</div>
</HeroCard>
```

- [ ] **Step 3: Grep insights for remaining `rounded-xl`**

```bash
rg "rounded-xl|rounded-2xl" web/dashboard/src/features/insights
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add web/dashboard/src/features/insights
git commit -m "$(cat <<'EOF'
fix(dashboard): Insights plate radii and skeleton chrome

EOF
)"
```

---

### Task 6: Spark CSS — kill rem-soup radii and shadow forks

**Files:**
- Modify: `web/dashboard/src/features/spark/spark.css`

**Interfaces:**
- Consumes: `--radius-wt`, `--radius-wt-sm`, `--radius-wt-lg`, `--wt-shadow`
- Produces: no `.85rem` / `.7rem` / `14px` card radii; no `--wt-shadow-lg` resting cards; keep `999px` only on true pills/toggles

- [ ] **Step 1: Replace card/control rem radii**

In `spark.css`, replace patterns used on cards/panels (not `999px` pills):

| Find (examples) | Replace |
|---|---|
| `border-radius: .85rem` | `border-radius: var(--radius-wt)` |
| `border-radius: .8rem` | `border-radius: var(--radius-wt)` |
| `border-radius: .75rem` | `border-radius: var(--radius-wt)` |
| `border-radius: .7rem` | `border-radius: var(--radius-wt)` |
| `border-radius: .65rem` | `border-radius: var(--radius-wt)` |
| `border-radius: .55rem` | `border-radius: var(--radius-wt-sm)` |
| `border-radius: var(--border-radius, 14px)` | `border-radius: var(--radius-wt)` |
| `box-shadow: var(--wt-shadow-lg, var(--wt-shadow))` | `box-shadow: var(--wt-shadow)` |

Leave `border-radius: 999px` and `border-radius: 0` alone.

- [ ] **Step 2: Verify with rg**

```bash
rg "border-radius:\s*\." web/dashboard/src/features/spark/spark.css
rg "wt-shadow-lg|14px" web/dashboard/src/features/spark/spark.css
```

Expected: no rem decimal card radii left; no `wt-shadow-lg` / `14px` fallbacks on chrome.

- [ ] **Step 3: Preview Spark tab briefly** (`npm run preview` → Spark) — cards look squared-off, not soft SaaS.

- [ ] **Step 4: Commit**

```bash
git add web/dashboard/src/features/spark/spark.css
git commit -m "$(cat <<'EOF'
fix(dashboard): Spark plate radii and shadow tokens

EOF
)"
```

---

### Task 7: Logs — skeletons + CSS rem radii / shadow stacks

**Files:**
- Modify: `web/dashboard/src/features/logs/view.tsx`
- Modify: `web/dashboard/src/features/logs/logs.css`

**Interfaces:**
- Consumes: `--radius-wt*`, `--wt-shadow`
- Produces: no `rounded-xl` in logs view; card radii use tokens; Flat-at-Rest on panels

- [ ] **Step 1: Replace `rounded-xl` skeletons in `logs/view.tsx` with `rounded-[var(--radius-wt)]`**

- [ ] **Step 2: In `logs.css`, map rem soup to tokens**

| Find | Replace |
|---|---|
| `border-radius: 0.45rem` | `border-radius: var(--radius-wt)` |
| `border-radius: 0.4rem` | `border-radius: var(--radius-wt)` |
| `border-radius: 0.2rem` | `border-radius: var(--radius-wt-sm)` |

Inspect multi-layer `box-shadow:` on panel chrome (~lines 51–63). If it is not a focus ring, collapse to `var(--wt-shadow)` or hairline inset only. Keep intentional focus/selection inset rings that use accent mix.

- [ ] **Step 3: Commit**

```bash
git add web/dashboard/src/features/logs
git commit -m "$(cat <<'EOF'
fix(dashboard): Logs plate radii and skeleton chrome

EOF
)"
```

---

### Task 8: Backups + Activity + Sources — `HeroCard` wrappers

**Files:**
- Modify: `web/dashboard/src/features/backups/view.tsx`
- Modify: `web/dashboard/src/features/activity/view.tsx`
- Modify: `web/dashboard/src/features/sources/view.tsx`
- Optionally touch matching `*.css` only if outer glow/border double-draws after wrap

**Interfaces:**
- Consumes: `HeroCard` from `@/ui/patterns`
- Produces: all three heroes use `HeroCard`; keep inner `*-hero__body wt-hero-shell` and local `Kpi` components

- [ ] **Step 1: Backups**

Import `HeroCard`. Replace:

```tsx
<div className={`bu-hero bu-hero--${heroTone}`}>
  <div className="bu-hero__body wt-hero-shell">
```

with:

```tsx
<HeroCard
  tone={heroTone === 'info' ? 'info' : heroTone === 'ok' ? 'ok' : heroTone === 'warn' ? 'warn' : heroTone === 'danger' ? 'danger' : 'info'}
  className={`bu-hero bu-hero--${heroTone}`}
>
  <div className="bu-hero__body wt-hero-shell">
    {/* unchanged */}
  </div>
</HeroCard>
```

Do not convert `Kpi` to `VitalTile`.

- [ ] **Step 2: Activity — same wrap pattern (`ac-hero` / `ac-hero__body`)**

- [ ] **Step 3: Sources — same wrap pattern (`src-hero` / `src-hero__body`)**

- [ ] **Step 4: Typecheck + commit**

```bash
cd web/dashboard && npx tsc -b --pretty false
git add web/dashboard/src/features/backups/view.tsx web/dashboard/src/features/activity/view.tsx web/dashboard/src/features/sources/view.tsx
git commit -m "$(cat <<'EOF'
refactor(dashboard): HeroCard on Backups Activity Sources

EOF
)"
```

---

### Task 9: Settings — `.wt-form-row` + kill `rounded-xl`

**Files:**
- Modify: `web/dashboard/src/features/settings/view.tsx`
- Modify: `web/dashboard/src/features/settings/audit-log-panel.tsx` (skeleton `rounded-xl`)

**Interfaces:**
- Consumes: `.wt-form-row` from `index.css`
- Produces: zero `rounded-xl` under `features/settings/`

- [ ] **Step 1: Replace form row classNames**

Common before:

```tsx
className={`… rounded-xl border border-wt-line bg-wt-bg2/50 px-4 py-3 …`}
```

After:

```tsx
className={`… wt-form-row …`}
```

(Adjust padding utilities if `.wt-form-row` already sets padding — drop duplicate `px-4 py-3` when redundant.)

For nested panels using `rounded-xl border … bg-wt-bg2/40 p-4`:

```tsx
className="space-y-3 wt-form-row p-4"
```

or `rounded-[var(--radius-wt)]` + existing border/bg if structure differs.

- [ ] **Step 2: Skeletons**

```tsx
// before
className="h-10 w-96 animate-pulse rounded-xl bg-wt-bg2"
// after
className="h-10 w-96 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2"
```

Same in `audit-log-panel.tsx`.

- [ ] **Step 3: Confirm clean**

```bash
rg "rounded-xl|rounded-2xl" web/dashboard/src/features/settings
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add web/dashboard/src/features/settings
git commit -m "$(cat <<'EOF'
fix(dashboard): Settings form rows use wt-form-row tokens

EOF
)"
```

---

### Task 10: Docs + Roadmap light token pass

**Files:**
- Modify: `web/dashboard/src/features/docs/docs.css` (remove soft fallbacks like `var(--radius-wt, 0.875rem)` → `var(--radius-wt)`; map `0.3rem` → `--radius-wt-sm`)
- Modify: `web/dashboard/src/features/roadmap/roadmap.css` only if drift found (already mostly tokens)

**Interfaces:**
- Consumes: `--radius-wt*`
- Produces: no `0.875rem` fallbacks pretending to be `--radius-wt`

- [ ] **Step 1: Docs CSS fallback cleanup**

```css
/* before */
border-radius: var(--radius-wt, 0.875rem);
/* after */
border-radius: var(--radius-wt);
```

```css
/* before */
border-radius: 0.3rem;
/* after */
border-radius: var(--radius-wt-sm);
```

Keep intentional `999px` on docs chips/pills if they are true pills.

- [ ] **Step 2: Commit**

```bash
git add web/dashboard/src/features/docs/docs.css web/dashboard/src/features/roadmap/roadmap.css
git commit -m "$(cat <<'EOF'
fix(dashboard): Docs radius token fallbacks

EOF
)"
```

---

### Task 11: Operator chrome — Boot, Auth, Wizard

**Files:**
- Modify: `web/dashboard/src/app/boot.tsx`
- Modify: `web/dashboard/src/app/auth-gate.tsx`
- Modify: `web/dashboard/src/features/wizard/view.tsx`
- Modify: `web/dashboard/src/features/support/bundle-builder-modal.tsx` and/or `support.css` if missing `overscroll-behavior: contain` on the modal scroller

**Interfaces:**
- Consumes: `.wt-form-row`, `--radius-wt`
- Produces: zero `rounded-xl` on boot/auth/wizard; auth fields have labels + autocomplete; focus-visible on auth inputs; support modal contains overscroll

- [ ] **Step 1: Boot icon radius**

```tsx
// before
className="rounded-xl"
// after
className="rounded-[var(--radius-wt)]"
```

Boot logo `img` already has `alt=""` (decorative) — keep it.

- [ ] **Step 2: Auth gate — radius + focus + form craft**

Field class helper — replace `rounded-xl` and bare `outline-none` with token radius + focus-visible ring:

```ts
return 'mt-1 w-full rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg2 px-3 py-2 text-sm outline-none focus-visible:border-wt-accent focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--wt-accent)_35%,transparent)]';
```

Ensure each input has a visible `<label>` (or `aria-label`), `name`, and auth-appropriate `autoComplete` (`username` / `current-password`). Set `spellCheck={false}` on username. Submit button: disable while request pending; label uses `…` if showing progress (`Signing in…`).

Also replace any card/`rounded-xl` on the auth panel shell with `rounded-[var(--radius-wt)]` or `.wt-plate`.

- [ ] **Step 3: Wizard — bulk replace form shells**

Replace `rounded-xl border border-wt-line bg-wt-bg2/50` / `bg-wt-bg2/40` blocks with `wt-form-row` (or `rounded-[var(--radius-wt)]` + same border/bg). Replace input `rounded-xl` with `rounded-[var(--radius-wt)]`. Keep pending buttons disabled; loading copy uses `…`.

```bash
rg "rounded-xl|rounded-2xl" web/dashboard/src/features/wizard web/dashboard/src/app/boot.tsx web/dashboard/src/app/auth-gate.tsx
```

Expected: no matches.

- [ ] **Step 4: Support modal overscroll**

On the modal panel / scroll body in `bundle-builder-modal.tsx` or `support.css`, ensure:

```css
overscroll-behavior: contain;
```

Do not restyle the modal into Double-Bezel / pill chrome.

- [ ] **Step 5: Commit**

```bash
git add web/dashboard/src/app/boot.tsx web/dashboard/src/app/auth-gate.tsx web/dashboard/src/features/wizard/view.tsx web/dashboard/src/features/support
git commit -m "$(cat <<'EOF'
fix(dashboard): boot auth wizard plate radii and form craft

EOF
)"
```

---

### Task 12: Overview / Live / remaining banlist sweep + test green

**Files:**
- Modify: any remaining in-scope offenders reported by the banlist
- Touch Overview/Live only if grep finds `rounded-xl` or shadow forks (they are largely already on `HeroCard` / `.wt-plate`)

**Interfaces:**
- Consumes: banlist test from Task 1 (radii + `transition-all`)
- Produces: `npm run test:ui-consistency` PASS for both suites

- [ ] **Step 1: Run banlist**

```bash
cd web/dashboard && npm run test:ui-consistency
```

Expected: PASS. If FAIL, fix each listed file:
- Radii → `rounded-[var(--radius-wt)]` / `.wt-form-row` / `.wt-plate`
- `transition-all` / `transition: all` → explicit properties (e.g. `transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150` or the existing property list on that rule)


- [ ] **Step 2: Optional Overview/Live visual spot-check** — mission heroes still glow; plates still Flat-at-Rest.

- [ ] **Step 3: Commit only if fixes landed**

```bash
git add -u web/dashboard/src
git commit -m "$(cat <<'EOF'
fix(dashboard): clear remaining radius banlist offenders

EOF
)"
```

---

### Task 13: Preview QA gate (manual) + WIG craft audit

**Files:** none required (checklist only); fix regressions if found, then commit those fixes separately

**Interfaces:**
- Consumes: `npm run preview` on port 8081; spec § Craft quality bar
- Produces: checked walkthrough of every in-scope surface; craft checklist signed off

- [ ] **Step 1: Start preview**

```bash
cd web/dashboard && npm run preview
```

- [ ] **Step 2: Dark theme — walk every surface**

Rail: Overview, Live, Insights (all PillNav views), Session, Startup, Issues, Crashes, Spark, Logs, Mods, Backups, Activity, Sources, Docs, Roadmap, Settings (sample 3 panels including general + backups + security).

Chrome: boot/loading if reachable; Auth gate (sign out); Wizard via `npm run preview:fresh` if needed; Support pack modal from shell footer.

Visual parity per surface:
- Plate corners ~4px; Flat-at-Rest shadow; heroes use `HeroCard` where required
- No soft SaaS cards / Double-Bezel / pill CTAs
- Shared `Button` / specular CTAs; skeleton radii match plates

- [ ] **Step 3: Light + black spot-check (contrast)**

Cycle theme on Overview, Settings, Spark, Auth:
- Form rows / plates still separate from page bg
- Mid/low text readable (≈4.5:1 on body)
- Borders visible in light (not `white/10`-invisible)
- Native inputs keep explicit bg/text in black theme

- [ ] **Step 4: Craft / WIG spot audit on touched chrome**

While walking Auth, Wizard, Settings, Support modal, Issues/Crashes toolbars:

| Check | Pass if |
|---|---|
| Focus | Tab shows `:focus-visible` ring; no control with bare `outline-none` and no ring |
| Icon-only | Every icon-only button has `aria-label` |
| Forms | Labels present; auth `autoComplete` set; username `spellCheck={false}` |
| Loading | Pending primary actions disabled; labels use `…` |
| Motion | Prefer-reduced-motion: hero glow/enters calm; no new `transition: all` |
| Modal | Support modal does not scroll-chain the page (`overscroll-behavior: contain`) |
| Flex overflow | Long mod/path strings in rows we touched do not blow horizontal layout (`min-w-0`) |
| Reject list | No 2rem squircles, glass orbs, island nav, or new font families |

Grep assist:

```bash
rg "outline-none" web/dashboard/src/app/auth-gate.tsx web/dashboard/src/features/settings web/dashboard/src/features/wizard
rg "backdrop-blur" web/dashboard/src/features --glob '!**/visuals/**' --glob '!**/lab/**'
rg "rounded-\[2rem\]|rounded-3xl|rounded-full" web/dashboard/src/features/settings web/dashboard/src/features/wizard web/dashboard/src/app
```

`rounded-full` on true toggles/PillNav is fine; flag it on cards/primary CTAs.

- [ ] **Step 5: Re-run banlist + typecheck**

```bash
cd web/dashboard && npm run test:ui-consistency && npx tsc -b --pretty false
```

Expected: both PASS (radii + `transition-all` suites).

- [ ] **Step 6: If QA fixes were needed, commit them**

```bash
git add -u web/dashboard/src
git commit -m "$(cat <<'EOF'
fix(dashboard): UI consistency QA follow-ups

EOF
)"
```

---

### Task 14: Expand `DESIGN.md` into the deep canonical system

**Files:**
- Modify: `DESIGN.md` (root — YAML frontmatter + full prose)
- Cross-check against: `web/dashboard/src/index.css`, `web/dashboard/src/ui/patterns/index.tsx`, `web/dashboard/src/ui/patterns/hero-card.tsx`, `web/dashboard/src/app/theme.tsx`, `web/dashboard/src/app/accents.ts`, `docs/superpowers/specs/2026-08-02-dashboard-ui-consistency-design.md`

**Interfaces:**
- Consumes: post-pass dashboard reality (Tasks 1–13 done)
- Produces: `DESIGN.md` as the single deep design system future agents call back on — matches how WatchTower looks after this pass; no parallel aspirational brand

- [ ] **Step 1: Audit live tokens vs frontmatter**

Read `web/dashboard/src/index.css` CSS variables (`--wt-*`, `--radius-wt*`, `--wt-fs-*`, `--wt-shadow`, themes). Update YAML frontmatter in `DESIGN.md` so every color/type/radius/spacing value matches live tokens (including light/black variants already listed). Add any missing component entries for primitives now in code:

```yaml
components:
  # keep existing button-primary, plate-card, rail-nav, metric-readout, chip-status
  hero-card:
    backgroundColor: "{colors.bg1-dark}"
    rounded: "{rounded.md}"
    # glowIntensity ~0.55; status-keyed BorderGlow
  form-row:
    backgroundColor: "{colors.bg2-dark}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  vital-tile:
    typography: "{typography.mono}"
    rounded: "{rounded.sm}"
```

(Adjust hex/token refs to match actual CSS after the pass.)

- [ ] **Step 2: Rewrite / expand prose into a deep system**

Replace/extend the markdown body of `DESIGN.md` so it is a complete call-back document. Required sections (use these headings):

```markdown
# Design System: WatchTower

## Overview
## How to use this document
## Creative north star
## Color system
## Typography
## Spacing & density
## Shape & radius
## Elevation, plates & shadows
## Themes & accents
## Motion
## Accessibility & interaction craft
## Shared primitives (code map)
## Page patterns
## Navigation patterns
## Forms & settings rows
## Empty, error & loading
## Copy & voice
## Allowed exceptions
## Reject list (do not ship)
## Do's and Don'ts
## Repo file map
```

Content rules for Step 2:

- **How to use:** Agents and humans treat this file as law for dashboard UI. Generic high-end/SaaS skills inform craft only when they do not contradict this document.
- **Primitives:** Document exact export/class names and file paths:
  - `.wt-plate`, `.wt-form-row`, `.wt-specular-cta` → `web/dashboard/src/index.css`
  - `HeroCard`, `VitalTile`, `MetricReadout`, `Button`, `SpecularCtaButton`, `EmptyState`, `ErrorState`, `StatusPill`, `Section`, `HeroTabNav` → `web/dashboard/src/ui/patterns/`
  - `PillNav` → `web/dashboard/src/components/pill-nav/`
- **Page patterns:** Mission hero (`HeroCard` + `wt-hero-shell`); list+detail inboxes; Insights `PillNav` segments; Settings/Wizard `.wt-form-row`; operator chrome (boot/auth/wizard/support).
- **Allowed exceptions:** `999px` for PillNav / scroll thumbs / toggles; `StatusPill` uses `--radius-wt-sm`; hero glow ~0.55; specular CTA shadows on primary CTAs only.
- **Reject list:** Copy from the consistency spec (Double-Bezel / `rounded-[2rem]`, floating island nav, full-pill primary CTAs, purple/indigo glass orbs, heavy blur on scrolling cards, marketing `py-24+`, new fonts/icon sets, `rounded-xl`/`rounded-2xl` plates, `transition: all`).
- **Motion / a11y:** `transform`/`opacity` only; `prefers-reduced-motion`; `:focus-visible`; no bare `outline-none`; icon-only `aria-label`; loading `…`; modal `overscroll-behavior: contain`.
- **Copy:** sentence case; spell **WatchTower**; advisory-only product constraint (no pretend auto-restart/download/world mutation).
- Keep personality **precise** Night Watch Desk — do not rewrite into a different aesthetic.

- [ ] **Step 3: Cross-link from the consistency spec**

At the top of `docs/superpowers/specs/2026-08-02-dashboard-ui-consistency-design.md`, add one line after the status header:

```markdown
**Canonical system after this pass:** [`DESIGN.md`](../../../DESIGN.md) (deep design system — call this back for all future dashboard UI).
```

- [ ] **Step 4: Self-check DESIGN.md**

Skim for placeholders (`TBD`, `TODO`), contradictions with `index.css`, or leftover “aspirational” radii/shadows that the banlist now forbids. Fix inline.

- [ ] **Step 5: Commit**

```bash
git add DESIGN.md docs/superpowers/specs/2026-08-02-dashboard-ui-consistency-design.md
git commit -m "$(cat <<'EOF'
docs: deepen DESIGN.md as WatchTower dashboard system of record

EOF
)"
```

| Spec requirement | Task |
|---|---|
| Cohesion contract / ban `rounded-xl` | 1, 9, 11, 12 |
| Ban `transition-all` | 1, 12 |
| Shared `VitalTile` + delete locals | 2, 3, 4 |
| `.wt-form-row` / Settings | 2, 9 |
| HeroCard on Backups/Session/Activity/Sources | 4, 8 |
| Insights keep PillNav; plate banners | 5 |
| Spark rem radii / shadow | 6 |
| Logs chrome | 7 |
| Docs/Roadmap | 10 |
| Boot/Auth/Wizard/Support (+ form/focus/overscroll craft) | 11 |
| Craft quality bar / WIG / a11y / contrast QA | 13 |
| Expand `DESIGN.md` into deep canonical system | 14 |
| Reject Double-Bezel / glass / pill CTAs | Global Constraints + Task 13 reject greps + Task 14 Reject list |
| React: no memo churn / no inline PageView components | Global Constraints + Tasks 2–4, 8 |
| No Visuals/lab/marketing | Global Constraints + banlist allowlist |
| Leave Backups `Kpi` alone | Task 8 note |

**Placeholder scan:** none intentional.  
**Type consistency:** `VitalTileProps` as defined in Task 2; HeroTone mapping documented in Tasks 4/8.

---

## Plain English

When this plan is done, the dashboard and login/setup/support screens share the same sharp card corners, quiet shadows, metric tiles, and hero framing — Settings/Spark/wizard stop looking like a different soft product — without changing what any page does. Focus, forms, motion, and contrast get the same consistency pass so it feels machined, not just restyled. Then `DESIGN.md` is expanded into the deep system of record that matches that look, so future work calls it back instead of inventing a parallel aesthetic.
