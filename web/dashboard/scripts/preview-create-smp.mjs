/**
 * Preview dashboard using a real mods/ + config/ folder (Create SMP defaults).
 *
 *   npm run preview:create-smp
 *   PREVIEW_MODS_DIR="D:/other/mods" PREVIEW_CONFIG_DIR="D:/other/config" npm run preview:create-smp
 *
 * Set PREVIEW_SKIP_REGEN=1 to skip mock regeneration (use when data/ is locked).
 * Config edits in preview stay in-session — they do not write back to PREVIEW_CONFIG_DIR.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

process.env.PREVIEW_MODS_DIR =
  process.env.PREVIEW_MODS_DIR || 'D:/minecraft/profiles/Create SMP 2026/mods';
process.env.PREVIEW_CONFIG_DIR =
  process.env.PREVIEW_CONFIG_DIR || 'D:/minecraft/profiles/Create SMP 2026/config';
process.env.PREVIEW_MC_VERSION = process.env.PREVIEW_MC_VERSION || '1.21.1';
process.env.PREVIEW_LOADER = process.env.PREVIEW_LOADER || 'neoforge';

console.log(`PREVIEW_MODS_DIR=${process.env.PREVIEW_MODS_DIR}`);
console.log(`PREVIEW_CONFIG_DIR=${process.env.PREVIEW_CONFIG_DIR}`);
console.log(`PREVIEW_MC_VERSION=${process.env.PREVIEW_MC_VERSION} loader=${process.env.PREVIEW_LOADER}`);

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    shell: false,
  });
  if (r.status) process.exit(r.status ?? 1);
}

run(process.execPath, [join(root, 'scripts', 'build-wiki.mjs')]);
if (process.env.PREVIEW_SKIP_REGEN === '1') {
  console.log('PREVIEW_SKIP_REGEN=1 — skipping fixture regenerate');
} else {
  run(process.execPath, [join(root, 'scripts', 'apply-preview-profile.mjs'), 'normal']);
}
run(process.execPath, [
  join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
  '--port',
  '8081',
  '--strictPort',
]);
