#!/usr/bin/env node
/**
 * One-time vendoring: download Preact, signals, HTM, uPlot, and IBM Plex fonts.
 * Rewrites bare import specifiers in signals bundles to relative paths.
 *
 * Run from web/dashboard: node scripts/vendor-libs.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const VENDOR = path.join(ROOT, 'vendor');
const FONTS = path.join(ROOT, 'assets', 'fonts');

const PREACT_VERSION = '10.26.4';
const SIGNALS_VERSION = '2.9.3';
const SIGNALS_CORE_VERSION = '1.14.4';
const HTM_VERSION = '3.1.1';
const UPLOT_VERSION = '1.6.31';
const FONTSOURCE_VERSION = '5.2.5';

const LIBS = [
  {
    url: `https://cdn.jsdelivr.net/npm/preact@${PREACT_VERSION}/dist/preact.module.js`,
    dest: 'preact.module.js',
  },
  {
    url: `https://cdn.jsdelivr.net/npm/preact@${PREACT_VERSION}/hooks/dist/hooks.module.js`,
    dest: 'preact-hooks.module.js',
  },
  {
    url: `https://cdn.jsdelivr.net/npm/@preact/signals-core@${SIGNALS_CORE_VERSION}/dist/signals-core.module.js`,
    dest: 'signals-core.module.js',
  },
  {
    url: `https://cdn.jsdelivr.net/npm/@preact/signals@${SIGNALS_VERSION}/dist/signals.module.js`,
    dest: 'signals.module.js',
  },
  {
    url: `https://cdn.jsdelivr.net/npm/htm@${HTM_VERSION}/dist/htm.module.js`,
    dest: 'htm.module.js',
  },
  {
    url: `https://cdn.jsdelivr.net/npm/uplot@${UPLOT_VERSION}/dist/uPlot.esm.js`,
    dest: 'uplot.esm.js',
  },
  {
    url: `https://cdn.jsdelivr.net/npm/uplot@${UPLOT_VERSION}/dist/uPlot.min.css`,
    dest: 'uplot.css',
  },
];

const FONT_FILES = [
  {
    url: `https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-sans@${FONTSOURCE_VERSION}/latin-400-normal.woff2`,
    dest: 'IBMPlexSans-Regular.woff2',
  },
  {
    url: `https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-sans@${FONTSOURCE_VERSION}/latin-500-normal.woff2`,
    dest: 'IBMPlexSans-Medium.woff2',
  },
  {
    url: `https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-sans@${FONTSOURCE_VERSION}/latin-600-normal.woff2`,
    dest: 'IBMPlexSans-SemiBold.woff2',
  },
  {
    url: `https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-sans@${FONTSOURCE_VERSION}/latin-700-normal.woff2`,
    dest: 'IBMPlexSans-Bold.woff2',
  },
  {
    url: `https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-mono@${FONTSOURCE_VERSION}/latin-400-normal.woff2`,
    dest: 'IBMPlexMono-Regular.woff2',
  },
  {
    url: `https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-mono@${FONTSOURCE_VERSION}/latin-600-normal.woff2`,
    dest: 'IBMPlexMono-SemiBold.woff2',
  },
];

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

function applyRewrites(content, rewrite) {
  let out = content;
  for (const { from, to } of rewrite ?? []) {
    out = out.replace(from, to);
  }
  return out;
}

/** Bare specifier rewrites for minified ESM (with or without spaces around quotes). */
const BARE_IMPORTS = [
  { spec: 'preact', rel: './preact.module.js' },
  { spec: 'preact/hooks', rel: './preact-hooks.module.js' },
  { spec: '@preact/signals-core', rel: './signals-core.module.js' },
];

function rewriteBareImports(content) {
  let out = content;
  for (const { spec, rel } of BARE_IMPORTS) {
    const escaped = spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`from\\s*["']${escaped}["']`, 'g');
    out = out.replace(re, `from "${rel}"`);
  }
  return out;
}

async function vendorLib({ url, dest, rewrite }) {
  const target = path.join(VENDOR, dest);
  console.log(`  ${dest}`);
  let content = await download(url);
  content = applyRewrites(content, rewrite);
  if (dest.endsWith('.module.js') || dest.endsWith('.mjs')) {
    content = rewriteBareImports(content);
  }
  fs.writeFileSync(target, content, 'utf8');
  return target;
}

async function vendorFont({ url, dest }) {
  const target = path.join(FONTS, dest);
  console.log(`  ${dest}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(target, buf);
  return target;
}

async function main() {
  fs.mkdirSync(VENDOR, { recursive: true });
  fs.mkdirSync(FONTS, { recursive: true });

  console.log('Downloading vendor libraries…');
  for (const lib of LIBS) {
    await vendorLib(lib);
  }

  console.log('Downloading IBM Plex fonts…');
  for (const font of FONT_FILES) {
    await vendorFont(font);
  }

  console.log('\nVendoring complete.');
  console.log(`  vendor/: ${fs.readdirSync(VENDOR).join(', ')}`);
  console.log(
    `  assets/fonts/: ${fs
      .readdirSync(FONTS)
      .filter((f) => f.endsWith('.woff2'))
      .join(', ')}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
