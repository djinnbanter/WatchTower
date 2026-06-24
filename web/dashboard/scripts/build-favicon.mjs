#!/usr/bin/env node
/** Write a small root favicon from the simple icon (preview + static hosts). */
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'assets', 'watchtower-icon-simple.png');
const dest = join(root, 'favicon.ico');

if (!existsSync(src)) {
  console.warn('build-favicon: missing', src);
  process.exit(0);
}

copyFileSync(src, dest);
console.log('build-favicon: wrote favicon.ico');
