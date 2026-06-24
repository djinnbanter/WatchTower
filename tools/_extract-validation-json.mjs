#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [transcriptPath, outName] = process.argv.slice(2);
if (!transcriptPath || !outName) {
  console.error('Usage: node tools/_extract-validation-json.mjs <transcript.jsonl> <out.json>');
  process.exit(1);
}

const text = readFileSync(transcriptPath, 'utf8');
let jsonStr = null;
for (const line of text.split('\n')) {
  if (!line.trim()) continue;
  try {
    const row = JSON.parse(line);
    const msg = row.message?.content?.find((c) => c.type === 'text')?.text;
    if (msg && msg.includes('```json')) {
      const m = msg.match(/```json\n([\s\S]*?)\n```/);
      if (m) {
        jsonStr = m[1];
        break;
      }
    }
  } catch {
    /* skip non-json lines */
  }
}
if (!jsonStr) {
  const match = text.match(/```json\\n([\s\S]*?)\\n```/);
  if (match) jsonStr = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
}
if (!jsonStr) {
  console.error('No JSON block found in', transcriptPath);
  process.exit(1);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'corpus-audit-v2');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, outName);
writeFileSync(outPath, jsonStr);
JSON.parse(jsonStr);
console.log('Wrote', outPath, '(' + jsonStr.length + ' bytes)');
