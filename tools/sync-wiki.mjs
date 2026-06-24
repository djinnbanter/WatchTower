#!/usr/bin/env node
/**
 * Push docs/wiki/*.md to the GitHub Wiki repository.
 *
 * Usage:
 *   node tools/sync-wiki.mjs              # copy only (prints instructions)
 *   node tools/sync-wiki.mjs --push       # clone, copy, commit, push
 *
 * Requires: git, network, push access to WatchTower.wiki
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'docs', 'wiki');
const wikiUrl = process.env.WATCHTOWER_WIKI_URL || 'https://github.com/djinnbanter/WatchTower.wiki.git';
const push = process.argv.includes('--push');
const tmpDir = join(root, '.wiki-sync');

function copyWikiFiles(target) {
  for (const name of readdirSync(srcDir)) {
    if (name === 'README.md') continue;
    cpSync(join(srcDir, name), join(target, name), { force: true });
  }
}

if (!push) {
  console.log('Wiki source: docs/wiki/');
  console.log('Pages:', readdirSync(srcDir).filter((f) => f.endsWith('.md') && f !== 'README.md').length);
  console.log('');
  console.log('To publish to GitHub Wiki:');
  console.log('  node tools/sync-wiki.mjs --push');
  console.log('');
  console.log('Or manually:');
  console.log(`  git clone ${wikiUrl}`);
  console.log('  cp docs/wiki/*.md WatchTower.wiki/');
  console.log('  cd WatchTower.wiki && git add -A && git commit -m "Sync wiki from docs/wiki" && git push');
  process.exit(0);
}

if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });

console.log('Cloning wiki...');
execSync(`git clone ${wikiUrl} .`, { cwd: tmpDir, stdio: 'inherit' });

console.log('Copying pages...');
copyWikiFiles(tmpDir);

console.log('Committing...');
execSync('git add -A', { cwd: tmpDir, stdio: 'inherit' });
try {
  execSync('git diff --staged --quiet', { cwd: tmpDir });
  console.log('No wiki changes to push.');
} catch {
  execSync('git commit -m "Sync wiki from docs/wiki"', { cwd: tmpDir, stdio: 'inherit' });
  console.log('Pushing...');
  execSync('git push', { cwd: tmpDir, stdio: 'inherit' });
  console.log('Wiki updated: https://github.com/djinnbanter/WatchTower/wiki');
}

rmSync(tmpDir, { recursive: true, force: true });
