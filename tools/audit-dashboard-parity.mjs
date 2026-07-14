#!/usr/bin/env node
/**
 * Guardrails for Lantern dashboard preview/JAR parity.
 * Run from repo root: node tools/audit-dashboard-parity.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const dashboard = join(ROOT, 'web', 'dashboard');
const stylesCss = join(dashboard, 'styles.css');
const indexHtml = join(dashboard, 'index.html');
const buildScript = join(dashboard, 'scripts', 'build.mjs');
const srcStyles = join(dashboard, 'src', 'styles');

let failed = false;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  failed = true;
}

function walkCss(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkCss(full, out);
    else if (name.endsWith('.css') && !name.startsWith('_')) {
      out.push(relative(dashboard, full).replace(/\\/g, '/'));
    }
  }
  return out;
}

// Required shipped assets
const required = [
  'index.html',
  'styles.css',
  'src/main.js',
  'src/wiki/content.js',
  'vendor/preact.module.js',
  'vendor/uplot.esm.js',
  'assets/fonts/IBMPlexSans-Regular.woff2',
];
for (const rel of required) {
  if (!existsSync(join(dashboard, rel))) fail(`missing required asset: ${rel}`);
}

// index.html must boot the Lantern app, not legacy scripts
const html = readFileSync(indexHtml, 'utf8');
if (!html.includes('src/main.js')) fail('index.html must load src/main.js');
if (html.includes('app.js') || html.includes('tower/')) {
  fail('index.html still references legacy app.js or tower/');
}
if (html.includes('fonts.googleapis.com')) {
  fail('index.html must not load Google Fonts CDN (self-hosted IBM Plex)');
}
if (!html.includes('modulepreload:start') || !html.includes('modulepreload:end')) {
  fail('index.html missing modulepreload markers');
}

// styles.css must be Lantern tokens, not wt- legacy
const stylesText = readFileSync(stylesCss, 'utf8');
if (!stylesText.includes('--ui-bg0') && !stylesText.includes('--ui-accent')) {
  fail('styles.css missing Lantern --ui-* tokens');
}
if (stylesText.includes('.wt-setup-wizard') || stylesText.includes('--wt-surface-0')) {
  fail('styles.css still contains legacy wt- rules');
}

// build.mjs must exist and reference src/styles
if (!existsSync(buildScript)) fail('scripts/build.mjs missing');
const buildSrc = readFileSync(buildScript, 'utf8');
if (!buildSrc.includes('src/styles/00-tokens.css')) {
  fail('build.mjs STYLE_ORDER missing src/styles/00-tokens.css');
}

// CSS modules on disk should appear in STYLE_ORDER (best-effort)
const order = [...buildSrc.matchAll(/['"](src\/styles\/[^'"]+\.css)['"]/g)].map((m) => m[1]);
const onDisk = walkCss(srcStyles).filter((p) => !p.includes('/_'));
const missing = onDisk.filter((rel) => !order.includes(rel) && !rel.endsWith('/_index.css'));
if (missing.length) {
  console.warn(`WARN: CSS files not in STYLE_ORDER (may be intentional placeholders): ${missing.join(', ')}`);
}

// No legacy UI in shipped path
const legacyPaths = [
  'tower',
  'css/v3',
  'app.js',
  'vendor/chart.umd.min.js',
  'vendor/lucide.min.js',
];
for (const rel of legacyPaths) {
  if (existsSync(join(dashboard, rel))) {
    fail(`legacy path still present (must delete before release): ${rel}`);
  }
}

// Grep-ish: no wt- class prefixes in src/
function walkJs(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkJs(full, out);
    else if (name.endsWith('.js') || name.endsWith('.css')) out.push(full);
  }
  return out;
}

const srcFiles = walkJs(join(dashboard, 'src')).filter((f) => !f.replace(/\\/g, '/').includes('/wiki/content.js'));
for (const file of srcFiles) {
  const text = readFileSync(file, 'utf8');
  if (/\bclassList\.[^(]*\(['"]wt-|class="[^"]*\bwt-[a-z]|TowerRender|WatchtowerToast/.test(text)) {
    fail(`legacy reference in ${relative(dashboard, file)}`);
  }
}

if (failed) process.exit(1);
console.log('audit-dashboard-parity OK (Lantern)');
