#!/usr/bin/env node
/**
 * Lightweight forensics fixture harness (1.0.17).
 * Validates fixture inventory + DR panel module loads without jar walking.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = path.join(root, 'samples', 'fixtures', 'forensics');

const required = [
  'create-class-lookup.json',
  'corrupt-zip-boot.log',
  'serverconfig-bad.toml',
  'stderr-fml-early.log',
  'expected.json',
  'mcreator-mod.marker',
  'fabric-in-neoforge.marker',
];

function readJson(p) {
  let text = fs.readFileSync(p, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return JSON.parse(text);
}

let failed = 0;
for (const name of required) {
  const p = path.join(fixtures, name);
  if (!fs.existsSync(p)) {
    console.error('MISSING fixture', name);
    failed++;
  }
}

const panelPath = path.join(root, 'web', 'dr-viewer', 'analyze', 'modForensicsPanel.js');
const mod = await import(pathToFileURL(panelPath).href);
const skipped = mod.renderModForensicsPanel({
  mod_forensics: { scan_config: { mod_forensics_scan: false } },
});
if (!skipped.skipped) {
  console.error('expected skipped panel when master off');
  failed++;
}
const live = mod.renderModForensicsPanel({
  mod_forensics: {
    class_index_status: 'ready',
    corrupt_jars: [{ path: 'broken.jar', reason: 'zip_error' }],
    scan_config: { mod_forensics_scan: true },
  },
  config_health: [{ path: 'world/serverconfig/x.toml', reason: 'parse_error' }],
});
if (live.skipped || !live.html.includes('broken.jar')) {
  console.error('expected forensics panel html');
  failed++;
}

const createLookup = readJson(path.join(fixtures, 'create-class-lookup.json'));
if (createLookup?.expected?.mod_id !== 'create') {
  console.error('create-class-lookup expected.mod_id');
  failed++;
}
const expected = readJson(path.join(fixtures, 'expected.json'));
if (expected?.version !== '1.0.17' || !Array.isArray(expected?.api_routes) || expected.api_routes.length < 5) {
  console.error('expected.json version/api_routes');
  failed++;
}

if (failed) {
  console.error(`FAIL forensics-parity — ${failed} check(s)`);
  process.exit(1);
}
console.log('OK forensics-parity — fixtures + DR panel (facts-only) passed');
