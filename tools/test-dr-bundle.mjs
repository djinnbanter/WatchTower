#!/usr/bin/env node
/**
 * Smoke test for DR bundle zip ingest (Node, no browser).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ingestDrBundle } from '../web/dr-viewer/analyze/bundleIngest.js';
import { writeBrief } from '../web/dr-viewer/analyze/briefWriter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', 'web', 'dr-viewer');
const factsPath = join(root, 'examples', 'cli-facts-dr.json');
const logPath = join(root, 'examples', 'type2-mod-load', 'logs', 'latest.log');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const factsText = readFileSync(factsPath, 'utf8');
const facts = JSON.parse(factsText);
const brief = writeBrief(facts);
const logContent = readFileSync(logPath, 'utf8');

const manifest = {
  bundle_version: 1,
  report_mode: 'dr',
  lookback_minutes: 30,
  window_start: new Date().toISOString(),
  selection_policy: 'since_last_successful_start',
  anchor_status: 'not_found',
  fallback_minutes: 1440,
  facts: 'watchtower-facts-test.json',
  brief: 'watchtower-brief-test.txt',
  file_counts: { regular: 1, debug: 0, crash: 0 },
  sessions: [{
    attempt: 1,
    started_at: new Date().toISOString(),
    regular_logs: ['logs/regular/latest.log'],
    debug_logs: [],
    crash_reports: [],
    correlation_status: 'logs_only',
    user_message: 'Test session without crash report',
    failure_signals: true,
  }],
};

// Build minimal zip using fflate (Node devDependency; browser uses CDN in bundleIngest)
import { zipSync, strToU8 } from '../web/dr-viewer/node_modules/fflate/esm/browser.js';
const zipData = zipSync({
  'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
  'watchtower-facts-test.json': strToU8(factsText),
  'watchtower-brief-test.txt': strToU8(brief),
  'logs/regular/latest.log': strToU8(logContent),
  'README.txt': strToU8('test bundle'),
});

const fixtureZip = join(root, 'examples', 'dr-bundle-minimal.zip');
writeFileSync(fixtureZip, zipData);

const result = await ingestDrBundle(zipData.buffer.slice(zipData.byteOffset, zipData.byteOffset + zipData.byteLength));

assert(result.facts?.meta?.report_mode === 'dr', 'facts report_mode');
assert(result.brief.includes('Watchtower DR'), 'brief present');
assert(result.bundleLogs.regular.length === 1, 'one regular log');
assert(result.correlation.length === 1, 'correlation sessions');
assert(result.warnings.length >= 1, 'logs_only warning');

console.log('OK dr-bundle-minimal.zip ingest');
console.log('All DR bundle smoke tests passed.');
