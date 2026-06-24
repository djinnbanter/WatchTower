#!/usr/bin/env node
/**
 * Guardrails for preview/JAR dashboard parity.
 * Run from repo root: node tools/audit-dashboard-parity.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const dashboard = join(ROOT, 'web', 'dashboard');
const cssV3 = join(dashboard, 'css', 'v3');
const buildCss = join(dashboard, 'scripts', 'build-css.mjs');
const stylesCss = join(dashboard, 'styles.css');
const indexHtml = join(dashboard, 'index.html');

let failed = false;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  failed = true;
}

function walkCss(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkCss(full, out);
    else if (name.endsWith('.css')) out.push(relative(dashboard, full).replace(/\\/g, '/'));
  }
  return out;
}

const order = [...readFileSync(buildCss, 'utf8').matchAll(/'css\/v3\/[^']+'/g)].map((m) => m[0].slice(1, -1));
const onDisk = walkCss(cssV3).sort();
const missing = onDisk.filter((rel) => !order.includes(rel));
if (missing.length) fail(`CSS modules missing from V3_ORDER: ${missing.join(', ')}`);

const styles = readFileSync(stylesCss, 'utf8');
if (!styles.includes('.wt-setup-wizard')) fail('styles.css missing setup wizard rules');

const html = readFileSync(indexHtml, 'utf8');
const scriptSrcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1].split('?')[0]);
for (const src of scriptSrcs) {
  const path = join(dashboard, src);
  if (!statSync(path, { throwIfNoEntry: false })?.isFile()) {
    fail(`index.html references missing script: ${src}`);
  }
}
if (!statSync(join(dashboard, 'styles.css'), { throwIfNoEntry: false })?.isFile()) {
  fail('styles.css missing');
}

const apiJs = readFileSync(join(dashboard, 'api.js'), 'utf8');
if (apiJs.includes('8787')) fail('api.js still uses port 8787 embedded heuristic');

if (failed) process.exit(1);
console.log('audit-dashboard-parity OK');
