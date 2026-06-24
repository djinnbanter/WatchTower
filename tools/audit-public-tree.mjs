#!/usr/bin/env node
/**
 * Scan tracked source files for patterns that must not appear in the public repo.
 * Run from repo root before first push: node tools/audit-public-tree.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

const SKIP_DIRS = new Set([
  'node_modules', 'build', '.gradle', '.git', 'fixtures', 'legacy',
  'releases', '.idea', '.vscode', '.cursor', 'docs/dev',
]);

const SKIP_FILES = new Set(['audit-public-tree.mjs', 'watchtower.conf', 'mc-status.conf']);

const PATTERNS = [
  { re: /\bDJINN\b/i, label: 'personal server name' },
  { re: /\bdjinnmc\b/i, label: 'personal hostname' },
  { re: /f208f13f-03b8-42f4-b07e-02f1dff6f964/i, label: 'real server UUID' },
  { re: /\bDJINNBANTER\b/, label: 'player name' },
  { re: /RCON_PASSWORD=(?!rcon-password-here|your-secret)/i, label: 'RCON password' },
  { re: /C:\\Users\\/i, label: 'Windows user path' },
  { re: /\/Users\/[A-Za-z0-9_-]+\//, label: 'macOS user path' },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function isTextFile(path) {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (['jar', 'png', 'gif', 'ico', 'woff', 'woff2', 'zip', 'gz'].includes(ext)) return false;
  if (SKIP_FILES.has(path.split(/[/\\]/).pop() ?? '')) return false;
  return true;
}

const hits = [];
for (const file of walk(ROOT)) {
  if (!isTextFile(file)) continue;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  for (const { re, label } of PATTERNS) {
    if (re.test(text)) {
      hits.push({ file: rel, label, match: text.match(re)?.[0] ?? '' });
    }
  }
}

if (hits.length) {
  console.error('audit-public-tree FAILED — sensitive patterns in tracked paths:');
  for (const h of hits) {
    console.error(`  ${h.file}: ${h.label} (${h.match})`);
  }
  process.exit(1);
}

console.log('audit-public-tree OK — no blocked patterns in scanned tree');
