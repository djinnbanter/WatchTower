# Overview Critique Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every Overview critique finding (P1–P3) so CRITICAL Overview is one Fix path — mission → next action → Needs attention — with quieter secondary CTAs, clear grade copy, smarter collapses, and matching shell/a11y polish.

**Architecture:** Prefer pure helpers in `mission-status.ts` (and a shared view-only title constant) so behavior is unit-tested with `tsx --test`. Keep JSX changes in `overview/view.tsx` + light CSS. Shell active-rail and WatchTower spelling are separate, small chrome edits. No backend changes — `scorecard.grade_reasons` already ships.

**Tech Stack:** React 19 dashboard (`web/dashboard`), Vite preview on `:8081`, `tsx --test` + `node:test`/`node:assert` (same pattern as `mission-status.test.ts`), Tailwind + `--wt-*` tokens, Impeccable design critique backlog.

## Global Constraints

- Product spelling in UI chrome: **WatchTower** (never “Watchtower” in user-visible strings you touch).
- Operate / Night Watch Desk: triage over spectacle; Signal Blue scarce (one primary CTA on Overview under stress).
- Advisory only — do not imply the UI restarts the server or mutates the pack.
- Themes remain light / dark / black only (no Skin switcher).
- Channel colours ≠ status colours (do not restyle vital channel dots).
- Respect `prefers-reduced-motion` if adding any motion (prefer none in this pass).
- Critique source of truth: `.impeccable/critique/2026-07-30T08-53-51Z__web-dashboard-src-features-overview-view-tsx.md`.

## Impeccable command map

Run these as the **intent labels** for each task (user asked for the full critique action list). Implementation is the code below; the command name is what the critique recommended.

| Task | Impeccable command | Critique items |
|------|--------------------|----------------|
| 1 | `/impeccable distill` | P1 incident choice overload — demote story/digest |
| 2 | `/impeccable quieter` | P1 peer primary CTAs — ghost instrument/story/digest buttons |
| 3 | `/impeccable layout` | P2 story open / lag collapsed defaults in incident |
| 4 | `/impeccable clarify` | P2 opaque grade letter + nextAction label bug + headline echo |
| 5 | `/impeccable polish` | P3 solid Signal Blue active rail + WatchTower spelling |
| 6 | `/impeccable audit` | P3 a11y collapses + lag `+N` routing consistency |
| 7 | `/impeccable polish` then `/impeccable critique` | Final pass + rescore Overview |

---

## File map

| File | Responsibility |
|------|----------------|
| `web/dashboard/src/features/overview/mission-status.ts` | Add `openTabLabel`, `gradeReasonTeasers` (testable) |
| `web/dashboard/src/features/overview/mission-status.test.ts` | Unit tests for new helpers |
| `web/dashboard/src/features/overview/view.tsx` | Incident order, CTAs, defaults, grade teaser UI, aria, lag overflow |
| `web/dashboard/src/features/overview/overview.css` | Optional teaser / history spacing; drop dead specular instrument rules if unused |
| `web/dashboard/src/app/permissions.ts` | Export shared `VIEW_ONLY_TITLE` with WatchTower spelling |
| `web/dashboard/src/app/shell.tsx` | Active rail solid accent; import shared title |
| Multiple feature files with local `VIEW_ONLY_TITLE` | Import shared constant (Task 5) |

---

### Task 1: Distill incident triage (`/impeccable distill`)

**Files:**
- Modify: `web/dashboard/src/features/overview/view.tsx` (triage block ~1099–1248 vs instruments ~1252–1650)
- Modify: `web/dashboard/src/features/overview/overview.css` only if a spacer class is needed

**Interfaces:**
- Consumes: existing `layoutMode`, `hasStory`, `hasDigest`, `hasLag`, `storyOpen` / `setStoryOpen`
- Produces: In `layoutMode === 'incident'`, triage column renders Needs attention → Right now → Lag only; story + digest render **after** the instrument stack. Steady mode keeps story + digest in the triage column as today.

- [ ] **Step 1: Extract story and digest plates into render helpers inside the component**

Above the main return (or immediately before the grid), define two local functions or `const` JSX factories so each plate is written once:

```tsx
const renderStoryPlate = () =>
  hasStory ? (
    <article className={`${PLATE} ov-instrument--story`}>
      {/* existing PlateHead + body from current story block */}
    </article>
  ) : null;

const renderDigestPlate = () =>
  hasDigest ? (
    <article className={`${PLATE} ov-instrument--digest`}>
      {/* existing digest block */}
    </article>
  ) : null;
```

Move the current story (~1099–1127) and digest (~1129–1203) JSX into those helpers. Do not change CTA kinds yet (Task 2).

- [ ] **Step 2: Wire placement by layoutMode**

In the **triage** column:

```tsx
{layoutMode !== 'incident' ? (
  <>
    {renderStoryPlate()}
    {renderDigestPlate()}
  </>
) : null}
```

Keep Lag in triage for incident (after attention / Right now).

After the instrument column finishes rendering its plates (after Restart/Storage / steady collapse controls — end of metrics column), append:

```tsx
{layoutMode === 'incident' ? (
  <div className="ov-history-stack space-y-3">
    {renderStoryPlate()}
    {renderDigestPlate()}
  </div>
) : null}
```

Put `ov-history-stack` inside the metrics column wrapper so it scrolls with instruments, **below** instrument cards.

- [ ] **Step 3: Manual check (distill)**

Run: `npm run preview` from `web/dashboard` (or use existing `:8081`). Open `/?tab=overview` with a CRITICAL / attention-heavy mock.

Expected:
- Needs attention (+ Right now / Lag) appear in the left triage column.
- Incident story and Weekly digest appear **below** Performance/Spark/Boot/etc., not beside Needs attention.
- Steady/healthy Overview: story/digest still in the secondary column as before.

- [ ] **Step 4: Commit**

```bash
git add web/dashboard/src/features/overview/view.tsx web/dashboard/src/features/overview/overview.css
git commit -m "$(cat <<'EOF'
fix(overview): demote story and digest below instruments in incident mode

EOF
)"
```

---

### Task 2: Quieter secondary CTAs (`/impeccable quieter`)

**Files:**
- Modify: `web/dashboard/src/features/overview/view.tsx` (Button `kind="primary"` sites)
- Modify: `web/dashboard/src/features/overview/overview.css` — remove unused `.ov-insight-row .ov-specular-cta` / `.ov-boot__foot .ov-specular-cta` rules if present (~1559–1566)

**Interfaces:**
- Consumes: `SpecularCtaButton`, `Button`
- Produces: Only `ov-next` and first-run Live keep `SpecularCtaButton kind="primary"`. Story, digest, Performance, Spark, Boot use `Button kind="ghost"`.

- [ ] **Step 1: Downgrade primary Buttons**

Replace `kind="primary"` with `kind="ghost"` at these call sites in `view.tsx`:

| Approx line | Label | Keep Specular? |
|-------------|-------|----------------|
| ~665 | first-run Live | **Yes — leave Specular primary** |
| ~979 | ov-next | **Yes — leave Specular primary** |
| ~1120 | Open Activity | ghost |
| ~1195 | Open Digest | ghost |
| ~1270 | Open Insights (Performance) | ghost |
| ~1295 | Spark CTA | ghost |
| ~1375 | Open Startup | ghost |

Example:

```tsx
<Button kind="ghost" onClick={() => navigate({ tab: 'activity' })}>
  Open Activity
</Button>
```

- [ ] **Step 2: CSS cleanup**

Delete Overview CSS that styles instrument Specular CTAs if nothing uses `ov-specular-cta` outside `ov-next` / first-run. Grep `ov-specular-cta` in `overview.css` and `view.tsx` before deleting.

- [ ] **Step 3: Manual check (quieter)**

Expected on CRITICAL Overview: **one** Signal Blue filled primary at `ov-next`. Instrument / story / digest footers look like secondary links (ghost).

- [ ] **Step 4: Commit**

```bash
git add web/dashboard/src/features/overview/view.tsx web/dashboard/src/features/overview/overview.css
git commit -m "$(cat <<'EOF'
fix(overview): demote instrument CTAs to ghost so ov-next is the only primary

EOF
)"
```

---

### Task 3: Incident collapse defaults (`/impeccable layout`)

**Files:**
- Modify: `web/dashboard/src/features/overview/view.tsx` (~501–502 and near `layoutMode`)

**Interfaces:**
- Consumes: `layoutMode` (`'incident' | 'steady'`)
- Produces: Entering incident forces `lagOpen === true` and `storyOpen === false`. Steady does not force-open story.

- [ ] **Step 1: Change initial state**

```tsx
const [lagOpen, setLagOpen] = useState(true);
const [storyOpen, setStoryOpen] = useState(false);
```

- [ ] **Step 2: Sync when layoutMode becomes incident**

Place after `layoutMode` is computed (must be inside the component body that already has `layoutMode` — if hooks order forbids placing effect after early returns, compute a boolean `isIncident` earlier or move the effect above any conditional return). Prefer computing layout flags before any early return, or use:

```tsx
useEffect(() => {
  if (layoutMode === 'incident') {
    setLagOpen(true);
    setStoryOpen(false);
  }
}, [layoutMode]);
```

If `layoutMode` is only available after an early return for loading/error, extract the incident predicate into a memoized boolean available before that return, and key the effect on that boolean.

- [ ] **Step 3: Manual check (layout)**

CRITICAL Overview: Lag plate expanded by default; Incident story collapsed (Expand available). Expanding story manually must still work. Healthy Overview: no Lag plate; story may stay collapsed until user expands (acceptable).

- [ ] **Step 4: Commit**

```bash
git add web/dashboard/src/features/overview/view.tsx
git commit -m "$(cat <<'EOF'
fix(overview): expand lag and collapse story by default in incident mode

EOF
)"
```

---

### Task 4: Clarify grade + nextAction labels (`/impeccable clarify`)

**Files:**
- Modify: `web/dashboard/src/features/overview/mission-status.ts`
- Modify: `web/dashboard/src/features/overview/mission-status.test.ts`
- Modify: `web/dashboard/src/features/overview/view.tsx` (mission band ~861–891, nextAction ~786–797, headline ~716–721)
- Modify: `web/dashboard/src/features/overview/overview.css` (teaser styles)

**Interfaces:**
- Consumes: `scorecard.grade_reasons`, `attentionFromGradeReasons`, `navigate`
- Produces:
  - `openTabLabel(tab: string): string`
  - `gradeReasonTeasers(reasons: unknown, limit?: number): string[]`
  - Mission band shows ≤2 teaser lines + “How grading works” → `docs` / `Dashboard-Overview`
  - `nextAction.label` uses `openTabLabel(topAttention.tab)`

- [ ] **Step 1: Write failing tests**

Append to `mission-status.test.ts`:

```ts
import { openTabLabel, gradeReasonTeasers } from './mission-status.ts';

describe('openTabLabel', () => {
  it('maps known tabs to chrome titles', () => {
    assert.equal(openTabLabel('issues'), 'Issues');
    assert.equal(openTabLabel('crashes'), 'Crashes');
    assert.equal(openTabLabel('insights'), 'Insights');
    assert.equal(openTabLabel('live'), 'Live');
    assert.equal(openTabLabel('backups'), 'Backups');
    assert.equal(openTabLabel('activity'), 'Activity');
    assert.equal(openTabLabel('startup'), 'Startup');
  });

  it('title-cases unknown tabs instead of lying about Backups', () => {
    assert.equal(openTabLabel('mods'), 'Mods');
    assert.equal(openTabLabel(''), 'Details');
  });
});

describe('gradeReasonTeasers', () => {
  it('returns up to two plain messages in order', () => {
    const lines = gradeReasonTeasers(
      [
        { code: 'a', message: 'First reason', severity: 'warning', tab: 'insights' },
        { code: 'b', message: 'Second reason', severity: 'critical', tab: 'crashes' },
        { code: 'c', message: 'Third reason', severity: 'warning', tab: 'issues' },
      ],
      2,
    );
    assert.deepEqual(lines, ['First reason', 'Second reason']);
  });

  it('skips malformed rows', () => {
    assert.deepEqual(gradeReasonTeasers([{ code: 'x' }]), []);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run from `web/dashboard`:

```bash
npx tsx --test src/features/overview/mission-status.test.ts
```

Expected: FAIL — `openTabLabel` / `gradeReasonTeasers` not exported.

- [ ] **Step 3: Implement helpers in mission-status.ts**

```ts
const TAB_LABELS: Record<string, string> = {
  issues: 'Issues',
  crashes: 'Crashes',
  insights: 'Insights',
  live: 'Live',
  backups: 'Backups',
  activity: 'Activity',
  startup: 'Startup',
  overview: 'Overview',
  mods: 'Mods',
  session: 'Session',
  spark: 'Spark',
  docs: 'Help',
  settings: 'Settings',
};

export function openTabLabel(tab: string): string {
  const key = tab.trim().toLowerCase();
  if (!key) return 'Details';
  if (TAB_LABELS[key]) return TAB_LABELS[key];
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Plain grade_reason messages for mission-band teaser (not attention rows). */
export function gradeReasonTeasers(reasons: unknown, limit = 2): string[] {
  if (!Array.isArray(reasons)) return [];
  const out: string[] = [];
  for (const raw of reasons) {
    if (!raw || typeof raw !== 'object') continue;
    const message = typeof (raw as { message?: unknown }).message === 'string'
      ? (raw as { message: string }).message.trim()
      : '';
    if (!message) continue;
    out.push(message);
    if (out.length >= limit) break;
  }
  return out;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx tsx --test src/features/overview/mission-status.test.ts
```

Expected: PASS.

- [ ] **Step 5: Wire nextAction label**

In `view.tsx`, import `openTabLabel` and `gradeReasonTeasers`. Replace:

```tsx
label: `Open ${topAttention.tab === 'issues' ? 'Issues' : topAttention.tab === 'crashes' ? 'Crashes' : 'Backups'}`,
```

with:

```tsx
label: `Open ${openTabLabel(topAttention.tab)}`,
```

- [ ] **Step 6: Mission-band grade teaser + Help link**

Near mission subcopy (under hostname / grade word area ~861–891), after computing:

```tsx
const gradeTeasers = gradeReasonTeasers(scorecard.grade_reasons, 2).filter(
  (line) => !nextAction || line !== nextAction.hint,
);
```

Render when `gradeTeasers.length > 0` or whenever grade is not healthy:

```tsx
{(gradeTeasers.length > 0 || tone !== 'ok') && (
  <div className="ov-grade-teaser">
    {gradeTeasers.map((line) => (
      <p key={line} className="ov-grade-teaser__line">
        {line}
      </p>
    ))}
    <button
      type="button"
      className="ov-grade-teaser__help"
      onClick={() => navigate({ tab: 'docs', wiki: 'Dashboard-Overview' })}
    >
      How grading works
    </button>
  </div>
)}
```

Add CSS (muted, compact — not another hero plate):

```css
.ov-grade-teaser {
  margin-top: 0.5rem;
  max-width: 36rem;
}
.ov-grade-teaser__line {
  margin: 0;
  font-size: var(--wt-fs-sm, 0.8125rem);
  color: var(--wt-text-mid);
  line-height: 1.4;
}
.ov-grade-teaser__help {
  margin-top: 0.25rem;
  padding: 0;
  border: 0;
  background: none;
  color: var(--wt-accent);
  font-size: var(--wt-fs-sm, 0.8125rem);
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
```

- [ ] **Step 7: Headline echo**

Where mission headline becomes `"Needs attention"` when `layoutMode === 'incident' && attentionDeduped.length` (~716–721), use `displayWord` (Critical / Degraded) instead of repeating the plate title:

```tsx
const missionHeadline =
  layoutMode === 'incident' && attentionDeduped.length
    ? displayWord
    : displayWord;
```

(If both branches are identical, delete the special case and always use `displayWord`.) Keep the Needs attention **plate** title unchanged.

- [ ] **Step 8: Manual check (clarify)**

CRITICAL with grade_reasons: see 1–2 reason lines under the mission band; “How grading works” opens Help Center on Dashboard-Overview. `ov-next` for an insights-tab attention row says **Open Insights**, not Open Backups. Headline is not the duplicate string “Needs attention” above a plate also titled Needs attention.

- [ ] **Step 9: Commit**

```bash
git add web/dashboard/src/features/overview/mission-status.ts web/dashboard/src/features/overview/mission-status.test.ts web/dashboard/src/features/overview/view.tsx web/dashboard/src/features/overview/overview.css
git commit -m "$(cat <<'EOF'
fix(overview): explain grade on the mission band and fix next-action tab labels

EOF
)"
```

---

### Task 5: Shell polish + WatchTower spelling (`/impeccable polish`)

**Files:**
- Modify: `web/dashboard/src/app/permissions.ts` — export `VIEW_ONLY_TITLE`
- Modify: `web/dashboard/src/app/shell.tsx` — active rail + import title
- Modify: every file that defines local `VIEW_ONLY_TITLE` (grep list below) — delete local const, import from `@/app/permissions`

Grep hits to update (all currently say “Watchtower”):

- `web/dashboard/src/app/shell.tsx`
- `web/dashboard/src/features/issues/queue.tsx`
- `web/dashboard/src/features/issues/view.tsx`
- `web/dashboard/src/features/issues/tools.tsx`
- `web/dashboard/src/features/mods/overview-tab.tsx`
- `web/dashboard/src/features/mods/log-errors-tab.tsx`
- `web/dashboard/src/features/backups/local-folder-setup.tsx`
- `web/dashboard/src/features/backups/external-tracking-setup.tsx`
- `web/dashboard/src/features/settings/view.tsx`
- `web/dashboard/src/features/support/bundle-builder-modal.tsx`
- `web/dashboard/src/features/crashes/queue.tsx`
- `web/dashboard/src/features/crashes/view.tsx`
- `web/dashboard/src/features/crashes/tools.tsx`

**Interfaces:**
- Produces: `export const VIEW_ONLY_TITLE = 'Your account can view WatchTower but not change it';`
- Active rail uses solid `--wt-accent` + `--wt-accent-ink` when `active`

- [ ] **Step 1: Add shared constant**

In `permissions.ts`:

```ts
export const VIEW_ONLY_TITLE = 'Your account can view WatchTower but not change it';
```

- [ ] **Step 2: Active rail in shell.tsx**

Replace active className branch:

```tsx
active
  ? 'rounded-[2px] border-transparent bg-wt-accent font-medium text-wt-accent-ink'
  : 'border-transparent text-wt-text-mid hover:bg-wt-bg2/60 hover:text-wt-text',
```

For the icon when active, use `text-wt-accent-ink` (not `text-wt-accent`) so it stays readable on the blue fill. Keep `border-l-2` only if it still looks intentional; preferred DESIGN look is solid fill without a competing left bar — drop `border-l-2` on the active item or set `border-l-2 border-transparent` for layout stability:

```tsx
className={cn(
  'flex items-center gap-2 border-l-2 px-2.5 py-1.5 text-sm transition-colors',
  active
    ? 'border-transparent bg-wt-accent font-medium text-wt-accent-ink'
    : 'border-transparent text-wt-text-mid hover:bg-wt-bg2/60 hover:text-wt-text',
)}
```

- [ ] **Step 3: Replace all local VIEW_ONLY_TITLE copies**

In each file listed above:

```ts
import { VIEW_ONLY_TITLE, useCanWrite /* if already imported */ } from '@/app/permissions';
```

Delete the local `const VIEW_ONLY_TITLE = ...`.

- [ ] **Step 4: Manual check (polish)**

Active Overview rail item is solid Signal Blue with dark ink text. Hover a view-only control: tooltip says **WatchTower**.

- [ ] **Step 5: Commit**

```bash
git add web/dashboard/src/app/permissions.ts web/dashboard/src/app/shell.tsx web/dashboard/src/features
git commit -m "$(cat <<'EOF'
fix(dashboard): solid accent active rail and WatchTower view-only copy

EOF
)"
```

---

### Task 6: Audit collapses + lag overflow (`/impeccable audit`)

**Files:**
- Modify: `web/dashboard/src/features/overview/view.tsx` (story/lag toggles ~1105, ~1211; lag `+N` ~1237; steady instrument expand ~1642)

**Interfaces:**
- Produces: `aria-expanded` (+ `aria-controls` / panel `id`) on story, lag, and steady instrument toggles. Lag overflow navigates to Insights incidents like row Open.

- [ ] **Step 1: Story toggle a11y**

```tsx
<button
  type="button"
  className="ov-collapsible-toggle"
  aria-expanded={storyOpen}
  aria-controls="ov-incident-story-panel"
  onClick={() => setStoryOpen((v) => !v)}
>
  {storyOpen ? 'Collapse' : 'Expand'}
</button>
{storyOpen ? (
  <div id="ov-incident-story-panel" className="ov-story">
    ...
  </div>
) : null}
```

- [ ] **Step 2: Lag toggle a11y**

Same pattern with `id="ov-lag-incidents-panel"` and `aria-expanded={lagOpen}`.

- [ ] **Step 3: Steady instruments toggle**

On the “Show N more…” / “Show less” buttons (~1642–1649), add `aria-expanded={instrumentsExpanded}`.

- [ ] **Step 4: Fix lag overflow destination**

Replace:

```tsx
onClick={() => navigate({ tab: 'issues' })}
```

with:

```tsx
onClick={() => navigate({ tab: 'insights', view: 'patterns', panel: 'incidents' })}
```

Label can stay `+{lagMore} more` or become `+{lagMore} more on Insights` for clarity.

- [ ] **Step 5: Manual check (audit)**

Keyboard: tab to Expand/Collapse; screen reader or DevTools shows `aria-expanded`. Click `+N more` on Lag → Insights patterns/incidents (same as row Open).

- [ ] **Step 6: Commit**

```bash
git add web/dashboard/src/features/overview/view.tsx
git commit -m "$(cat <<'EOF'
fix(overview): aria-expanded on collapses and align lag overflow with Insights

EOF
)"
```

---

### Task 7: Final polish + rescore (`/impeccable polish` + `/impeccable critique`)

**Files:**
- Touch only if verification finds leftovers (no new features)

- [ ] **Step 1: Regression checklist**

From `web/dashboard`:

```bash
npx tsx --test src/features/overview/mission-status.test.ts
npx tsx --test src/features/overview/incident-story-title.test.ts
```

Manual on `:8081/?tab=overview`:

| Mode | Expect |
|------|--------|
| CRITICAL / attention | One Specular primary (`ov-next`); triage = attention (+ Right now) + lag open; story collapsed below instruments with digest; grade teasers + Help link |
| Healthy / steady | Instruments-first; ghost CTAs; story/digest in secondary column |
| Rail | Active item solid accent |
| Lag +N | Insights incidents |

- [ ] **Step 2: Optional detector**

```bash
node "C:\Users\DJINN\.cursor\skills\impeccable\scripts\detect.mjs" --json web/dashboard/src/features/overview
```

Expected: still clean or only known false positives.

- [ ] **Step 3: Re-run `/impeccable critique` on Overview**

Compare to baseline **26/40**. Heuristics 4/7/8/10 should move if P1–P2 landed.

- [ ] **Step 4: Commit only if Step 1–2 required follow-up edits**

Otherwise no empty commit.

---

## Self-review (spec coverage)

| Critique item | Task |
|---------------|------|
| P1 incident competing jobs / story+digest in crisis stack | 1 distill |
| P1 Specular/primary peer CTAs | 2 quieter |
| P2 story default-open vs lag collapsed | 3 layout |
| P2 opaque grade letter | 4 clarify |
| nextAction “Open Backups” lie | 4 clarify |
| Needs attention headline echo | 4 clarify |
| P3 rail ≠ DESIGN solid accent | 5 polish |
| P3 Watchtower spelling | 5 polish |
| P3 missing aria-expanded | 6 audit |
| Lag +N → Issues vs Insights | 6 audit |
| Final verify + critique rescore | 7 |

Out of scope (explicit): redesign identity chips → Session; rename Needs attention → Fix now; full contrast token overhaul; aria-live on 1s uptime ticker.

---

## Plain English — what will actually change

When the server looks **bad** (CRITICAL / Needs attention):

1. The top of Overview still shows the big grade and vitals, but it will also show **one or two short sentences explaining why** the grade is bad, plus a link to the Help article about grading.
2. The bright blue “do this next” button stays the **only** loud button. Links like Open Insights / Open Spark / Open Activity become quieter text-style buttons so they stop competing.
3. **Needs attention** (and live “Right now” / lag) stay in the left urgency column. The **Incident story** and **Weekly digest** move **down below** the other instrument cards so they are not in your face during a crisis.
4. Lag incidents start **open**; the Incident story starts **closed** (you can expand it).
5. Clicking “+N more” on lag goes to the **same Insights lag page** as each row’s Open button (not a random jump to Issues).
6. The left nav’s **current page** lights up as a solid blue bar (matching the design system), and view-only tooltips finally spell **WatchTower** correctly everywhere that string is used.

When the server looks **fine**, Overview still puts instruments first; story/digest stay in the side column. We are not changing what WatchTower can *do* (still advisory) — only how Overview guides your eye under stress.
