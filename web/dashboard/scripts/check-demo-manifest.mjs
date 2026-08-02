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
