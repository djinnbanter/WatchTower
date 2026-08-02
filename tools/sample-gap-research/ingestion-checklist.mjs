#!/usr/bin/env node
/**
 * Inventory kind × WatchTower reader coverage → ingestion-checklist.md.
 *
 * Usage:
 *   node tools/sample-gap-research/ingestion-checklist.mjs --inventory <INVENTORY.json> --out <OUT.md>
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const KIND_READERS = {
  latest: { readers: ['LogScanner', 'OpsLogTailScanner'], status: 'seen' },
  debug: { readers: ['LogScanner'], status: 'seen' },
  rotate_gz: { readers: ['LogScanner', 'GzipLineReader'], status: 'seen' },
  debug_gz: { readers: ['LogScanner', 'GzipLineReader'], status: 'seen' },
  crash: {
    readers: ['CrashReportScanner', 'CrashMtimeScanner', 'CrashClassifier', 'CrashNarrator'],
    status: 'seen',
  },
  kubejs: {
    readers: ['SilentFailSignatures (partial via latest only)'],
    status: 'partial',
    notes: 'Dedicated kubejs/*.log not in LogScanner file set',
  },
  jade: {
    readers: [],
    status: 'unread',
    notes: 'JadeErrorOutput.txt sidecar not scanned today',
  },
  archive: {
    readers: [],
    status: 'unread',
    notes: 'Nested archives not auto-ingested; inventory dedupes members',
  },
  other: {
    readers: [],
    status: 'partial',
    notes: 'Unknown sidecar — review manually',
  },
};

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--inventory') args.inventory = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
  }
  if (!args.inventory || !args.out) {
    console.error('Usage: ingestion-checklist.mjs --inventory <INVENTORY.json> --out <OUT.md>');
    process.exit(1);
  }
  return args;
}

function escapeCell(text) {
  return String(text ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function main() {
  const { inventory: inventoryPath, out: outPath } = parseArgs(process.argv);
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));

  const exampleByKind = new Map();
  for (const file of inventory.files ?? []) {
    if (file.duplicate_of) continue;
    if (!exampleByKind.has(file.kind)) {
      exampleByKind.set(file.kind, file.rel);
    }
  }

  const rows = [];
  for (const [kind, meta] of Object.entries(KIND_READERS)) {
    const readers = meta.readers.length > 0 ? meta.readers.join(', ') : '—';
    const example = exampleByKind.get(kind) ?? '—';
    const notes = meta.notes ?? '';
    rows.push(`| ${kind} | ${escapeCell(example)} | ${escapeCell(readers)} | ${meta.status} | ${escapeCell(notes)} |`);
  }

  const lines = [
    '# Ingestion checklist',
    '',
    `Sample root: \`${inventory.sample_root ?? '—'}\``,
    '',
    '| kind | example path | wt_readers | status | notes |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ];

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`Wrote ${outPath} (${rows.length} kinds)`);
}

main();
