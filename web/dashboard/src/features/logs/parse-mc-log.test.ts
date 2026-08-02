import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildVirtualItems,
  filterEntries,
  findMatchIndexes,
  findProblemIndexes,
  groupKeyFromTs,
  highlightQuery,
  isProblemsOnly,
  levelsFromParam,
  newestFirst,
  parseMcLog,
} from './parse-mc-log.ts';

describe('parseMcLog', () => {
  it('parses vanilla INFO lines', () => {
    const text = '[00:00:01] [Server thread/INFO]: Done (12.3s)! For help, type "help"';
    const { entries, counts } = parseMcLog(text);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].level, 'INFO');
    assert.equal(entries[0].ts, '00:00:01');
    assert.equal(entries[0].thread, 'Server thread');
    assert.match(entries[0].message, /^Done/);
    assert.equal(counts.INFO, 1);
  });

  it('parses NeoForge ERROR with logger', () => {
    const text =
      '[21:04:12] [Server thread/ERROR] [some.mod/]: Failed to load recipe abc';
    const { entries, counts } = parseMcLog(text);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].level, 'ERROR');
    assert.equal(entries[0].logger, 'some.mod');
    assert.equal(entries[0].message, 'Failed to load recipe abc');
    assert.equal(counts.ERROR, 1);
  });

  it('glues multi-line stacks to the header entry', () => {
    const text = [
      '[21:04:12] [Server thread/ERROR]: Boom',
      'java.lang.RuntimeException: nope',
      '\tat net.minecraft.Server.tick(Server.java:1)',
      '[21:04:13] [Server thread/INFO]: Recovered',
    ].join('\n');
    const { entries } = parseMcLog(text);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].level, 'ERROR');
    assert.equal(entries[0].lines.length, 3);
    assert.equal(entries[1].level, 'INFO');
    assert.equal(entries[1].message, 'Recovered');
  });

  it('buckets orphan noise as UNKNOWN', () => {
    const text = 'not a log line\n[00:00:00] [Server thread/WARN]: ok';
    const { entries, counts } = parseMcLog(text);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].level, 'UNKNOWN');
    assert.equal(entries[0].message, 'not a log line');
    assert.equal(entries[1].level, 'WARN');
    assert.equal(counts.UNKNOWN, 1);
    assert.equal(counts.WARN, 1);
  });

  it('filters by level and search', () => {
    const text = [
      '[00:00:00] [Server thread/INFO]: hello world',
      '[00:00:01] [Server thread/ERROR]: bad recipe',
      '[00:00:02] [Server thread/WARN]: soft fail',
    ].join('\n');
    const { entries } = parseMcLog(text);
    const problems = filterEntries(entries, new Set(['ERROR', 'WARN', 'FATAL']), '');
    assert.equal(problems.length, 2);
    const searched = filterEntries(entries, new Set(['ERROR', 'WARN', 'INFO']), 'recipe');
    assert.equal(searched.length, 1);
    assert.equal(searched[0].level, 'ERROR');
  });

  it('newestFirst reverses order', () => {
    const text = [
      '[00:00:00] [Server thread/INFO]: a',
      '[00:00:01] [Server thread/INFO]: b',
    ].join('\n');
    const { entries } = parseMcLog(text);
    const rev = newestFirst(entries);
    assert.equal(rev[0].message, 'b');
    assert.equal(rev[1].message, 'a');
  });

  it('levelsFromParam defaults to problems', () => {
    const d = levelsFromParam(null);
    assert.ok(isProblemsOnly(d));
    const custom = levelsFromParam('INFO,DEBUG');
    assert.equal(custom.size, 2);
    assert.ok(custom.has('INFO'));
  });
});

describe('virtual grouping helpers', () => {
  it('groupKeyFromTs extracts minute labels', () => {
    assert.equal(groupKeyFromTs('13Jul2026 08:19:10.221').key, '13Jul2026 08:19');
    assert.equal(groupKeyFromTs(undefined).label, 'Unknown time');
  });

  it('buildVirtualItems inserts sticky headers and counts', () => {
    const text = [
      '[00:00:01] [Server thread/INFO]: a',
      '[00:00:01] [Server thread/WARN]: b',
      '[00:01:00] [Server thread/ERROR]: c',
    ].join('\n');
    const { entries } = parseMcLog(text);
    const { items, stickyIndexes } = buildVirtualItems(newestFirst(entries));
    assert.ok(stickyIndexes.length >= 2);
    assert.equal(items[0].kind, 'header');
    if (items[0].kind === 'header') {
      assert.ok(items[0].count >= 1);
    }
    const entryCount = items.filter((i) => i.kind === 'entry').length;
    assert.equal(entryCount, 3);
  });

  it('findProblemIndexes and findMatchIndexes', () => {
    const text = [
      '[00:00:00] [Server thread/INFO]: hello',
      '[00:00:01] [Server thread/ERROR]: bad recipe',
      '[00:00:02] [Server thread/WARN]: soft',
    ].join('\n');
    const { entries } = parseMcLog(text);
    const { items } = buildVirtualItems(newestFirst(entries));
    const problems = findProblemIndexes(items);
    assert.equal(problems.length, 2);
    const matches = findMatchIndexes(items, 'recipe');
    assert.equal(matches.length, 1);
  });

  it('highlightQuery marks hits', () => {
    const parts = highlightQuery('bad recipe here', 'recipe');
    assert.ok(parts.some((p) => p.hit && p.t.toLowerCase() === 'recipe'));
  });
});
