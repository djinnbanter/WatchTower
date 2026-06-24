#!/usr/bin/env node
/** Copy shared dashboard v3 assets from web/dashboard into web/dr-viewer. */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dash = join(root, '..', 'dashboard');

const copies = [
  [join(dash, 'styles.css'), join(root, 'styles.css')],
  [join(dash, 'labels.js'), join(root, 'dashboard', 'labels.js')],
  [join(dash, 'health.js'), join(root, 'dashboard', 'health.js')],
  [join(dash, 'acks.js'), join(root, 'dashboard', 'acks.js')],
  [join(dash, 'toast.js'), join(root, 'dashboard', 'toast.js')],
  [join(dash, 'tower', 'motion.js'), join(root, 'tower', 'motion.js')],
];

const optional = [
  [join(dash, 'vendor', 'lucide.min.js'), join(root, 'vendor', 'lucide.min.js')],
];

const logoAssets = [
  'watchtower-logo.png',
  'watchtower-logo-light.png',
  'watchtower-wordmark.png',
  'watchtower-icon-simple.png',
];

mkdirSync(join(root, 'dashboard'), { recursive: true });
mkdirSync(join(root, 'tower'), { recursive: true });
mkdirSync(join(root, 'vendor'), { recursive: true });
mkdirSync(join(root, 'assets'), { recursive: true });

for (const [src, dest] of copies) {
  copyFileSync(src, dest);
  console.log(`synced ${dest.replace(root + '/', '')}`);
}

for (const [src, dest] of optional) {
  if (existsSync(src)) {
    copyFileSync(src, dest);
    console.log(`synced ${dest.replace(root + '/', '')}`);
  }
}

for (const name of logoAssets) {
  const src = join(dash, 'assets', name);
  if (existsSync(src)) {
    const dest = join(root, 'assets', name);
    copyFileSync(src, dest);
    console.log(`synced assets/${name}`);
  }
}
