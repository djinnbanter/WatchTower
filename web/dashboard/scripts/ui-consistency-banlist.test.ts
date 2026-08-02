import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

/** Paths relative to src/ that may keep rounded-xl (out of scope). */
const ALLOW_PREFIXES = ['features/visuals/', 'features/lab/'];

const BAN = /\brounded-(?:xl|2xl)\b/;
/** Soft craft flags — report in assertion message; still fail the test if any match on in-scope files. */
const CRAFT_BANS: { name: string; re: RegExp }[] = [
  { name: 'transition: all', re: /transition\s*:\s*all\b/ },
  { name: 'transition-all utility', re: /\btransition-all\b/ },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|css)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function rel(p: string): string {
  return path.relative(SRC, p).split(path.sep).join('/');
}

describe('ui consistency banlist', () => {
  it('forbids rounded-xl / rounded-2xl on in-scope dashboard surfaces', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const r = rel(file);
      if (ALLOW_PREFIXES.some((p) => r.startsWith(p))) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (!BAN.test(text)) continue;
      for (const [i, line] of text.split(/\r?\n/).entries()) {
        if (BAN.test(line)) offenders.push(`${r}:${i + 1}:${line.trim()}`);
      }
    }
    assert.equal(
      offenders.length,
      0,
      `Forbidden radii on in-scope surfaces:\n${offenders.join('\n')}`,
    );
  });

  it('forbids transition: all / transition-all on in-scope surfaces', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const r = rel(file);
      if (ALLOW_PREFIXES.some((p) => r.startsWith(p))) continue;
      const text = fs.readFileSync(file, 'utf8');
      for (const { name, re } of CRAFT_BANS) {
        if (!re.test(text)) continue;
        for (const [i, line] of text.split(/\r?\n/).entries()) {
          if (re.test(line)) offenders.push(`${r}:${i + 1} [${name}]: ${line.trim()}`);
        }
      }
    }
    assert.equal(
      offenders.length,
      0,
      `Forbidden transition:all craft smells:\n${offenders.join('\n')}`,
    );
  });
});
