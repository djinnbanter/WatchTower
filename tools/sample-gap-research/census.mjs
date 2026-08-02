#!/usr/bin/env node
/**
 * Full-corpus pattern census → census.json.
 *
 * Usage:
 *   node tools/sample-gap-research/census.mjs --sample <SAMPLE_ROOT> --out <OUT_DIR> --inventory <INVENTORY.json>
 */
import {
  createReadStream,
  readFileSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { matchSignals, modErrorCategory } from './lib/patterns.mjs';

const LOG_TS = /^\[(\d{2}[A-Za-z]{3}\d{4} \d{2}:\d{2}:\d{2}\.\d{3})\]/;
const MONTHS = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

const SCANNABLE_KINDS = new Set([
  'latest', 'debug', 'rotate_gz', 'debug_gz', 'crash', 'kubejs', 'jade', 'other',
]);

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--sample') args.sample = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--inventory') args.inventory = argv[++i];
  }
  if (!args.sample || !args.out || !args.inventory) {
    console.error('Usage: census.mjs --sample <SAMPLE_ROOT> --out <OUT_DIR> --inventory <INVENTORY.json>');
    process.exit(1);
  }
  return args;
}

function parseLogTimestamp(line) {
  const m = line.match(LOG_TS);
  if (!m) return null;
  const raw = m[1];
  const p = raw.match(/^(\d{2})([A-Za-z]{3})(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
  if (!p) return null;
  const mo = MONTHS[p[2]] || '01';
  return `${p[3]}-${mo}-${p[1]}T${p[4]}:${p[5]}:${p[6]}`;
}

function openLineStream(absPath, rel) {
  const base = rel.split('/').pop() || rel;
  const isGz = base.endsWith('.gz') && !rel.includes('#');
  if (isGz) {
    return createInterface({
      input: createReadStream(absPath).pipe(createGunzip()),
      crlfDelay: Infinity,
    });
  }
  return createInterface({
    input: createReadStream(absPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
}

async function scanFile(absPath, rel) {
  const result = {
    rel,
    line_count: 0,
    time_start: null,
    time_end: null,
    signal_counts: {},
    error_lines: 0,
    mod_error_category_hits: {},
    samples: {},
  };

  const rl = openLineStream(absPath, rel);
  let lineNo = 0;

  for await (const line of rl) {
    lineNo++;
    result.line_count++;

    const ts = parseLogTimestamp(line);
    if (ts) {
      if (!result.time_start) result.time_start = ts;
      result.time_end = ts;
    }

    if (/\/ERROR\]/i.test(line)) {
      result.error_lines++;
      const cat = modErrorCategory(line);
      if (cat) {
        result.mod_error_category_hits[cat] = (result.mod_error_category_hits[cat] || 0) + 1;
      }
    }

    for (const id of matchSignals(line)) {
      result.signal_counts[id] = (result.signal_counts[id] || 0) + 1;
      if (!result.samples[id]) {
        result.samples[id] = { line_no: lineNo, text: line.slice(0, 500) };
      }
    }
  }

  return result;
}

function mergeTotals(totals, fileResult) {
  for (const [id, count] of Object.entries(fileResult.signal_counts)) {
    totals[id] = (totals[id] || 0) + count;
  }
}

async function main() {
  const { sample, out, inventory: inventoryPath } = parseArgs(process.argv);
  mkdirSync(out, { recursive: true });

  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
  const files = [];
  const totals = {};

  for (const entry of inventory.files) {
    if (entry.duplicate_of != null) continue;
    if (entry.kind === 'archive') continue;
    if (!SCANNABLE_KINDS.has(entry.kind)) continue;

    const absPath = join(sample, entry.rel);
    try {
      const fileResult = await scanFile(absPath, entry.rel);
      files.push(fileResult);
      mergeTotals(totals, fileResult);
    } catch (err) {
      console.error(`Warning: could not scan ${entry.rel}: ${err.message}`);
    }
  }

  files.sort((a, b) => a.rel.localeCompare(b.rel));

  const census = {
    schema: 'sample-gap-census-v1',
    sample_root: sample.replace(/\\/g, '/'),
    files,
    totals,
  };

  const outPath = join(out, 'census.json');
  writeFileSync(outPath, JSON.stringify(census, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${outPath} (${files.length} files scanned)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
