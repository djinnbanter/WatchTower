#!/usr/bin/env node
/**
 * Anti-slop / Shift Log audit for web/marketing.
 * Exit 1 on failure. Run from web/marketing: node scripts/audit-shift-log.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
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

// Shift-log + entries + desk + how plates: no sub-12px font sizes
const sizeTargets = files.filter((p) => {
  const r = rel(p);
  return (
    r.startsWith('components/shift-log/') ||
    r.startsWith('components/entries/') ||
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
    r.startsWith('components/shift-log/') ||
    r.startsWith('components/entries/') ||
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
    // InstrumentPlate may still define the token; pages must not apply it
    if (!r.includes('instrument-plate')) {
      fail.push(`${r}: elevation box-shadow via --wt-shadow`);
    }
  }
  // Atmospheric radial on tour entries/pages
  if (
    (r.startsWith('components/entries/') ||
      r.startsWith('components/how/') ||
      r === 'app/page.tsx' ||
      r === 'app/how-it-works/page.tsx') &&
    /radial-gradient\(/.test(text)
  ) {
    fail.push(`${r}: decorative radial-gradient`);
  }
}

// Feature-tour rail: named surfaces, no clock stamps on the rail
const EXPECTED_RAIL = [
  ['welcome', 'Welcome'],
  ['live', 'Live'],
  ['issues', 'Issues'],
  ['crashes', 'Crashes'],
  ['overview', 'Overview'],
  ['insights', 'Insights'],
  ['close', 'End of shift'],
];

const nightPath = join(ROOT, 'content/night.ts');
const nightText = readFileSync(nightPath, 'utf8');
for (const [id, label] of EXPECTED_RAIL) {
  if (!new RegExp(`id:\\s*'${id}'`).test(nightText)) {
    fail.push(`night.ts: missing id '${id}'`);
  }
  if (!nightText.includes(`railLabel: '${label}'`) && !nightText.includes(`railLabel: "${label}"`)) {
    fail.push(`night.ts: missing railLabel '${label}'`);
  }
}
if (/railLabel:\s*'[0-2]\d:[0-5]\d'/.test(nightText)) {
  fail.push('night.ts: clock-style railLabel still present');
}

// Feature-first left columns: no TOUR.proof, no DESK fixture stories in entries
const productPath = join(ROOT, 'content/product.ts');
const productText = readFileSync(productPath, 'utf8');
if (/\bproof\s*:/.test(productText)) {
  fail.push('content/product.ts: TOUR.proof (or other proof:) still present - feature-first copy forbids left-column proofs');
}

const entryBans = [
  ['components/entries/live.tsx', /\.proof\b|Long busy-hour patterns sit on Insights/],
  ['components/entries/issues.tsx', /\.proof\b/],
  ['components/entries/crashes.tsx', /\.proof\b/],
  ['components/entries/overview.tsx', /DESK\.overview\.letter|Restart verdict:/],
  ['components/entries/insights.tsx', /stickyLag/],
];
for (const [relPath, re] of entryBans) {
  const text = readFileSync(join(ROOT, relPath), 'utf8');
  if (re.test(text)) fail.push(`${relPath}: left-column fixture / proof narrative still present`);
}

// How it works is a mechanism pipeline now, not a setup guide
const howPagePath = join(ROOT, 'app/how-it-works/page.tsx');
const howPageText = readFileSync(howPagePath, 'utf8');
if (/wizard|mods\/|disaster-recovery CLI|watchtower-cli/i.test(howPageText)) {
  fail.push('app/how-it-works/page.tsx: setup-guide vocabulary should live on Install, not here');
}

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

if (fail.length) {
  console.error('audit-shift-log FAILED:\n' + fail.map((x) => `  - ${x}`).join('\n'));
  process.exit(1);
}

console.log(`audit-shift-log OK (${files.length} files scanned)`);
