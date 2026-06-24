#!/usr/bin/env node
/**
 * Import outstanding WT issues to GitHub from tools/issues-outstanding.json.
 *
 * Requires: gh CLI authenticated (gh auth status)
 *
 *   node tools/import-github-issues.mjs --dry-run
 *   node tools/import-github-issues.mjs --setup --dry-run
 *   node tools/import-github-issues.mjs --setup --apply
 *   node tools/import-github-issues.mjs --apply --skip-existing
 *   node tools/import-github-issues.mjs --setup --apply --update --skip-existing
 *   node tools/import-github-issues.mjs --setup --apply --import-shipped
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'tools', 'issues-outstanding.json');
const shippedPath = join(root, 'tools', 'issues-shipped.json');
const mapPath = join(root, 'tools', 'issues-github-map.json');

const GH_CANDIDATES = [
  process.env.GH_BIN,
  'gh',
  'C:\\Program Files\\GitHub CLI\\gh.exe',
  'C:\\Program Files (x86)\\GitHub CLI\\gh.exe',
].filter(Boolean);

function resolveGhBin() {
  for (const candidate of GH_CANDIDATES) {
    if (candidate.includes('\\') || candidate.includes('/')) {
      if (existsSync(candidate)) return candidate;
      continue;
    }
    try {
      execFileSync(candidate, ['--version'], { stdio: 'pipe', env: process.env });
      return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

const ghBin = resolveGhBin();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const apply = args.includes('--apply');
const setupOnly = args.includes('--setup') && !apply && !dryRun;
const skipExisting = args.includes('--skip-existing');
const updateExisting = args.includes('--update');
const importShipped = args.includes('--import-shipped');
const doSetup = setupOnly || apply || dryRun;
const doImport = apply || dryRun;
const doUpdate = updateExisting && (apply || dryRun);
const doShipped = importShipped && (apply || dryRun);

if (!dryRun && !apply && !setupOnly) {
  console.error(
    'Usage: node tools/import-github-issues.mjs [--dry-run] [--setup] [--apply] [--skip-existing] [--update] [--import-shipped]',
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const repo = process.env.GITHUB_REPO || manifest.repo;

function gh(argsStr, opts = {}) {
  if (!ghBin) {
    console.error('GitHub CLI (gh) not found. Install: winget install GitHub.cli');
    console.error('Or set GH_BIN to the full path, e.g. C:\\Program Files\\GitHub CLI\\gh.exe');
    process.exit(1);
  }
  const cmd = `"${ghBin}" ${argsStr}`;
  if (dryRun && !opts.allowInDryRun) {
    console.log(`[dry-run] ${cmd}`);
    return opts.dryRunReturn ?? '';
  }
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: opts.stdio ?? ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, GH_PAGER: '' },
      shell: true,
    }).trim();
  } catch (e) {
    if (opts.ignoreError) return null;
    throw e;
  }
}

function ensureGh() {
  if (dryRun && !apply) return;
  if (!ghBin) {
    console.error('GitHub CLI (gh) not found. Install: winget install GitHub.cli');
    process.exit(1);
  }
  try {
    execFileSync(ghBin, ['auth', 'status'], { encoding: 'utf8', stdio: 'pipe' });
  } catch {
    console.error(`gh CLI not authenticated. Run:\n  "${ghBin}" auth login`);
    console.error('Or set GH_TOKEN / GITHUB_TOKEN with repo scope for non-interactive use.');
    process.exit(1);
  }
}

function existingIssueNumbers(label) {
  if (dryRun && !apply) return [];
  const out = gh(
    `issue list --repo ${repo} --label "${label}" --state all --limit 10 --json number`,
    { ignoreError: true },
  );
  if (!out) return [];
  try {
    return JSON.parse(out).map((i) => i.number);
  } catch {
    return [];
  }
}

function ensureLabel(name, color, description) {
  const exists = gh(`label list --repo ${repo} --json name --limit 200`, { ignoreError: true });
  if (exists && JSON.parse(exists).some((l) => l.name === name)) {
    console.log(`  label exists: ${name}`);
    return;
  }
  const created = gh(
    `label create "${name}" --repo ${repo} --color ${color}${description ? ` --description "${description.replace(/"/g, '\\"')}"` : ''}`,
    { ignoreError: true },
  );
  if (created === null) {
    console.log(`  label exists: ${name}`);
    return;
  }
  if (!(dryRun && !apply)) console.log(`  created label: ${name}`);
}

function ensureMilestone(title, description) {
  const list = gh(`api repos/${repo}/milestones?state=all&per_page=100 --jq '.[].title'`, { ignoreError: true });
  if (list && list.split('\n').includes(title)) {
    console.log(`  milestone exists: ${title}`);
    return;
  }
  if (dryRun && !apply) {
    console.log(`[dry-run] gh api repos/${repo}/milestones -f title='${title}' -f description='${description}' -f state=open`);
    return;
  }
  const created = gh(
    `api repos/${repo}/milestones -f title="${title.replace(/"/g, '\\"')}" -f description="${(description || '').replace(/"/g, '\\"')}" -f state=open`,
    { ignoreError: true },
  );
  if (created === null) {
    console.log(`  milestone exists: ${title}`);
    return;
  }
  console.log(`  created milestone: ${title}`);
}

function setupLabelsAndMilestones() {
  console.log(`\nSetup labels + milestones for ${repo}\n`);
  for (const lb of manifest.labels || []) {
    ensureLabel(lb.name, lb.color, lb.description || '');
  }
  for (const issue of manifest.issues) {
    ensureLabel(issue.id, 'ededed', `Watchtower tracker ${issue.id}`);
  }
  for (const ms of manifest.milestones || []) {
    ensureMilestone(ms.title, ms.description || '');
  }
}

function writeBodyTmp(issueId, body) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'wt-issue-'));
  const bodyFile = join(tmpDir, `${issueId}.md`);
  writeFileSync(bodyFile, body, 'utf8');
  return { tmpDir, bodyFile };
}

function createIssue(issue) {
  const title = `${issue.id}: ${issue.title}`;
  if (skipExisting) {
    const existing = existingIssueNumbers(issue.id);
    if (existing.length) {
      console.log(`  skip ${issue.id} — already #${existing[0]}`);
      return { id: issue.id, number: existing[0], skipped: true };
    }
  }

  const labelArgs = issue.labels.map((l) => `--label "${l}"`).join(' ');
  const milestoneArg = issue.milestone ? `--milestone "${issue.milestone.replace(/"/g, '\\"')}"` : '';

  if (dryRun && !apply) {
    console.log(`[dry-run] gh issue create --repo ${repo} --title "${title}" ${labelArgs} ${milestoneArg} --body-file <tmp>`);
    return { id: issue.id, number: null, dryRun: true };
  }

  const { tmpDir, bodyFile } = writeBodyTmp(issue.id, issue.body);
  try {
    const out = gh(
      `issue create --repo ${repo} --title "${title.replace(/"/g, '\\"')}" ${labelArgs} ${milestoneArg} --body-file "${bodyFile}"`,
    );
    const match = out.match(/issues\/(\d+)/) || out.match(/#(\d+)/);
    const number = match ? parseInt(match[1], 10) : null;
    if (!number) {
      console.warn(`  created ${issue.id} but could not parse number from: ${out}`);
    } else {
      console.log(`  created ${issue.id} → #${number} (${out})`);
    }
    return { id: issue.id, number, url: out };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function updateIssue(issue, number) {
  const title = `${issue.id}: ${issue.title}`;
  const milestoneArg = issue.milestone ? `--milestone "${issue.milestone.replace(/"/g, '\\"')}"` : '';

  if (dryRun && !apply) {
    console.log(`[dry-run] gh issue edit ${number} --repo ${repo} --title "${title}" ${milestoneArg} --body-file <tmp>`);
    for (const label of issue.labels) {
      console.log(`[dry-run] gh issue edit ${number} --repo ${repo} --add-label "${label}"`);
    }
    return { id: issue.id, number, updated: true };
  }

  const { tmpDir, bodyFile } = writeBodyTmp(issue.id, issue.body);
  try {
    gh(
      `issue edit ${number} --repo ${repo} --title "${title.replace(/"/g, '\\"')}" ${milestoneArg} --body-file "${bodyFile}"`,
    );
    for (const label of issue.labels) {
      gh(`issue edit ${number} --repo ${repo} --add-label "${label.replace(/"/g, '\\"')}"`, { ignoreError: true });
    }
    console.log(`  updated ${issue.id} → #${number}`);
    return { id: issue.id, number, updated: true };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function updateExistingIssues() {
  let map = {};
  try {
    map = JSON.parse(readFileSync(mapPath, 'utf8'));
  } catch {
    console.warn(`No map at ${mapPath}; nothing to update.`);
    return {};
  }

  console.log(`\nUpdate ${manifest.issues.length} mapped issues on ${repo}\n`);
  const updates = {};
  for (const issue of manifest.issues) {
    const entry = map[issue.id];
    if (!entry?.number) {
      console.log(`  skip update ${issue.id} — not in map`);
      continue;
    }
    const result = updateIssue(issue, entry.number);
    if (result?.number) {
      updates[issue.id] = {
        number: result.number,
        url: entry.url || `https://github.com/${repo}/issues/${result.number}`,
        title: issue.title,
        updated: true,
      };
    }
  }
  return updates;
}

function importIssues() {
  console.log(`\nImport ${manifest.issues.length} issues to ${repo}\n`);
  const map = {};
  for (const issue of manifest.issues) {
    const result = createIssue(issue);
    if (result?.number) {
      map[issue.id] = {
        number: result.number,
        url: result.url || `https://github.com/${repo}/issues/${result.number}`,
        title: issue.title,
      };
    } else if (result?.skipped && result.number) {
      map[issue.id] = {
        number: result.number,
        url: `https://github.com/${repo}/issues/${result.number}`,
        title: issue.title,
        skipped: true,
      };
    }
  }

  if (apply && Object.keys(map).length) {
    const existing = {};
    try {
      Object.assign(existing, JSON.parse(readFileSync(mapPath, 'utf8')));
    } catch {
      /* no map yet */
    }
    writeFileSync(mapPath, JSON.stringify({ ...existing, ...map, repo, updatedAt: new Date().toISOString() }, null, 2));
    console.log(`\nWrote ${mapPath}`);
    console.log('Run: node tools/sync-issue-docs.mjs');
  }
  return map;
}

function setupShippedLabelsAndMilestone(shipped) {
  ensureMilestone(shipped.milestone, 'Shipped in Watchtower 1.0.0');
  for (const lb of shipped.labels || []) {
    ensureLabel(lb, '0e8a16', 'Released — see milestone');
  }
  for (const issue of shipped.issues) {
    ensureLabel(issue.id, 'ededed', `Watchtower tracker ${issue.id}`);
    for (const lb of issue.labels || []) {
      if (lb.startsWith('WT-')) continue;
      ensureLabel(lb, lb === 'shipped' ? '0e8a16' : '5319e7', '');
    }
  }
}

function importShippedIssues() {
  if (!existsSync(shippedPath)) {
    console.error(`Missing ${shippedPath}`);
    process.exit(1);
  }
  const shipped = JSON.parse(readFileSync(shippedPath, 'utf8'));
  console.log(`\nImport ${shipped.issues.length} shipped issues to ${repo}\n`);

  setupShippedLabelsAndMilestone(shipped);

  const map = {};
  for (const issue of shipped.issues) {
    const existing = existingIssueNumbers(issue.id);
    let number = existing[0] ?? null;

    if (!number) {
      const title = `${issue.id}: ${issue.title}`;
      const labelArgs = issue.labels.map((l) => `--label "${l}"`).join(' ');
      const milestoneArg = `--milestone "${shipped.milestone.replace(/"/g, '\\"')}"`;

      if (dryRun && !apply) {
        console.log(`[dry-run] create+close ${issue.id}: gh issue create ... then gh issue close`);
        continue;
      }

      const { tmpDir, bodyFile } = writeBodyTmp(issue.id, issue.body);
      try {
        const out = gh(
          `issue create --repo ${repo} --title "${title.replace(/"/g, '\\"')}" ${labelArgs} ${milestoneArg} --body-file "${bodyFile}"`,
        );
        const match = out.match(/issues\/(\d+)/) || out.match(/#(\d+)/);
        number = match ? parseInt(match[1], 10) : null;
        if (number) console.log(`  created ${issue.id} → #${number}`);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    } else {
      console.log(`  found ${issue.id} → #${number}`);
    }

    if (!number) continue;

    const state = gh(`issue view ${number} --repo ${repo} --json state --jq .state`, { ignoreError: true });
    if (state === 'OPEN') {
      const comment = (shipped.closeComment || 'Shipped in 1.0.0.').replace(/"/g, '\\"');
      gh(`issue close ${number} --repo ${repo} --comment "${comment}"`);
      console.log(`  closed ${issue.id} → #${number}`);
    } else {
      console.log(`  already closed ${issue.id} → #${number}`);
    }

    map[issue.id] = {
      number,
      url: `https://github.com/${repo}/issues/${number}`,
      title: issue.title,
      shipped: true,
      state: 'closed',
    };
  }

  if (apply && Object.keys(map).length) {
    let existing = {};
    try {
      existing = JSON.parse(readFileSync(mapPath, 'utf8'));
    } catch {
      /* no map yet */
    }
    writeFileSync(mapPath, JSON.stringify({ ...existing, ...map, repo, updatedAt: new Date().toISOString() }, null, 2));
    console.log(`\nWrote ${mapPath}`);
  }
  return map;
}

function mergeMap(updates) {
  if (!apply || !Object.keys(updates).length) return;
  let existing = {};
  try {
    existing = JSON.parse(readFileSync(mapPath, 'utf8'));
  } catch {
    /* no map yet */
  }
  writeFileSync(mapPath, JSON.stringify({ ...existing, ...updates, repo, updatedAt: new Date().toISOString() }, null, 2));
  console.log(`\nWrote ${mapPath}`);
}

ensureGh();

if (doSetup) setupLabelsAndMilestones();
if (doUpdate) mergeMap(updateExistingIssues());
if (doImport && !setupOnly) importIssues();
if (doShipped) importShippedIssues();
else if (setupOnly && !apply && !dryRun) {
  console.log('\nSetup complete. Run with --apply to create issues.');
}

console.log('\nDone.');
