#!/usr/bin/env node
/**
 * Sync brand assets and screenshots into public/ for the marketing site.
 * Output dirs (generated — do not commit):
 *   public/screenshots/  ← docs/assets/screenshots/
 *   public/brand/        ← web/dashboard/assets/ (or dist/assets/ fallback)
 */
import { cpSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(ROOT, '..', '..');
const shotsSrc = join(REPO, 'docs', 'assets', 'screenshots');
const assetsDir = join(REPO, 'web', 'dashboard', 'assets');
const distAssetsDir = join(REPO, 'web', 'dashboard', 'dist', 'assets');
const brandSrc = existsSync(assetsDir) ? assetsDir : distAssetsDir;
const shotsDest = join(ROOT, 'public', 'screenshots');
const brandDest = join(ROOT, 'public', 'brand');

mkdirSync(shotsDest, { recursive: true });
mkdirSync(brandDest, { recursive: true });

function hasMedia(dir) {
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((n) => /\.(png|webp|jpg|jpeg|svg|ico)$/i.test(n));
}

if (!existsSync(shotsSrc)) {
  // CLI deploys from web/marketing alone omit repo docs/; keep pre-synced public/.
  if (!hasMedia(shotsDest)) {
    console.error('sync-brand-assets: missing', shotsSrc);
    process.exit(1);
  }
  console.warn('sync-brand-assets: screenshot source missing — using existing public/screenshots');
} else {
  for (const name of readdirSync(shotsSrc)) {
    if (!/\.(png|webp|jpg|jpeg|svg)$/i.test(name)) continue;
    cpSync(join(shotsSrc, name), join(shotsDest, name));
  }
}

if (!existsSync(brandSrc)) {
  if (!hasMedia(brandDest)) {
    console.error('sync-brand-assets: missing brand source', brandSrc);
    process.exit(1);
  }
  console.warn('sync-brand-assets: brand source missing — using existing public/brand');
} else {
  const brandFiles = [
    'watchtower-logo.png',
    'watchtower-logo-light.png',
    'watchtower-wordmark.png',
    'watchtower-icon.png',
    'watchtower-favicon.png',
    'watchtower-icon-simple.png',
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
}

// Root favicon matches the static demo (copy of watchtower-icon-simple).
const faviconSrc = join(REPO, 'web', 'dashboard', 'favicon.ico');
const faviconDest = join(ROOT, 'public', 'favicon.ico');
if (existsSync(faviconSrc)) {
  cpSync(faviconSrc, faviconDest);
} else if (existsSync(join(brandDest, 'watchtower-icon-simple.png'))) {
  cpSync(join(brandDest, 'watchtower-icon-simple.png'), faviconDest);
} else if (existsSync(join(brandDest, 'favicon.png'))) {
  cpSync(join(brandDest, 'favicon.png'), faviconDest);
}

console.log('sync-brand-assets: ok → public/screenshots + public/brand');
