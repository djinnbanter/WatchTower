#!/usr/bin/env node
/**
 * Smoke test for Watchtower DR analyzer (Node, no browser).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAnalysis } from '../web/dr-viewer/analyze/run.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', 'web', 'dr-viewer');

function loadExample(id) {
  const base = join(root, 'examples', id);
  const bundle = { logs: [], crashes: [], mods: [], priorFacts: null };

  const logPath = join(base, 'logs', 'latest.log');
  if (existsSync(logPath)) {
    bundle.logs.push({ name: 'logs/latest.log', content: readFileSync(logPath, 'utf8') });
  }

  const crDir = join(base, 'crash-reports');
  if (existsSync(crDir)) {
    for (const name of readdirSync(crDir)) {
      if (!name.endsWith('.txt')) continue;
      bundle.crashes.push({
        name,
        content: readFileSync(join(crDir, name), 'utf8'),
        mtime: Math.floor(Date.now() / 1000),
      });
    }
  }
  return bundle;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function testExample(id, expectedMod) {
  const bundle = loadExample(id);
  const { facts, brief } = await runAnalysis(bundle, { loader: 'neoforge' });
  assert(facts.issues?.length > 0, `${id}: expected issues`);
  assert(facts.optional?.crash_summaries?.length > 0, `${id}: expected crash_summaries`);
  const summary = facts.optional.crash_summaries[0];
  assert(summary.suspect_mod_id === expectedMod || summary.mod_file?.includes(expectedMod),
    `${id}: expected suspect ${expectedMod}, got ${summary.suspect_mod_id} / ${summary.mod_file}`);
  assert(summary.plain_english, `${id}: expected plain_english narrative`);
  assert(brief.includes('Watchtower DR'), `${id}: expected brief header`);
  const hasModIssue = facts.issues.some((i) =>
    i.id === 'MOD_LOAD_FAILED' || i.id === 'CRASH_REPORT' || i.id === 'SERVER_DOWN');
  assert(hasModIssue, `${id}: expected MOD_LOAD_FAILED, CRASH_REPORT, or SERVER_DOWN`);
  console.log(`OK ${id} — suspect=${summary.suspect_mod_id || summary.mod_file}`);
}

await testExample('type2-mod-load', 'pride');
await testExample('type2-missing-dep', 'create');
console.log('All DR analyze smoke tests passed.');
