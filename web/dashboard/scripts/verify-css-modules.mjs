#!/usr/bin/env node
/**
 * Fail if any css/v3 module is missing from build-css.mjs V3_ORDER.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const v3Root = path.join(root, 'css', 'v3');
const buildScript = fs.readFileSync(path.join(root, 'scripts', 'build-css.mjs'), 'utf8');

const orderMatches = [...buildScript.matchAll(/'css\/v3\/[^']+'/g)].map((m) => m[0].slice(1, -1));
const orderSet = new Set(orderMatches);

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.name.endsWith('.css')) files.push(path.relative(root, full).replace(/\\/g, '/'));
  }
  return files;
}

const onDisk = walk(v3Root).sort();
const missing = onDisk.filter((rel) => !orderSet.has(rel));
const extra = orderMatches.filter((rel) => !onDisk.includes(rel));

if (missing.length || extra.length) {
  if (missing.length) {
    console.error('CSS modules on disk but missing from V3_ORDER:');
    missing.forEach((m) => console.error(`  - ${m}`));
  }
  if (extra.length) {
    console.error('V3_ORDER entries not found on disk:');
    extra.forEach((m) => console.error(`  - ${m}`));
  }
  process.exit(1);
}

console.log(`verify-css-modules OK (${onDisk.length} modules)`);
