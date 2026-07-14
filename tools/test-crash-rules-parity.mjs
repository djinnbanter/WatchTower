#!/usr/bin/env node
/**
 * Parity harness for 1.0.18 crash rule packs — schema validate + fixture presence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const fixtures = path.join(root, 'samples', 'fixtures', 'crash-rules');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('OK:', msg);
  }
}

assert(fs.existsSync(path.join(fixtures, 'create-contraption-npe.yaml')), 'create-contraption-npe.yaml present');
assert(fs.existsSync(path.join(fixtures, 'invalid-exec.yaml')), 'invalid-exec.yaml present');
assert(fs.existsSync(path.join(fixtures, 'suppressions.conf')), 'suppressions.conf present');

const good = fs.readFileSync(path.join(fixtures, 'create-contraption-npe.yaml'), 'utf8');
const bad = fs.readFileSync(path.join(fixtures, 'invalid-exec.yaml'), 'utf8');
assert(/mod_present:\s*create/.test(good), 'good fixture gates on create');
assert(!/Flywheel/i.test(good), 'good fixture does not lead with Flywheel');
assert(/exec:/.test(bad), 'invalid fixture contains exec');

const builtin = path.join(root, 'watchtower-core', 'src', 'main', 'resources', 'builtin-rules', 'create-contraption-npe.yaml');
assert(fs.existsSync(builtin), 'JAR builtin create-contraption-npe.yaml present');
const builtinText = fs.readFileSync(builtin, 'utf8');
assert(/Stop or break the stuck Create assembly/.test(builtinText), 'builtin evidence-first hint');
assert(!/Update Create \+ Flywheel/i.test(builtinText), 'builtin does not lead with Update Create + Flywheel');

assert(fs.existsSync(path.join(fixtures, 'invalid-regex.yaml')), 'invalid-regex.yaml present');
const badRegex = fs.readFileSync(path.join(fixtures, 'invalid-regex.yaml'), 'utf8');
const regexMatch = badRegex.match(/regex:\s*"([^"]+)"/);
assert(regexMatch && regexMatch[1].length > 500, 'invalid-regex fixture exceeds 500 chars');

const coreClasses = [
  'CrashRuleSchema.java',
  'CrashRuleValidator.java',
  'CrashRuleRegistry.java',
  'CrashRuleEvaluator.java',
  'IssueSuppressionStore.java',
].map((f) => path.join(root, 'watchtower-core', 'src', 'main', 'java', 'dev', 'mcstatus', 'watchtower', 'core', 'rules', f));
for (const f of coreClasses) {
  assert(fs.existsSync(f), path.basename(f) + ' exists');
}

if (process.exitCode) {
  console.error('crash-rules parity: FAILED');
  process.exit(process.exitCode);
}
console.log('crash-rules parity: PASSED');
