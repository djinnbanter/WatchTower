#!/usr/bin/env node
/**
 * Build dashboard assets:
 * - Concatenate src/styles/** into styles.css
 * - Include vendor/uplot.css
 * - Run build-wiki.mjs if present
 * - Inject modulepreload links into index.html (when markers exist)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

export const STYLE_ORDER = [
  'src/styles/00-tokens.css',
  'src/styles/01-themes.css',
  'src/styles/02-reset.css',
  'src/styles/03-type.css',
  'src/styles/10-motion.css',
  // Phase 2 primitives
  'src/styles/20-primitives/button.css',
  'src/styles/20-primitives/field.css',
  'src/styles/20-primitives/combobox.css',
  'src/styles/20-primitives/toggle.css',
  'src/styles/20-primitives/segmented.css',
  'src/styles/20-primitives/badge.css',
  'src/styles/20-primitives/misc.css',
  // Phase 5 patterns
  'src/styles/30-patterns/page.css',
  'src/styles/30-patterns/section.css',
  'src/styles/30-patterns/metric.css',
  'src/styles/30-patterns/chart.css',
  'src/styles/30-patterns/table.css',
  'src/styles/30-patterns/list.css',
  'src/styles/30-patterns/accordion.css',
  'src/styles/30-patterns/filter.css',
  'src/styles/30-patterns/states.css',
  'src/styles/30-patterns/freshness.css',
  'src/styles/30-patterns/toast.css',
  'src/styles/30-patterns/banner.css',
  'src/styles/30-patterns/modal.css',
  'src/styles/30-patterns/heatmap.css',
  'src/styles/30-patterns/timeline.css',
  'src/styles/30-patterns/health-grade.css',
  'src/styles/30-patterns/key-value.css',
  'src/styles/30-patterns/subnav.css',
  'src/styles/30-patterns/skeleton.css',
  'src/styles/30-patterns/gauge.css',
  'src/styles/30-patterns/bars.css',
  'src/styles/30-patterns/status.css',
  'src/styles/30-patterns/instrument.css',
  'src/styles/30-patterns/_index.css',
  // Phase 3 shell / app
  'src/styles/40-features/shell.css',
  // Phase 6 feature pages
  'src/styles/40-features/queue-chrome.css',
  'src/styles/40-features/features.css',
  'src/styles/40-features/overview.css',
  'src/styles/40-features/live.css',
  'src/styles/40-features/issues.css',
  'src/styles/40-features/logs.css',
  'src/styles/40-features/roadmap.css',
  'src/styles/40-features/_index.css',
  // Phase 9 pages
  'src/styles/40-features/settings.css',
  'src/styles/40-features/docs.css',
  'src/styles/40-features/help.css',
  'src/styles/40-features/tour.css',
];

const PRELOAD_START = '<!-- modulepreload:start -->';
const PRELOAD_END = '<!-- modulepreload:end -->';
const IMPORT_RE = /\bfrom\s+['"](\.\.?\/[^'"]+)['"]/g;

function readIfExists(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

function buildStyles() {
  const parts = [];
  for (const rel of STYLE_ORDER) {
    const content = readIfExists(rel);
    if (content == null) {
      throw new Error(`Missing CSS module: ${rel}`);
    }
    parts.push(`/* === ${rel} === */\n${content.trim()}`);
  }

  const uplotCss = readIfExists('vendor/uplot.css');
  if (uplotCss) {
    parts.push(`/* === vendor/uplot.css === */\n${uplotCss.trim()}`);
  }

  const header =
    '/* Watchtower Lantern UI — built from src/styles/. Run: node scripts/build.mjs */\n\n';
  const out = path.join(ROOT, 'styles.css');
  const tmp = path.join(ROOT, `styles.css.${process.pid}.tmp`);
  const body = header + parts.join('\n\n') + '\n';
  fs.writeFileSync(tmp, body);
  try {
    fs.renameSync(tmp, out);
  } catch {
    // Windows may lock styles.css (IDE/preview); fall back to overwrite in place
    try {
      fs.copyFileSync(tmp, out);
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }
  const size = fs.statSync(out).size;
  console.log(`Built styles.css (${STYLE_ORDER.length} modules + uplot, ${size} bytes)`);
}

function runWikiBuild() {
  const wikiScript = path.join(__dirname, 'build-wiki.mjs');
  if (!fs.existsSync(wikiScript)) {
    console.log('Skipping wiki build (build-wiki.mjs not found)');
    return;
  }
  const result = spawnSync(process.execPath, [wikiScript], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error('build-wiki.mjs failed');
  }
}

function resolveImport(fromFile, spec) {
  const base = path.dirname(fromFile);
  let resolved = path.normalize(path.join(base, spec));
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    for (const candidate of ['index.js', 'index.mjs']) {
      const idx = path.join(resolved, candidate);
      if (fs.existsSync(idx)) {
        resolved = idx;
        break;
      }
    }
  } else if (!fs.existsSync(resolved)) {
    for (const ext of ['.js', '.mjs']) {
      if (fs.existsSync(resolved + ext)) {
        resolved = resolved + ext;
        break;
      }
    }
  }
  return resolved;
}

function scanImportGraph(entryRel, seen = new Set()) {
  const queue = [entryRel];
  const modules = [];

  while (queue.length) {
    const rel = queue.shift();
    if (seen.has(rel)) continue;
    seen.add(rel);

    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) continue;

    modules.push(rel);
    const src = fs.readFileSync(full, 'utf8');
    let match;
    IMPORT_RE.lastIndex = 0;
    while ((match = IMPORT_RE.exec(src))) {
      const spec = match[1];
      if (!spec.startsWith('.')) continue;
      const resolved = resolveImport(rel, spec);
      const nextRel = path.relative(ROOT, resolved).replace(/\\/g, '/');
      if (!seen.has(nextRel)) queue.push(nextRel);
    }
  }

  return modules;
}

function injectModulePreload() {
  const indexPath = path.join(ROOT, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.log('Skipping modulepreload (index.html not found)');
    return;
  }

  let html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes(PRELOAD_START) || !html.includes(PRELOAD_END)) {
    console.log('Skipping modulepreload (markers not in index.html)');
    return;
  }

  const entry = 'src/main.js';
  const modules = fs.existsSync(path.join(ROOT, entry))
    ? scanImportGraph(entry)
    : [];

  const links = modules
    .map((rel) => `  <link rel="modulepreload" href="${rel}">`)
    .join('\n');

  const block = `${PRELOAD_START}\n${links}\n  ${PRELOAD_END}`;
  const next = html.replace(
    new RegExp(`${escapeRegExp(PRELOAD_START)}[\\s\\S]*?${escapeRegExp(PRELOAD_END)}`),
    block,
  );
  if (next === html) {
    console.log(`Injected ${modules.length} modulepreload link(s) into index.html (unchanged)`);
    return;
  }
  const tmp = path.join(ROOT, `index.html.${process.pid}.tmp`);
  fs.writeFileSync(tmp, next);
  try {
    fs.renameSync(tmp, indexPath);
  } catch {
    try {
      fs.copyFileSync(tmp, indexPath);
    } catch (err) {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      // Windows lock (IDE preview): keep going if markers already present
      if (html.includes(PRELOAD_START) && modules.length > 0) {
        console.warn(`modulepreload write skipped (${err.message}); existing index.html kept`);
        return;
      }
      throw err;
    }
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
  console.log(`Injected ${modules.length} modulepreload link(s) into index.html`);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function main() {
  buildStyles();
  runWikiBuild();
  injectModulePreload();
}

main();
