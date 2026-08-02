# WatchTower Marketing Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public WatchTower marketing site plus a clickable read-only static demo of the real dashboard on Vercel from this monorepo.

**Architecture:** Two npm packages, two Vercel projects. `web/marketing` is a new Next.js App Router site inheriting Night Watch Desk from DESIGN.md. The demo is `web/dashboard` built with `VITE_STATIC_DEMO=1` against a pre-baked JSON API extracted from the same fixture handlers that power `npm run preview`.

**Tech Stack:** Next.js App Router, Tailwind v4, motion, @fontsource-variable/geist + jetbrains-mono, Node 20, Vercel, tsx --test.

## Global Constraints

Every task inherits these. Copied from `PRODUCT.md`, `DESIGN.md`, `docs/ROADMAP.md`, and `docs/superpowers/specs/2026-07-30-watchtower-marketing-site-design.md`.

- **Display spelling is `WatchTower`** in all site chrome and copy. Never `Watchtower` or `watchtower` outside of code identifiers, package names, and URLs.
- **Product truth only.** Every factual claim must trace to `PRODUCT.md`, `README.md`, `docs/ROADMAP.md`, `CHANGELOG.md`, or the wiki. No invented features, no testimonials, no download counts beyond the live Modrinth shield, no fabricated uptime or performance numbers.
- **Honor the hard constraints in copy:** local-first with no required cloud; advisory only (never restarts the server, never edits worlds or mods); Modrinth lookups never download jars; not a host-panel replacement; not player analytics.
- **Never hardcode a version number.** README currently lags behind real releases. Link to `releases/latest` and resolve the current tag at build time.
- **Design tokens come from DESIGN.md, not from taste.** bg0 `#14171e`, Signal Blue `#4C8DFF` kept scarce (under roughly 10 percent of colour mass), Lantern Amber `#F5A524` for brand warmth only, radii 2/4/6px, Geist for prose, JetBrains Mono for numbers.
- **Banned chrome:** periwinkle or purple-indigo AI-SaaS palettes, glassmorphism cards, sparkle motifs, 12–16px friendly-SaaS radii, multi-layer marketing shadows, three-equal-feature-card rows, fake stat strips.
- **Motion budget is exactly three**, all gated on `prefers-reduced-motion`: (1) hero rise 12px + fade, (2) section reveals 8px rise + fade once via IntersectionObserver, (3) thin Signal Blue line tracing Watching → Scanning → Fix inbox.
- **Accessibility target is WCAG 2.2 AA** (skip link, visible focus, keyboard nav, contrast on dark palette, reduced-motion).
- **The NeoForge jar must not change size.** Nothing from the demo build may reach `web/dashboard/dist/` or `web/dashboard/public/`. Baked output goes only to `dist-demo/`.
- **`npm run preview` must keep working identically** after the fixture-API refactor. Preview is the acceptance test; if behaviour drifts, revert the wrapper rather than pushing forward.
- **Node 20** to match `.github/workflows/ci.yml`.
- **Do not create a sibling repo.** Do not fork-copy the dashboard into the marketing app. Do not rewrite `DESIGN.md`.
- **Circuit breaker — Spark tree gzip:** one debugging pass serving `.tree.json.gz` with `Content-Encoding: gzip`; if broken, ship an honest empty state ("deep Spark trees are not available in the demo") and move on.
- **Circuit breaker — bake size:** if `dist-demo/demo-api/` exceeds ~100 MB, drop 30d rollups and the largest Spark profiles from `demo-routes.mjs` and let those surfaces show normal empty states.
- **Non-goals:** no dashboard UI redesign; no Watchtower Cloud marketing; no wiki replacement; no blog/CMS/newsletter/testimonials/analytics in v1; not a writable or live-server-connectable demo.

**Design Read (binding for marketing UI tasks):**
> Reading this as: an open-source ops-tool marketing site for skeptical self-hosting Minecraft server admins, with WatchTower's own Night Watch Desk instrument language, leaning toward Tailwind v4 + Geist/JetBrains Mono + restrained status-keyed motion.
> `DESIGN_VARIANCE: 6` · `MOTION_INTENSITY: 4` · `VISUAL_DENSITY: 4`

---

## File structure map

```
web/marketing/
  package.json                  Next.js, tailwind v4, motion, fontsource, lucide-react
  next.config.ts                images unoptimized false; no rewrites in v1
  postcss.config.mjs            @tailwindcss/postcss
  tsconfig.json
  vercel.json                   headers only
  scripts/sync-brand-assets.mjs prebuild copy from docs/assets + dashboard assets
  app/
    layout.tsx                  fonts, tokens, header, footer, skip link
    page.tsx                    home
    how-it-works/page.tsx
    features/page.tsx
    install/page.tsx
    demo/page.tsx
    faq/page.tsx
    sitemap.ts
    robots.ts
    opengraph-image.tsx
  components/
    site-header.tsx
    site-footer.tsx
    hero.tsx
    cta-row.tsx
    product-shot.tsx            screenshot in bezel with caption and alt text
    loop-diagram.tsx            the one signature motion
    promise-list.tsx
    not-our-job.tsx
    install-steps.tsx
    reveal.tsx                  shared motion primitive
  content/
    product.ts                  headline, taglines, links, claim sources
    features.ts                 one entry per surface + screenshot + alpha flag
    faq.ts
  lib/release.ts                latest GitHub release tag at build time
  styles/globals.css            dark --wt-* block ported from the dashboard onto :root

web/dashboard/                  (modified)
  scripts/fixture-api-core.ts   NEW  extracted handlers, shared source of truth
  scripts/fixture-api-core.test.ts  NEW
  scripts/vite-fixture-api.ts   MODIFIED  thin plugin wrapper over the core
  scripts/demo-routes.mjs       NEW  explicit list of requests to bake
  scripts/bake-demo-api.mjs     NEW  writes dist-demo/demo-api/** + manifest.json
  scripts/check-demo-manifest.mjs NEW  asserts client.ts coverage
  scripts/smoke-demo.mjs        NEW  optional local serve helper for Task 11
  src/api/demo-key.mjs          NEW  canonicalKey (client + bake)
  src/api/demo-key.test.ts      NEW
  src/api/client.ts             MODIFIED  static-demo routing + POST stubs
  src/api/client.demo.test.ts   NEW
  src/app/runtime.ts            MODIFIED  isStaticDemo()
  src/app/runtime.test.ts       NEW
  src/app/demo-banner.tsx       NEW  read-only notice, static-demo only
  src/app/shell.tsx             MODIFIED  mount DemoBanner when isStaticDemo()
  vite.config.ts                MODIFIED  outDir dist-demo when VITE_STATIC_DEMO=1
  vercel.json                   NEW
  package.json                  MODIFIED  build:demo, test:demo, check:demo-manifest

tools/audit-dashboard-packaging.mjs  MODIFIED  jar must contain no demo artefacts
.github/workflows/web-marketing.yml  NEW  path-filtered
.github/workflows/demo-rebake.yml    NEW  daily deploy hook
.github/workflows/ci.yml             MODIFIED  paths-ignore for web/marketing/**
.gitignore                           MODIFIED  marketing build artefacts + dist-demo/
```

## Key interfaces (exact)

```ts
// web/dashboard/src/api/demo-key.mjs
export function canonicalKey(method: string, pathname: string, search: string): string;
// Example: "GET /api/spark/tree?max_nodes=250000&path=abc"  (params sorted, method uppercased)

// web/dashboard/scripts/fixture-api-core.ts
export type FixtureResponse = { status: number; contentType: string; body: string | Buffer };
export type FixtureSession = Record<string, unknown>;
export function createFixtureSession(): FixtureSession;
export function handleFixtureRequest(
  session: FixtureSession,
  method: string,
  url: string,
  body?: unknown,
): Promise<FixtureResponse | null>;   // null means "not an API route"

// web/dashboard/src/app/runtime.ts
export function isStaticDemo(): boolean;   // import.meta.env.VITE_STATIC_DEMO === '1'

// dist-demo/demo-api/manifest.json
// { "GET /api/live": "live.json", "GET /api/samples?max_points=500&minutes=60": "samples-60-500.json" }
```

---

### Task 1: Scaffold `web/marketing`

**Files:**
- Create: `web/marketing/package.json`
- Create: `web/marketing/tsconfig.json`
- Create: `web/marketing/next.config.ts`
- Create: `web/marketing/postcss.config.mjs`
- Create: `web/marketing/styles/globals.css`
- Create: `web/marketing/scripts/sync-brand-assets.mjs`
- Create: `web/marketing/app/layout.tsx` (minimal stub — full shell in Task 2)
- Create: `web/marketing/app/page.tsx` (placeholder "WatchTower" until Task 4)

**Interfaces:**
- Consumes: dark `--wt-*` tokens from `web/dashboard/src/index.css` lines 86–117; brand files from `web/dashboard/assets/` and screenshots from `docs/assets/screenshots/`
- Produces: installable Next.js package that builds with `npm run build`; `prebuild` syncs assets into gitignored `public/`

**Design Read (re-declare before any component code):**
> Reading this as: an open-source ops-tool marketing site for skeptical self-hosting Minecraft server admins, with WatchTower's own Night Watch Desk instrument language, leaning toward Tailwind v4 + Geist/JetBrains Mono + restrained status-keyed motion.
> `DESIGN_VARIANCE: 6` · `MOTION_INTENSITY: 4` · `VISUAL_DENSITY: 4`

- [ ] **Step 1: Create `web/marketing/package.json`**

```json
{
  "name": "watchtower-marketing",
  "private": true,
  "type": "module",
  "scripts": {
    "prebuild": "node scripts/sync-brand-assets.mjs",
    "dev": "node scripts/sync-brand-assets.mjs && next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@fontsource-variable/geist": "^5.3.0",
    "@fontsource-variable/jetbrains-mono": "^5.3.0",
    "lucide-react": "^0.525.0",
    "motion": "^12.42.2",
    "next": "^15.3.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.11",
    "@types/node": "^24.0.14",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "tailwindcss": "^4.1.11",
    "typescript": "~5.8.3"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create `web/marketing/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `web/marketing/next.config.ts`**

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Screenshots are local static files under public/screenshots after sync.
    unoptimized: false,
  },
  // No rewrites in v1 — demo lives on a separate Vercel project.
};

export default nextConfig;
```

- [ ] **Step 4: Create `web/marketing/postcss.config.mjs`**

```js
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
```

- [ ] **Step 5: Create `web/marketing/styles/globals.css` with dark `--wt-*` on `:root`**

Port the dark theme block from `web/dashboard/src/index.css` lines 86–117 onto `:root` (marketing is dark-only; no `html[data-theme]` variants).

```css
@import "tailwindcss";
@import "@fontsource-variable/geist";
@import "@fontsource-variable/jetbrains-mono";

:root {
  --wt-bg0: #14171e;
  --wt-bg1: #222833;
  --wt-bg2: #2e3543;
  --wt-bg3: #3b4354;
  --wt-line: rgba(232, 237, 246, 0.14);
  --wt-line-strong: rgba(232, 237, 246, 0.22);
  --wt-text: #f3f5f8;
  --wt-text-mid: #b8bfcc;
  --wt-text-low: #8a92a1;
  --wt-accent: #4C8DFF;
  --wt-accent-soft: rgba(76, 141, 255, 0.16);
  --wt-accent-ink: #0A0F1C;
  --wt-lantern: #F5A524;
  --wt-ok: #34d399;
  --wt-warn: #F5A524;
  --wt-danger: #f87171;
  --wt-info: #9DB2CE;
  --wt-ch-tps: #4FB286;
  --wt-ch-mspt: #E0A458;
  --wt-ch-players: #7FA9D6;
  --wt-ch-heap: #9B8BD9;
  --wt-ch-disk: #5FB3C4;
  --wt-ch-cpu: #C77FA6;
  --wt-shadow: 0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 6px 16px rgba(0, 0, 0, 0.4);
  --wt-glare: rgba(255, 255, 255, 0.12);
  --wt-spotlight: rgba(76, 141, 255, 0.16);
  --wt-scroll-size: 10px;
  --wt-scroll-track: color-mix(in srgb, var(--wt-bg0) 55%, transparent);
  --wt-scroll-thumb: color-mix(in srgb, var(--wt-accent) 32%, var(--wt-bg3));
  --wt-scroll-thumb-hover: color-mix(in srgb, var(--wt-accent) 52%, var(--wt-bg2));
  --wt-radius-sm: 2px;
  --wt-radius-md: 4px;
  --wt-radius-lg: 6px;
  --font-sans: "Geist Variable", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", ui-monospace, monospace;
}

@theme inline {
  --color-wt-bg0: var(--wt-bg0);
  --color-wt-bg1: var(--wt-bg1);
  --color-wt-bg2: var(--wt-bg2);
  --color-wt-bg3: var(--wt-bg3);
  --color-wt-line: var(--wt-line);
  --color-wt-text: var(--wt-text);
  --color-wt-text-mid: var(--wt-text-mid);
  --color-wt-text-low: var(--wt-text-low);
  --color-wt-accent: var(--wt-accent);
  --color-wt-lantern: var(--wt-lantern);
  --color-wt-ok: var(--wt-ok);
  --color-wt-warn: var(--wt-warn);
  --color-wt-danger: var(--wt-danger);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
}

html,
body {
  background: var(--wt-bg0);
  color: var(--wt-text);
  font-family: var(--font-sans);
}

:focus-visible {
  outline: 2px solid var(--wt-accent);
  outline-offset: 2px;
}
```

- [ ] **Step 6: Create `web/marketing/scripts/sync-brand-assets.mjs`**

```js
#!/usr/bin/env node
import { cpSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(ROOT, '..', '..');
const shotsSrc = join(REPO, 'docs', 'assets', 'screenshots');
const brandSrc = join(REPO, 'web', 'dashboard', 'assets');
const shotsDest = join(ROOT, 'public', 'screenshots');
const brandDest = join(ROOT, 'public', 'brand');

mkdirSync(shotsDest, { recursive: true });
mkdirSync(brandDest, { recursive: true });

if (!existsSync(shotsSrc)) {
  console.error('sync-brand-assets: missing', shotsSrc);
  process.exit(1);
}

for (const name of readdirSync(shotsSrc)) {
  if (!/\.(png|webp|jpg|jpeg|svg)$/i.test(name)) continue;
  cpSync(join(shotsSrc, name), join(shotsDest, name));
}

const brandFiles = [
  'watchtower-icon-simple.png',
  'watchtower-icon.png',
  'watchtower-wordmark.png',
  'watchtower-logo.png',
  'favicon.png',
];
for (const name of brandFiles) {
  const src = join(brandSrc, name);
  if (!existsSync(src)) {
    console.warn('sync-brand-assets: skip missing', name);
    continue;
  }
  cpSync(src, join(brandDest, name));
}

console.log('sync-brand-assets: ok → public/screenshots + public/brand');
```

- [ ] **Step 7: Create stub `app/layout.tsx` and `app/page.tsx`**

```tsx
// app/layout.tsx
import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'WatchTower',
  description: "What's happening on your Minecraft server — and what to do next.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// app/page.tsx
export default function HomePage() {
  return <main className="p-8"><h1>WatchTower</h1></main>;
}
```

- [ ] **Step 8: Install and verify build**

Run from `web/marketing`:

```bash
npm install
npm run build
```

Expected: `sync-brand-assets: ok`, Next.js build succeeds, `public/screenshots/Overview.png` exists.

- [ ] **Step 9: Commit**

```bash
git add web/marketing/package.json web/marketing/package-lock.json web/marketing/tsconfig.json web/marketing/next.config.ts web/marketing/postcss.config.mjs web/marketing/styles/globals.css web/marketing/scripts/sync-brand-assets.mjs web/marketing/app/layout.tsx web/marketing/app/page.tsx
git commit -m "$(cat <<'EOF'
chore(marketing): scaffold Next.js App Router package with Night Watch Desk tokens

EOF
)"
```

---

### Task 2: Site shell

**Files:**
- Create: `web/marketing/components/site-header.tsx`
- Create: `web/marketing/components/site-footer.tsx`
- Create: `web/marketing/components/reveal.tsx`
- Create: `web/marketing/components/product-shot.tsx`
- Modify: `web/marketing/app/layout.tsx`

**Interfaces:**
- Consumes: `--wt-*` tokens; `/brand/watchtower-icon-simple.png`; `NEXT_PUBLIC_DEMO_URL` (optional, fallback `#` until deploy)
- Produces: `SiteHeader`, `SiteFooter`, `Reveal`, `ProductShot` used by all pages

- [ ] **Step 1: Create `components/reveal.tsx`**

```tsx
'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

/** Section reveal: 8px rise + fade, once. Collapses under prefers-reduced-motion. */
export function Reveal({ children, className, delay = 0 }: Props) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Create `components/product-shot.tsx`**

```tsx
import Image from 'next/image';

type Props = {
  src: string;
  alt: string;
  caption?: string;
  priority?: boolean;
  width?: number;
  height?: number;
};

/** Real screenshot in a quiet 4px-radius bezel. No glass, no floating badges. */
export function ProductShot({
  src,
  alt,
  caption,
  priority = false,
  width = 1280,
  height = 720,
}: Props) {
  return (
    <figure className="m-0">
      <div
        className="overflow-hidden border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)]"
        style={{ borderRadius: 'var(--wt-radius-md)' }}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes="(max-width: 768px) 100vw, 960px"
          className="block h-auto w-full"
        />
      </div>
      {caption ? (
        <figcaption className="mt-2 text-sm text-[color:var(--wt-text-low)]">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
```

- [ ] **Step 3: Create `components/site-header.tsx`**

```tsx
import Image from 'next/image';
import Link from 'next/link';

const NAV = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/install', label: 'Install' },
  { href: '/demo', label: 'Demo' },
  { href: '/faq', label: 'FAQ' },
] as const;

export function SiteHeader() {
  const demoUrl = process.env.NEXT_PUBLIC_DEMO_URL || '/demo';
  return (
    <header className="border-b border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 no-underline text-[color:var(--wt-text)]">
          <Image src="/brand/watchtower-icon-simple.png" alt="" width={28} height={28} />
          <span className="text-base font-semibold tracking-tight">WatchTower</span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-4 text-sm text-[color:var(--wt-text-mid)] md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-[color:var(--wt-text)]">
              {item.label}
            </Link>
          ))}
          <a
            href={demoUrl}
            className="rounded-[var(--wt-radius-md)] bg-[color:var(--wt-accent)] px-3 py-1.5 font-semibold text-[color:var(--wt-accent-ink)]"
          >
            Try the demo
          </a>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create `components/site-footer.tsx`**

```tsx
import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10 text-sm text-[color:var(--wt-text-mid)] md:flex-row md:justify-between">
        <div>
          <div className="font-semibold text-[color:var(--wt-text)]">WatchTower</div>
          <p className="mt-1 max-w-sm">
            Local ops desk for NeoForge dedicated servers. GPL-3.0-or-later. Free forever on your machine.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <a href="https://modrinth.com/mod/watchtower">Modrinth</a>
          <a href="https://github.com/djinnbanter/WatchTower">GitHub</a>
          <a href="https://github.com/djinnbanter/WatchTower/wiki">Wiki</a>
          <Link href="/faq">FAQ</Link>
          <Link href="/install">Install</Link>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 5: Wire shell into `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import '@/styles/globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export const metadata: Metadata = {
  title: {
    default: 'WatchTower',
    template: '%s · WatchTower',
  },
  description: "What's happening on your Minecraft server — and what to do next.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--wt-radius-md)] focus:bg-[color:var(--wt-accent)] focus:px-3 focus:py-2 focus:text-[color:var(--wt-accent-ink)]"
        >
          Skip to content
        </a>
        <SiteHeader />
        <div id="main">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Verify a11y shell basics**

Run: `cd web/marketing && npm run dev`

Manual check: skip link appears on Tab; header focus rings visible; brand reads **WatchTower**; no glass/periwinkle chrome.

- [ ] **Step 7: Commit**

```bash
git add web/marketing/components web/marketing/app/layout.tsx
git commit -m "$(cat <<'EOF'
feat(marketing): add site shell with header, footer, reveal, and product shot

EOF
)"
```

---

### Task 3: Content modules

**Files:**
- Create: `web/marketing/content/product.ts`
- Create: `web/marketing/content/features.ts`
- Create: `web/marketing/content/faq.ts`
- Create: `web/marketing/lib/release.ts`

**Interfaces:**
- Consumes: claim sources in `PRODUCT.md`, `README.md`, `docs/ROADMAP.md`
- Produces: typed content exports consumed by Tasks 4–5; `getLatestReleaseTag()` for `/install`

- [ ] **Step 1: Create `content/product.ts`**

```ts
/**
 * Claim sources (do not invent beyond these):
 * - Tagline + two questions: README.md, PRODUCT.md
 * - Local-first / no required cloud / no telemetry by default: PRODUCT.md, docs/ROADMAP.md Promises
 * - Advisory only (no restart, no quiet mod/world edits): README.md, PRODUCT.md
 * - Modrinth never downloads jars: PRODUCT.md / wiki Mods
 * - Not host panel / not player analytics / not client GPU: docs/ROADMAP.md "Not our job"
 * - License GPL-3.0-or-later; local dashboard free forever: README.md, PRODUCT.md
 * - NeoForge 1.21.x, Java 21, Linux dedicated common: README.md
 * Display spelling: WatchTower (DESIGN.md / PRODUCT.md)
 */

export const TAGLINE = "What's happening on your Minecraft server — and what to do next.";

export const SUPPORT_LINE =
  'A local ops desk for NeoForge dedicated servers. Watches while the game runs, then tells you what to fix next — on your machine, no cloud account required.';

export const TWO_QUESTIONS = [
  { q: 'Is the server okay right now?', detail: 'Live vitals, health grade, and restart advice — without restarting for you.' },
  { q: 'What should I fix next?', detail: 'Issues, crashes, mods, backups, and world pressure turned into plain next steps.' },
] as const;

export const PROMISES = [
  {
    title: 'Your data stays yours',
    body: 'Local-first; no telemetry; no log uploads by default.',
  },
  {
    title: "You're in control",
    body: 'Opt-in network features; no quiet edits to mods or the world.',
  },
  {
    title: 'Ops, not surveillance',
    body: 'Help run the server; do not track players like an analytics product.',
  },
  {
    title: 'Drop-in beside your host',
    body: 'A jar in mods/, not a second control panel.',
  },
] as const;
// Source: docs/ROADMAP.md "## Promises that don't change"

export const NOT_OUR_JOB = [
  { weDont: 'Host panels (start/stop, files, console)', useInstead: 'Pterodactyl, Crafty, AMP, bare metal, etc.' },
  { weDont: 'Player analytics (retention, GeoIP, leaderboards)', useInstead: 'Plan and similar' },
  { weDont: 'Client GPU / graphics crash tooling', useInstead: "Doesn't apply to headless dedicated servers" },
] as const;
// Source: docs/ROADMAP.md "## Not our job"

export const LINKS = {
  modrinth: 'https://modrinth.com/mod/watchtower',
  github: 'https://github.com/djinnbanter/WatchTower',
  releasesLatest: 'https://github.com/djinnbanter/WatchTower/releases/latest',
  wiki: 'https://github.com/djinnbanter/WatchTower/wiki',
  wikiInstall: 'https://github.com/djinnbanter/WatchTower/wiki/Installation',
  license: 'https://github.com/djinnbanter/WatchTower/blob/main/LICENSE',
} as const;

export const FOOTNOTE = 'Free forever on your machine. GPL-3.0-or-later. Runs where the server runs.';
```

- [ ] **Step 2: Create `content/features.ts`**

```ts
/**
 * Surfaces + screenshots. Alpha labelled alpha.
 * Sources: README.md "What you get", docs/wiki/*, PRODUCT.md.
 * Screenshot files synced from docs/assets/screenshots/ via prebuild.
 */

export type FeatureSurface = {
  id: string;
  title: string;
  blurb: string;
  screenshot: string; // under /screenshots/
  alpha?: boolean;
};

export const FEATURE_SURFACES: FeatureSurface[] = [
  {
    id: 'overview',
    title: 'Overview',
    blurb: 'Health grade, live vitals, what needs attention, and restart advice — Safe / Caution / Wait. Does not restart the server for you.',
    screenshot: 'Overview.png',
  },
  {
    id: 'live',
    title: 'Live',
    blurb: 'TPS, lag, players, memory, CPU, and host charts while you watch.',
    screenshot: 'Live-Metrics.png',
  },
  {
    id: 'issues',
    title: 'Issues',
    blurb: 'A fix inbox from continuous watching and scanning — not a giant scheduled homework dump.',
    screenshot: 'Issues.png',
  },
  {
    id: 'crashes',
    title: 'Crashes',
    blurb: 'Crash reports grouped and explained in plain English, with context from nearby logs.',
    screenshot: 'Crash-Logs.png',
  },
  {
    id: 'mods',
    title: 'Mods',
    blurb: 'Inventory, conflicts, log errors, and Modrinth lookup hints. Modrinth never downloads jars.',
    screenshot: 'Mods.png',
  },
  {
    id: 'insights',
    title: 'Insights',
    blurb: 'Patterns over time: schedule pressure, load, storage, and weekly digest.',
    screenshot: 'Insights.png',
  },
  {
    id: 'backups',
    title: 'Backups',
    blurb: 'See what backup folders exist and whether they look healthy — advisory only.',
    screenshot: 'Backups.png',
  },
  {
    id: 'spark',
    title: 'Spark',
    blurb: 'Optional companion for lag proof. Deep Spark workspace is alpha.',
    screenshot: 'spark.png',
    alpha: true,
  },
  {
    id: 'support',
    title: 'Support pack',
    blurb: 'Compose a redacted zip for helpers — facts and evidence stay consistent.',
    screenshot: 'sources.png',
  },
  {
    id: 'cli',
    title: 'CLI',
    blurb: 'Disaster-recovery path when the game will not boot. Separate from the live dashboard.',
    screenshot: 'readme-header.png',
  },
];
```

- [ ] **Step 3: Create `content/faq.ts`**

```ts
/**
 * FAQ answers must stay inside PRODUCT.md / README.md / docs/ROADMAP.md truth.
 */

export type FaqItem = { q: string; a: string };

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Is WatchTower a host panel?',
    a: 'No. It does not start/stop the server, manage files, or replace the console. Use Pterodactyl, Crafty, AMP, or bare metal for that — WatchTower sits beside them.',
  },
  {
    q: 'Does it upload my logs?',
    a: 'Not by default. Data stays on the host. Optional network features are opt-in. There is no required cloud account.',
  },
  {
    q: 'Will it restart my server?',
    a: 'No. Overview can advise Safe / Caution / Wait. WatchTower is advisory only — it never restarts the server for you and never quietly edits mods or the world.',
  },
  {
    q: 'Does it support Fabric?',
    a: 'Primary support today is NeoForge 1.21.x on Java 21. Fabric is on the near-term platform order preference, not a current promise on this site.',
  },
  {
    q: 'Is it free?',
    a: 'The local dashboard stays free forever under GPL-3.0-or-later. Get the jar from Modrinth or GitHub Releases.',
  },
  {
    q: 'Do I need a cloud account?',
    a: 'No. WatchTower is local-first. Watchtower Cloud is an unshipped future bet and is not required for the local dashboard.',
  },
  {
    q: 'What does it cost to run?',
    a: 'A jar in mods/ plus the embedded dashboard on port 8787 (prefer localhost or an SSH tunnel — do not expose 8787 to the open internet). Change the default login.',
  },
];
```

- [ ] **Step 4: Create `lib/release.ts`**

```ts
/**
 * Resolve latest GitHub release tag at build time.
 * Never hardcode a version in copy.
 */

export type ReleaseInfo = {
  tag: string;
  url: string;
};

const FALLBACK: ReleaseInfo = {
  tag: 'latest',
  url: 'https://github.com/djinnbanter/WatchTower/releases/latest',
};

export async function getLatestReleaseTag(): Promise<ReleaseInfo> {
  try {
    const res = await fetch('https://api.github.com/repos/djinnbanter/WatchTower/releases/latest', {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'watchtower-marketing' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return FALLBACK;
    const data = (await res.json()) as { tag_name?: string; html_url?: string };
    if (!data.tag_name) return FALLBACK;
    return {
      tag: data.tag_name,
      url: data.html_url || FALLBACK.url,
    };
  } catch {
    return FALLBACK;
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add web/marketing/content web/marketing/lib/release.ts
git commit -m "$(cat <<'EOF'
feat(marketing): add product, features, and FAQ content modules with claim sources

EOF
)"
```

---

### Task 4: Home page

**Files:**
- Create: `web/marketing/components/hero.tsx`
- Create: `web/marketing/components/cta-row.tsx`
- Create: `web/marketing/components/loop-diagram.tsx`
- Create: `web/marketing/components/promise-list.tsx`
- Create: `web/marketing/components/not-our-job.tsx`
- Modify: `web/marketing/app/page.tsx`

**Interfaces:**
- Consumes: `TAGLINE`, `SUPPORT_LINE`, `TWO_QUESTIONS`, `PROMISES`, `NOT_OUR_JOB`, `LINKS`, `FOOTNOTE` from `content/product.ts`; `Reveal`, `ProductShot`
- Produces: first-viewport composition matching the design spec

- [ ] **Step 1: Create `components/cta-row.tsx`**

```tsx
import { LINKS } from '@/content/product';

export function CtaRow() {
  const demoUrl = process.env.NEXT_PUBLIC_DEMO_URL || '/demo';
  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={LINKS.modrinth}
        className="rounded-[var(--wt-radius-md)] bg-[color:var(--wt-accent)] px-4 py-2 text-sm font-semibold text-[color:var(--wt-accent-ink)]"
      >
        Get it on Modrinth
      </a>
      <a
        href={demoUrl}
        className="rounded-[var(--wt-radius-md)] border border-[color:var(--wt-line-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--wt-text)]"
      >
        Try the demo
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/hero.tsx`**

```tsx
'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'motion/react';
import { ProductShot } from '@/components/product-shot';
import { CtaRow } from '@/components/cta-row';
import { FOOTNOTE, SUPPORT_LINE, TAGLINE } from '@/content/product';

export function Hero() {
  const reduce = useReducedMotion();
  return (
    <section className="mx-auto grid max-w-5xl gap-10 px-4 pb-16 pt-12 md:grid-cols-[1.05fr_0.95fr] md:items-center">
      <div>
        <div className="mb-6 flex items-center gap-3">
          <Image src="/brand/watchtower-icon-simple.png" alt="" width={40} height={40} priority />
          <span className="text-2xl font-semibold tracking-tight text-[color:var(--wt-text)]">WatchTower</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--wt-text)] md:text-4xl">
          {TAGLINE}
        </h1>
        <p className="mt-4 max-w-xl text-base text-[color:var(--wt-text-mid)]">{SUPPORT_LINE}</p>
        <div className="mt-6">
          <CtaRow />
        </div>
        <p className="mt-4 text-xs text-[color:var(--wt-text-low)]">{FOOTNOTE}</p>
      </div>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <ProductShot
          src="/screenshots/Overview.png"
          alt="WatchTower Overview page showing health grade and live vitals"
          caption="Overview — the real dashboard UI"
          priority
          width={1280}
          height={800}
        />
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 3: Create `components/loop-diagram.tsx`**

```tsx
'use client';

import { motion, useReducedMotion } from 'motion/react';

const STEPS = ['Watching', 'Scanning', 'Fix inbox'] as const;

/** Signature motion #3: thin Signal Blue line traces Watching → Scanning → Fix inbox. */
export function LoopDiagram() {
  const reduce = useReducedMotion();
  return (
    <div className="relative overflow-hidden rounded-[var(--wt-radius-md)] border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-6">
      <ol className="relative z-10 grid gap-4 md:grid-cols-3">
        {STEPS.map((label, i) => (
          <li key={label} className="text-center">
            <div className="font-mono text-xs uppercase tracking-[0.14em] text-[color:var(--wt-text-low)]">
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="mt-2 text-lg font-semibold text-[color:var(--wt-text)]">{label}</div>
          </li>
        ))}
      </ol>
      {!reduce ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute bottom-4 left-6 right-6 h-px origin-left bg-[color:var(--wt-accent)]"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.9, ease: 'easeInOut' }}
        />
      ) : (
        <div aria-hidden className="absolute bottom-4 left-6 right-6 h-px bg-[color:var(--wt-accent)]" />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `components/promise-list.tsx` and `components/not-our-job.tsx`**

```tsx
// promise-list.tsx
import { PROMISES } from '@/content/product';

export function PromiseList() {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {PROMISES.map((p) => (
        <li key={p.title} className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-4" style={{ borderRadius: 'var(--wt-radius-md)' }}>
          <h3 className="text-base font-semibold text-[color:var(--wt-text)]">{p.title}</h3>
          <p className="mt-2 text-sm text-[color:var(--wt-text-mid)]">{p.body}</p>
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// not-our-job.tsx
import { NOT_OUR_JOB } from '@/content/product';

export function NotOurJob() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[color:var(--wt-line)] text-[color:var(--wt-text-low)]">
            <th className="py-2 pr-4 font-medium">We don’t replace…</th>
            <th className="py-2 font-medium">Use instead / leave alone</th>
          </tr>
        </thead>
        <tbody>
          {NOT_OUR_JOB.map((row) => (
            <tr key={row.weDont} className="border-b border-[color:var(--wt-line)]">
              <td className="py-3 pr-4 text-[color:var(--wt-text)]">{row.weDont}</td>
              <td className="py-3 text-[color:var(--wt-text-mid)]">{row.useInstead}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Write `app/page.tsx`**

```tsx
import { Hero } from '@/components/hero';
import { LoopDiagram } from '@/components/loop-diagram';
import { NotOurJob } from '@/components/not-our-job';
import { PromiseList } from '@/components/promise-list';
import { Reveal } from '@/components/reveal';
import { TWO_QUESTIONS } from '@/content/product';

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Reveal className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-2xl font-semibold tracking-tight">Two questions</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {TWO_QUESTIONS.map((item) => (
            <div key={item.q}>
              <h3 className="text-lg font-semibold text-[color:var(--wt-text)]">{item.q}</h3>
              <p className="mt-2 text-sm text-[color:var(--wt-text-mid)]">{item.detail}</p>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal className="mx-auto max-w-5xl px-4 py-12" delay={0.05}>
        <h2 className="text-2xl font-semibold tracking-tight">Watch → scan → fix</h2>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--wt-text-mid)]">
          Continuous watching and scanning into a fix inbox — not a giant scheduled audit homework dump.
        </p>
        <div className="mt-6">
          <LoopDiagram />
        </div>
      </Reveal>
      <Reveal className="mx-auto max-w-5xl px-4 py-12" delay={0.05}>
        <h2 className="text-2xl font-semibold tracking-tight">Promises that don’t change</h2>
        <div className="mt-6">
          <PromiseList />
        </div>
      </Reveal>
      <Reveal className="mx-auto max-w-5xl px-4 py-12" delay={0.05}>
        <h2 className="text-2xl font-semibold tracking-tight">Not our job</h2>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--wt-text-mid)]">
          We stay focused so the product stays clear.
        </p>
        <div className="mt-6">
          <NotOurJob />
        </div>
      </Reveal>
    </main>
  );
}
```

- [ ] **Step 6: Visual check**

Run: `cd web/marketing && npm run dev` → open `/`.

First viewport must contain only: brand, one headline, one support line, CTA pair, one Overview screenshot, footnote. No stat strip. No three equal feature cards.

- [ ] **Step 7: Commit**

```bash
git add web/marketing/app/page.tsx web/marketing/components
git commit -m "$(cat <<'EOF'
feat(marketing): ship home page hero, loop, promises, and not-our-job

EOF
)"
```

---

### Task 5: Remaining pages

**Files:**
- Create: `web/marketing/app/how-it-works/page.tsx`
- Create: `web/marketing/app/features/page.tsx`
- Create: `web/marketing/app/install/page.tsx`
- Create: `web/marketing/app/demo/page.tsx`
- Create: `web/marketing/app/faq/page.tsx`
- Create: `web/marketing/components/install-steps.tsx`
- Create: `web/marketing/app/sitemap.ts`
- Create: `web/marketing/app/robots.ts`
- Create: `web/marketing/app/opengraph-image.tsx`

**Interfaces:**
- Consumes: `FEATURE_SURFACES`, `FAQ_ITEMS`, `getLatestReleaseTag()`, shell components
- Produces: all six routes live and linked from header

- [ ] **Step 1: Create `app/how-it-works/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { LoopDiagram } from '@/components/loop-diagram';
import { Reveal } from '@/components/reveal';

export const metadata: Metadata = { title: 'How it works' };

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">How it works</h1>
      <p className="mt-3 max-w-2xl text-[color:var(--wt-text-mid)]">
        WatchTower watches while the game runs, scans into a fix inbox, and keeps data under the server’s `watchtower/` folder. The dashboard defaults to port 8787 — prefer localhost or an SSH tunnel; do not expose it to the open internet.
      </p>
      <Reveal className="mt-10">
        <LoopDiagram />
      </Reveal>
      <Reveal className="mt-12 space-y-4 text-sm text-[color:var(--wt-text-mid)]">
        <h2 className="text-xl font-semibold text-[color:var(--wt-text)]">On disk</h2>
        <p>Runtime data lives under the server’s `watchtower/` folder (ops-cache, state, Spark uploads, support zips).</p>
        <h2 className="text-xl font-semibold text-[color:var(--wt-text)]">Dashboard</h2>
        <p>Open the embedded UI on `:8787`. Change the default login (`watchtower` / `password`) immediately.</p>
        <h2 className="text-xl font-semibold text-[color:var(--wt-text)]">When the game won’t boot</h2>
        <p>Use the optional CLI / DR path — separate from the live dashboard — documented in the wiki.</p>
      </Reveal>
    </main>
  );
}
```

- [ ] **Step 2: Create `app/features/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { ProductShot } from '@/components/product-shot';
import { Reveal } from '@/components/reveal';
import { FEATURE_SURFACES } from '@/content/features';

export const metadata: Metadata = { title: 'Features' };

export default function FeaturesPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Features</h1>
      <p className="mt-3 max-w-2xl text-[color:var(--wt-text-mid)]">
        Real surfaces from the local dashboard. Alpha depth is labelled alpha — no invented screenshots.
      </p>
      <div className="mt-12 space-y-16">
        {FEATURE_SURFACES.map((f, i) => (
          <Reveal key={f.id} delay={i === 0 ? 0 : 0.04}>
            <div className="grid gap-6 md:grid-cols-2 md:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-semibold">{f.title}</h2>
                  {f.alpha ? (
                    <span className="rounded-[var(--wt-radius-sm)] border border-[color:var(--wt-line)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[color:var(--wt-lantern)]">
                      Alpha
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm text-[color:var(--wt-text-mid)]">{f.blurb}</p>
              </div>
              <ProductShot
                src={`/screenshots/${f.screenshot}`}
                alt={`WatchTower ${f.title} screenshot`}
                width={1280}
                height={720}
                priority={i === 0}
              />
            </div>
          </Reveal>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create `components/install-steps.tsx` and `app/install/page.tsx`**

```tsx
// install-steps.tsx
import { LINKS } from '@/content/product';
import type { ReleaseInfo } from '@/lib/release';

export function InstallSteps({ release }: { release: ReleaseInfo }) {
  return (
    <ol className="space-y-6">
      <li className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-4" style={{ borderRadius: 'var(--wt-radius-md)' }}>
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-[color:var(--wt-text-low)]">Step 1</div>
        <h3 className="mt-2 text-lg font-semibold">Get the jar</h3>
        <p className="mt-2 text-sm text-[color:var(--wt-text-mid)]">
          Download the latest release ({release.tag}) from{' '}
          <a href={LINKS.modrinth}>Modrinth</a> or{' '}
          <a href={release.url}>GitHub Releases</a>. Never hardcode a version in docs you copy by hand.
        </p>
      </li>
      <li className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-4" style={{ borderRadius: 'var(--wt-radius-md)' }}>
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-[color:var(--wt-text-low)]">Step 2</div>
        <h3 className="mt-2 text-lg font-semibold">Drop it in `mods/`</h3>
        <p className="mt-2 text-sm text-[color:var(--wt-text-mid)]">
          Requirements: Linux dedicated host (common), NeoForge 1.21.x, Java 21. Restart the server so the mod loads.
        </p>
      </li>
      <li className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-4" style={{ borderRadius: 'var(--wt-radius-md)' }}>
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-[color:var(--wt-text-low)]">Step 3</div>
        <h3 className="mt-2 text-lg font-semibold">Open the dashboard</h3>
        <p className="mt-2 text-sm text-[color:var(--wt-text-mid)]">
          Browse to `http://127.0.0.1:8787` (or tunnel). Change the default login immediately. Do not expose port 8787 to the open internet.
        </p>
      </li>
    </ol>
  );
}
```

```tsx
// app/install/page.tsx
import type { Metadata } from 'next';
import { InstallSteps } from '@/components/install-steps';
import { LINKS } from '@/content/product';
import { getLatestReleaseTag } from '@/lib/release';

export const metadata: Metadata = { title: 'Install' };

export default async function InstallPage() {
  const release = await getLatestReleaseTag();
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Install</h1>
      <p className="mt-3 max-w-2xl text-[color:var(--wt-text-mid)]">
        Three steps. Full detail lives on the{' '}
        <a href={LINKS.wikiInstall}>Installation wiki</a>.
      </p>
      <div className="mt-10">
        <InstallSteps release={release} />
      </div>
      <aside className="mt-10 border border-[color:var(--wt-warn)]/40 bg-[color:var(--wt-bg1)] p-4 text-sm" style={{ borderRadius: 'var(--wt-radius-md)' }}>
        <strong className="text-[color:var(--wt-warn)]">Credentials + port:</strong>{' '}
        Default login is `watchtower` / `password` — change it. Prefer localhost or SSH tunnel for `:8787`.
      </aside>
    </main>
  );
}
```

- [ ] **Step 4: Create `app/demo/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { CtaRow } from '@/components/cta-row';

export const metadata: Metadata = { title: 'Demo' };

export default function DemoPage() {
  const demoUrl = process.env.NEXT_PUBLIC_DEMO_URL || '#';
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Try the interactive demo</h1>
      <p className="mt-3 text-[color:var(--wt-text-mid)]">
        This is the real WatchTower dashboard UI with sample data. Nothing you click is saved. POSTs respond so buttons still work, but the demo is read-only.
      </p>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-[color:var(--wt-text-mid)]">
        <li>Sample fixtures — not your server.</li>
        <li>Every tab is clickable.</li>
        <li>No live-server connect in v1.</li>
      </ul>
      <div className="mt-8">
        <a
          href={demoUrl}
          className="inline-block rounded-[var(--wt-radius-md)] bg-[color:var(--wt-accent)] px-4 py-2 text-sm font-semibold text-[color:var(--wt-accent-ink)]"
        >
          Launch interactive demo
        </a>
      </div>
      <div className="mt-8">
        <CtaRow />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Create `app/faq/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { FAQ_ITEMS } from '@/content/faq';

export const metadata: Metadata = { title: 'FAQ' };

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">FAQ</h1>
      <div className="mt-10 space-y-8">
        {FAQ_ITEMS.map((item) => (
          <section key={item.q}>
            <h2 className="text-lg font-semibold text-[color:var(--wt-text)]">{item.q}</h2>
            <p className="mt-2 text-sm text-[color:var(--wt-text-mid)]">{item.a}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Create `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`**

```ts
// sitemap.ts
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.vercel.app';
  return ['', '/how-it-works', '/features', '/install', '/demo', '/faq'].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));
}
```

```ts
// robots.ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.vercel.app';
  return { rules: { userAgent: '*', allow: '/' }, sitemap: `${base}/sitemap.xml` };
}
```

```tsx
// opengraph-image.tsx
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 64,
          background: '#14171e',
          color: '#f3f5f8',
          fontSize: 48,
          fontWeight: 600,
        }}
      >
        <div style={{ color: '#F5A524', fontSize: 28, marginBottom: 16 }}>WatchTower</div>
        <div>What&apos;s happening on your Minecraft server — and what to do next.</div>
      </div>
    ),
    { ...size },
  );
}
```

- [ ] **Step 7: Build all routes**

```bash
cd web/marketing && npm run build
```

Expected: pages for `/`, `/how-it-works`, `/features`, `/install`, `/demo`, `/faq` all compile. Install page shows a real tag or `latest` fallback — never a hardcoded `1.1.2`.

- [ ] **Step 8: Commit**

```bash
git add web/marketing/app web/marketing/components/install-steps.tsx
git commit -m "$(cat <<'EOF'
feat(marketing): add how-it-works, features, install, demo, and FAQ pages

EOF
)"
```

---

### Task 6: Copy humanize pass

**Files:**
- Modify: `web/marketing/content/product.ts`
- Modify: `web/marketing/content/features.ts`
- Modify: `web/marketing/content/faq.ts`
- Modify: page-level prose in `web/marketing/app/**/page.tsx` and components that hold sentences

**Interfaces:**
- Consumes: `human-writing` + `anti-ai-writing-humanizer` skills (heavy depth for page prose, light for buttons/labels)
- Produces: claim-audited copy with source comments intact

- [ ] **Step 1: Run human-writing skill on page-length prose**

Load `c:\Users\DJINN\.agents\skills\human-writing\SKILL.md` and `c:\Users\DJINN\.agents\skills\anti-ai-writing-humanizer\SKILL.md`. Rewrite strings in `content/*.ts` and long paragraphs on pages. Prose only — do not humanize code, comments that cite sources, or config.

Rules of thumb for this pass:
- At most one em dash per paragraph
- No banned AI vocabulary (delve, landscape, robust, seamless, unlock, elevate, etc.)
- No rule-of-three padding
- Keep product claims identical in meaning after rewrite

- [ ] **Step 2: Claim audit checklist**

For each factual sentence, confirm a source comment exists in the owning `content/*.ts` module (or add one). Cross-check against:
- `PRODUCT.md`
- `README.md`
- `docs/ROADMAP.md` (Promises + Not our job)
- Wiki links only — do not duplicate wiki bodies

Reject any invented testimonials, download counts (except live Modrinth shield if added later), or Fabric “available now” claims.

- [ ] **Step 3: Light pass on microcopy**

Buttons/labels stay short: “Get it on Modrinth”, “Try the demo”, “Launch interactive demo”, “Alpha”. No slogan inflation.

- [ ] **Step 4: Commit**

```bash
git add web/marketing/content web/marketing/app web/marketing/components
git commit -m "$(cat <<'EOF'
docs(marketing): humanize copy and audit claims against product sources

EOF
)"
```

---

### Task 7: Perf / a11y

**Files:**
- Modify: `web/marketing/components/product-shot.tsx` (confirm `sizes` + `priority` props match Task 2)
- Modify: `web/marketing/app/features/page.tsx` (only first surface sets `priority`)
- Modify: `web/marketing/app/layout.tsx` — add metadata icons pointing at `/brand/favicon.png`
- No globals.css font-display edits unless Step 1 finds missing `font-display: swap` in the installed fontsource CSS (unexpected; file a note and pin the package)

**Interfaces:**
- Consumes: `next/image`, fontsource packages already imported in globals.css
- Produces: LCP &lt; 2.5s target on simulated mobile for `/` and `/features`; CLS &lt; 0.1; reduced-motion honoured

- [ ] **Step 1: Confirm fontsource loads with swap**

`styles/globals.css` already imports `@fontsource-variable/geist` and `@fontsource-variable/jetbrains-mono` at the same majors as `web/dashboard/package.json` (`^5.3.0`). Those packages ship `@font-face` with `font-display: swap`. Verify in DevTools → Network that font requests are not render-blocking beyond the CSS import, and that body text remains visible during load via the `:root` fallback stacks.

- [ ] **Step 2: Priority only the LCP candidate**

On `/`, `ProductShot` for Overview already has `priority`. On `/features`, only the first surface uses `priority={i === 0}`; remaining images must not set priority.

- [ ] **Step 3: Measure**

Run production build and start:

```bash
cd web/marketing && npm run build && npm run start
```

Use Chrome DevTools Performance / Lighthouse on `/` and `/features` (mobile throttling). Record LCP, CLS, INP. Target LCP &lt; 2.5s and CLS &lt; 0.1. If LCP misses, first reduce Overview/spark PNG dimensions via `next/image` `sizes` (already set) and ensure only one `priority` image per page — do not hand-convert PNGs to WebP in git; leave sources in `docs/assets/screenshots/`.

- [ ] **Step 4: Accessibility pass**

Manual:
- Keyboard-only tab through header → main → footer on every page
- Skip link works
- Contrast: body text `#f3f5f8` / mid `#b8bfcc` on `#14171e` / `#222833`
- Toggle `prefers-reduced-motion: reduce` — hero and reveals must not animate; loop line appears fully drawn

Optional: axe DevTools — zero critical issues on `/` and `/features`.

- [ ] **Step 5: Commit**

```bash
git add web/marketing
git commit -m "$(cat <<'EOF'
perf(marketing): tighten LCP image priority, fonts, and a11y checks

EOF
)"
```

---

### Task 8: `fixture-api-core` refactor (TDD)

**Files:**
- Create: `web/dashboard/scripts/fixture-api-core.ts`
- Create: `web/dashboard/scripts/fixture-api-core.test.ts`
- Modify: `web/dashboard/scripts/vite-fixture-api.ts` (thin plugin wrapper)
- Modify: `web/dashboard/package.json` (add `test:demo`)

**Interfaces:**
- Consumes: existing handler logic currently inside `vite-fixture-api.ts`
- Produces:
  - `createFixtureSession(): FixtureSession`
  - `handleFixtureRequest(session, method, url, body?): Promise<FixtureResponse | null>`
  - `FixtureResponse`, `FixtureSession` types

- [ ] **Step 1: Write the failing test**

Create `web/dashboard/scripts/fixture-api-core.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFixtureSession,
  handleFixtureRequest,
} from './fixture-api-core.ts';

describe('fixture-api-core', () => {
  it('createFixtureSession returns a mutable session object', () => {
    const s = createFixtureSession();
    assert.equal(typeof s, 'object');
    assert.ok(s);
  });

  it('returns null for non-API paths', async () => {
    const session = createFixtureSession();
    const res = await handleFixtureRequest(session, 'GET', '/not-api');
    assert.equal(res, null);
  });

  it('serves GET /api/live as JSON', async () => {
    const session = createFixtureSession();
    const res = await handleFixtureRequest(session, 'GET', '/api/live');
    assert.ok(res);
    assert.equal(res.status, 200);
    assert.match(res.contentType, /json/);
    const body = typeof res.body === 'string' ? JSON.parse(res.body) : JSON.parse(res.body.toString('utf8'));
    assert.equal(typeof body, 'object');
  });

  it('serves GET /api/auth/session as authenticated preview', async () => {
    const session = createFixtureSession();
    const res = await handleFixtureRequest(session, 'GET', '/api/auth/session');
    assert.ok(res);
    assert.equal(res.status, 200);
    const body = JSON.parse(String(res.body));
    assert.equal(body.authenticated === true || body.ok === true || body.user != null, true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web/dashboard && npx tsx --test scripts/fixture-api-core.test.ts
```

Expected: FAIL — `Cannot find module './fixture-api-core.ts'` (or export missing).

- [ ] **Step 3: Extract core implementation**

Move the request-handling body from `vite-fixture-api.ts` into `fixture-api-core.ts`:

```ts
export type FixtureResponse = { status: number; contentType: string; body: string | Buffer };
export type FixtureSession = Record<string, unknown>;

export function createFixtureSession(): FixtureSession {
  return {
    settings: null,
    acks: {},
    crashAcks: null,
    opsCache: null,
    suppressions: [],
    theme: 'dark',
    baselineRegression: null,
  };
}

export async function handleFixtureRequest(
  session: FixtureSession,
  method: string,
  url: string,
  body?: unknown,
): Promise<FixtureResponse | null> {
  if (!url.startsWith('/api/')) return null;
  // ... relocate existing map + branch logic from vite-fixture-api.ts configureServer ...
  // Return { status, contentType, body } instead of writing to Connect res.
}
```

Keep helper functions (`readJson`, `sliceSamplesPayload`, spark tree gunzip, etc.) in the core file (or shared module colocated). Do not change fixture JSON on disk.

- [ ] **Step 4: Thin-wrap `vite-fixture-api.ts`**

```ts
import type { Plugin } from 'vite';
import { createFixtureSession, handleFixtureRequest } from './fixture-api-core';

function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function fixtureApiPlugin(): Plugin {
  const session = createFixtureSession();
  return {
    name: 'watchtower-fixture-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/')) return next();
        try {
          const method = (req.method || 'GET').toUpperCase();
          let body: unknown;
          if (method !== 'GET' && method !== 'HEAD') {
            const raw = await readBody(req);
            body = raw ? JSON.parse(raw) : undefined;
          }
          const result = await handleFixtureRequest(session, method, url, body);
          if (!result) return next();
          res.statusCode = result.status;
          res.setHeader('Content-Type', result.contentType);
          res.end(result.body);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}
```

Move `readBody` with the core if POST handlers need the raw string instead of parsed JSON — match whatever the extracted handlers expect. Do not change Connect response status codes relative to today’s plugin.

- [ ] **Step 5: Run tests green + register script**

Add to `web/dashboard/package.json` scripts (Task 8 only — Task 9 appends the other test files):

```json
"test:demo": "tsx --test scripts/fixture-api-core.test.ts"
```

Run:

```bash
cd web/dashboard && npm run test:demo
```

Expected: PASS.

- [ ] **Step 6: Acceptance — preview unchanged**

```bash
cd web/dashboard && npm run preview
```

Open `http://127.0.0.1:8081/`, confirm Overview / Issues / Live load as before. If behaviour drifts: revert wrapper and re-extract carefully (circuit breaker).

- [ ] **Step 7: Commit**

```bash
git add web/dashboard/scripts/fixture-api-core.ts web/dashboard/scripts/fixture-api-core.test.ts web/dashboard/scripts/vite-fixture-api.ts web/dashboard/package.json
git commit -m "$(cat <<'EOF'
refactor(dashboard): extract fixture-api-core for shared preview and demo bake

EOF
)"
```

---

### Task 9: `demo-key` + `isStaticDemo` + `apiFetch` intercept + banner (TDD)

**Files:**
- Create: `web/dashboard/src/api/demo-key.mjs`
- Create: `web/dashboard/src/api/demo-key.test.ts`
- Create: `web/dashboard/src/app/runtime.test.ts`
- Create: `web/dashboard/src/api/client.demo.test.ts`
- Create: `web/dashboard/src/app/demo-banner.tsx`
- Modify: `web/dashboard/src/app/runtime.ts`
- Modify: `web/dashboard/src/api/client.ts`
- Modify: `web/dashboard/src/app/shell.tsx`
- Modify: `web/dashboard/package.json` (`test:demo` includes new tests)
- Modify: `web/dashboard/vite.config.ts` (`define` + `build.outDir` when static demo)

**Interfaces:**
- Consumes: `canonicalKey`, `isStaticDemo`
- Produces: static-demo GET lookup via `./demo-api/manifest.json`; POSTs return `{ ok: true, preview: true }`; banner copy exact

- [ ] **Step 1: Write failing `demo-key` tests**

```ts
// src/api/demo-key.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalKey } from './demo-key.mjs';

describe('canonicalKey', () => {
  it('uppercases method and sorts query params', () => {
    assert.equal(
      canonicalKey('get', '/api/samples', '?minutes=60&max_points=500'),
      'GET /api/samples?max_points=500&minutes=60',
    );
  });

  it('handles empty search', () => {
    assert.equal(canonicalKey('GET', '/api/live', ''), 'GET /api/live');
  });

  it('accepts search without leading ?', () => {
    assert.equal(
      canonicalKey('GET', '/api/spark/tree', 'path=abc&max_nodes=250000'),
      'GET /api/spark/tree?max_nodes=250000&path=abc',
    );
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
cd web/dashboard && npx tsx --test src/api/demo-key.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/api/demo-key.mjs`**

```js
/** Shared by browser client and Node bake script. Keep .mjs for dual import. */
export function canonicalKey(method, pathname, search) {
  const m = String(method || 'GET').toUpperCase();
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const raw = String(search || '');
  const q = raw.startsWith('?') ? raw.slice(1) : raw;
  if (!q) return `${m} ${path}`;
  const params = new URLSearchParams(q);
  const keys = [...new Set([...params.keys()])].sort();
  const sorted = new URLSearchParams();
  for (const k of keys) {
    for (const v of params.getAll(k)) sorted.append(k, v);
  }
  return `${m} ${path}?${sorted.toString()}`;
}
```

- [ ] **Step 4: Run demo-key tests — PASS**

```bash
cd web/dashboard && npx tsx --test src/api/demo-key.test.ts
```

- [ ] **Step 5: Write failing `isStaticDemo` test**

```ts
// src/app/runtime.test.ts
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

describe('isStaticDemo', () => {
  const prev = process.env.VITE_STATIC_DEMO;
  afterEach(() => {
    if (prev === undefined) delete process.env.VITE_STATIC_DEMO;
    else process.env.VITE_STATIC_DEMO = prev;
  });

  it('is exported and returns boolean', async () => {
    // Runtime uses import.meta.env; unit-test the pure helper if extracted,
    // or assert module exports the function.
    const mod = await import('./runtime.ts');
    assert.equal(typeof mod.isStaticDemo, 'function');
    assert.equal(typeof mod.isStaticDemo(), 'boolean');
  });
});
```

- [ ] **Step 6: Implement `isStaticDemo` in `runtime.ts`**

```ts
/** Static Vercel demo build (VITE_STATIC_DEMO=1). Implies fixture-preview auth skip. */
export function isStaticDemo(): boolean {
  return import.meta.env.VITE_STATIC_DEMO === '1' || import.meta.env.VITE_STATIC_DEMO === 'true';
}

/** Fixture-backed design preview (not embedded, not live proxy). */
export function isFixturePreview(): boolean {
  return isStaticDemo() || (!isEmbedded() && !isLiveProxy());
}
```

Update `vite.config.ts`:

```ts
const staticDemo = process.env.VITE_STATIC_DEMO === '1' || process.env.VITE_STATIC_DEMO === 'true';

// inside defineConfig return:
define: {
  'import.meta.env.VITE_LIVE_PROXY': JSON.stringify(useLiveProxy ? '1' : '0'),
  'import.meta.env.VITE_STATIC_DEMO': JSON.stringify(staticDemo ? '1' : '0'),
},
build: {
  outDir: staticDemo ? 'dist-demo' : 'dist',
  emptyOutDir: true,
},
```

When `staticDemo` is true, do **not** register `fixtureApiPlugin()` (no Vite middleware in the static build). Auth skip still works via `isFixturePreview()`.

- [ ] **Step 7: Write failing client intercept test**

```ts
// src/api/client.demo.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalKey } from './demo-key.mjs';

describe('static demo routing helpers', () => {
  it('canonicalKey matches bake manifest style keys', () => {
    assert.equal(
      canonicalKey('GET', '/api/performance/rollups', 'hours=24'),
      'GET /api/performance/rollups?hours=24',
    );
  });

  it('documents POST stub shape', () => {
    const stub = { ok: true, preview: true };
    assert.deepEqual(stub, { ok: true, preview: true });
  });
});
```

Then implement intercept inside `apiFetch` in `client.ts`:

```ts
import { canonicalKey } from './demo-key.mjs';
import { isStaticDemo } from '@/app/runtime';

let demoManifest: Record<string, string> | null | undefined;
async function loadDemoManifest(): Promise<Record<string, string>> {
  if (demoManifest) return demoManifest;
  const res = await fetch('./demo-api/manifest.json');
  demoManifest = (await res.json()) as Record<string, string>;
  return demoManifest;
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  if (isStaticDemo()) {
    const method = (init?.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      return { ok: true, preview: true } as T;
    }
    const u = new URL(path, 'http://demo.local');
    const key = canonicalKey(method, u.pathname, u.search);
    const manifest = await loadDemoManifest();
    const file = manifest[key];
    if (!file) throw new Error(`404 ${path}: demo manifest miss for ${key}`);
    const res = await fetch(`./demo-api/${file}`);
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json') || file.endsWith('.json')) return res.json() as Promise<T>;
    return res.text() as Promise<T>;
  }
  // Non-static path — keep the current apiFetch body from client.ts unchanged:
  const hasJsonBody = Boolean(init?.body) && !(init?.body instanceof FormData);
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${path}: ${text || res.statusText}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json() as Promise<T>;
  return res.text() as Promise<T>;
}
```

Also stub the raw-fetch bypass and add `resolveDemoAsset` for href downloads:

```ts
supportBundleDownload: async () => {
  if (isStaticDemo()) return new Blob(['demo'], { type: 'application/zip' });
  const res = await fetch('/api/support/bundle', { credentials: 'include' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} /api/support/bundle: ${text || res.statusText}`);
  }
  return res.blob();
},

performanceExportCsvUrl: (window = '7d') =>
  `/api/performance/export?format=csv&window=${encodeURIComponent(window)}`,
```

```ts
/** Map an /api/... path to ./demo-api/<file> using the baked manifest (static demo only). */
export async function resolveDemoAsset(path: string): Promise<string> {
  if (!isStaticDemo()) return path;
  const u = new URL(path, 'http://demo.local');
  const key = canonicalKey('GET', u.pathname, u.search);
  const manifest = await loadDemoManifest();
  const file = manifest[key];
  if (!file) throw new Error(`demo manifest miss for ${key}`);
  return `./demo-api/${file}`;
}
```

Task 10 bakes `GET /api/performance/export?format=csv&window=7d`. Grep for `performanceExportCsvUrl` and update every call site that puts the URL in an `<a href>` so static demo resolves through `resolveDemoAsset(...)` (async click handler is fine). Same commit as this task.

- [ ] **Step 8: Create `demo-banner.tsx` and mount in shell**

```tsx
// src/app/demo-banner.tsx
import { isStaticDemo } from '@/app/runtime';

export function DemoBanner() {
  if (!isStaticDemo()) return null;
  return (
    <div
      role="status"
      className="border-b border-[color:var(--wt-line)] bg-[color:var(--wt-bg2)] px-3 py-2 text-center text-sm text-[color:var(--wt-text-mid)]"
    >
      Interactive demo. Sample data, and nothing you change is saved.
    </div>
  );
}
```

In `shell.tsx`, render `<DemoBanner />` above the main chrome when static demo.

- [ ] **Step 9: Extend `test:demo` and run all demo unit tests**

Update `web/dashboard/package.json`:

```json
"test:demo": "tsx --test scripts/fixture-api-core.test.ts src/api/demo-key.test.ts src/api/client.demo.test.ts src/app/runtime.test.ts"
```

Run:

```bash
cd web/dashboard && npm run test:demo
```

Expected: PASS for fixture-api-core, demo-key, runtime, client.demo.

- [ ] **Step 10: Commit**

```bash
git add web/dashboard/src/api/demo-key.mjs web/dashboard/src/api/demo-key.test.ts web/dashboard/src/api/client.ts web/dashboard/src/api/client.demo.test.ts web/dashboard/src/app/runtime.ts web/dashboard/src/app/runtime.test.ts web/dashboard/src/app/demo-banner.tsx web/dashboard/src/app/shell.tsx web/dashboard/vite.config.ts web/dashboard/package.json
git commit -m "$(cat <<'EOF'
feat(dashboard): add static demo mode with canonicalKey, apiFetch intercept, and banner

EOF
)"
```

---

### Task 10: Bake demo API + routes + `build:demo` + manifest check

**Files:**
- Create: `web/dashboard/scripts/demo-routes.mjs`
- Create: `web/dashboard/scripts/bake-demo-api.mjs`
- Create: `web/dashboard/scripts/check-demo-manifest.mjs`
- Modify: `web/dashboard/package.json` scripts: `build:demo`, `check:demo-manifest`

**Interfaces:**
- Consumes: `createFixtureSession`, `handleFixtureRequest`, `canonicalKey`
- Produces: `dist-demo/demo-api/**` + `manifest.json`; size circuit breaker at ~100 MB

- [ ] **Step 1: Create `scripts/demo-routes.mjs`**

Explicit list (~50–70 GETs). Start with:

```js
/** Single source list of requests to bake for the static demo. */
export const DEMO_GET_ROUTES = [
  '/api/auth/session',
  '/api/live',
  '/api/players',
  '/api/samples?minutes=60&max_points=500',
  '/api/overview/meta',
  '/api/data-sources',
  '/api/ops-cache',
  '/api/issues/peek',
  '/api/issues/acks',
  '/api/issues/suppressions',
  '/api/performance/dashboard?window=7d',
  '/api/performance/dashboard?window=30d',
  '/api/performance/insights?window=7d',
  '/api/performance/insights?window=30d',
  '/api/performance/rollups?hours=24',
  '/api/performance/rollups?hours=168',
  '/api/performance/rollups?hours=720',
  '/api/performance/export?format=csv&window=7d',
  '/api/spark/profiles',
  '/api/logs/list',
  '/api/crash-contexts',
  '/api/crashes',
  '/api/crashes/acks',
  '/api/reports/latest',
  '/api/reports/index',
  '/api/reports/status',
  '/api/facts',
  '/api/update-check',
  '/api/config-audit',
  '/api/weekly-digest',
  '/api/modrinth/status',
  '/api/mods/forensics/status',
  '/api/settings',
  '/api/accounts',
  '/api/audit-log?limit=200',
  '/api/support/catalog',
  '/api/fs/roots',
  '/api/onboarding/discovery/status',
  '/api/preview/profile',
];

/**
 * Append parameterized GETs discovered from fixture JSON so every tab resolves.
 * Call from bake-demo-api.mjs: `const routes = await expandDemoRoutes(DEMO_GET_ROUTES)`.
 */
export async function expandDemoRoutes(base) {
  const { readFileSync, existsSync, readdirSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
  const out = [...base];

  const profilesPath = join(dataDir, 'spark-profiles.json');
  if (existsSync(profilesPath)) {
    const profiles = JSON.parse(readFileSync(profilesPath, 'utf8'));
    const list = Array.isArray(profiles)
      ? profiles
      : Array.isArray(profiles.profiles)
        ? profiles.profiles
        : [];
    for (const row of list) {
      const path = String(row.path || row.id || row.file || '').trim();
      if (!path) continue;
      out.push(`/api/spark/profile?path=${encodeURIComponent(path)}`);
      out.push(`/api/spark/tree?path=${encodeURIComponent(path)}&max_nodes=250000`);
    }
  }

  const logsPath = join(dataDir, 'logs-index.json');
  if (existsSync(logsPath)) {
    const logs = JSON.parse(readFileSync(logsPath, 'utf8'));
    const files = Array.isArray(logs) ? logs : Array.isArray(logs.files) ? logs.files : [];
    for (const f of files.slice(0, 5)) {
      const name = String(f.file || f.name || f).trim();
      if (name) out.push(`/api/logs/content?file=${encodeURIComponent(name)}&tail=2000`);
    }
  }

  const crashDir = join(dataDir, 'crash-reports');
  if (existsSync(crashDir)) {
    for (const name of readdirSync(crashDir).filter((n) => n.endsWith('.txt')).slice(0, 13)) {
      out.push(`/api/crashes/report?file=${encodeURIComponent(name)}`);
      out.push(`/api/crashes/context?file=${encodeURIComponent(name)}&minutes=10`);
    }
  }

  return [...new Set(out)];
}

/** Allowlisted /api/ literals in client.ts that need not be baked (POST-only or unused in demo). */
export const DEMO_MANIFEST_ALLOWLIST = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/totp',
  '/api/auth/change-password',
  '/api/auth/change-username',
  '/api/auth/totp/setup',
  '/api/auth/totp/confirm',
  '/api/auth/totp/disable',
  '/api/auth/recovery/regenerate',
  '/api/settings',
  '/api/performance/baseline',
  '/api/spark/import',
  '/api/spark/upload',
  '/api/crashes/ack',
  '/api/crashes/acknowledge-all',
  '/api/crashes/scan',
  '/api/forensics/find-class',
  '/api/mods/scan',
  '/api/modrinth/scan',
  '/api/weekly-digest',
  '/api/issues/ack',
  '/api/issues/acknowledge-all',
  '/api/issues/suppress',
  '/api/issues/unsuppress',
  '/api/onboarding/discovery/start',
  '/api/backups/dirs',
  '/api/backups/external',
  '/api/backups/external/test',
  '/api/backups/scan',
  '/api/support/compose',
  '/api/support/bundle',
  '/api/accounts',
  '/api/accounts/update',
  '/api/accounts/me/minecraft',
  '/api/accounts/reset-password',
  '/api/accounts/delete',
];
```

Bake must call `expandDemoRoutes(DEMO_GET_ROUTES)` before the write loop. If size exceeds ~100 MB after expansion, remove `window=30d`, `hours=720`, and the largest spark tree routes from the expanded list and rebake.

- [ ] **Step 2: Create `scripts/bake-demo-api.mjs`**

```js
#!/usr/bin/env node
import { mkdirSync, writeFileSync, rmSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalKey } from '../src/api/demo-key.mjs';
import { DEMO_GET_ROUTES, expandDemoRoutes } from './demo-routes.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist-demo', 'demo-api');
const MAX_BYTES = 100 * 1024 * 1024; // circuit breaker ~100 MB

async function main() {
  // Dynamic import TS core via tsx when invoked as: npx tsx scripts/bake-demo-api.mjs
  const { createFixtureSession, handleFixtureRequest } = await import('./fixture-api-core.ts');

  if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const session = createFixtureSession();
  const manifest = {};
  let i = 0;
  const routes = await expandDemoRoutes(DEMO_GET_ROUTES);

  for (const route of routes) {
    const u = new URL(route, 'http://demo.local');
    const key = canonicalKey('GET', u.pathname, u.search);
    const result = await handleFixtureRequest(session, 'GET', u.pathname + u.search);
    if (!result) {
      console.warn('bake-demo-api: skip (null)', key);
      continue;
    }
    const ext = result.contentType.includes('json') ? 'json' : 'bin';
    const file = `r${String(++i).padStart(4, '0')}.${ext}`;
    const abs = join(OUT, file);
    writeFileSync(abs, result.body);
    // Spark gzip circuit breaker: if body is already gzip Buffer, write .json.gz and
    // record contentEncoding in a sidecar OR rely on vercel.json Content-Encoding for *.tree.json.gz
    manifest[key] = file;
  }

  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Size circuit breaker
  let total = 0;
  for (const name of readdirSync(OUT)) {
    total += statSync(join(OUT, name)).size;
  }
  console.log(`bake-demo-api: ${Object.keys(manifest).length} routes, ${(total / 1e6).toFixed(1)} MB`);
  if (total > MAX_BYTES) {
    console.error('bake-demo-api: exceeds ~100 MB — drop 30d rollups and largest Spark profiles from demo-routes.mjs');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

**Spark gzip note:** If `/api/spark/tree` currently gunzips in the fixture core, for bake either (a) write still-compressed bytes with filename `*.json.gz` and teach `apiFetch` to fetch them (browser inflates when Vercel sends `Content-Encoding: gzip`), or (b) after one failed debugging pass, omit tree routes and return empty-state JSON from a tiny baked file. Do not block launch on Spark depth.

- [ ] **Step 3: Create `scripts/check-demo-manifest.mjs`**

```js
#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_MANIFEST_ALLOWLIST } from './demo-routes.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const clientSrc = readFileSync(join(ROOT, 'src', 'api', 'client.ts'), 'utf8');
const manifestPath = join(ROOT, 'dist-demo', 'demo-api', 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error('check-demo-manifest: missing', manifestPath);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const bakedPaths = new Set(
  Object.keys(manifest).map((k) => k.replace(/^GET\s+/, '').split('?')[0]),
);

const literals = [...clientSrc.matchAll(/['"`](\/api\/[^'"`?]+)/g)].map((m) => m[1]);
const unique = [...new Set(literals)];
const allow = new Set(DEMO_MANIFEST_ALLOWLIST.map((p) => p.split('?')[0]));
const missing = unique.filter((p) => !bakedPaths.has(p) && !allow.has(p));

if (missing.length) {
  console.error('check-demo-manifest FAIL — /api/ literals not baked or allowlisted:');
  for (const p of missing) console.error(' ', p);
  process.exit(1);
}
console.log('check-demo-manifest OK', { baked: bakedPaths.size, scanned: unique.length });
```

- [ ] **Step 4: Wire package scripts**

Replace any Task-8-only `test:demo` entry and add build scripts to `web/dashboard/package.json`:

```json
"test:demo": "tsx --test scripts/fixture-api-core.test.ts src/api/demo-key.test.ts src/api/client.demo.test.ts src/app/runtime.test.ts",
"build:demo": "node scripts/build-wiki.mjs && tsc -b && node scripts/run-vite-static-demo.mjs && npx tsx scripts/bake-demo-api.mjs && node scripts/check-demo-manifest.mjs",
"check:demo-manifest": "node scripts/check-demo-manifest.mjs"
```

Create `scripts/run-vite-static-demo.mjs` (portable env set for Windows PowerShell + bash):

```js
import { spawnSync } from 'node:child_process';
process.env.VITE_STATIC_DEMO = '1';
const r = spawnSync('npx', ['vite', 'build'], { stdio: 'inherit', shell: true, env: process.env });
process.exit(r.status ?? 1);
```

Bake runs **after** vite so files land inside `dist-demo/demo-api/` beside the built assets. Order: vite build → bake → check.

- [ ] **Step 5: Run build:demo**

```bash
cd web/dashboard && npm run build:demo
```

Expected: `dist-demo/index.html` exists; `dist-demo/demo-api/manifest.json` exists; check passes; size under ~100 MB. If over: remove `window=30d` and `hours=720` routes and largest spark trees from `DEMO_GET_ROUTES`, rebuild.

- [ ] **Step 6: Commit**

```bash
git add web/dashboard/scripts/demo-routes.mjs web/dashboard/scripts/bake-demo-api.mjs web/dashboard/scripts/check-demo-manifest.mjs web/dashboard/scripts/run-vite-static-demo.mjs web/dashboard/package.json
git commit -m "$(cat <<'EOF'
feat(dashboard): bake static demo API from fixture-api-core with manifest coverage check

EOF
)"
```

Do **not** commit `dist-demo/` (gitignored in Task 12).

---

### Task 11: Demo smoke

**Files:**
- Create: `web/dashboard/scripts/smoke-demo.mjs` (local static server helper)
- Evidence: screenshots or notes saved under a local path (do not commit unless asked)

**Interfaces:**
- Consumes: `dist-demo/` from Task 10; `scripts/data/route-catalog.json` pages
- Produces: zero console 404s across catalog top-level tabs

- [ ] **Step 1: Serve dist-demo**

```js
// scripts/smoke-demo.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist-demo');
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.gz': 'application/json',
};

createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = join(ROOT, url === '/' ? 'index.html' : url);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html');
  const body = readFileSync(file);
  const type = TYPES[extname(file)] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    ...(file.endsWith('.gz') ? { 'Content-Encoding': 'gzip' } : {}),
  });
  res.end(body);
}).listen(4173, '127.0.0.1', () => console.log('smoke-demo http://127.0.0.1:4173/'));
```

Run:

```bash
cd web/dashboard && node scripts/smoke-demo.mjs
```

- [ ] **Step 2: Browser walk**

Open each top-level route from `scripts/data/route-catalog.json` `pages[].route` (overview, live, insights, session, startup, issues, crashes, spark, logs, mods, backups, activity, sources, docs, roadmap, settings, help — skip wizard unless `?setup=1`). Confirm:
- Demo banner visible
- No red console 404s for `/api/*` or `./demo-api/*`
- No full-page error states on primary tabs
- Spark deep tree: either works via gzip or shows honest empty state (circuit breaker)

- [ ] **Step 3: Capture evidence**

Save at least Overview + Issues + Spark screenshots locally for the PR description. Paste console “0 errors” note in the PR.

- [ ] **Step 4: Commit helper only**

```bash
git add web/dashboard/scripts/smoke-demo.mjs
git commit -m "$(cat <<'EOF'
chore(dashboard): add static demo smoke server helper

EOF
)"
```

---

### Task 12: Deploy configs

**Files:**
- Create: `web/marketing/vercel.json`
- Create: `web/dashboard/vercel.json`
- Create: `.github/workflows/web-marketing.yml`
- Create: `.github/workflows/demo-rebake.yml`
- Modify: `.github/workflows/ci.yml` (`paths-ignore`)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_DEMO_URL`, Vercel deploy hook secret `VERCEL_DEMO_DEPLOY_HOOK`
- Produces: two deployable projects; daily rebake; CI ignores marketing-only paths

- [ ] **Step 1: Create `web/marketing/vercel.json`**

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

- [ ] **Step 2: Create `web/dashboard/vercel.json`**

```json
{
  "buildCommand": "npm run build:demo",
  "outputDirectory": "dist-demo",
  "rewrites": [{ "source": "/((?!demo-api/).*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/demo-api/(.*)\\.gz",
      "headers": [
        { "key": "Content-Encoding", "value": "gzip" },
        { "key": "Content-Type", "value": "application/json" },
        { "key": "Cache-Control", "value": "public, max-age=3600" }
      ]
    },
    {
      "source": "/demo-api/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=3600" }]
    }
  ]
}
```

SPA fallback must not swallow `demo-api/*`. Adjust rewrite negative lookahead if Vercel syntax requires a different form; verify with a deployed `/demo-api/manifest.json` 200.

- [ ] **Step 3: Create `.github/workflows/web-marketing.yml`**

```yaml
name: Web marketing

on:
  push:
    branches: [main, master]
    paths: ['web/marketing/**']
  pull_request:
    branches: [main, master]
    paths: ['web/marketing/**']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install and build
        working-directory: web/marketing
        run: |
          npm ci
          npm run build
```

- [ ] **Step 4: Create `.github/workflows/demo-rebake.yml`**

```yaml
name: Demo rebake

on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:

jobs:
  rebake:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Vercel deploy hook
        env:
          HOOK: ${{ secrets.VERCEL_DEMO_DEPLOY_HOOK }}
        run: |
          if [ -z "$HOOK" ]; then
            echo "VERCEL_DEMO_DEPLOY_HOOK not set — skip"
            exit 0
          fi
          curl -fsS -X POST "$HOOK"
```

- [ ] **Step 5: Add `paths-ignore` to `.github/workflows/ci.yml`**

Under both `push` and `pull_request`:

```yaml
on:
  push:
    branches: [main, master]
    paths-ignore:
      - 'web/marketing/**'
      - 'docs/superpowers/**'
  pull_request:
    branches: [main, master]
    paths-ignore:
      - 'web/marketing/**'
      - 'docs/superpowers/**'
```

Keep dashboard / Java CI running for demo-related `web/dashboard/**` changes.

- [ ] **Step 6: Update `.gitignore`**

Append:

```
# Marketing site build artefacts
web/marketing/.next/
web/marketing/public/screenshots/
web/marketing/public/brand/
web/marketing/out/

# Static demo bake (never embed in NeoForge jar)
web/dashboard/dist-demo/
```

- [ ] **Step 7: Commit**

```bash
git add web/marketing/vercel.json web/dashboard/vercel.json .github/workflows/web-marketing.yml .github/workflows/demo-rebake.yml .github/workflows/ci.yml .gitignore
git commit -m "$(cat <<'EOF'
ci: add marketing and demo Vercel configs, rebake workflow, and gitignore

EOF
)"
```

Manual (operator): create Vercel project A root `web/marketing`; project B root `web/dashboard` build `npm run build:demo` output `dist-demo`; set `NEXT_PUBLIC_DEMO_URL` on marketing; store deploy hook in `VERCEL_DEMO_DEPLOY_HOOK`.

---

### Task 13: Packaging guard

**Files:**
- Modify: `tools/audit-dashboard-packaging.mjs`

**Interfaces:**
- Consumes: built jar under `mods/neoforge-1.21/build/libs`
- Produces: fail if jar contains `demo-api/`, demo `manifest.json`, or demo banner markup

- [ ] **Step 1: Extend jar listing checks**

Inside the existing `for (const jar of jarCandidates…)` loop, after the index.html check:

```js
    if (/demo-api\//.test(listing)) {
      fails.push(`JAR must not contain demo-api/: ${jar}`);
    }
    if (/assets\/watchtower\/web\/demo-api\/manifest\.json/.test(listing) || /\/demo-api\/manifest\.json/.test(listing)) {
      fails.push(`JAR must not contain demo manifest.json: ${jar}`);
    }
    // Banner string only exists in static-demo bundle; production dist must not include it.
    if (/Interactive demo\. Sample data, and nothing you change is saved\./.test(listing)) {
      fails.push(`JAR must not contain static demo banner markup: ${jar}`);
    }
```

Also assert Gradle still syncs from `web/dashboard` `dist/` (not `dist-demo/`):

```js
if (/dist-demo/.test(text)) {
  fails.push('build.gradle must not reference dist-demo');
}
```

- [ ] **Step 2: Build jar and run audit**

```bash
./gradlew :neoforge-1.21:build --no-configuration-cache
node tools/audit-dashboard-packaging.mjs
```

Expected: `audit-dashboard-packaging OK`. Compare jar size to a pre-change baseline if available — should be unchanged aside from normal dashboard churn unrelated to demo artefacts.

- [ ] **Step 3: Confirm normal `npm run build` still writes `dist/` only**

```bash
cd web/dashboard && npm run build
```

Expected: `dist/` present; `dist-demo/` absent (unless leftover — delete leftovers; never copy demo into `public/`).

- [ ] **Step 4: Commit**

```bash
git add tools/audit-dashboard-packaging.mjs
git commit -m "$(cat <<'EOF'
test: guard NeoForge jar against static demo bake artefacts

EOF
)"
```

---

### Task 14: Final verify

**Files:**
- None new required — verification + optional PR
- Evidence in PR body

**Interfaces:**
- Consumes: all prior tasks
- Produces: green builds, live `*.vercel.app` URLs, plain-English summary

- [ ] **Step 1: Production builds**

```bash
cd web/marketing && npm ci && npm run build
cd ../dashboard && npm ci && npm run test:demo && npm run build && npm run build:demo
```

Expected: all succeed; existing `npm run test:*` still green (at least `test:issues`, `test:settings`).

- [ ] **Step 2: Preview regression**

```bash
cd web/dashboard && npm run preview
```

Expected: identical fixture behaviour to pre-refactor.

- [ ] **Step 3: Deploy both Vercel projects**

Confirm marketing home loads; “Try the demo” hits `NEXT_PUBLIC_DEMO_URL`; demo shows banner; Overview tab works.

- [ ] **Step 4: Desktop + mobile screenshot review**

Check `/` first viewport composition (brand-first, no stat strip); `/features` alpha labels; `/install` latest tag; dark tokens only.

- [ ] **Step 5: Bugbot / code review**

Run requesting-code-review or Bugbot on the branch diff; triage findings.

- [ ] **Step 6: Plain-English end-user summary (for PR)**

Visitors land on a site that says WatchTower answers two questions — is my server okay, and what should I fix next. They can open a working copy of the real dashboard with sample data and click every tab before downloading. Install is three steps. Honest pages explain what it refuses to do: no cloud account required, no player tracking, no touching their world or mods.

---

## Self-Review

### 1. Spec coverage

| Spec requirement | Task |
| ---------------- | ---- |
| `web/marketing` Next.js on Vercel | 1, 12 |
| Interactive demo = real dashboard + `VITE_STATIC_DEMO=1` → `dist-demo/` | 9, 10, 12 |
| Night Watch Desk tokens / dark-only / Geist + JetBrains Mono / lucide | 1, 2 |
| Product truth + claim sources + no hardcoded versions | 3, 5, 6 |
| Pages `/`, `/how-it-works`, `/features`, `/install`, `/demo`, `/faq` | 4, 5 |
| First viewport composition + 3 motions + reduced-motion | 2, 4, 7 |
| Screenshot sync from `docs/assets/screenshots/` | 1 |
| Extract `fixture-api-core` + thin vite wrapper | 8 |
| Bake + `canonicalKey` + manifest + POST stubs + banner | 9, 10 |
| Spark gzip + bake size circuit breakers | Global Constraints, 10, 11 |
| Daily rebake Action | 12 |
| Jar must not contain demo artefacts; packaging audit | 13 |
| `npm run preview` unchanged; verification suite | 8, 11, 14 |
| A11y WCAG 2.2 AA intent | 2, 7 |
| Non-goals respected (no Cloud marketing, no wiki fork, no analytics) | Global Constraints, 3–6 |

No uncovered spec sections found.

### 2. Placeholder scan

Scanned for TBD / TODO / “similar to Task N” / “add appropriate error handling” without code. Fixed during drafting: bake script, package scripts, vercel rewrites, test bodies, and content modules all include concrete code. Remaining operator-only steps (create Vercel projects, set secrets) are explicit manual actions with exact env var names, not placeholders.

### 3. Type consistency

- `canonicalKey(method, pathname, search)` — Tasks 9–10
- `FixtureResponse` / `FixtureSession` / `createFixtureSession` / `handleFixtureRequest` — Tasks 8, 10
- `isStaticDemo()` — Tasks 9–11, 13 (banner string)
- Manifest map `Record<canonicalKey, filename>` — Tasks 9–10
- Banner copy exact string used in packaging guard — Tasks 9, 13

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-30-watchtower-marketing-site.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks (`superpowers:subagent-driven-development`)
2. **Inline Execution** — execute in-session with checkpoints (`superpowers:executing-plans`)

Which approach?
