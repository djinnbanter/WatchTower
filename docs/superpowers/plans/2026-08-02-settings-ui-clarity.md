# Settings UI Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every WatchTower Settings panel easy to scan — one section = one plate of desk rows — without changing product behavior.

**Architecture:** Extract a small Settings stack primitive (CSS + thin React wrappers) that turns today’s per-field `.wt-form-row` cards into hairline-divided rows inside a single `.wt-plate`. Migrate panel JSX panel-by-panel; clarify Backups save hierarchy with button kind + caption only.

**Tech Stack:** React 19 + Vite (`web/dashboard`), existing `Section` / `Button` / `.wt-plate` / `.wt-form-row`, feature CSS in `settings.css`, fixture preview `:8081`, `tsx --test` banlist.

## Global Constraints

- Identity: Night Watch Desk per `DESIGN.md` — radii `--radius-wt-sm` / `--radius-wt` / `--radius-wt-lg` (2/4/6px); plates `.wt-plate` + `--wt-shadow`; scarce Signal Blue.
- Spec: `docs/superpowers/specs/2026-08-02-settings-ui-clarity-design.md` is source of truth for layout/copy.
- Depth: clarity + shared field chrome only — **no** new settings keys, API, roles, or panel IA rewrite.
- Scope in: `features/settings/**`, `features/backups/local-folder-setup.tsx`, `features/backups/external-tracking-setup.tsx` (save button weight + caption only), Appearance controls as consumed by Settings.
- Scope out: wizard full redesign, Visuals/lab, marketing, rail pages outside Settings.
- **Reject:** Double-Bezel / `rounded-[2rem]`, pill primary CTAs, glass orbs, purple/indigo mesh, marketing `py-24+`, new fonts/icon sets.
- **Craft:** `:focus-visible`; no `transition-all`; motion = transform/opacity + `prefers-reduced-motion`; WatchTower spelling in chrome; loading `…`.
- **React:** no new `useMemo`/`useCallback`/deps; do not define components inside `PageView` (hoist helpers at module scope — already the pattern).
- Tests: extend banlist if needed; prefer CSS/structure checks; verify UI via `npm run preview`.
- Commits: one logical unit per task; do not push unless asked.

---

## File structure (locked)

| File | Responsibility |
|------|----------------|
| `docs/superpowers/specs/2026-08-02-settings-ui-clarity-design.md` | Approved design (already written) |
| `web/dashboard/src/features/settings/settings.css` | `.st-stack`, `.st-row`, pair grid, accounts footer band |
| `web/dashboard/src/features/settings/fields.tsx` | Shared `SettingsStack`, `ToggleField`, `NumberField`, `TextField`, `ReadOnlyField` (moved out of `view.tsx`) |
| `web/dashboard/src/features/settings/view.tsx` | Panel chrome + section composition using stack |
| `web/dashboard/src/features/settings/accounts-panel.tsx` | Table + add-account in one plate band |
| `web/dashboard/src/features/settings/audit-log-panel.tsx` | Minor flush/spacing only if needed |
| `web/dashboard/src/features/backups/local-folder-setup.tsx` | Secondary save button + caption |
| `web/dashboard/src/app/appearance-controls.tsx` (+ css if needed) | Fit inside stack without nested plate borders |
| `web/dashboard/scripts/ui-consistency-banlist.test.ts` | Remain green; optional assert `.st-stack` exists once shipped |

---

### Task 1: Settings stack CSS + field primitives

**Files:**
- Create: `web/dashboard/src/features/settings/fields.tsx`
- Modify: `web/dashboard/src/features/settings/settings.css` (append stack rules)
- Modify: `web/dashboard/src/features/settings/view.tsx` (delete local field helpers; import from `fields.tsx` — temporary still using old classNames until Task 2 swaps wrappers)

**Interfaces:**
- Consumes: existing `Button` patterns none; CSS vars `--wt-*`, `--radius-wt*`
- Produces:
  - `SettingsStack({ children, className?: string })`
  - `SettingsPair({ children })` — `md:grid-cols-2` for true pairs only
  - `ToggleField`, `NumberField`, `TextField`, `ReadOnlyField` with **row** chrome (no per-field outer border)

- [ ] **Step 1: Append stack CSS**

Add to end of `settings.css`:

```css
/* Settings desk stack — one plate, hairline rows (not one card per field) */
.st-stack {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}

.st-stack > .st-row + .st-row,
.st-stack > .st-pair + .st-row,
.st-stack > .st-row + .st-pair,
.st-stack > .st-pair + .st-pair {
  border-top: 1px solid color-mix(in srgb, var(--wt-line) 85%, transparent);
}

.st-pair {
  display: grid;
  gap: 0;
  grid-template-columns: 1fr;
}

@media (min-width: 768px) {
  .st-pair {
    grid-template-columns: 1fr 1fr;
  }

  .st-pair > .st-row + .st-row {
    border-top: none;
    border-left: 1px solid color-mix(in srgb, var(--wt-line) 85%, transparent);
  }
}

.st-row {
  display: block;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  border-radius: 0;
}

.st-row--toggle,
.st-row--inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.st-row__label {
  font-size: var(--wt-fs-sm, 0.875rem);
  font-weight: 600;
  color: var(--wt-text);
}

.st-row__hint {
  margin-top: 0.15rem;
  font-size: var(--wt-fs-xs, 0.75rem);
  color: var(--wt-text-low);
  line-height: 1.35;
}

.st-row__control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.st-row input[type='number'],
.st-row input[type='text'],
.st-row input[type='password'],
.st-row select {
  border-radius: var(--radius-wt);
  border: 1px solid var(--wt-line);
  background: var(--wt-bg1);
  outline: none;
}

.st-row input:focus-visible,
.st-row select:focus-visible {
  border-color: var(--wt-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--wt-accent) 35%, transparent);
}
```

- [ ] **Step 2: Create `fields.tsx` with stack + fields**

```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SettingsStack({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('wt-plate st-stack', className)}>{children}</div>;
}

export function SettingsPair({ children }: { children: ReactNode }) {
  return <div className="st-pair">{children}</div>;
}

export function ToggleField({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn('st-row st-row--toggle', disabled && 'opacity-60')}>
      <div className="min-w-0">
        <div className="st-row__label">{label}</div>
        {hint ? <div className="st-row__hint">{hint}</div> : null}
      </div>
      {/* keep existing switch markup from view.tsx ToggleField — copy verbatim */}
    </div>
  );
}

// NumberField / TextField / ReadOnlyField: same props as current view.tsx helpers,
// but root className = "st-row" / "st-row st-row--inline" — NO "wt-form-row".
```

Copy the **existing switch / input markup** from `view.tsx` (`ToggleField`, `NumberField`, `TextField`, `ReadOnlyField`) verbatim into `fields.tsx`, only changing the outer wrapper classes from `wt-form-row …` to `st-row…`. Keep `TimezonePreferenceField` in `view.tsx` for now (Task 2).

- [ ] **Step 3: Wire imports in `view.tsx`**

Replace local field function definitions with:

```tsx
import {
  NumberField,
  ReadOnlyField,
  SettingsPair,
  SettingsStack,
  TextField,
  ToggleField,
} from './fields';
```

Leave JSX still wrapping grids as-is for this commit if needed — or wrap one General section to smoke-test. Prefer full import swap with wrappers added in Task 2 if that keeps the build green.

- [ ] **Step 4: Typecheck / banlist**

Run:

```powershell
cd web/dashboard; npm run test:ui-consistency
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add web/dashboard/src/features/settings/fields.tsx web/dashboard/src/features/settings/settings.css web/dashboard/src/features/settings/view.tsx
git commit -m "feat(dashboard): add Settings desk stack field primitives"
```

---

### Task 2: General panel — stack composition

**Files:**
- Modify: `web/dashboard/src/features/settings/view.tsx` (`panel === 'general'` block ~459–503)
- Modify: `web/dashboard/src/app/appearance-controls.tsx` / `.css` only if Appearance still paints its own full plate border that doubles with `.st-stack`

**Interfaces:**
- Consumes: `SettingsStack`, `SettingsPair`, field components from Task 1
- Produces: General panel with three section stacks (identity, appearance, preferences)

- [ ] **Step 1: Rewrite Server identity**

```tsx
<Section title="Server identity" hint="Detected for this install — not edited here.">
  <SettingsStack>
    <SettingsPair>
      <ReadOnlyField label="Hostname" value={str(form.hostname)} hint="From the server environment" />
      <ReadOnlyField
        label="Hosting panel"
        value={str(form.panel_display_name) || str(form.panel, 'none')}
        hint="Auto-detected panel / host type"
      />
    </SettingsPair>
    <ReadOnlyField
      label="Dashboard port"
      value={String(num(form.dashboard_port) || '—')}
      hint="Change in watchtower-common.toml, then restart"
    />
  </SettingsStack>
</Section>
```

- [ ] **Step 2: Appearance + preferences**

Wrap `AppearanceControls` in `<SettingsStack>` (if Appearance already has a bordered shell, remove the outer border from Appearance when `embedded` — add optional `variant="embedded"` prop defaulting to current look for any other callers; Settings passes `embedded`).

```tsx
<Section
  title="Appearance"
  hint="Theme and accent sync to your account. Status colours stay the same."
>
  <SettingsStack>
    <div className="st-row">
      <AppearanceControls idPrefix="settings-appearance" embedded />
    </div>
  </SettingsStack>
</Section>

<Section
  title="Dashboard preferences"
  hint="Banners apply after Save. Timezone applies immediately in this browser."
>
  <SettingsStack>
    <SettingsPair>
      <ToggleField
        label="Check for updates"
        hint="Show when a newer WatchTower release is available"
        value={bool(form.update_check)}
        onChange={(v) => set('update_check', v)}
      />
      <ToggleField
        label="Metrics context banner"
        hint="Short explainer above Live / chart pages"
        value={bool(form.metrics_context_banner)}
        onChange={(v) => set('metrics_context_banner', v)}
      />
    </SettingsPair>
    {/* TimezonePreferenceField: strip its outer wt-form-row; use st-row root */}
    <TimezonePreferenceField />
  </SettingsStack>
</Section>
```

Update `TimezonePreferenceField` root from `wt-form-row` / nested plate to `className="st-row"` (no second plate).

- [ ] **Step 3: Preview General**

Run: `cd web/dashboard; npm run preview` → open `http://127.0.0.1:8081/?tab=settings&panel=general`  
Expected: one plate per section; port row full width under hostname/panel pair; no orphan half-card.

- [ ] **Step 4: Commit**

```powershell
git add web/dashboard/src/features/settings/view.tsx web/dashboard/src/app/appearance-controls.tsx web/dashboard/src/app/appearance-controls.css
git commit -m "fix(dashboard): compose Settings General as desk stacks"
```

---

### Task 3: Monitoring panel

**Files:**
- Modify: `web/dashboard/src/features/settings/view.tsx` (`panel === 'monitoring'`)

**Interfaces:**
- Consumes: Task 1 primitives
- Produces: Lag / baseline / Spark on lag / Scan cadence as stacks

- [ ] **Step 1: Lag + baseline pairs**

```tsx
<Section title="Lag thresholds" hint="When TPS or MSPT crosses these, Issues and Overview mark the window unhealthy.">
  <SettingsStack>
    <SettingsPair>
      <NumberField label="TPS warning" hint="Typical 19.5" value={num(form.tps_warn)} onChange={(v) => set('tps_warn', v)} />
      <NumberField label="MSPT warning" hint="Typical 50" unit="ms" value={num(form.mspt_warn)} onChange={(v) => set('mspt_warn', v)} />
    </SettingsPair>
  </SettingsStack>
</Section>
```

Same pattern for Performance baseline (toggle + threshold pair).

- [ ] **Step 2: Spark on lag — kill the orphan fifth card**

Use one stack:

1. `SettingsPair`: Spark mod (read-only status row) + Spark enabled toggle  
2. `SettingsPair`: Auto-capture toggle + Capture window number  
3. Full-width: Cooldown number  

Do **not** leave Cooldown as a half-width grid orphan.

- [ ] **Step 3: Scan cadence**

Pair ops poll + log scan; Live sample interval as full-width read-only row with unit `sec`.

- [ ] **Step 4: Preview Monitoring**

`?tab=settings&panel=monitoring` — four tidy plates, no ragged bottoms.

- [ ] **Step 5: Commit**

```powershell
git add web/dashboard/src/features/settings/view.tsx
git commit -m "fix(dashboard): stack Settings Monitoring fields"
```

---

### Task 4: Alerts + Integrations panels

**Files:**
- Modify: `web/dashboard/src/features/settings/view.tsx` (`alerts`, `integrations`)

**Interfaces:**
- Consumes: Task 1 primitives
- Produces: Even stacks; units on every numeric field

- [ ] **Step 1: Disk alerts**

Three numbers → one stack: pair warning % + fill days; full-width write latency `ms`.

- [ ] **Step 2: Chunk write / retention**

- Chunk: pair toggle + growth; full-width sustained scans with `unit="scans"`.  
- Retention: pair keep days + keep at most with `unit="reports"`.

- [ ] **Step 3: Integrations**

Modrinth: pair two toggles in one stack.  
Spark: pair mod status + enabled toggle in one stack. Shorten hints to one line each.

- [ ] **Step 4: Preview**

`panel=alerts` and `panel=integrations`.

- [ ] **Step 5: Commit**

```powershell
git add web/dashboard/src/features/settings/view.tsx
git commit -m "fix(dashboard): stack Settings Alerts and Integrations"
```

---

### Task 5: Backups panel — hierarchy + stack

**Files:**
- Modify: `web/dashboard/src/features/settings/view.tsx` (backups Section)
- Modify: `web/dashboard/src/features/backups/local-folder-setup.tsx`
- Modify: `web/dashboard/src/features/backups/external-tracking-setup.tsx` (if it uses `kind="primary"` for save — demote to `default`)

**Interfaces:**
- Consumes: `SettingsStack` for stale-hours; secondary Button API
- Produces: Clear save hierarchy; same folder/external APIs

- [ ] **Step 1: Shorten Backups intro + stack stale hours**

```tsx
<Section
  title="Backups"
  hint="Local folders are supported. Panel / cloud tracking is alpha. Folders save separately from the threshold below."
>
  <SettingsStack>
    <NumberField
      label="Stale after"
      hint="Older than this → Stale on Backups and BACKUP_STALE Issue"
      unit="hours"
      value={num(form.backup_stale_hours)}
      onChange={(v) => set('backup_stale_hours', v)}
    />
  </SettingsStack>
  {/* existing LocalFolderSetup + ExternalTrackingSetup */}
</Section>
```

- [ ] **Step 2: Demote folder save**

In `local-folder-setup.tsx`:

```tsx
<Button kind="default" disabled={!canSave} …>
  {saving ? 'Saving…' : filledCount > 1 ? 'Save folders & scan' : 'Save folder & scan'}
</Button>
<p className="text-xs text-wt-text-low">
  Folders save here. Stale threshold uses Save changes above.
</p>
```

Wrap folder list UI in `wt-plate` **or** keep existing container but ensure it is one plate, not nested `wt-form-row` per path if that already looks heavy — prefer one plate around the folder list.

- [ ] **Step 3: External tracking**

Keep Alpha callout; ensure segmented control + webhook block live in one `.wt-plate`; save buttons `kind="default"`.

- [ ] **Step 4: Preview Backups**

Confirm one specular/primary Save (header) and secondary folder save.

- [ ] **Step 5: Commit**

```powershell
git add web/dashboard/src/features/settings/view.tsx web/dashboard/src/features/backups/local-folder-setup.tsx web/dashboard/src/features/backups/external-tracking-setup.tsx
git commit -m "fix(dashboard): clarify Settings Backups save hierarchy"
```

---

### Task 6: Security + About

**Files:**
- Modify: `web/dashboard/src/features/settings/view.tsx` (security + about blocks)

**Interfaces:**
- Consumes: `SettingsStack` / existing security subcomponents
- Produces: Security forms in stacks; About facts as rows

- [ ] **Step 1: Security**

Wrap password / 2FA blocks in `SettingsStack` (or one stack per subsection). Fixture empty-state plate stays `.wt-plate` with one short sentence.

- [ ] **Step 2: About**

```tsx
<Section title="About this install" hint="Quick facts for this WatchTower dashboard.">
  <SettingsStack>
    <ReadOnlyField label="Hosting panel" value={…} />
    <ReadOnlyField label="Hostname" value={…} />
    <ReadOnlyField label="Dashboard port" value={…} />
    {/* Spark status as row with StatusPill */}
    <div className="st-row st-row--inline">…</div>
  </SettingsStack>
  <p className="text-xs text-wt-text-low">Fixture preview mode — …</p>
  <Button kind="primary" onClick={…}>Relaunch setup wizard</Button>
</Section>
```

No custom glow beyond shared primary Button.

- [ ] **Step 3: Preview**

`panel=security`, `panel=about`.

- [ ] **Step 4: Commit**

```powershell
git add web/dashboard/src/features/settings/view.tsx
git commit -m "fix(dashboard): stack Settings Security and About"
```

---

### Task 7: Accounts + Audit polish

**Files:**
- Modify: `web/dashboard/src/features/settings/accounts-panel.tsx`
- Modify: `web/dashboard/src/features/settings/settings.css` (`.st-accounts__new` footer band)
- Modify: `web/dashboard/src/features/settings/audit-log-panel.tsx` (spacing only if chips float oddly)

**Interfaces:**
- Consumes: existing accounts API/mutations
- Produces: Single plate = table + add footer

- [ ] **Step 1: CSS footer band**

```css
.st-accounts__shell {
  /* apply wt-plate look; table-wrap loses duplicate outer border */
  border-radius: var(--radius-wt);
  border: 1px solid var(--wt-line);
  background: color-mix(in srgb, var(--wt-bg1) 90%, transparent);
  box-shadow: var(--wt-shadow);
  overflow: hidden;
}

.st-accounts__table-wrap {
  border: none;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}

.st-accounts__new {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-end;
  padding: 0.85rem 1rem;
  border-top: 1px solid color-mix(in srgb, var(--wt-line) 85%, transparent);
  background: color-mix(in srgb, var(--wt-bg2) 35%, transparent);
}
```

- [ ] **Step 2: JSX shell**

Wrap table + add form:

```tsx
<div className="st-accounts__shell">
  <div className="st-accounts__table-wrap">…table…</div>
  <form className="st-accounts__new" …>…</form>
</div>
```

Tighten `.st-accounts__actions` gap to `0.35rem 0.65rem`; keep ConfirmInline behavior.

- [ ] **Step 3: Audit**

Ensure bands + ledger share one visual column; no extra plate around filter pills.

- [ ] **Step 4: Preview**

`panel=accounts`, `panel=audit`.

- [ ] **Step 5: Commit**

```powershell
git add web/dashboard/src/features/settings/accounts-panel.tsx web/dashboard/src/features/settings/audit-log-panel.tsx web/dashboard/src/features/settings/settings.css
git commit -m "fix(dashboard): unify Settings Accounts shell and Audit spacing"
```

---

### Task 8: Panel chrome polish + regression

**Files:**
- Modify: `web/dashboard/src/features/settings/view.tsx` (header Save row)
- Optionally: `web/dashboard/scripts/ui-consistency-banlist.test.ts`

**Interfaces:**
- Consumes: existing dirty/save mutation
- Produces: Stable Save placement; banlist green

- [ ] **Step 1: Header layout**

Ensure panel pills + Save sit in one row with `justify-between`; on wrap, Save stays visible (not buried mid-pill wrap). Prefer:

```tsx
<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
  <div className="inline-flex flex-wrap gap-1" role="tablist" aria-label="Settings sections">…</div>
  {showSave ? <div className="flex flex-wrap items-center gap-2">…</div> : null}
</div>
```

Add `aria-selected` on panel buttons if not present.

- [ ] **Step 2: Grep leftovers**

```powershell
rg "wt-form-row" web/dashboard/src/features/settings
```

Expected: none in Settings field rows (wizard may still use global `.wt-form-row` elsewhere — leave wizard alone). Settings-specific stacks use `.st-row` only.

- [ ] **Step 3: Banlist + preview sweep**

```powershell
cd web/dashboard; npm run test:ui-consistency
```

Walk dark: general → monitoring → backups → alerts → security → integrations → accounts → audit → about. Spot-check light + black on Monitoring + Backups.

Expected: stacks, one primary Save, readable sections.

- [ ] **Step 4: Commit**

```powershell
git add web/dashboard/src/features/settings/view.tsx web/dashboard/scripts/ui-consistency-banlist.test.ts
git commit -m "fix(dashboard): polish Settings panel chrome and verify stacks"
```

---

## Self-review

1. **Spec coverage:** Section plates, field rows, Save hierarchy, Backups caption, copy shortening, Accounts shell, About, craft bar, themes — all mapped to Tasks 1–8.  
2. **Placeholders:** None — CSS/JSX snippets are concrete; implementers copy switch markup from current `view.tsx`.  
3. **Types:** `SettingsStack` / `SettingsPair` / field props match Task 1; later tasks only compose them.  
4. **Behavior:** No API/key changes; folder save remains a separate action with clearer visual weight.

## End-user plain English

Settings stops looking like a scatter of little cards. Each topic is a short title and one neat box of rows you can scan, with Save clearly for thresholds — and folder backups still save on their own button without fighting the main Save.
