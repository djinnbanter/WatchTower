#!/usr/bin/env node
/**
 * Scan public docs for stale version strings and wrong UI paths.
 * Run from repo root: node tools/audit-docs.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

const SCAN_DIRS = ['docs/wiki', 'docs', '.'];
const SCAN_FILES = ['README.md', 'CONTRIBUTING.md', 'docs/README.md', 'mods/README.md'];

const SKIP_DIRS = new Set([
  'node_modules', 'build', '.gradle', '.git', 'fixtures', 'legacy',
  'releases', 'docs/dev', 'docs/end-user', 'web', 'mods', 'watchtower-core',
  'watchtower-cli', 'tools', 'samples', 'fixtures',
]);

const PATTERNS = [
  { re: /Help → Security/g, label: 'wrong 2FA path (use Settings → Security)' },
  { re: /Help → Settings/g, label: 'wrong settings path (use Settings gear)' },
  { re: /\b1\.0\.11\b/g, label: 'stale version 1.0.11' },
  { re: /\b1\.0\.1b\b/g, label: 'stale version 1.0.1b' },
  { re: /\b1\.0\.1a\b/g, label: 'stale version 1.0.1a' },
  { re: /welcome button/gi, label: 'obsolete welcome button (use setup wizard)' },
  { re: /welcome screen/gi, label: 'obsolete welcome screen (use setup wizard)' },
  { re: /local build only/gi, label: 'obsolete local-build-only copy' },
  { re: /from \*\*1\.0\.1\*\*/g, label: 'loader range wrongly attributed to 1.0.1' },
  { re: /From \*\*1\.0\.1\*\*/g, label: 'release artifact wrongly attributed to 1.0.1' },
];

function walkMd(dir, out = []) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return out;
  const relDir = relative(ROOT, dir).replace(/\\/g, '/');
  if (relDir === 'docs/dev' || relDir.startsWith('docs/dev/')) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkMd(full, out);
    else if (name.endsWith('.md')) out.push(full);
  }
  return out;
}

const files = new Set();
for (const d of SCAN_DIRS) {
  const abs = join(ROOT, d);
  if (d === '.') {
    for (const name of SCAN_FILES) {
      const f = join(abs, name);
      if (statSync(f, { throwIfNoEntry: false })?.isFile()) files.add(f);
    }
  } else {
    for (const f of walkMd(abs)) files.add(f);
  }
}

const hits = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  for (const { re, label } of PATTERNS) {
    re.lastIndex = 0;
    const m = text.match(re);
    if (m) hits.push({ file: rel, label, count: m.length, sample: m[0] });
  }
}

if (hits.length) {
  console.error('audit-docs FAILED — stale patterns in public docs:');
  for (const h of hits) {
    console.error(`  ${h.file}: ${h.label} (${h.count}×, e.g. "${h.sample}")`);
  }
  process.exit(1);
}

console.log(`audit-docs OK — ${files.size} public doc files scanned`);
