#!/usr/bin/env node
/**
 * Parity check: DR Layer-1 modSideScorer vs golden fixture expectations
 * (same fixture as ModSideScorerGoldenTest.java).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyModSideScoring } from '../web/dr-viewer/analyze/modSideScorer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(
  __dirname,
  '..',
  'samples',
  'fixtures',
  'mod-intelligence',
  'mods-scoring-basic.json',
);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const optional = structuredClone(fixture.input);

applyModSideScoring(optional);

const scores = Object.fromEntries(
  (optional.mods || []).filter((m) => m.side_score).map((m) => [m.id, m.side_score]),
);

for (const [id, want] of Object.entries(fixture.expected_side_scores)) {
  assert(scores[id] === want, `side_score ${id}: expected ${want}, got ${scores[id]}`);
}

const clientIds = (optional.client_only_mods || []).map((m) => m.mod_id).sort();
const expectedClient = [...fixture.expected_client_only_mod_ids].sort();
assert(
  JSON.stringify(clientIds) === JSON.stringify(expectedClient),
  `client_only_mods: expected ${expectedClient.join(',')}, got ${clientIds.join(',')}`,
);

for (const id of fixture.expected_excluded_from_client_only) {
  assert(!clientIds.includes(id), `${id} should be excluded from client_only_mods`);
}

console.log('OK mod-side-parity — scores and client_only_mods match golden fixture');
