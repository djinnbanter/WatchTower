# How it works Mechanism Pipeline Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace `/how-it-works` with a single continuous Collect → Understand → Advise mechanism diagram, deleting the old setup-room implementation entirely.

**Architecture:** Delete all Shift Log room files for this route. Build three new small components (`PipelineNodeCard`, `PipelineConnector`, `Pipeline`) plus a standalone `HowClose` CTA band (no `ShiftLog`/`ShiftEntry` dependency), assembled in a fresh `app/how-it-works/page.tsx`. Reuse existing `ProductDesk`, `Cta`, `MarginNote`, `Reveal`, `DeskShapeGrid`, `MagnetHit`, `SparkProvider` — no new dependencies.

**Tech Stack:** Next.js 15 (App Router) + React 19, Tailwind v4 (`@theme inline` tokens in `styles/globals.css`), `motion` (`motion/react`) for animation, existing `web/marketing` component library.

## Global Constraints

- No `ShiftLog`/`ShiftEntry` usage anywhere on this page (spec §5, §11)
- One continuous diagram, not discrete full-bleed rooms (spec §2, §5)
- Setup-step content (jar drop, wizard steps, CLI command) must not appear on this page (spec §3, §11)
- Category-level node labels only — no worked "X causes Y" examples (spec §3, §6)
- Exactly one real `ProductDesk` mock on the page, anchored under Fix inbox only (spec §3, §6)
- Reduced motion renders a fully connected, static diagram — no pulse, no stagger (spec §7)
- Mobile/tablet stacks stages top-to-bottom, still connected (spec §7, §11)
- Hyphens only, no em-dashes, no Fabric shipping claims, no promises/not-our-job copy (spec §8)
- Home page and `ShiftLog` component are not modified (spec §3, §12)
- Spec: `docs/superpowers/specs/2026-07-31-marketing-how-it-works-pipeline-rebuild-design.md`

---

## File map

| File | Responsibility |
|---|---|
| `content/how.ts` | Lede + Collect/Advise node data + Understand copy (new) |
| `components/how/pipeline-node.tsx` | Single node/tag card, sm and lg sizes (new) |
| `components/how/pipeline-connector.tsx` | Line + one-shot pulse between two stages (new) |
| `components/how/pipeline.tsx` | Orchestrates Collect → Understand → Advise + proof mock (new) |
| `components/how/how-close.tsx` | Close CTA band, no Shift Log dependency (new) |
| `app/how-it-works/page.tsx` | Page intro + `Pipeline` + `HowClose` (rewritten) |
| `scripts/audit-shift-log.mjs` | Drop how-room-specific rail/promises checks (modified) |

Deleted: `components/entries/how/*.tsx` (6 files), `components/how/mods-plate.tsx`,
`wizard-steps.tsx`, `loop-path.tsx`, `disk-tree.tsx`, `cli-plate.tsx`,
`plate-shell.tsx`, `content/how-it-works.ts`, `content/how-night.ts`.

---

### Task 1: Delete the old setup-room implementation

**Files:**
- Delete: `web/marketing/components/entries/how/drop.tsx`
- Delete: `web/marketing/components/entries/how/wizard.tsx`
- Delete: `web/marketing/components/entries/how/loop.tsx`
- Delete: `web/marketing/components/entries/how/disk.tsx`
- Delete: `web/marketing/components/entries/how/cli.tsx`
- Delete: `web/marketing/components/entries/how/close.tsx`
- Delete: `web/marketing/components/how/mods-plate.tsx`
- Delete: `web/marketing/components/how/wizard-steps.tsx`
- Delete: `web/marketing/components/how/loop-path.tsx`
- Delete: `web/marketing/components/how/disk-tree.tsx`
- Delete: `web/marketing/components/how/cli-plate.tsx`
- Delete: `web/marketing/components/how/plate-shell.tsx`
- Delete: `web/marketing/content/how-it-works.ts`
- Delete: `web/marketing/content/how-night.ts`

- [x] Step 1: Delete all 14 files listed above
- [x] Step 2: Confirm nothing outside this list still imports them

Run: `grep -rn "entries/how/\|how/mods-plate\|how/wizard-steps\|how/loop-path\|how/disk-tree\|how/cli-plate\|how/plate-shell\|content/how-it-works\|content/how-night" web/marketing/app web/marketing/components web/marketing/scripts`
Expected: no output (the only remaining reference will be `app/how-it-works/page.tsx`, which Task 6 rewrites — it is fine if this command still shows the old page.tsx import before Task 6 runs)

- [x] Step 3: Commit

```bash
git add -A -- web/marketing/components/entries/how web/marketing/components/how web/marketing/content/how-it-works.ts web/marketing/content/how-night.ts
git commit -m "chore(marketing): remove how-it-works setup-room implementation"
```

---

### Task 2: Add pipeline content

**Files:**
- Create: `web/marketing/content/how.ts`

**Interfaces:**
- Produces: `HOW_LEDE: string`, `PipelineNode = { id: string; label: string; detail?: string }`, `COLLECT_NODES: readonly PipelineNode[]`, `UNDERSTAND_COPY: string`, `ADVISE_NODES: readonly PipelineNode[]` — consumed by `components/how/pipeline.tsx` in Task 4.

- [x] Step 1: Create the content file

```ts
/**
 * How it works: mechanism pipeline copy.
 * Sources: PRODUCT.md (Collect/Advise capabilities), README.md.
 * Hyphens only. No Fabric shipping claims. No promises / not-our-job.
 * Category level only - no worked "X causes Y" examples.
 */

export type PipelineNode = {
  id: string;
  label: string;
  detail?: string;
};

export const HOW_LEDE =
  'WatchTower watches your server while it runs, works out what it is seeing, and turns that into a short list of what to fix.';

export const COLLECT_NODES: readonly PipelineNode[] = [
  { id: 'vitals', label: 'Vitals', detail: 'TPS, MSPT, heap, CPU, disk' },
  { id: 'logs', label: 'Logs', detail: 'latest.log tail, crash reports' },
  { id: 'mods', label: 'Mods', detail: 'Jar inventory, checksums' },
  { id: 'world', label: 'World', detail: 'Chunk load, entity and item counts' },
  { id: 'backups', label: 'Backups', detail: 'Presence, age' },
] as const;

export const UNDERSTAND_COPY =
  'Every scan gets checked against what a healthy server looks like, so a real problem stands out from normal noise.';

export const ADVISE_NODES: readonly PipelineNode[] = [
  { id: 'fix-inbox', label: 'Fix inbox', detail: 'Ranked issues, one next step each' },
  { id: 'overview', label: 'Overview grade', detail: 'Health grade, needs-attention list' },
  { id: 'insights', label: 'Insights trends', detail: 'Schedule, load, and storage over time' },
  { id: 'support', label: 'Support pack', detail: 'Redacted bundle to share' },
] as const;
```

- [x] Step 2: Verify no em-dashes and correct exports

Run: `grep -n "—\|–" web/marketing/content/how.ts`
Expected: no output

Run: `grep -n "export const HOW_LEDE\|export const COLLECT_NODES\|export const UNDERSTAND_COPY\|export const ADVISE_NODES\|export type PipelineNode" web/marketing/content/how.ts`
Expected: all five lines found

- [x] Step 3: Commit

```bash
git add web/marketing/content/how.ts
git commit -m "feat(marketing): add how-it-works pipeline content"
```

---

### Task 3: Build the node card and connector components

**Files:**
- Create: `web/marketing/components/how/pipeline-node.tsx`
- Create: `web/marketing/components/how/pipeline-connector.tsx`

**Interfaces:**
- Consumes: `PipelineNode` type from `@/content/how` (Task 2)
- Produces: `PipelineNodeCard({ node, size, index, active }): JSX.Element` and `PipelineConnector({ active, delay }): JSX.Element` — consumed by `components/how/pipeline.tsx` in Task 4. `active` is a boolean the parent computes once (via `useInView`) and passes down; nodes/connectors do not observe their own visibility.

- [x] Step 1: Create the node card

```tsx
'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { PipelineNode } from '@/content/how';

const STAGGER_S = 0.08;

export function PipelineNodeCard({
  node,
  size = 'sm',
  index = 0,
  active,
}: {
  node: PipelineNode;
  size?: 'sm' | 'lg';
  index?: number;
  active: boolean;
}) {
  const reduce = useReducedMotion();
  const big = size === 'lg';

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={active || reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      transition={{
        duration: 0.4,
        delay: reduce ? 0 : index * STAGGER_S,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={`flex flex-col gap-1 border border-[color:var(--wt-line)] bg-[color:var(--wt-plate-outer)] px-4 py-3 ${
        big ? 'items-center text-center' : ''
      }`}
      style={{ borderRadius: 'var(--wt-radius-md)' }}
    >
      <span
        className={`font-mono font-semibold uppercase tracking-[0.12em] text-[color:var(--wt-text)] ${
          big ? 'text-[0.9375rem]' : 'text-[0.8125rem]'
        }`}
      >
        {node.label}
      </span>
      {node.detail ? (
        <span
          className={`leading-snug text-[color:var(--wt-text-low)] ${
            big ? 'max-w-[36ch] text-[0.9375rem]' : 'text-[0.8125rem]'
          }`}
        >
          {node.detail}
        </span>
      ) : null}
    </motion.div>
  );
}
```

- [x] Step 2: Create the connector

```tsx
'use client';

import { motion, useReducedMotion } from 'motion/react';

/**
 * Line between two stages. The accent overlay scales in (the "pulse")
 * then fades, leaving the calm base line - a signal that passed through
 * and settled, not a permanent bright line (Signal Blue stays scarce).
 */
export function PipelineConnector({
  active,
  delay = 0,
}: {
  active: boolean;
  delay?: number;
}) {
  const reduce = useReducedMotion();

  return (
    <div
      aria-hidden
      className="relative mx-auto h-10 w-px shrink-0 bg-[color:var(--wt-line)] lg:mx-0 lg:h-px lg:w-10 lg:flex-1"
    >
      {!reduce ? (
        <motion.span
          className="absolute inset-0 origin-top bg-[color:var(--wt-accent)] lg:origin-left"
          initial={{ scale: 0, opacity: 1 }}
          animate={
            active
              ? { scale: [0, 1, 1], opacity: [1, 1, 0] }
              : { scale: 0, opacity: 0 }
          }
          transition={{
            duration: 0.7,
            delay,
            times: [0, 0.55, 1],
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      ) : null}
    </div>
  );
}
```

- [x] Step 3: Verify both files compile

Run: `cd web/marketing && npm run lint`
Expected: no errors for the two new files

- [x] Step 4: Commit

```bash
git add web/marketing/components/how/pipeline-node.tsx web/marketing/components/how/pipeline-connector.tsx
git commit -m "feat(marketing): add pipeline node and connector components"
```

---

### Task 4: Build the Pipeline orchestrator

**Files:**
- Create: `web/marketing/components/how/pipeline.tsx`

**Interfaces:**
- Consumes: `PipelineNodeCard`, `PipelineConnector` (Task 3); `COLLECT_NODES`, `UNDERSTAND_COPY`, `ADVISE_NODES` (Task 2); `ProductDesk` from `@/components/desk/product-desk` (existing, `surface="issues" cut="bands" chrome="bare"` matches the same fixture already used on home's Issues room)
- Produces: `Pipeline(): JSX.Element` — consumed by `app/how-it-works/page.tsx` in Task 6

- [x] Step 1: Create the orchestrator

```tsx
'use client';

import { useRef } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { ProductDesk } from '@/components/desk/product-desk';
import { PipelineNodeCard } from '@/components/how/pipeline-node';
import { PipelineConnector } from '@/components/how/pipeline-connector';
import { COLLECT_NODES, ADVISE_NODES, UNDERSTAND_COPY } from '@/content/how';

const STAGGER_S = 0.08;
const CONNECTOR_1_DELAY_S = COLLECT_NODES.length * STAGGER_S + 0.2;
const CONNECTOR_2_DELAY_S = CONNECTOR_1_DELAY_S + 0.7 + 0.2;

function StageTitle({ children }: { children: string }) {
  return (
    <h2 className="wt-entry text-center text-[color:var(--wt-text)] lg:text-left">
      {children}
    </h2>
  );
}

export function Pipeline() {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, amount: 0.25 });
  const active = reduce ? true : inView;

  return (
    <div ref={rootRef} className="flex flex-col gap-8">
      <StageTitle>Collect</StageTitle>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {COLLECT_NODES.map((node, i) => (
          <PipelineNodeCard key={node.id} node={node} index={i} active={active} />
        ))}
      </div>

      <div className="flex justify-center lg:justify-start lg:pl-6">
        <PipelineConnector active={active} delay={reduce ? 0 : CONNECTOR_1_DELAY_S} />
      </div>

      <StageTitle>Understand</StageTitle>
      <div className="mx-auto w-full max-w-xl lg:mx-0">
        <PipelineNodeCard
          node={{ id: 'understand', label: 'One read on the server', detail: UNDERSTAND_COPY }}
          size="lg"
          index={0}
          active={active}
        />
      </div>

      <div className="flex justify-center lg:justify-start lg:pl-6">
        <PipelineConnector active={active} delay={reduce ? 0 : CONNECTOR_2_DELAY_S} />
      </div>

      <StageTitle>Advise</StageTitle>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {ADVISE_NODES.map((node, i) => (
          <div key={node.id} className="flex flex-col gap-4">
            <PipelineNodeCard node={node} index={i} active={active} />
            {node.id === 'fix-inbox' ? (
              <ProductDesk surface="issues" cut="bands" chrome="bare" className="w-full" />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [x] Step 2: Verify it compiles

Run: `cd web/marketing && npm run lint`
Expected: no errors for `components/how/pipeline.tsx`

- [x] Step 3: Commit

```bash
git add web/marketing/components/how/pipeline.tsx
git commit -m "feat(marketing): add how-it-works pipeline orchestrator"
```

---

### Task 5: Build the standalone Close band

**Files:**
- Create: `web/marketing/components/how/how-close.tsx`

**Interfaces:**
- Consumes: `SparkProvider`, `useSpark`, `MagnetHit`, `DeskShapeGrid` from `@/components/motion`; `Cta` from `@/components/cta`; `MarginNote` from `@/components/type/margin-note`; `Reveal` from `@/components/reveal`; `ModrinthMark` from `@/components/brand/modrinth-mark`; `DEMO_URL`, `CLOSE_BODY`, `CLOSE_HEADLINE`, `FOOTNOTE`, `LINKS` from `@/content/product` (all existing, unchanged)
- Produces: `HowClose(): JSX.Element` — consumed by `app/how-it-works/page.tsx` in Task 6. Self-contained: wraps its own `SparkProvider` since the page no longer provides one via `ShiftLog`.

- [x] Step 1: Create the component

```tsx
'use client';

import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { Cta } from '@/components/cta';
import { MarginNote } from '@/components/type/margin-note';
import { Reveal } from '@/components/reveal';
import { DeskShapeGrid, MagnetHit, SparkProvider, useSpark } from '@/components/motion';
import { DEMO_URL, CLOSE_BODY, CLOSE_HEADLINE, FOOTNOTE, LINKS } from '@/content/product';

function HowCloseInner() {
  const { burst } = useSpark();

  return (
    <div className="relative overflow-hidden border-t border-[color:var(--wt-line)] py-20 md:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <DeskShapeGrid />
      </div>
      <div className="relative z-[1] mx-auto grid w-full max-w-[84rem] items-end gap-10 px-5 md:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
        <Reveal>
          <MarginNote className="mb-5 text-[0.8125rem]">End of shift</MarginNote>
          <h2 className="wt-display max-w-[16ch] text-[color:var(--wt-text)]">
            {CLOSE_HEADLINE}
          </h2>
        </Reveal>

        <Reveal delay={0.06} className="min-w-0">
          <p className="max-w-[40ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
            {CLOSE_BODY}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <MagnetHit>
              <span
                onPointerDown={(e) => burst(e.clientX, e.clientY, 'accent')}
                className="inline-flex"
              >
                <Cta href={DEMO_URL} withArrow newTab>
                  Open the demo
                </Cta>
              </span>
            </MagnetHit>
            <Cta
              href={LINKS.modrinth}
              variant="ghost"
              leading={<ModrinthMark className="h-3.5 w-3.5" />}
            >
              Get it on Modrinth
            </Cta>
          </div>
          <p className="mt-8 max-w-[46ch] font-mono text-[0.75rem] leading-relaxed text-[color:var(--wt-text-low)]">
            {FOOTNOTE}
          </p>
        </Reveal>
      </div>
    </div>
  );
}

export function HowClose() {
  return (
    <SparkProvider>
      <HowCloseInner />
    </SparkProvider>
  );
}
```

- [x] Step 2: Verify it compiles

Run: `cd web/marketing && npm run lint`
Expected: no errors for `components/how/how-close.tsx`

- [x] Step 3: Commit

```bash
git add web/marketing/components/how/how-close.tsx
git commit -m "feat(marketing): add standalone how-it-works close band"
```

---

### Task 6: Assemble the new page

**Files:**
- Modify (rewrite): `web/marketing/app/how-it-works/page.tsx`

**Interfaces:**
- Consumes: `Pipeline` (Task 4), `HowClose` (Task 5), `HOW_LEDE` (Task 2)

- [x] Step 1: Rewrite the page

```tsx
import type { Metadata } from 'next';
import { Pipeline } from '@/components/how/pipeline';
import { HowClose } from '@/components/how/how-close';
import { HOW_LEDE } from '@/content/how';

export const metadata: Metadata = { title: 'How it works' };

export default function HowItWorksPage() {
  return (
    <main>
      <section className="mx-auto w-full max-w-[84rem] px-5 pb-16 pt-20 md:px-8 md:pb-20 md:pt-28">
        <h1 className="wt-entry max-w-[18ch] text-[color:var(--wt-text)]">How it works</h1>
        <p className="mt-4 max-w-[56ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
          {HOW_LEDE}
        </p>
      </section>

      <section className="mx-auto w-full max-w-[84rem] px-5 pb-20 md:px-8 md:pb-28">
        <Pipeline />
      </section>

      <HowClose />
    </main>
  );
}
```

- [x] Step 2: Verify no old imports remain

Run: `grep -rn "entries/how/\|content/how-night\|content/how-it-works" web/marketing/app web/marketing/components`
Expected: no output

- [x] Step 3: Commit

```bash
git add web/marketing/app/how-it-works/page.tsx
git commit -m "feat(marketing): rebuild how-it-works as a mechanism pipeline page"
```

---

### Task 7: Update the audit script and do final verification

**Files:**
- Modify: `web/marketing/scripts/audit-shift-log.mjs`

- [x] Step 1: Remove the `EXPECTED_HOW_RAIL` block and its loop (reads `content/how-night.ts`, which no longer exists)

Delete these lines:

```js
// How it works operating-model tour rail
const EXPECTED_HOW_RAIL = [
  ['drop', 'Drop'],
  ['wizard', 'First run'],
  ['loop', 'Loop'],
  ['disk', 'On disk'],
  ['cli', 'CLI'],
  ['close', 'End of shift'],
];

const howNightPath = join(ROOT, 'content/how-night.ts');
const howNightText = readFileSync(howNightPath, 'utf8');
for (const [id, label] of EXPECTED_HOW_RAIL) {
  if (!new RegExp(`id:\\s*'${id}'`).test(howNightText)) {
    fail.push(`how-night.ts: missing id '${id}'`);
  }
  if (
    !howNightText.includes(`railLabel: '${label}'`) &&
    !howNightText.includes(`railLabel: "${label}"`)
  ) {
    fail.push(`how-night.ts: missing railLabel '${label}'`);
  }
}
if (/railLabel:\s*'[0-2]\d:[0-5]\d'/.test(howNightText)) {
  fail.push('how-night.ts: clock-style railLabel still present');
}

// How it works must not relocate promises / not-our-job
const howEntryFiles = files.filter((p) => rel(p).startsWith('components/entries/how/'));
for (const f of howEntryFiles) {
  const text = readFileSync(f, 'utf8');
  if (/\bPROMISES\b|\bNOT_OUR_JOB\b/.test(text)) {
    fail.push(`${rel(f)}: promises / not-our-job must stay off how-it-works`);
  }
}
```

Keep everything else in the file unchanged (the em-dash check, sub-12px font check, glow-token check, home `EXPECTED_RAIL` check, and feature-first left-column bans all still apply and are unrelated to how-it-works).

- [x] Step 2: Add a replacement check specific to the new page: no setup-step vocabulary should reappear on this route

```js
// How it works is a mechanism pipeline now, not a setup guide
const howPagePath = join(ROOT, 'app/how-it-works/page.tsx');
const howPageText = readFileSync(howPagePath, 'utf8');
if (/wizard|mods\/|disaster-recovery CLI|watchtower-cli/i.test(howPageText)) {
  fail.push('app/how-it-works/page.tsx: setup-guide vocabulary should live on Install, not here');
}
```

Add this block where the old `EXPECTED_HOW_RAIL` block was removed.

- [x] Step 3: Run the audit

Run: `cd web/marketing && node scripts/audit-shift-log.mjs`
Expected: `audit-shift-log OK (N files scanned)` with exit code 0 (file count will be lower than before since 14 files were deleted)

- [x] Step 4: Run the full lint and build as final verification

Run: `cd web/marketing && npm run lint`
Expected: no errors

Run: `cd web/marketing && npm run build`
Expected: build succeeds, `/how-it-works` listed in the route output

- [x] Step 5: Commit

```bash
git add web/marketing/scripts/audit-shift-log.mjs
git commit -m "chore(marketing): update audit for how-it-works pipeline rebuild"
```

---

## Acceptance

- `/how-it-works` has no `ShiftLog`/`ShiftEntry` usage (verified by grep in Task 6)
- One continuous Collect → Understand → Advise diagram with staggered reveal and a settling pulse between stages
- Exactly one `ProductDesk` mock on the page, under the Fix inbox node
- No setup-step vocabulary on the page (enforced by the new audit check in Task 7)
- Reduced motion renders instantly, fully visible, no animation
- `node scripts/audit-shift-log.mjs` and `npm run build` both pass
- Home page and `components/shift-log/*` are untouched
