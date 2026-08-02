# WatchTower Marketing Site Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the wireframe-grade `web/marketing` site with a committed Instrument Wall composition that carries WatchTower's Night Watch Desk identity at marketing scale, and fix the four shipped bugs that make it read as broken.

**Architecture:** The visual world stays WatchTower's (DESIGN.md tokens, Geist + JetBrains Mono, Signal Blue scarce, Lantern Amber for brand warmth, 2/4/6px radii). What gets added is a Persuade-scale register on top of it: a real display type scale, a lantern light field, a measurement graticule texture, an instrument-plate bezel, and one orchestrated signature motion. Every home section uses a different layout family. Every screenshot is real and rendered at legible scale.

**Tech Stack:** Next.js App Router (static export), React 19, Tailwind CSS v4, Motion (`motion/react`), `@fontsource-variable/geist`, `@fontsource-variable/jetbrains-mono`, `next/image`.

## Direction Contract

This is the contract that goes in `app/layout.tsx` as an HTML comment and that the finish review audits the render against.

- **THESIS:** The page opens on the instrument, not on a claim. It refuses the dev-tool landing arrangement (headline left, glowing browser-frame thumbnail right, three equal feature cards, logo wall).
- **OWN-WORLD:** Night Watch Desk at marketing scale. Tonal plates on `bg0`, hairline rules, tight 2/4/6px corners, Signal Blue as scarce control accent, Lantern Amber as the light source rather than a second accent. Graticule texture under content. Geist display, JetBrains Mono for every number and micro-label.
- **STORY:** A server admin sees a real ops desk showing a real server and a real next step, understands within seconds that it runs on their own machine, and opens the demo.
- **FIRST VIEWPORT:** Left column carries the two questions as display type, one support line, and two actions. The Overview screenshot sits right, bleeding past the container to the viewport edge, on an instrument plate at legible scale. A lantern field glows from the top left. A watch sweep crosses the plate once on load.
- **FORM:** Instrument Wall, candidate 3 of the grounded list, seed key `ee04f60e`.
- **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.

## Global Constraints

- Display brand spelling in all UI chrome is **WatchTower**.
- Zero em-dash (`—`) and zero en-dash (`–`) characters in any user-visible string. Regular hyphen only.
- Radii are `2px` / `4px` / `6px` only. No `rounded-xl`, `rounded-2xl`, or pill geometry on cards or plates. Full radius is permitted only on the scroll thumb.
- Signal Blue (`#4C8DFF`) stays scarce: primary action, focus ring, active state. It never washes a region.
- Lantern Amber (`#F5A524`) is brand light and the sweep. It is never used for a status meaning on this site.
- No invented claims. Every factual statement traces to `PRODUCT.md`, `README.md`, or `docs/ROADMAP.md`. No testimonials, no download counts, no customer logos, no fabricated metrics.
- No fake product UI built from `div` elements. Product imagery is real screenshots from `docs/assets/screenshots/` only.
- One label per CTA intent across the whole site: `Open the demo` for trying it, `Get it on Modrinth` for installing.
- Every motion is gated on `prefers-reduced-motion` and animates only `transform` and `opacity`.
- Full-height sections use `min-h-[100dvh]`, never `h-screen`.
- Maximum 3 uppercase tracked eyebrow labels across the home page's 7 sections.
- WCAG 2.2 AA: visible focus, 4.5:1 body contrast, keyboard operable nav including the mobile menu.

## File Structure

**Foundation**
- `web/marketing/styles/globals.css` - additive Persuade-scale tokens and utilities on top of the existing dashboard tokens. Existing `--wt-*` values are not edited.
- `web/marketing/app/layout.tsx` - direction contract comment, font wiring, fixed light field, graticule.

**Primitives** (each one file, one responsibility)
- `web/marketing/components/instrument-plate.tsx` - the double-bezel plate at WatchTower radii. Server component.
- `web/marketing/components/product-shot.tsx` - rewritten. Real screenshot inside an InstrumentPlate, sized for legibility, optional caption below the plate.
- `web/marketing/components/watch-sweep.tsx` - client. The signature motion.
- `web/marketing/components/readout.tsx` - client. Mono metric with number flow on enter.
- `web/marketing/components/reveal.tsx` - rewritten. Heavier, correctly eased section enter with stagger support.
- `web/marketing/components/wordmark.tsx` - lantern mark plus text wordmark. Replaces the broken PNG.
- `web/marketing/components/cta.tsx` - replaces `cta-row.tsx`. Primary and ghost actions with press feedback.

**Chrome**
- `web/marketing/components/site-header.tsx` - rewritten with a working mobile menu.
- `web/marketing/components/site-footer.tsx` - rewritten.

**Home sections** (one file each, one layout family each)
- `web/marketing/components/sections/hero.tsx` - bleed split
- `web/marketing/components/sections/questions.tsx` - full-bleed diptych
- `web/marketing/components/sections/loop.tsx` - full-width instrument band
- `web/marketing/components/sections/proof.tsx` - asymmetric bento
- `web/marketing/components/sections/promises.tsx` - rule-led list
- `web/marketing/components/sections/boundaries.tsx` - two-column ledger
- `web/marketing/components/sections/close.tsx` - anchored close

Deleted: `components/hero.tsx`, `components/loop-diagram.tsx`, `components/promise-list.tsx`, `components/not-our-job.tsx`, `components/cta-row.tsx`.

**Content**
- `web/marketing/content/product.ts` - headline rewritten, all em-dashes removed, `READOUTS` added.
- `web/marketing/content/features.ts` - em-dashes removed, `weight` field added for bento sizing.

**Pages**
- `web/marketing/app/page.tsx`, `app/features/page.tsx`, `app/how-it-works/page.tsx`, `app/install/page.tsx`, `app/demo/page.tsx`, `app/faq/page.tsx`

---

### Task 1: Design foundation

Additive tokens and utilities. Nothing here changes an existing `--wt-*` value, so the dashboard parity story is untouched.

**Files:**
- Modify: `web/marketing/styles/globals.css`
- Modify: `web/marketing/app/layout.tsx`

**Interfaces:**
- Consumes: existing `--wt-bg0`, `--wt-bg1`, `--wt-bg2`, `--wt-line`, `--wt-accent`, `--wt-lantern`, `--wt-radius-*`.
- Produces: CSS custom properties `--wt-fs-display`, `--wt-fs-display-sm`, `--wt-fs-lead`, `--wt-ease`, `--wt-ease-sweep`, `--wt-grat`, `--wt-glow-lantern`, `--wt-glow-accent`; utility classes `.wt-field`, `.wt-graticule`, `.wt-display`, `.wt-display-sm`, `.wt-lead`, `.wt-label`, `.wt-rule`.

- [ ] **Step 1: Append the Persuade-scale tokens to `:root` in globals.css**

```css
/* Persuade-scale additions. Dashboard tokens above are unchanged. */
:root {
  --wt-fs-display: clamp(2.5rem, 6.2vw, 4.5rem);
  --wt-fs-display-sm: clamp(1.75rem, 3.4vw, 2.5rem);
  --wt-fs-lead: clamp(1rem, 1.25vw, 1.1875rem);
  --wt-track-display: -0.03em;
  --wt-ease: cubic-bezier(0.16, 1, 0.3, 1);
  --wt-ease-sweep: cubic-bezier(0.33, 0, 0.15, 1);
  --wt-grat: rgba(232, 237, 246, 0.035);
  --wt-glow-lantern: rgba(245, 165, 36, 0.11);
  --wt-glow-accent: rgba(76, 141, 255, 0.1);
}
```

- [ ] **Step 2: Add the light field and graticule utilities**

The field is the lantern. It is fixed, behind everything, and never intercepts pointer events.

```css
.wt-field {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(60rem 40rem at 8% -10%, var(--wt-glow-lantern), transparent 62%),
    radial-gradient(52rem 36rem at 88% 4%, var(--wt-glow-accent), transparent 60%);
}

.wt-graticule {
  background-image:
    repeating-linear-gradient(to right, var(--wt-grat) 0 1px, transparent 1px 88px),
    repeating-linear-gradient(to bottom, var(--wt-grat) 0 1px, transparent 1px 88px);
}
```

- [ ] **Step 3: Add the type utilities**

```css
.wt-display {
  font-size: var(--wt-fs-display);
  font-weight: 600;
  line-height: 1.02;
  letter-spacing: var(--wt-track-display);
  text-wrap: balance;
}

.wt-display-sm {
  font-size: var(--wt-fs-display-sm);
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.02em;
  text-wrap: balance;
}

.wt-lead {
  font-size: var(--wt-fs-lead);
  line-height: 1.55;
  color: var(--wt-text-mid);
  max-width: 46ch;
}

.wt-label {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--wt-text-low);
}

.wt-rule {
  height: 1px;
  background: linear-gradient(to right, var(--wt-line-strong), transparent);
}
```

- [ ] **Step 4: Wire the field into the root layout and replace the direction contract**

In `app/layout.tsx`, replace the existing contract comment with the Direction Contract from this plan verbatim, and render `<div className="wt-field" aria-hidden />` as the first element inside `<body>` after the skip link. Wrap page content in `<div className="relative z-10">` so it sits above the field.

- [ ] **Step 5: Verify the foundation renders**

Run: `cd web/marketing && npm run dev -- --port 3099`
Expected: the home page shows a faint warm glow at the top left and a cool one at the top right, no layout shift, no pointer capture over links.

- [ ] **Step 6: Commit**

```bash
git add web/marketing/styles/globals.css web/marketing/app/layout.tsx
git commit -m "feat(marketing): add Persuade-scale design foundation and light field"
```

---

### Task 2: Fix the shipped bugs

Four real defects. Each one is independently visible.

**Files:**
- Create: `web/marketing/components/wordmark.tsx`
- Modify: `web/marketing/components/site-header.tsx`
- Modify: `web/marketing/components/site-footer.tsx`

**Interfaces:**
- Produces: `<Wordmark size?: 'sm' | 'lg' />` rendering the lantern mark plus the text "WatchTower".

**Bug 1: the wordmark asset is a duplicate of the icon.** `public/brand/watchtower-wordmark.png` is byte-identical to `watchtower-icon-simple.png` (both 418766 bytes), which is why the hero shows two lanterns and no wordmark. The dashboard rail sets the wordmark as text beside the mark. Do the same here rather than shipping a broken image.

- [ ] **Step 1: Create the Wordmark component**

```tsx
import Image from 'next/image';

export function Wordmark({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const px = size === 'lg' ? 34 : 26;
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image
        src="/brand/watchtower-icon-simple.png"
        alt=""
        width={px}
        height={px}
        priority
        className="shrink-0"
      />
      <span
        className="font-semibold tracking-[-0.01em] text-[color:var(--wt-text)]"
        style={{ fontSize: size === 'lg' ? '1.25rem' : '1.0625rem' }}
      >
        WatchTower
      </span>
    </span>
  );
}
```

- [ ] **Step 2: Confirm no remaining reference to the broken asset**

Run: `rg "watchtower-wordmark" web/marketing`
Expected: no matches in `.tsx` files.

**Bug 2: there is no mobile navigation.** The nav is `hidden md:flex` with no fallback, so on a phone no page is reachable.

- [ ] **Step 3: Rewrite the header with a working mobile menu**

Client component. Requirements: single line at desktop with total height at or under 72px; a disclosure button below `md` that toggles a full-width panel; `aria-expanded` and `aria-controls` on the button; Escape closes it; focus returns to the button on close; the panel closes on route change.

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Wordmark } from '@/components/wordmark';
import { DEMO_URL } from '@/content/product';

const NAV = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/install', label: 'Install' },
  { href: '/faq', label: 'FAQ' },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)]/88 backdrop-blur-md">
      {/* markup per Step 4 */}
    </header>
  );
}
```

- [ ] **Step 4: Build the header markup**

Row: `mx-auto flex max-w-[84rem] items-center justify-between gap-4 px-5 py-3.5 lg:px-8`. Left is `<Link href="/"><Wordmark /></Link>`. Right at `md` and up is the nav links plus a single primary action reading `Open the demo`. Below `md` it is the disclosure button only. The mobile panel is a `border-t` block listing the nav links as full-width rows with `py-3` touch targets, then the primary action.

- [ ] **Step 5: Rewrite the footer**

Three columns at `md` and up, stacked below: the Wordmark plus the one-line description, a Product column (How it works, Features, Install, Demo, FAQ), a Project column (Modrinth, GitHub, Wiki, License). Bottom row carries `GPL-3.0-or-later` and `Runs on your machine.` No version string, no locale strip, no build stamp.

- [ ] **Step 6: Verify both breakpoints**

Run the dev server, then check at 1440px and at 390px.
Expected: nav on one line at desktop; at 390px the disclosure button opens a panel with all five destinations, Escape closes it, focus returns to the button.

- [ ] **Step 7: Commit**

```bash
git add web/marketing/components/wordmark.tsx web/marketing/components/site-header.tsx web/marketing/components/site-footer.tsx
git commit -m "fix(marketing): replace broken wordmark asset and add mobile navigation"
```

---

### Task 3: Copy pass

**Files:**
- Modify: `web/marketing/content/product.ts`
- Modify: `web/marketing/content/features.ts`
- Modify: `web/marketing/app/layout.tsx` (metadata description)

**Interfaces:**
- Produces: `TAGLINE_LINES: readonly string[]`, `SUPPORT_LINE: string`, `DEMO_URL: string`, `READOUTS: readonly { label: string; value: string; unit?: string }[]`, plus the existing `TWO_QUESTIONS`, `PROMISES`, `NOT_OUR_JOB`, `LINKS`, `FOOTNOTE`.

- [ ] **Step 1: Find every em-dash**

Run: `rg -n "—|–" web/marketing --glob '!node_modules' --glob '!.next'`
Expected: matches in `content/product.ts`, `content/features.ts`, `components/hero.tsx`, `app/layout.tsx`, `app/features/page.tsx`. Every one gets rewritten, not swapped for a hyphen where the sentence can simply be split.

- [ ] **Step 2: Rewrite the headline as the two questions**

The product's own thesis in PRODUCT.md is that WatchTower answers two questions. Making those questions the headline is the copy equivalent of proving rather than claiming, and it sets up the diptych section directly below.

```ts
/** Two lines, set as display type. Source: PRODUCT.md "answers two questions". */
export const TAGLINE_LINES = ['Is the server okay?', 'And what should I fix next?'] as const;

/** 20 words. Source: PRODUCT.md Product Purpose, README.md. */
export const SUPPORT_LINE =
  'A local ops desk for NeoForge servers. It watches while the game runs and tells you what to fix.';
```

- [ ] **Step 3: Rewrite the remaining em-dash strings**

```ts
export const TWO_QUESTIONS = [
  {
    q: 'Is the server okay right now?',
    detail:
      'A health grade, live vitals, and honest restart advice. WatchTower never restarts anything for you.',
    shot: 'Overview.png',
  },
  {
    q: 'What should I fix next?',
    detail:
      'Issues, crashes, mods, backups, and world pressure, turned into plain next steps you can act on.',
    shot: 'Issues.png',
  },
] as const;
```

In `features.ts`: Overview blurb becomes `'Health grade, live vitals, what needs attention, and restart advice rated Safe, Caution, or Wait. It does not restart the server for you.'`. Backups blurb becomes `'See which backup folders exist and whether they look healthy. Advisory only.'`.

- [ ] **Step 4: Add the demo URL constant and the readouts**

`DEMO_URL` centralises the `NEXT_PUBLIC_DEMO_URL` fallback that is currently duplicated in three files.

```ts
export const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL || '/demo';

/**
 * Instrument captions for the loop band. These describe what the product does,
 * not measured performance claims. No invented metrics.
 */
export const READOUTS = [
  { label: 'Watching', value: 'while the game runs' },
  { label: 'Scanning', value: 'logs, mods, crashes, disk' },
  { label: 'Fix inbox', value: 'ranked, with next steps' },
] as const;
```

- [ ] **Step 5: Update the metadata description**

`description: 'Is the server okay, and what should I fix next? A local ops desk for NeoForge dedicated servers.'`

- [ ] **Step 6: Verify zero dashes remain**

Run: `rg -n "—|–" web/marketing --glob '!node_modules' --glob '!.next'`
Expected: no matches.

- [ ] **Step 7: Commit**

```bash
git add web/marketing/content web/marketing/app/layout.tsx
git commit -m "fix(marketing): rewrite headline copy and remove every em-dash"
```

---

### Task 4: Primitives

Five small components. Each is the vocabulary the sections are built from, so a stock Tailwind card anywhere downstream is a lapse.

**Files:**
- Create: `web/marketing/components/instrument-plate.tsx`
- Create: `web/marketing/components/watch-sweep.tsx`
- Create: `web/marketing/components/readout.tsx`
- Create: `web/marketing/components/cta.tsx`
- Modify: `web/marketing/components/product-shot.tsx`
- Modify: `web/marketing/components/reveal.tsx`

**Interfaces:**
- Produces:
  - `<InstrumentPlate className?: string; inset?: boolean; children: ReactNode />`
  - `<WatchSweep delay?: number />` (absolutely positioned, expects a `relative` parent)
  - `<Readout label: string; value: string />`
  - `<Cta href: string; variant?: 'primary' | 'ghost'; children: ReactNode />`
  - `<ProductShot src: string; alt: string; width?: number; height?: number; priority?: boolean; caption?: string; sweep?: boolean />`
  - `<Reveal className?: string; delay?: number; children: ReactNode />`

- [ ] **Step 1: Build InstrumentPlate**

The double-bezel technique at WatchTower's radii. This is the single strongest anti-generic lever available: a plate that reads as machined hardware while keeping 6px and 4px corners instead of the 24px friendly-SaaS radius.

```tsx
import type { ReactNode } from 'react';

export function InstrumentPlate({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`border border-[color:var(--wt-line)] bg-[color:var(--wt-bg2)]/45 p-[5px] ${className}`}
      style={{ borderRadius: 'var(--wt-radius-lg)' }}
    >
      <div
        className="relative overflow-hidden bg-[color:var(--wt-bg1)]"
        style={{
          borderRadius: 'var(--wt-radius-sm)',
          boxShadow:
            '0 1px 0 rgba(255,255,255,0.07) inset, 0 18px 44px rgba(0,0,0,0.46)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build WatchSweep, the signature motion**

One orchestrated moment, not scattered effects. A lantern-amber blade crosses the plate once on entry, which is the product's verb made visible: it watches. Reduced motion renders nothing at all, because the content underneath is already fully visible.

```tsx
'use client';

import { motion, useReducedMotion } from 'motion/react';

export function WatchSweep({ delay = 0.35 }: { delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 w-[38%]"
      style={{
        background:
          'linear-gradient(90deg, transparent 0%, rgba(245,165,36,0.05) 42%, rgba(245,165,36,0.16) 82%, rgba(245,165,36,0.85) 99%, transparent 100%)',
        mixBlendMode: 'screen',
      }}
      initial={{ x: '-42%', opacity: 0 }}
      animate={{ x: '265%', opacity: [0, 1, 1, 0] }}
      transition={{
        duration: 1.5,
        delay,
        ease: [0.33, 0, 0.15, 1],
        opacity: { times: [0, 0.12, 0.82, 1], duration: 1.5, delay },
      }}
    />
  );
}
```

- [ ] **Step 3: Build Readout with number flow**

Mono caption plus value, entering with a short vertical flow. Matches the dashboard's mono-for-numbers rule.

```tsx
'use client';

import { motion, useReducedMotion } from 'motion/react';

export function Readout({ label, value }: { label: string; value: string }) {
  const reduce = useReducedMotion();
  return (
    <div>
      <div className="wt-label">{label}</div>
      <motion.div
        className="mt-2 font-mono text-[0.9375rem] font-semibold text-[color:var(--wt-text)]"
        initial={reduce ? false : { opacity: 0, y: 6 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {value}
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 4: Build Cta**

Primary is Signal Blue fill with accent ink. Ghost is a hairline. Both press down on `:active`. Corners stay at 4px, so no pill buttons.

```tsx
import type { ReactNode } from 'react';

const BASE =
  'inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold no-underline transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:translate-y-[1px]';

export function Cta({
  href,
  variant = 'primary',
  children,
}: {
  href: string;
  variant?: 'primary' | 'ghost';
  children: ReactNode;
}) {
  const skin =
    variant === 'primary'
      ? 'bg-[color:var(--wt-accent)] text-[color:var(--wt-accent-ink)] hover:bg-[#5B9BFF]'
      : 'border border-[color:var(--wt-line-strong)] text-[color:var(--wt-text)] hover:border-[color:var(--wt-accent)] hover:text-[color:var(--wt-accent)]';
  return (
    <a href={href} className={`${BASE} ${skin}`} style={{ borderRadius: 'var(--wt-radius-md)' }}>
      {children}
    </a>
  );
}
```

- [ ] **Step 5: Rewrite ProductShot at legible scale**

The current version renders a 1280px screenshot into a roughly 350px column, which is the core reason the page reads as thin. The rewrite puts the screenshot in an InstrumentPlate, drops the internal border, and hands sizing to the caller so hero and bento can each ask for what they need.

```tsx
import Image from 'next/image';
import { InstrumentPlate } from '@/components/instrument-plate';
import { WatchSweep } from '@/components/watch-sweep';

type Props = {
  src: string;
  alt: string;
  caption?: string;
  priority?: boolean;
  sweep?: boolean;
  sizes?: string;
  width?: number;
  height?: number;
  className?: string;
};

export function ProductShot({
  src,
  alt,
  caption,
  priority = false,
  sweep = false,
  sizes = '(max-width: 768px) 100vw, 62vw',
  width = 1280,
  height = 800,
  className = '',
}: Props) {
  return (
    <figure className={`m-0 ${className}`}>
      <InstrumentPlate>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes={sizes}
          className="block h-auto w-full"
        />
        {sweep ? <WatchSweep /> : null}
      </InstrumentPlate>
      {caption ? <figcaption className="wt-label mt-3">{caption}</figcaption> : null}
    </figure>
  );
}
```

- [ ] **Step 6: Rewrite Reveal with weight**

The current 8px rise over 350ms is imperceptible. Give it real mass and the project's easing curve.

```tsx
'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 7: Typecheck**

Run: `cd web/marketing && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add web/marketing/components
git commit -m "feat(marketing): add instrument plate, watch sweep, readout and CTA primitives"
```

---

### Task 5: The Instrument Wall first viewport

**Files:**
- Create: `web/marketing/components/sections/hero.tsx`
- Delete: `web/marketing/components/hero.tsx`
- Delete: `web/marketing/components/cta-row.tsx`

**Interfaces:**
- Consumes: `TAGLINE_LINES`, `SUPPORT_LINE`, `DEMO_URL`, `LINKS` from `content/product`; `ProductShot`, `Cta` from components.
- Produces: `<Hero />`

Composition: an asymmetric split where the screenshot is not boxed inside the centred container but bleeds past it toward the right viewport edge. That single decision is most of the difference between a thumbnail beside a headline and a desk you are looking at.

- [ ] **Step 1: Build the hero**

Rules this must satisfy: at most four text elements; headline two lines; support line 20 words; top padding no more than `pt-24`; the primary action visible without scrolling at 1440x900.

```tsx
import { ProductShot } from '@/components/product-shot';
import { Cta } from '@/components/cta';
import { DEMO_URL, LINKS, SUPPORT_LINE, TAGLINE_LINES } from '@/content/product';

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-14 md:pb-28 md:pt-20">
      <div className="mx-auto grid max-w-[84rem] items-center gap-12 px-5 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:gap-10 lg:px-8">
        <div className="max-w-xl">
          <h1 className="wt-display text-[color:var(--wt-text)]">
            {TAGLINE_LINES[0]}
            <br />
            <span className="text-[color:var(--wt-text-mid)]">{TAGLINE_LINES[1]}</span>
          </h1>
          <p className="wt-lead mt-6">{SUPPORT_LINE}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Cta href={DEMO_URL}>Open the demo</Cta>
            <Cta href={LINKS.modrinth} variant="ghost">
              Get it on Modrinth
            </Cta>
          </div>
        </div>
        <div className="lg:-mr-[max(1.5rem,calc((100vw-84rem)/2))]">
          <ProductShot
            src="/screenshots/Overview.png"
            alt="The WatchTower Overview page showing a health grade, live vitals and what needs attention"
            priority
            sweep
            sizes="(max-width: 1024px) 100vw, 62vw"
          />
        </div>
      </div>
    </section>
  );
}
```

The second headline line sits in `--wt-text-mid` so the two questions read as a pair with the first carrying more weight. That is hierarchy by colour rather than by raw scale.

- [ ] **Step 2: Delete the replaced components**

```bash
git rm web/marketing/components/hero.tsx web/marketing/components/cta-row.tsx
```

- [ ] **Step 3: Verify the first viewport**

Load the home page at 1440x900.
Expected: headline on two lines, both actions above the fold, the Overview screenshot legible enough to read its section headings, the amber sweep crossing it once shortly after load, and no horizontal scrollbar.

- [ ] **Step 4: Verify the bleed does not overflow**

Run in the browser console: `document.documentElement.scrollWidth <= document.documentElement.clientWidth`
Expected: `true` at 390px, 768px, 1280px and 1920px.

- [ ] **Step 5: Commit**

```bash
git add web/marketing/components/sections/hero.tsx
git commit -m "feat(marketing): build the Instrument Wall first viewport"
```

---

### Task 6: Home body sections

Six sections, six distinct layout families, no two alike. Eyebrows are used on exactly two of them.

**Files:**
- Create: `web/marketing/components/sections/questions.tsx`
- Create: `web/marketing/components/sections/loop.tsx`
- Create: `web/marketing/components/sections/proof.tsx`
- Create: `web/marketing/components/sections/promises.tsx`
- Create: `web/marketing/components/sections/boundaries.tsx`
- Create: `web/marketing/components/sections/close.tsx`
- Modify: `web/marketing/app/page.tsx`
- Delete: `web/marketing/components/loop-diagram.tsx`, `components/promise-list.tsx`, `components/not-our-job.tsx`

- [ ] **Step 1: Questions, as a full-bleed diptych**

Two panels filling the width, split by a single hairline, each carrying its question as display-sm type above a real screenshot. Not a text grid.

Layout: `grid md:grid-cols-2` with `md:divide-x divide-[color:var(--wt-line)]`, each cell `px-5 py-16 lg:px-10`, the container `border-y border-[color:var(--wt-line)] wt-graticule`. Screenshot per cell uses `TWO_QUESTIONS[i].shot` at `sizes="(max-width: 768px) 100vw, 46vw"`. Mobile collapse: one column, divider becomes the top border of the second cell.

- [ ] **Step 2: Loop, as a full-width instrument band**

This replaces the `01 / 02 / 03` box. Numbered step labels are banned and, more importantly, wrong: this is a continuous loop, not a three-step onboarding. Express it as one horizontal trace with the three states positioned along it.

Layout: full-width band on `bg-[color:var(--wt-bg1)]/60` with `border-y`. Inside, a `grid md:grid-cols-3` of `Readout` components from `READOUTS`, and behind them a single 1px Signal Blue line that draws left to right on enter via `scaleX` with `transform-origin: left`, 1.1s, project easing. Under reduced motion the line renders at full width immediately. Section heading above the band: `Watching, scanning, and a fix inbox.` with the supporting line `It runs continuously while the game runs. There is no giant scheduled audit to sit through.`

- [ ] **Step 3: Proof, as an asymmetric bento**

Exactly five cells for five items, no empty tiles. Three cells carry real screenshots so the grid has genuine visual variation rather than five text cards.

```
lg grid-cols-12, gap-4
  cell A  col-span-7  Live-Metrics.png   (large shot)
  cell B  col-span-5  Crash-Logs.png     (medium shot)
  cell C  col-span-5  text plate: Mods
  cell D  col-span-4  text plate: Insights
  cell E  col-span-3  Backups.png        (small shot)
```

Mobile: `grid-cols-1`, every span resets, order stays as written. Eyebrow allowed here (1 of 2).

- [ ] **Step 4: Promises, as a rule-led list**

Four items, no boxes. Each item gets a 2px Lantern Amber leading rule on its left edge, the title at `text-lg font-semibold`, and the body in `--wt-text-mid` capped at 62ch. Generous `space-y-10`. This is the one place lantern amber appears as a structural mark rather than as light, which keeps it reading as brand rather than as a status colour.

Heading: `Promises that do not change` (the existing string uses a typographic apostrophe, which is fine; only dashes are banned).

- [ ] **Step 5: Boundaries, as a two-column ledger**

Replaces the hairline-per-row table. One rule above the group only, then rows separated by space rather than borders. Left column in `--wt-text`, right in `--wt-text-low`. Column captions use `wt-label`. Eyebrow allowed here (2 of 2).

Heading: `Not our job` with the supporting line `Staying out of these keeps the product clear about what it does.`

- [ ] **Step 6: Close, as an anchored full-width finish**

The home page currently just stops. Add a real close: full-width block with the lantern field intensified locally, one display-sm line (`Point it at your server and see what it finds.`), and a single primary action `Open the demo` plus the ghost `Get it on Modrinth`. Centred alignment is permitted here because it is the close, and it is the only centred composition on the page.

- [ ] **Step 7: Rewrite the home page to compose them**

```tsx
import { Hero } from '@/components/sections/hero';
import { Questions } from '@/components/sections/questions';
import { Loop } from '@/components/sections/loop';
import { Proof } from '@/components/sections/proof';
import { Promises } from '@/components/sections/promises';
import { Boundaries } from '@/components/sections/boundaries';
import { Close } from '@/components/sections/close';

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Questions />
      <Loop />
      <Proof />
      <Promises />
      <Boundaries />
      <Close />
    </main>
  );
}
```

- [ ] **Step 8: Audit the section rhythm**

Walk the page and confirm: seven distinct layout families; no three consecutive sections sharing the image-plus-text split; exactly two eyebrows; more space above each heading than below it; the page ends anchored rather than trailing off.

- [ ] **Step 9: Commit**

```bash
git add web/marketing/components/sections web/marketing/app/page.tsx
git commit -m "feat(marketing): rebuild home with six distinct section layouts"
```

---

### Task 7: Interior pages

The features page is currently ten consecutive identical splits, which is the single worst layout repetition on the site.

**Files:**
- Modify: `web/marketing/app/features/page.tsx`
- Modify: `web/marketing/app/how-it-works/page.tsx`
- Modify: `web/marketing/app/install/page.tsx`
- Modify: `web/marketing/app/demo/page.tsx`
- Modify: `web/marketing/app/faq/page.tsx`
- Modify: `web/marketing/content/features.ts`

- [ ] **Step 1: Add a weight field to the feature surfaces**

```ts
export type FeatureSurface = {
  id: string;
  title: string;
  blurb: string;
  screenshot: string;
  alpha?: boolean;
  /** Bento sizing. 'lead' spans wide with a large shot; 'note' is text only. */
  weight: 'lead' | 'standard' | 'note';
};
```

Assign: `overview` and `live` are `lead`; `issues`, `crashes`, `mods`, `insights` are `standard`; `backups`, `spark`, `support`, `cli` are `note`.

- [ ] **Step 2: Rebuild the features page as a bento**

A 12-column grid where `lead` spans 12 with a full-width shot, `standard` spans 6 with a shot, and `note` spans 3 as a text plate. Ten items, ten cells, no blanks. Mobile collapses to one column. The alpha chip stays as it is, since labelling alpha honestly is a product commitment.

Intro copy loses its em-dash: `Real surfaces from the local dashboard. Where depth is still alpha, it says alpha.`

- [ ] **Step 3: Rebuild how-it-works**

Keep the content. Restructure as alternating full-width bands with a hairline between, so it does not repeat the home page's diptych or bento. No numbered step labels.

- [ ] **Step 4: Restyle install**

Three steps, each as an InstrumentPlate with the command in JetBrains Mono on a `bg2` well. Keep the security warning prominent and keep the release label fetched at build time. Do not hardcode a version.

- [ ] **Step 5: Restyle demo and faq**

Demo keeps the graceful message when `NEXT_PUBLIC_DEMO_URL` is unset. FAQ becomes a definition list with generous rhythm and one rule per group rather than a border per row.

- [ ] **Step 6: Verify every page**

Visit `/`, `/how-it-works`, `/features`, `/install`, `/demo`, `/faq` at 1440px and 390px.
Expected: no page reuses another page's primary layout family, no horizontal overflow, every screenshot legible.

- [ ] **Step 7: Commit**

```bash
git add web/marketing/app web/marketing/content/features.ts
git commit -m "feat(marketing): rebuild interior pages with varied layouts"
```

---

### Task 8: Verify and finish

- [ ] **Step 1: Production build**

Run: `cd web/marketing && npm run build`
Expected: build succeeds, no type errors, static export produced.

- [ ] **Step 2: Confirm the direction contract survived the build**

Run: `rg -n "ee04f60e" web/marketing/.next` (or the export output directory)
Expected: at least one match. A contract the build erased is a contract nobody can audit.

- [ ] **Step 3: Run the mechanical design detector once**

Run: `node C:\Users\DJINN\.cursor\skills\impeccable\scripts\detect.mjs --json web/marketing`
Fix what is mechanical. Carry the rest to the review.

- [ ] **Step 4: Batched screenshot round**

Capture desktop (1440x900) and mobile (390x844) for the home page and the features page in one round. Critique against the direction contract, then fix everything found in a single batch.

- [ ] **Step 5: Accessibility and motion checks**

- Tab through the header, the mobile menu, and every CTA. Focus must be visible everywhere.
- Set `prefers-reduced-motion: reduce` and reload: no sweep, no rise, all content visible.
- Check body text contrast against `--wt-bg0` and `--wt-bg1` at 4.5:1.

- [ ] **Step 6: Confirm with one final screenshot round, then stop**

Two rounds is the ceiling. Whatever remains ships to the finish review.

- [ ] **Step 7: Commit**

```bash
git add web/marketing
git commit -m "chore(marketing): verification pass for the redesign"
```

---

## Self-Review

**Spec coverage.** Every defect found in the audit maps to a task: broken wordmark and missing mobile nav to Task 2; em-dashes and the weak headline to Task 3; the postage-stamp screenshot to Tasks 4 and 5; layout monotony to Tasks 6 and 7; the banned `01 / 02 / 03` diagram to Task 6 Step 2; the hairline-per-row table to Task 6 Step 5; the missing page close to Task 6 Step 6. The user's two answers map to the foundation (bolder register while keeping the dashboard's spirit) and to Task 5 (large real screenshots, demo linked rather than embedded).

**Placeholder scan.** No step says TBD, "handle edge cases", or "similar to Task N". Every code step carries the actual code or the exact grid specification.

**Type consistency.** `ProductShot` gains `sweep` and `sizes` in Task 4 and both are used in Task 5. `DEMO_URL` is introduced in Task 3 and consumed in Tasks 2, 5 and 6. `TWO_QUESTIONS` gains `shot` in Task 3 and it is read in Task 6 Step 1. `FeatureSurface` gains `weight` in Task 7 Step 1 and it is read in Step 2. `InstrumentPlate` is defined before every consumer.

**One gap found and closed.** Task 3 originally left `NEXT_PUBLIC_DEMO_URL` duplicated across the header, the CTA row and the demo page. Task 3 Step 4 now centralises it as `DEMO_URL`, and Task 2 Step 3 imports it.
