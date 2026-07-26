/**
 * Copy static brand assets into Vite dist/assets so embedded serving can resolve
 * ./assets/watchtower-icon-simple.png etc. alongside hashed JS/CSS chunks.
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'assets');
const distAssets = join(root, 'dist', 'assets');
const favicon = join(root, 'favicon.ico');

if (!existsSync(join(root, 'dist'))) {
  console.error('copy-static-assets: dist/ missing — run vite build first');
  process.exit(1);
}

mkdirSync(distAssets, { recursive: true });

if (existsSync(src)) {
  for (const name of readdirSync(src)) {
    const from = join(src, name);
    const to = join(distAssets, name);
    cpSync(from, to, { recursive: true });
  }
}

if (existsSync(favicon)) {
  cpSync(favicon, join(root, 'dist', 'favicon.ico'));
}

console.log('copy-static-assets: ok');
