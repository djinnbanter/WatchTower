#!/usr/bin/env node
/**
 * Minecraft motif presence audit for marketing site.
 * Exit 1 on failure. Run:
 *   node web/marketing/scripts/audit-minecraft-motif.mjs
 *   node scripts/audit-minecraft-motif.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const fail = [];
const css = readFileSync(join(ROOT, 'styles', 'globals.css'), 'utf8');
const hero = readFileSync(join(ROOT, 'components', 'sections', 'hero.tsx'), 'utf8');
const welcome = readFileSync(join(ROOT, 'components', 'entries', 'welcome.tsx'), 'utf8');
const product = readFileSync(join(ROOT, 'content', 'product.ts'), 'utf8');
const plate = readFileSync(join(ROOT, 'components', 'instrument-plate.tsx'), 'utf8');

if (!css.includes('--wt-grass:')) fail.push('globals.css missing --wt-grass');
if (!css.includes('.wt-block-grid')) fail.push('globals.css missing .wt-block-grid');
if (!css.includes('--wt-zenith:')) fail.push('globals.css missing --wt-zenith');
if (!hero.includes('wt-hero-night')) fail.push('hero.tsx missing wt-hero-night');
if (!hero.includes('wt-grass-strip')) fail.push('hero.tsx missing wt-grass-strip');
if (!welcome.includes('wt-hero-night')) fail.push('welcome.tsx missing wt-hero-night');
if (!welcome.includes('wt-grass-strip')) fail.push('welcome.tsx missing wt-grass-strip');
if (!product.includes('NeoForge')) fail.push('HERO_CONTEXT must name NeoForge');
if (!plate.includes('wt-plate-stone')) fail.push('InstrumentPlate missing wt-plate-stone');

if (fail.length) {
  console.error(fail.join('\n'));
  process.exit(1);
}
console.log('audit-minecraft-motif: ok');
