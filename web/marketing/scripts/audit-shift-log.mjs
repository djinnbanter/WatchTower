#!/usr/bin/env node
/**
 * Anti-slop / board-layout audit for web/marketing.
 * Exit 1 on failure. Run from web/marketing: node scripts/audit-shift-log.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const fail = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '_archive') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|css|mjs|js|md)$/.test(name)) out.push(p);
  }
  return out;
}

function rel(p) {
  return relative(ROOT, p).replace(/\\/g, '/');
}

const files = walk(ROOT);

// Content files: no em-dash or en-dash
for (const f of files.filter((p) => /\/content\//.test(rel(p)))) {
  const text = readFileSync(f, 'utf8');
  if (/[—–]/.test(text)) {
    fail.push(`${rel(f)}: contains em-dash or en-dash`);
  }
}

// Board + home + features + how: no sub-12px font sizes
const sizeTargets = files.filter((p) => {
  const r = rel(p);
  return (
    r.startsWith('components/board/') ||
    r.startsWith('components/home/') ||
    r.startsWith('components/features/') ||
    r.startsWith('components/how/') ||
    r.startsWith('components/type/') ||
    r.startsWith('components/motion/') ||
    r === 'components/evening-chart.tsx' ||
    r === 'components/desk/desk.css' ||
    r === 'components/hero-readout.tsx'
  );
});

const SUB = /(?:font-size:\s*)?0\.(5625|625|6875)rem|text-\[0\.(5625|625|6875)rem\]/;
for (const f of sizeTargets) {
  const text = readFileSync(f, 'utf8');
  if (SUB.test(text)) {
    fail.push(`${rel(f)}: sub-12px font size (0.5625/0.625/0.6875rem)`);
  }
}

// Home + how-it-works trees must not reintroduce glow tokens or atmosphere radials
const tourNew = files.filter((p) => {
  const r = rel(p);
  return (
    r.startsWith('components/board/') ||
    r.startsWith('components/home/') ||
    r.startsWith('components/how/') ||
    r === 'app/page.tsx' ||
    r === 'app/how-it-works/page.tsx' ||
    r === 'styles/globals.css'
  );
});

for (const f of tourNew) {
  const text = readFileSync(f, 'utf8');
  const r = rel(f);
  if (/--wt-glow-/.test(text)) fail.push(`${r}: --wt-glow-* token`);
  if (/boxShadow:\s*['"]var\(--wt-shadow\)['"]/.test(text) || /box-shadow:\s*var\(--wt-shadow\)/.test(text)) {
    if (!r.includes('instrument-plate')) {
      fail.push(`${r}: elevation box-shadow via --wt-shadow`);
    }
  }
  if (
    (r.startsWith('components/home/') ||
      r.startsWith('components/how/') ||
      r === 'app/page.tsx' ||
      r === 'app/how-it-works/page.tsx') &&
    /radial-gradient\(/.test(text)
  ) {
    fail.push(`${r}: decorative radial-gradient`);
  }
}

// Board Home required; Shift Log architecture retired
const homePage = readFileSync(join(ROOT, 'app/page.tsx'), 'utf8');
if (!/HomeBoard/.test(homePage)) {
  fail.push('app/page.tsx: expected HomeBoard');
}
if (/ShiftLog|WelcomeEntry|LiveEntry|IssuesEntry/.test(homePage)) {
  fail.push('app/page.tsx: Shift Log / entry list must stay retired');
}

for (const req of [
  'components/board/board-frame.tsx',
  'components/board/board-page-header.tsx',
  'components/board/board-section.tsx',
  'components/home/home-board.tsx',
  'components/home/live-gauges.tsx',
]) {
  if (!existsSync(join(ROOT, req))) {
    fail.push(`missing ${req}`);
  }
}

if (existsSync(join(ROOT, 'components/shift-log/log.tsx'))) {
  fail.push('components/shift-log/log.tsx: ShiftLog should stay removed from Home');
}
if (existsSync(join(ROOT, 'components/entries/welcome.tsx'))) {
  fail.push('components/entries: Home entry modules should stay removed');
}

// product.ts: no left-column proof narrative keys
const productText = readFileSync(join(ROOT, 'content/product.ts'), 'utf8');
if (/\bproof\s*:/.test(productText)) {
  fail.push('content/product.ts: TOUR.proof (or other proof:) still present');
}

// How it works is a mechanism pipeline now, not a setup guide
const howPageText = readFileSync(join(ROOT, 'app/how-it-works/page.tsx'), 'utf8');
if (/wizard|mods\/|disaster-recovery CLI|watchtower-cli/i.test(howPageText)) {
  fail.push('app/how-it-works/page.tsx: setup-guide vocabulary should live on Install, not here');
}
if (!/BoardFrame|BoardPageHeader/.test(howPageText)) {
  fail.push('app/how-it-works/page.tsx: expected BoardFrame / BoardPageHeader');
}

const featuresPage = readFileSync(join(ROOT, 'app/features/page.tsx'), 'utf8');
if (/ProductDesk/.test(featuresPage)) {
  fail.push('app/features/page.tsx: ProductDesk room peeks belong on home, not Features');
}
if (/FEATURE_SURFACES/.test(featuresPage)) {
  fail.push('app/features/page.tsx: use FEATURE_CAPABILITIES, not FEATURE_SURFACES');
}
if (!/CapabilityCatalog/.test(featuresPage)) {
  fail.push('app/features/page.tsx: expected CapabilityCatalog');
}
if (!/BoardFrame|BoardPageHeader/.test(featuresPage)) {
  fail.push('app/features/page.tsx: expected BoardFrame / BoardPageHeader');
}

const featuresContent = readFileSync(join(ROOT, 'content/features.ts'), 'utf8');
if (!/FEATURE_CAPABILITIES/.test(featuresContent)) {
  fail.push('content/features.ts: missing FEATURE_CAPABILITIES');
}
if (/FEATURE_SURFACES/.test(featuresContent)) {
  fail.push('content/features.ts: FEATURE_SURFACES should be removed');
}
if (!/tone:/.test(featuresContent)) {
  fail.push('content/features.ts: capability tones required for instrument gauges');
}

const catalogPath = join(ROOT, 'components/features/capability-catalog.tsx');
const tilePath = join(ROOT, 'components/features/capability-tile.tsx');
if (!existsSync(catalogPath)) {
  fail.push('components: capability-catalog required for Features grid');
}
if (existsSync(tilePath)) {
  fail.push('components/features: capability-tile superseded by capability-catalog');
}
if (existsSync(join(ROOT, 'components/features/capability-row.tsx'))) {
  fail.push('components/features: capability-row ledger should stay removed');
}

if (fail.length) {
  console.error('audit-shift-log FAILED:\n' + fail.map((x) => `  - ${x}`).join('\n'));
  process.exit(1);
}

console.log(`audit-shift-log OK (${files.length} files scanned)`);
