#!/usr/bin/env node
/**
 * Features catalog audit: capability ids cover bento cells, MORE rows fill 6 cols.
 * Exit 1 on failure. Run from repo root or web/marketing:
 *   node web/marketing/scripts/audit-features-catalog.mjs
 *   node scripts/audit-features-catalog.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const featuresPath = join(ROOT, 'content', 'features.ts');
const bentoPath = join(ROOT, 'content', 'features-bento.ts');

const fail = [];
const SPAN_W = { half: 3, one: 2, two: 4 };
const EXPECTED_SHOWCASE = [
  'health-grade',
  'fix-inbox',
  'world-pressure',
  'join-clinic',
  'live-vitals',
  'support-pack',
  'spark',
];
const REQUIRED_NEW = [
  'jar-disable',
  'mod-configs',
  'storage-space-map',
  'spark-map',
  'theme-accent',
];

function extractBlock(src, exportName) {
  const re = new RegExp(
    `export const ${exportName}[^=]*=\\s*\\[([\\s\\S]*?)\\n\\];`,
  );
  const m = src.match(re);
  if (!m) {
    fail.push(`Could not find export const ${exportName} = [...]`);
    return '';
  }
  return m[1];
}

function extractIds(block) {
  return [...block.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
}

function extractSpans(block) {
  return [...block.matchAll(/span:\s*'(half|one|two)'/g)].map((m) => m[1]);
}

const featuresSrc = readFileSync(featuresPath, 'utf8');
const bentoSrc = readFileSync(bentoPath, 'utf8');

const capabilityIds = new Set(extractIds(extractBlock(featuresSrc, 'FEATURE_CAPABILITIES')));
const showcaseBlock = extractBlock(bentoSrc, 'FEATURE_BENTO_SHOWCASE');
const moreBlock = extractBlock(bentoSrc, 'FEATURE_BENTO_MORE');
const showcaseIds = extractIds(showcaseBlock);
const moreIds = extractIds(moreBlock);
const moreSpans = extractSpans(moreBlock);

if (showcaseIds.length !== EXPECTED_SHOWCASE.length) {
  fail.push(
    `FEATURE_BENTO_SHOWCASE length ${showcaseIds.length}, expected ${EXPECTED_SHOWCASE.length}`,
  );
}
for (let i = 0; i < EXPECTED_SHOWCASE.length; i++) {
  if (showcaseIds[i] !== EXPECTED_SHOWCASE[i]) {
    fail.push(
      `FEATURE_BENTO_SHOWCASE[${i}] is '${showcaseIds[i] ?? '?'}', expected '${EXPECTED_SHOWCASE[i]}'`,
    );
  }
}

for (const id of [...showcaseIds, ...moreIds]) {
  if (!capabilityIds.has(id)) {
    fail.push(`Bento id '${id}' missing from FEATURE_CAPABILITIES`);
  }
}

if (moreIds.length !== moreSpans.length) {
  fail.push(
    `MORE id count (${moreIds.length}) != span count (${moreSpans.length})`,
  );
} else {
  let row = 0;
  for (let i = 0; i < moreSpans.length; i++) {
    const w = SPAN_W[moreSpans[i]];
    row += w;
    if (row > 6) {
      fail.push(
        `MORE row overflow at index ${i} (id '${moreIds[i]}', span '${moreSpans[i]}') — partial sum ${row}`,
      );
      row = row % 6;
    } else if (row === 6) {
      row = 0;
    }
  }
  if (row !== 0) {
    fail.push(`MORE grid incomplete final row (remainder ${row}/6)`);
  }
}

for (const id of REQUIRED_NEW) {
  if (!capabilityIds.has(id)) {
    fail.push(`Required new capability '${id}' missing from FEATURE_CAPABILITIES`);
  }
  if (!moreIds.includes(id)) {
    fail.push(`Required new capability '${id}' missing from FEATURE_BENTO_MORE`);
  }
}

if (fail.length) {
  console.error('audit-features-catalog: FAIL');
  for (const line of fail) console.error(`  - ${line}`);
  process.exit(1);
}

console.log(
  `audit-features-catalog: ok (${capabilityIds.size} capabilities, ${showcaseIds.length} showcase, ${moreIds.length} more)`,
);
