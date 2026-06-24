#!/usr/bin/env node
/**
 * Smoke test for DR viewer facts JSON ingest (Node, no browser).
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFactsJson } from '../web/dr-viewer/analyze/ingest.js';
import { writeBrief } from '../web/dr-viewer/analyze/briefWriter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, '..', 'web', 'dr-viewer', 'examples', 'cli-facts-dr.json');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const text = readFileSync(fixturePath, 'utf8');
const facts = parseFactsJson(text);

assert(facts.meta?.report_mode === 'dr', 'fixture should have report_mode dr');
assert(typeof facts.meta?.lookback_minutes === 'number', 'fixture should have lookback_minutes');
assert(facts.health && typeof facts.health === 'object', 'fixture should have health');
assert(Array.isArray(facts.issues) && facts.issues.length > 0, 'fixture should have issues');

const brief = writeBrief(facts);
assert(brief.includes('Watchtower DR'), 'writeBrief should produce DR brief header');
assert(brief.length > 40, 'brief should be non-trivial');

assert(parseFactsJson('{"meta":{},"health":{}}'), 'minimal valid shape accepted');
try {
  parseFactsJson('[]');
  throw new Error('array should be rejected');
} catch (e) {
  assert(/object/i.test(e.message), 'array rejection message');
}

console.log('OK cli-facts-dr.json — issues=', facts.issues.length);
console.log('All DR viewer smoke tests passed.');
