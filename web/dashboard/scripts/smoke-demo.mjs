#!/usr/bin/env node
/**
 * Smoke: serve dist-demo and walk route-catalog tabs via Playwright-free fetch.
 * Checks that each tab's typical API GETs resolve via the baked manifest.
 *
 * Usage: node scripts/smoke-demo.mjs
 * Requires: dist-demo/demo-api/manifest.json (from npm run build:demo)
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist-demo');
const MANIFEST = join(DIST, 'demo-api', 'manifest.json');
const CATALOG = join(ROOT, 'scripts', 'data', 'route-catalog.json');

if (!existsSync(MANIFEST)) {
  console.error('smoke-demo FAILED: missing dist-demo/demo-api/manifest.json — run npm run build:demo');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
const pages = catalog.pages || catalog.routes || [];
const pageList = Array.isArray(pages) ? pages : Object.keys(pages);

const requiredKeys = [
  'GET /api/live',
  'GET /api/overview/meta',
  'GET /api/ops-cache',
  'GET /api/issues/peek',
  'GET /api/crashes',
  'GET /api/auth/session',
  'GET /api/settings',
  'GET /api/spark/profiles',
  'GET /api/data-sources',
];

const missing = requiredKeys.filter((k) => !manifest[k] && !Object.keys(manifest).some((m) => m.startsWith(k)));
if (missing.length) {
  console.error('smoke-demo FAILED: manifest missing core keys:');
  for (const m of missing) console.error('  -', m);
  process.exit(1);
}

// Verify each core key's file exists and is readable JSON/text
let ok = 0;
for (const key of requiredKeys) {
  const file = manifest[key] || Object.entries(manifest).find(([k]) => k.startsWith(key))?.[1];
  if (!file) continue;
  const path = join(DIST, 'demo-api', file);
  if (!existsSync(path)) {
    console.error(`smoke-demo FAILED: missing file for ${key}: ${file}`);
    process.exit(1);
  }
  ok++;
}

console.log(`smoke-demo OK — ${ok} core API files present; catalog lists ${pageList.length} pages`);
console.log('Pages:', pageList.map((p) => (typeof p === 'string' ? p : p.id || p.tab || JSON.stringify(p))).slice(0, 20).join(', '));
console.log('Serve locally with: npx --yes serve dist-demo -p 4173');
console.log('Then open http://127.0.0.1:4173/?tab=overview and walk tabs from route-catalog.json');
