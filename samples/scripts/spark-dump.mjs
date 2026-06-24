#!/usr/bin/env node
/**
 * Dump a local .sparkprofile / .sparkheap or bytebin code to JSON via spark2json.
 *
 * Usage:
 *   node samples/scripts/spark-dump.mjs path/to/profile.sparkprofile
 *   node samples/scripts/spark-dump.mjs H5BVV4Annz
 *
 * Requires: yarn install in fixtures/spark2json-main (once).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const spark2jsonCli = path.resolve(__dirname, '../../fixtures/spark2json-main/src/cli.js');
const input = process.argv[2];

if (!input) {
  console.error('usage: node samples/scripts/spark-dump.mjs <file.sparkprofile|bytebin-code>');
  process.exit(1);
}

const result = spawnSync(process.execPath, [spark2jsonCli, input], {
  stdio: 'inherit',
  cwd: path.dirname(spark2jsonCli),
});

process.exit(result.status ?? 1);
