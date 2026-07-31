# Features Capability Instrument Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/features` with a Night Watch Desk capability grid of shipped insides (not dashboard room peeks).

**Architecture:** Content module lists ~26 capabilities. A small `CapabilityTile` wraps `InstrumentPlate` + `Reveal`. The page is intro + 12-col grid + optional close CTAs. No `ProductDesk` on this route.

**Tech Stack:** Next.js App Router, React, Tailwind (`web/marketing`), existing `InstrumentPlate`, `Reveal`, `Cta`, product CTAs from `content/product.ts`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-31-marketing-features-capability-grid-design.md`
- No `ProductDesk` / room peeks on Features
- Shipped capabilities only; Alpha honest (Spark deep workspace; panel/cloud backups in blurb)
- Hyphens only (no em/en dashes); no Fabric shipping claims; no promises / not-our-job
- Night Watch Desk craft: Geist + Mono, radii 2/4/6, hairlines, Signal Blue scarce, Lantern Amber for Alpha only
- Do not modify home Shift Log or How it works
- Prefer localhost demo links; do not invent product behavior

---

## File map

| File | Responsibility |
|---|---|
| `web/marketing/content/features.ts` | Replace surfaces list with `FEATURE_CAPABILITIES` |
| `web/marketing/components/features/capability-tile.tsx` | One InstrumentPlate capability card (new) |
| `web/marketing/app/features/page.tsx` | Intro + grid + close CTAs (rewrite) |
| `web/marketing/scripts/audit-shift-log.mjs` | Guard: Features must not import ProductDesk |

---

### Task 1: Replace features content module

**Files:**
- Modify: `web/marketing/content/features.ts` (full rewrite)

**Interfaces:**
- Produces: `FeatureCapability`, `FEATURE_CAPABILITIES`, `FEATURE_LEDE`

- [ ] **Step 1: Rewrite `content/features.ts`**

Replace the entire file with:

```ts
/**
 * Features page: capability catalog (insides), not dashboard rooms.
 * Sources: docs/ROADMAP.md Works today, README.md, PRODUCT.md.
 * Hyphens only. No Fabric shipping claims. No promises / not-our-job.
 */

export type FeatureCapability = {
  id: string;
  title: string;
  blurb: string;
  /** Parent room label for wayfinding only. */
  tag: string;
  weight: 'lead' | 'standard';
  alpha?: boolean;
};

export const FEATURE_LEDE =
  'What is inside the desk - the smaller tools under each surface, not another tour of Overview and Live.';

export const FEATURE_CAPABILITIES: FeatureCapability[] = [
  {
    id: 'health-grade',
    title: 'Health grade + restart advice',
    blurb:
      'Letter grade, needs-attention list, and Safe / Caution / Wait restart advice. It does not restart the server for you.',
    tag: 'Overview',
    weight: 'lead',
  },
  {
    id: 'fix-inbox',
    title: 'Fix inbox ranking',
    blurb:
      'Continuous Watching and Scanning into a ranked inbox with one plain next step per issue. No giant scheduled audit dump.',
    tag: 'Issues',
    weight: 'lead',
  },
  {
    id: 'join-clinic',
    title: 'Join / pack sync clinic',
    blurb:
      'Failed joins map to named mod diffs on Session. Player-safe copy of the fix - read-only, no jar downloads.',
    tag: 'Session',
    weight: 'lead',
  },
  {
    id: 'world-pressure',
    title: 'World pressure',
    blurb:
      'Entity, item, and chunk census that spots item storms, mob spikes, and unattended loaders.',
    tag: 'Insights',
    weight: 'lead',
  },
  {
    id: 'support-pack',
    title: 'Support pack redaction',
    blurb:
      'Build a redacted zip (facts, brief, evidence) for a helper or mod author. Discord copy presets stay consistent with the pack.',
    tag: 'Support',
    weight: 'lead',
  },
  {
    id: 'live-vitals',
    title: 'Live vitals charts',
    blurb: 'TPS, MSPT, players, heap, CPU, and host charts while you watch - including honest hosted-panel metrics.',
    tag: 'Live',
    weight: 'standard',
  },
  {
    id: 'gc-ram',
    title: 'GC / JVM + RAM advice',
    blurb: 'GC pause share of wall, flags profile, and a conservative do-I-need-more-RAM card.',
    tag: 'Live',
    weight: 'standard',
  },
  {
    id: 'crash-fingerprints',
    title: 'Crash fingerprints',
    blurb: 'Crash reports grouped and explained in plain English, with context from nearby logs.',
    tag: 'Crashes',
    weight: 'standard',
  },
  {
    id: 'external-kill',
    title: 'External kill / OOM',
    blurb: 'Host OOM killer vs panel force-kill when there is no crash report - plus the right fix path.',
    tag: 'Crashes',
    weight: 'standard',
  },
  {
    id: 'silent-fails',
    title: 'Silent script fails',
    blurb: 'KubeJS, CraftTweaker, datapack, and /reload errors that never crash still become Issues.',
    tag: 'Issues',
    weight: 'standard',
  },
  {
    id: 'mods-modrinth',
    title: 'Mod inventory + Modrinth hints',
    blurb: 'Jar inventory, conflicts, and Modrinth lookup hints. Modrinth never downloads jars for you.',
    tag: 'Mods',
    weight: 'standard',
  },
  {
    id: 'jar-drift',
    title: 'Pack / jar drift',
    blurb: 'Checksum baseline drift and high-confidence client-only jars surfaced on Issues.',
    tag: 'Mods',
    weight: 'standard',
  },
  {
    id: 'schedule-load',
    title: 'Schedule + load trends',
    blurb: 'Busy vs quiet hours and load patterns so you plan restarts around real pressure.',
    tag: 'Insights',
    weight: 'standard',
  },
  {
    id: 'storage-runway',
    title: 'Storage + disk runway',
    blurb: 'Dimension storage scan plus roughly how many days of disk left - not just a percent full.',
    tag: 'Insights',
    weight: 'standard',
  },
  {
    id: 'weekly-digest',
    title: 'Weekly ops digest',
    blurb: 'Local rollup of grade, crashes, disk, and MSPT trend with one next action. Stays on your host.',
    tag: 'Insights',
    weight: 'standard',
  },
  {
    id: 'config-audit',
    title: 'Config audit',
    blurb: 'Read-only keep / tweak / why for server.properties and startup flags.',
    tag: 'Insights',
    weight: 'standard',
  },
  {
    id: 'spark',
    title: 'Spark lag proof',
    blurb: 'Optional Spark companion turns a profile into what ate the tick. Deep Spark workspace is Alpha.',
    tag: 'Spark',
    weight: 'standard',
    alpha: true,
  },
  {
    id: 'backups',
    title: 'Backup health',
    blurb:
      'See whether local backup folders look present and fresh. Panel and cloud backup tracking is Alpha - do not fully trust it yet.',
    tag: 'Backups',
    weight: 'standard',
  },
  {
    id: 'activity',
    title: 'Activity / incident stories',
    blurb: 'Stitches lag, crash, and missed-backup moments into a readable incident thread.',
    tag: 'Activity',
    weight: 'standard',
  },
  {
    id: 'logs',
    title: 'Log tail',
    blurb: 'latest.log triage in the desk so you are not bouncing to the host panel for every line.',
    tag: 'Logs',
    weight: 'standard',
  },
  {
    id: 'startup',
    title: 'Startup watch',
    blurb: 'First-minutes and boot health when the process comes up.',
    tag: 'Startup',
    weight: 'standard',
  },
  {
    id: 'sources',
    title: 'Sources freshness',
    blurb: 'Poller freshness and what data pull is next so you know if Watching is current.',
    tag: 'Sources',
    weight: 'standard',
  },
  {
    id: 'accounts',
    title: 'Named accounts + audit log',
    blurb: 'Owner / admin / viewer logins with an audit log under Settings.',
    tag: 'Settings',
    weight: 'standard',
  },
  {
    id: 'auth',
    title: 'Secure login + optional 2FA',
    blurb: 'Login required by default; optional 2FA for the desk.',
    tag: 'Settings',
    weight: 'standard',
  },
  {
    id: 'help',
    title: 'Help Center',
    blurb: 'In-app wiki with the same guides as the public GitHub wiki.',
    tag: 'Help',
    weight: 'standard',
  },
  {
    id: 'cli-dr',
    title: 'Disaster-recovery CLI + viewer',
    blurb: 'Matching CLI jar and browser viewer when Minecraft will not stay up.',
    tag: 'CLI',
    weight: 'standard',
  },
];
```

- [ ] **Step 2: Confirm no em-dashes**

Run: `rg "[—–]" web/marketing/content/features.ts`  
Expected: no matches

- [ ] **Step 3: Commit**

```bash
git add web/marketing/content/features.ts
git commit -m "content: Features capabilities catalog replaces room surfaces"
```

---

### Task 2: Capability tile component

**Files:**
- Create: `web/marketing/components/features/capability-tile.tsx`

**Interfaces:**
- Consumes: `FeatureCapability` from `@/content/features`
- Produces: `CapabilityTile({ feature, className?, delay? })`

- [ ] **Step 1: Create the tile**

```tsx
'use client';

import { InstrumentPlate } from '@/components/instrument-plate';
import { Reveal } from '@/components/reveal';
import type { FeatureCapability } from '@/content/features';

export function CapabilityTile({
  feature,
  className = '',
  delay = 0,
}: {
  feature: FeatureCapability;
  className?: string;
  delay?: number;
}) {
  return (
    <Reveal kind="lift" delay={delay} className={`h-full ${className}`}>
      <InstrumentPlate elevation="flat" className="group h-full transition-[border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[color:color-mix(in_srgb,var(--wt-accent)_45%,var(--wt-line))]">
        <div className="flex h-full flex-col gap-3 p-4 md:p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--wt-text-low)]">
              {feature.tag}
            </span>
            {feature.alpha ? (
              <span
                className="border border-[color:var(--wt-line)] px-1.5 py-0.5 font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--wt-lantern)]"
                style={{ borderRadius: 'var(--wt-radius-sm)' }}
              >
                Alpha
              </span>
            ) : null}
          </div>
          <h2 className="text-[1.0625rem] font-semibold leading-snug tracking-[-0.01em] text-[color:var(--wt-text)] md:text-[1.125rem]">
            {feature.title}
          </h2>
          <p className="m-0 text-[0.875rem] leading-relaxed text-[color:var(--wt-text-mid)] md:text-[0.9375rem]">
            {feature.blurb}
          </p>
        </div>
      </InstrumentPlate>
    </Reveal>
  );
}
```

If `hover:border-[color:color-mix(...)]` is awkward in Tailwind v4, use a thin wrapper class in the component with inline `style` on hover via `onMouseEnter` is worse - prefer:

```tsx
className="h-full border border-transparent transition-colors ..."
```

and put hover on the InstrumentPlate outer by extending className only if InstrumentPlate forwards `className` to the outer border div (it does).

- [ ] **Step 2: Typecheck the module**

Run: `cd web/marketing && npx tsc --noEmit`  
Expected: PASS (or only unrelated errors)

- [ ] **Step 3: Commit**

```bash
git add web/marketing/components/features/capability-tile.tsx
git commit -m "feat(marketing): CapabilityTile instrument plate for Features grid"
```

---

### Task 3: Rewrite Features page

**Files:**
- Modify: `web/marketing/app/features/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `FEATURE_CAPABILITIES`, `FEATURE_LEDE`, `CapabilityTile`, `DEMO_URL`, `LINKS`, `Cta`, `ModrinthMark`

- [ ] **Step 1: Rewrite `app/features/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { CapabilityTile } from '@/components/features/capability-tile';
import { Cta } from '@/components/cta';
import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { FEATURE_CAPABILITIES, FEATURE_LEDE } from '@/content/features';
import { DEMO_URL, LINKS } from '@/content/product';

export const metadata: Metadata = { title: 'Features' };

const SPAN: Record<(typeof FEATURE_CAPABILITIES)[number]['weight'], string> = {
  lead: 'sm:col-span-2 lg:col-span-6',
  standard: 'sm:col-span-1 lg:col-span-4',
};

export default function FeaturesPage() {
  return (
    <main>
      <section className="mx-auto w-full max-w-[84rem] px-5 pb-10 pt-20 md:px-8 md:pb-12 md:pt-28">
        <h1 className="wt-display-sm max-w-[16ch] text-[color:var(--wt-text)] text-balance">
          Features
        </h1>
        <p className="mt-5 max-w-[52ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
          {FEATURE_LEDE}
        </p>
      </section>

      <section
        aria-label="Capability catalog"
        className="mx-auto w-full max-w-[84rem] px-5 pb-16 md:px-8 md:pb-20"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:gap-5">
          {FEATURE_CAPABILITIES.map((f, i) => (
            <CapabilityTile
              key={f.id}
              feature={f}
              className={SPAN[f.weight]}
              delay={(i % 6) * 0.04}
            />
          ))}
        </div>
      </section>

      <section className="border-t border-[color:var(--wt-line)] py-16 md:py-20">
        <div className="mx-auto flex w-full max-w-[84rem] flex-col gap-6 px-5 md:flex-row md:items-end md:justify-between md:px-8">
          <p className="max-w-[40ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
            Open the demo on sample data, or get the jar on Modrinth.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <Cta href={DEMO_URL} withArrow newTab>
              Open the demo
            </Cta>
            <Cta
              href={LINKS.modrinth}
              variant="ghost"
              leading={<ModrinthMark className="h-3.5 w-3.5" />}
            >
              Get it on Modrinth
            </Cta>
          </div>
        </div>
      </section>
    </main>
  );
}
```

Confirm `Cta` props (`withArrow`, `newTab`, `variant`, `leading`) match `components/cta.tsx`. If `newTab` is named differently, use the existing prop names from HowClose.

- [ ] **Step 2: Grep Features for ProductDesk**

Run: `rg "ProductDesk|FEATURE_SURFACES|DESK_BY_ID" web/marketing/app/features web/marketing/components/features`  
Expected: no matches

- [ ] **Step 3: Commit**

```bash
git add web/marketing/app/features/page.tsx
git commit -m "feat(marketing): Features page capability grid without room peeks"
```

---

### Task 4: Audit guard + verify

**Files:**
- Modify: `web/marketing/scripts/audit-shift-log.mjs`

- [ ] **Step 1: Add Features ProductDesk ban**

Near the how-it-works checks at the bottom of `audit-shift-log.mjs`, add:

```js
const featuresPagePath = join(ROOT, 'app/features/page.tsx');
const featuresPage = readFileSync(featuresPagePath, 'utf8');
if (/ProductDesk/.test(featuresPage)) {
  fail.push('app/features/page.tsx: ProductDesk room peeks belong on home, not Features');
}
if (/FEATURE_SURFACES/.test(featuresPage)) {
  fail.push('app/features/page.tsx: use FEATURE_CAPABILITIES, not FEATURE_SURFACES');
}

const featuresContentPath = join(ROOT, 'content/features.ts');
const featuresContent = readFileSync(featuresContentPath, 'utf8');
if (!/FEATURE_CAPABILITIES/.test(featuresContent)) {
  fail.push('content/features.ts: missing FEATURE_CAPABILITIES');
}
if (/FEATURE_SURFACES/.test(featuresContent)) {
  fail.push('content/features.ts: FEATURE_SURFACES should be removed');
}
```

Also include `components/features/` in the sub-12px sizeTargets filter if useful:

```js
r.startsWith('components/features/') ||
```

- [ ] **Step 2: Run audit + tsc**

```bash
cd web/marketing
node scripts/audit-shift-log.mjs
npx tsc --noEmit
```

Expected: both PASS

- [ ] **Step 3: Manual browser check**

Open `http://localhost:3099/features` (or marketing preview port):

- No Overview/Live ProductDesk peeks
- Lead tiles wider on desktop; mobile single column
- Spark shows Alpha chip; backup blurb mentions panel/cloud Alpha
- Demo + Modrinth CTAs at bottom

- [ ] **Step 4: Commit**

```bash
git add web/marketing/scripts/audit-shift-log.mjs
git commit -m "test(marketing): audit Features capability grid constraints"
```

---

## Spec coverage check

| Spec requirement | Task |
|---|---|
| Capability inventory (~26) | Task 1 |
| Lead vs standard weights | Task 1 + 3 |
| InstrumentPlate tiles + Reveal | Task 2 |
| No ProductDesk | Task 3 + 4 |
| Optional close CTAs | Task 3 |
| Alpha labeling | Task 1 + 2 |
| Hyphens / no invented claims | Task 1 + Global |
| Audit | Task 4 |

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-31-marketing-features-capability-grid.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — run tasks in this session with checkpoints  

Which approach?
