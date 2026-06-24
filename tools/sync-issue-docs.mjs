#!/usr/bin/env node
/**
 * Sync ISSUE-TRACKER.md and ../docs/dev/roadmap/README.md with GitHub issue URLs
 * from tools/issues-github-map.json (written by import-github-issues.mjs --apply).
 *
 *   node tools/sync-issue-docs.mjs
 *   node tools/sync-issue-docs.mjs --dry-run
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mapPath = join(root, 'tools', 'issues-github-map.json');
const manifestPath = join(root, 'tools', 'issues-outstanding.json');
const trackerPath = join(root, 'docs', 'dev', 'ISSUE-TRACKER.md');
const roadmapPath = join(root, 'docs', 'dev', 'roadmap', 'README.md');
const dryRun = process.argv.includes('--dry-run');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
let map = {};
try {
  map = JSON.parse(readFileSync(mapPath, 'utf8'));
} catch {
  console.warn(`No ${mapPath} — using label-search URLs until import --apply runs.`);
}

const repo = map.repo || manifest.repo || 'djinnbanter/WatchTower';
const outstandingIds = manifest.issues.map((i) => i.id);

function issueUrl(id) {
  if (map[id]?.number) {
    return `https://github.com/${repo}/issues/${map[id].number}`;
  }
  return `https://github.com/${repo}/issues?q=label%3A${id}+is%3Aopen`;
}

function issueRef(id) {
  return map[id]?.number ? `#${map[id].number}` : id;
}

function patchFile(path, mutator) {
  if (!existsSync(path)) {
    console.log(`  skip (not present): ${path}`);
    return;
  }
  const before = readFileSync(path, 'utf8');
  const after = mutator(before);
  if (before === after) {
    console.log(`  unchanged: ${path}`);
    return;
  }
  if (dryRun) {
    console.log(`  would update: ${path}`);
    return;
  }
  writeFileSync(path, after, 'utf8');
  console.log(`  updated: ${path}`);
}

function syncRoadmap(content) {
  let out = content;
  for (const id of outstandingIds) {
    const gh = issueUrl(id);
    out = out.replace(new RegExp(`\\[${id}\\]\\([^)]+\\)`, 'g'), `[${id}](${gh})`);
  }

  const closeLine = (ids, joiner = ', ') => {
    const nums = ids.map((id) => map[id]?.number).filter(Boolean);
    if (nums.length !== ids.length) return null;
    return nums.map((n) => `#${n}`).join(joiner);
  };

  const wt003 = closeLine(['WT-003', 'WT-004', 'WT-006']);
  if (wt003) {
    out = out.replace(/- \[ \] Close .+ on ship\n(?=---\n\n## 1\.0\.2)/, `- [ ] Close ${wt003} on ship\n`);
  }
  const wt007 = closeLine(['WT-007', 'WT-008', 'WT-009', 'WT-010', 'WT-011'], '–');
  if (wt007) {
    out = out.replace(/- \[ \] Close .+ on ship\n(?=---\n\n## 1\.0\.13)/, `- [ ] Close ${wt007} on ship\n`);
  }
  const wt012 = closeLine(['WT-012', 'WT-013']);
  if (wt012) {
    out = out.replace(/- \[ \] Close .+ on ship\n(?=---\n\n## 1\.1\.0)/, `- [ ] Close ${wt012} on ship\n`);
  }

  return out;
}

function syncTracker(content) {
  let out = content;

  const banner =
    '> **Active backlog → [GitHub Issues](https://github.com/djinnbanter/WatchTower/issues?q=is%3Aopen+label%3Aplanned)** — extended specs below.\n\n';

  if (!out.includes('Active backlog → [GitHub Issues]')) {
    out = out.replace('# Watchtower issue tracker\n\n', `# Watchtower issue tracker\n\n${banner}`);
  }

  if (!out.includes('| GitHub |')) {
    out = out.replace(
      '| ID | Title | Source | Status | Roadmap |\n|----|-------|--------|--------|---------|',
      '| ID | Title | Source | Status | Roadmap | GitHub |\n|----|-------|--------|--------|---------|--------|',
    );
  }

  for (const issue of manifest.issues) {
    const { id } = issue;
    const gh = issueRef(id);
    const url = issueUrl(id);
    const ghCell = `[${gh}](${url})`;

    const rowStart = new RegExp(`^\\| \\[${id}\\]\\([^)]+\\)[^\\n]*`, 'm');
    const rowMatch = out.match(rowStart);
    if (!rowMatch) continue;

    const row = rowMatch[0];
    const withoutGh = row.replace(/(?:\s\|\s\[(?:WT-\d+|#\d+)\]\([^)]+\))+\s*\|?\s*$/, '');
    const newRow = `${withoutGh} | ${ghCell} |`;
    out = out.replace(row, newRow);

    if (id === 'WT-012' || id === 'WT-013') {
      out = out.replace(
        new RegExp(`(\\| \\[${id}\\][^|]*\\| [^|]+ \\| [^|]+ \\| planned\\s+\\| )\\[1\\.0\\.1\\]\\([^)]+\\)`, 'g'),
        `$1[1.0.14](roadmap/versions/1.0.14-crash-inbox.md#1014--crash-inbox-polish)`,
      );
    }

    const headerRe = new RegExp(`### ${id}: ([^\n—]+)(?: — \\[[^\\]]+\\]\\([^)]+\\))?\\n`);
    if (!headerRe.test(out)) {
      out = out.replace(
        new RegExp(`### ${id}: ([^\n]+)\n`),
        `### ${id}: $1 — [GitHub ${gh}](${url})\n`,
      );
    } else {
      out = out.replace(
        headerRe,
        `### ${id}: $1 — [GitHub ${gh}](${url})\n`,
      );
    }

    if (id === 'WT-012' || id === 'WT-013') {
      out = out.replace(
        /(\| \*\*Roadmap\*\* \| )\[1\.0\.1\]\(roadmap\/versions\/1\.0\.14-crash-inbox\.md#101--crash-inbox-polish\)/g,
        '$1[1.0.14 — Crash inbox polish](roadmap/versions/1.0.14-crash-inbox.md#1014--crash-inbox-polish)',
      );
    }
  }

  return out;
}

console.log(`Sync issue docs (${repo})${dryRun ? ' [dry-run]' : ''}\n`);
patchFile(roadmapPath, syncRoadmap);
patchFile(trackerPath, syncTracker);
console.log('\nDone.');
