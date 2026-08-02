#!/usr/bin/env node
/**
 * Walk SAMPLE_ROOT → inventory.json with archive dedupe.
 *
 * Usage:
 *   node tools/sample-gap-research/inventory.mjs --sample <SAMPLE_ROOT> --out <OUT_DIR>
 */
import {
  createReadStream,
  readdirSync,
  statSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, basename, posix as pathPosix } from 'node:path';
import { gunzipSync } from 'node:zlib';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--sample') args.sample = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
  }
  if (!args.sample || !args.out) {
    console.error('Usage: inventory.mjs --sample <SAMPLE_ROOT> --out <OUT_DIR>');
    process.exit(1);
  }
  return args;
}

function toRel(sampleRoot, absPath) {
  return relative(sampleRoot, absPath).split(/[/\\]/).join('/');
}

function classifyKind(rel) {
  const base = basename(rel);
  const norm = rel.replace(/\\/g, '/');

  if (base === 'JadeErrorOutput.txt') return 'jade';
  if (norm.includes('/kubejs/') || norm.startsWith('kubejs/')) return 'kubejs';
  if (norm.startsWith('crash-reports/') && base.endsWith('.txt')) return 'crash';
  if (base === 'latest.log') return 'latest';
  if (base === 'debug.log') return 'debug';
  if (/^debug-\d+\.log\.gz$/i.test(base)) return 'debug_gz';
  if (/^\d{4}-\d{2}-\d{2}-\d+\.log\.gz$/i.test(base)) return 'rotate_gz';
  if (/\.(tar\.gz|tgz)$/i.test(base)) return 'archive';
  if (/\.zip$/i.test(base)) return 'archive';
  return 'other';
}

function walkDir(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(abs, files);
    } else if (entry.isFile()) {
      files.push(abs);
    }
  }
  return files;
}

async function readTarGzMembers(absPath) {
  const members = [];
  const buf = gunzipSync(readFileSync(absPath));
  let offset = 0;
  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '').trim();
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '').trim();
    const fullName = prefix ? `${prefix}/${name}` : name;
    const sizeOct = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim();
    const size = parseInt(sizeOct, 8) || 0;
    if (fullName && fullName !== './' && fullName !== '.') {
      members.push(pathPosix.basename(fullName.replace(/\\/g, '/')));
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return members;
}

async function readZipMembers(absPath) {
  const buf = readFileSync(absPath);
  const members = [];
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return members;
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const cdEntries = buf.readUInt16LE(eocd + 10);
  let pos = cdOffset;
  for (let n = 0; n < cdEntries && pos + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const name = buf.subarray(pos + 46, pos + 46 + nameLen).toString('utf8');
    if (name && !name.endsWith('/')) {
      members.push(pathPosix.basename(name.replace(/\\/g, '/')));
    }
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return members;
}

async function listArchiveMembers(absPath) {
  const base = basename(absPath).toLowerCase();
  if (base.endsWith('.zip')) return readZipMembers(absPath);
  return readTarGzMembers(absPath);
}

function sha256File(absPath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(absPath)
      .on('data', (d) => hash.update(d))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

function memberKind(basename) {
  if (/^debug-\d+\.log\.gz$/i.test(basename)) return 'debug_gz';
  if (/^\d{4}-\d{2}-\d{2}-\d+\.log\.gz$/i.test(basename)) return 'rotate_gz';
  if (basename.endsWith('.log.gz')) return 'rotate_gz';
  return 'other';
}

async function main() {
  const { sample, out } = parseArgs(process.argv);
  const sampleRoot = sample;
  mkdirSync(out, { recursive: true });

  const absFiles = walkDir(sampleRoot);
  const files = [];
  const logPeerBasenames = new Map();

  for (const abs of absFiles) {
    const rel = toRel(sampleRoot, abs);
    const kind = classifyKind(rel);
    const st = statSync(abs);
    const entry = {
      rel,
      kind,
      bytes: st.size,
      duplicate_of: null,
    };
    files.push(entry);

    if (rel.startsWith('logs/') && kind !== 'archive') {
      logPeerBasenames.set(basename(rel), rel);
    }
  }

  const dedupe = { archive: null, skipped_members: [] };

  for (const entry of files.filter((f) => f.kind === 'archive')) {
    const abs = join(sampleRoot, entry.rel);
    entry.sha256 = await sha256File(abs);
    if (!dedupe.archive) dedupe.archive = entry.rel;

    let members;
    try {
      members = await listArchiveMembers(abs);
    } catch (err) {
      console.error(`Warning: could not list archive ${entry.rel}: ${err.message}`);
      continue;
    }

    for (const memberBase of members) {
      const peerRel = logPeerBasenames.get(memberBase);
      if (peerRel) {
        dedupe.skipped_members.push(memberBase);
        files.push({
          rel: `${entry.rel}#${memberBase}`,
          kind: memberKind(memberBase),
          bytes: 0,
          duplicate_of: peerRel,
        });
      }
    }
  }

  dedupe.skipped_members.sort();

  const inventory = {
    schema: 'sample-gap-inventory-v1',
    sample_root: sampleRoot.replace(/\\/g, '/'),
    generated_at: new Date().toISOString(),
    files: files.sort((a, b) => a.rel.localeCompare(b.rel)),
    dedupe,
  };

  const outPath = join(out, 'inventory.json');
  writeFileSync(outPath, JSON.stringify(inventory, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${outPath} (${inventory.files.length} entries)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
