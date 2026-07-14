#!/usr/bin/env node
/** Offline optional jdeps helper (CA-20) — never called by the Watchtower server. */
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help')) {
  console.log(`Usage: node tools/jdeps-mod-scan.mjs <jar-or-class> [jdeps args...]

Requires a JDK with jdeps on PATH. Watchtower does not run this on the server —
use find-class for owning-jar lookup instead.`);
  process.exit(args.includes('--help') ? 0 : 1);
}

const result = spawnSync('jdeps', ['-verbose:class', ...args], { encoding: 'utf8', shell: true });
if (result.error) {
  console.error('jdeps not available:', result.error.message);
  process.exit(1);
}
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
process.exit(result.status ?? 1);
