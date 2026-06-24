#!/usr/bin/env node
/**
 * Batch audit of fixtures/crashlogs/ — corpus v2 harness for WT-022 / 1.0.13.
 *
 * Usage:
 *   node tools/analyze-crash-corpus.mjs
 *   node tools/analyze-crash-corpus.mjs --csv fixtures/corpus-audit-v2/coverage.csv
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CRASH_DIR = join(ROOT, 'fixtures', 'crashlogs');
const OUT_DIR = join(ROOT, 'fixtures', 'corpus-audit-v2');
const SHARDS_MD = join(CRASH_DIR, '_shards.md');

const TRANSFORMER = /TRANSFORMER\/([a-z][\w-]*)@/gi;
const MOD_FILE = /Mod File:\s*(.+)/i;
const DESCRIPTION = /^Description:\s*(.+)/im;
const FAILURE_MSG = /^Failure message:\s*(.+)/im;
const EXCEPTION = /^([a-z][\w.$]*(?:Exception|Error)):\s*(.+)/im;
const WATCHDOG_SEC = /single server tick took (\d+) seconds/i;
const WATCHDOG_MS = /single server tick took (\d+) milliseconds/i;

function parseShards(md) {
  const shards = {};
  let current = null;
  for (const line of md.split(/\r?\n/)) {
    const h = line.match(/^## Shard ([A-H]) —/);
    if (h) {
      current = h[1];
      shards[current] = [];
      continue;
    }
    if (current && line.startsWith('crash-') && line.endsWith('.txt')) {
      shards[current].push(line.trim());
    }
  }
  return shards;
}

function parseCrashSummary(text) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('Description:')) return trimmed.slice('Description:'.length).trim().slice(0, 200);
    if (trimmed.includes('Caused by:')) return trimmed.slice(0, 200);
    if (trimmed.includes('Mod File:') || trimmed.includes('Failure message:')) return trimmed.slice(0, 200);
  }
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const s = lines[i].trim();
    if (s && !s.startsWith('----') && !s.includes('Time:')) return s.slice(0, 200);
  }
  return '';
}

function stripJar(raw) {
  let s = raw.trim();
  const slash = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
  if (slash >= 0) s = s.slice(slash + 1);
  if (s.endsWith('.jar')) s = s.slice(0, -4);
  const dash = s.lastIndexOf('-');
  if (dash > 0 && /^\d+/.test(s.slice(dash + 1))) s = s.slice(0, dash);
  return s;
}

function extractStackHead(text, maxFrames = 30) {
  const frames = [];
  for (const line of text.split(/\r?\n/)) {
    if (/^\tat\s+/.test(line)) {
      frames.push(line);
      if (frames.length >= maxFrames) break;
    }
  }
  return frames.join('\n');
}

function parseCrashFile(name) {
  const path = join(CRASH_DIR, name);
  const text = readFileSync(path, 'utf8');
  const type = name.includes('-fml.txt') ? 'fml' : name.includes('-server.txt') ? 'server' : 'other';
  const modM = text.match(MOD_FILE);
  const modFileRaw = modM ? stripJar(modM[1]) : '';
  const hasModFile = modFileRaw.length > 0 && !/<No mod information/i.test(modFileRaw);
  const descM = text.match(DESCRIPTION);
  const description = descM ? descM[1].trim() : '';
  const failM = text.match(FAILURE_MSG);
  const failureMessage = failM ? failM[1].trim() : '';
  const exM = text.match(EXCEPTION);
  const rootException = exM ? `${exM[1]}: ${exM[2].trim()}`.slice(0, 200) : '';
  const causedM = text.match(/^Caused by:\s*(.+)/im);
  const exception = causedM ? causedM[1].trim().slice(0, 200) : rootException;
  const summary = parseCrashSummary(text);
  const stackHead = extractStackHead(text);
  const stackTransformers = [...new Set([...stackHead.matchAll(TRANSFORMER)].map((m) => m[1].toLowerCase()))];

  let watchdogSec = null;
  const ws = text.match(WATCHDOG_SEC);
  const wm = text.match(WATCHDOG_MS);
  if (ws) watchdogSec = parseInt(ws[1], 10);
  else if (wm) watchdogSec = Math.round(parseInt(wm[1], 10) / 1000);

  const engineCombined = ((exception || '') + ' ' + (modFileRaw || '') + ' ' + (summary || '')).toLowerCase();
  const signals = [];

  if (stackTransformers.length && !hasModFile) signals.push('TRANSFORMER stack not used for mod id');
  if (text.includes('ServerHangWatchdog') && ws && !wm) signals.push('watchdog duration in seconds not ms');
  if (modM && modM[1].includes('<No mod information')) signals.push('placeholder mod file treated as real');
  if ((text.match(/-- Mod loading issue --/g) || []).length > 1) signals.push('FML multi-failure — only first block used');
  if (description && !engineCombined.includes(description.toLowerCase().slice(0, 15))) {
    signals.push('description ignored by classifier');
  }

  const human = classifyHuman({
    description,
    failureMessage,
    exception,
    rootException,
    stackHead,
    stackTransformers,
    type,
    text,
  });
  const engine = classifyEngine(engineCombined, modFileRaw, exception);
  const primaryMod = guessPrimaryMod(modFileRaw, exception, summary, stackTransformers, stackHead, human.kind);

  const tsMatch = name.match(/crash-(\d{4}-\d{2}-\d{2})_(\d{2})\.(\d{2})/);
  const timestamp = tsMatch
    ? `${tsMatch[1]}T${tsMatch[2]}:${tsMatch[3]}:00`
    : null;

  return {
    file: name,
    type,
    timestamp,
    root_exception: rootException.slice(0, 150),
    description_snippet: description.slice(0, 120),
    has_mod_file_line: hasModFile,
    mod_file_value: modFileRaw.slice(0, 80),
    neoforge_transformer_mods: stackTransformers.slice(0, 8),
    human_failure_kind: human.kind,
    human_primary_mod: primaryMod,
    engine_category: engine,
    engine_would_be_unknown: engine === 'unknown',
    is_watchdog_followup: human.kind === 'watchdog_followup',
    paired_primary_file: null,
    signals_missed_by_engine: signals,
    recommended_fix_human: human.fix,
    golden_fixture_candidate: human.golden,
  };
}

function classifyHuman(ctx) {
  const sig = (
    ctx.exception + ' ' + ctx.rootException + ' ' + ctx.description + ' ' + ctx.failureMessage + ' ' + ctx.stackHead
  ).toLowerCase();

  if (sig.includes('serverhangwatchdog') || ctx.exception.includes('ServerHangWatchdog')) {
    const stackLow = ctx.stackHead.toLowerCase();
    if (/squaremap|chunky|bluemap|distant.?horizons/.test(stackLow)) {
      return { kind: 'watchdog_pregen', fix: 'Reduce concurrent pregen/map work; stall in world gen or map render.', golden: true };
    }
    return { kind: 'watchdog', fix: 'Server thread hung — check lag sources before watchdog.', golden: true };
  }
  if (sig.includes('loading nbt data') || (sig.includes('eofexception') && sig.includes('zlib'))) {
    return { kind: 'world_nbt_corrupt', fix: 'Corrupt schematic/NBT — restore from backup or remove bad structure.', golden: true };
  }
  if (/kubejs.*syntax|startup script|startup_scripts/i.test(sig)) {
    return { kind: 'mod_load_script', fix: 'Fix KubeJS script syntax in startup_scripts.', golden: true };
  }
  if (sig.includes('generator type id cannot be null') || sig.includes('schematicannon')) {
    return { kind: 'mod_runtime', fix: 'CreateCobblestone schematicannon — update or fix schematic.', golden: true };
  }
  if (sig.includes('mf.axis is null') || sig.includes('continuousobbcollider')) {
    return { kind: 'mod_runtime', fix: 'Create contraption collision bug — update Create/Flywheel.', golden: true };
  }
  if (/requires|missing|dependency|cloth_config|ftblibrary|blueprint|konkrete/i.test(sig) && ctx.type === 'fml') {
    return { kind: 'mod_load_dependency', fix: 'Install missing dependency mod.', golden: true };
  }
  if (/fabric loader|bukkit|java 25|wrong loader|connector.*crash/i.test(sig)) {
    return { kind: 'platform_mismatch', fix: 'Wrong loader or Java version for this jar.', golden: true };
  }
  if (ctx.type === 'fml' || sig.includes('mod loading has failed') || sig.includes('modloadingcrash')) {
    return { kind: 'mod_load_dependency', fix: 'Fix mod load failure — read FML issue blocks.', golden: ctx.type === 'fml' };
  }
  if (sig.includes('outofmemory') || sig.includes('heap space')) {
    return { kind: 'host_resource', fix: 'Increase heap or reduce memory pressure.', golden: false };
  }
  if (ctx.stackTransformers.length > 0 && /exception|error|nullpointer|illegalstate/i.test(sig)) {
    const top = ctx.stackTransformers.find((t) => !['neoforge', 'minecraft', 'mixin'].includes(t));
    return { kind: 'mod_runtime', fix: `Check mod ${top || ctx.stackTransformers[0]} stack in crash report.`, golden: false };
  }
  return { kind: 'unknown', fix: 'Manual review — stack unclear.', golden: false };
}

/** Mirrors CrashClassifier.classify(combined = exception + mod_file + summary). */
function classifyEngine(combined, modFile, exception) {
  const c = combined.toLowerCase();
  if (
    c.includes('serverhangwatchdog')
    || c.includes('single server tick took')
    || c.includes('outofmemoryerror')
    || c.includes('java heap space')
    || c.includes('direct buffer memory')
    || (exception && exception.includes('ServerHangWatchdog'))
  ) {
    return 'host_resource';
  }
  if (modFile && modFile.length > 0 && modFile !== 'java.lang.Error' && !modFile.includes('<No mod')) {
    return 'mod';
  }
  if (
    c.includes('modloadingcrash')
    || c.includes('mod loading has failed')
    || c.includes('modloadingexception')
    || c.includes('fmlmodloading')
    || (exception && (exception.includes('ModLoading') || exception.includes('ModException')))
    || /mod id\s+['"]?[a-z][\w-]*['"]?/i.test(c)
  ) {
    return 'mod';
  }
  if (
    c.includes('neoforged')
    || c.includes('net.neoforged')
    || c.includes('cpw.mods')
    || c.includes('fml early loading')
    || c.includes('bootstrap')
  ) {
    return 'loader';
  }
  return 'unknown';
}

function guessPrimaryMod(modFile, exception, summary, transformers, stackHead, kind) {
  if (kind === 'mod_runtime' && transformers.includes('create')) return 'create';
  if (kind === 'mod_load_script') return 'kubejs';
  if (modFile && modFile.length > 0 && !modFile.includes('<No')) return modFile.toLowerCase();
  const modLoading = (exception || '').match(/Mod\s+\(([^)]+)\)/i);
  if (modLoading) return modLoading[1].toLowerCase();
  const fml = (exception + ' ' + summary).match(/mod id\s+['"]?([a-z][\w-]*)['"]?/i);
  if (fml) return fml[1].toLowerCase();
  const ns = (summary || '').match(/([a-z][\w]*):[\w./_-]+/);
  if (ns && !['minecraft', 'neoforge'].includes(ns[1])) return ns[1];
  const top = transformers.find((t) => !['neoforge', 'minecraft', 'mixin', 'bus'].includes(t));
  return top || null;
}

function linkWatchdogPairs(entries) {
  const byTime = entries.filter((e) => e.timestamp).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  for (let i = 1; i < byTime.length; i++) {
    const prev = byTime[i - 1];
    const cur = byTime[i];
    if (cur.human_failure_kind === 'watchdog' || cur.human_failure_kind === 'watchdog_followup') {
      const prevKind = prev.human_failure_kind;
      if (prevKind === 'mod_runtime' || prevKind === 'world_nbt_corrupt') {
        const t0 = new Date(prev.timestamp).getTime();
        const t1 = new Date(cur.timestamp).getTime();
        if (t1 - t0 < 120000) {
          cur.is_watchdog_followup = true;
          cur.paired_primary_file = prev.file;
          cur.human_failure_kind = 'watchdog_followup';
        }
      }
    }
  }
}

function shardSummary(shardId, entries) {
  const sigCounts = {};
  for (const e of entries) {
    const sig = e.human_failure_kind;
    sigCounts[sig] = (sigCounts[sig] || 0) + 1;
  }
  const topSigs = Object.entries(sigCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const unknownEngine = entries.filter((e) => e.engine_would_be_unknown).length;
  const humanUnknown = entries.filter((e) => e.human_failure_kind === 'unknown').length;
  const engineCounts = {};
  for (const e of entries) {
    engineCounts[e.engine_category] = (engineCounts[e.engine_category] || 0) + 1;
  }
  return {
    shard: shardId,
    file_count: entries.length,
    signature_frequency: Object.fromEntries(topSigs),
    engine_category_counts: engineCounts,
    engine_unknown_count: unknownEngine,
    engine_unknown_pct: Math.round((unknownEngine / entries.length) * 1000) / 10,
    human_unknown_count: humanUnknown,
    worst_false_negatives: entries
      .filter((e) => e.human_failure_kind !== 'unknown' && e.engine_would_be_unknown)
      .slice(0, 5)
      .map((e) => ({ file: e.file, kind: e.human_failure_kind })),
    golden_candidates: entries.filter((e) => e.golden_fixture_candidate).map((e) => e.file).slice(0, 8),
  };
}

function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const shards = parseShards(readFileSync(SHARDS_MD, 'utf8'));
  const allEntries = [];
  const shardOutputs = {};

  for (const [shardId, files] of Object.entries(shards)) {
    const entries = files.map(parseCrashFile);
    allEntries.push(...entries);
    shardOutputs[shardId] = {
      shard: shardId,
      files: entries,
      summary: shardSummary(shardId, entries),
    };
    writeFileSync(join(OUT_DIR, `shard-${shardId}.json`), JSON.stringify(shardOutputs[shardId], null, 2));
  }

  linkWatchdogPairs(allEntries);

  const run1 = [...(shardOutputs.A?.files || []), ...(shardOutputs.B?.files || []), ...(shardOutputs.C?.files || []), ...(shardOutputs.D?.files || [])];
  const run2 = [...(shardOutputs.E?.files || []), ...(shardOutputs.F?.files || []), ...(shardOutputs.G?.files || []), ...(shardOutputs.H?.files || [])];

  writeFileSync(join(OUT_DIR, 'run1-merged.json'), JSON.stringify({ count: run1.length, files: run1 }, null, 2));
  writeFileSync(join(OUT_DIR, 'run2-merged.json'), JSON.stringify({ count: run2.length, files: run2 }, null, 2));
  writeFileSync(join(OUT_DIR, 'corpus-full.json'), JSON.stringify({ count: allEntries.length, files: allEntries }, null, 2));

  const engineUnknown = allEntries.filter((e) => e.engine_would_be_unknown).length;
  const humanUnknown = allEntries.filter((e) => e.human_failure_kind === 'unknown').length;
  const kindCounts = {};
  for (const e of allEntries) {
    kindCounts[e.human_failure_kind] = (kindCounts[e.human_failure_kind] || 0) + 1;
  }

  const report = {
    total: allEntries.length,
    engine_unknown_count: engineUnknown,
    engine_unknown_pct: Math.round((engineUnknown / allEntries.length) * 1000) / 10,
    human_unknown_count: humanUnknown,
    human_unknown_pct: Math.round((humanUnknown / allEntries.length) * 1000) / 10,
    human_failure_kind_counts: kindCounts,
  };
  writeFileSync(join(OUT_DIR, 'crash-summary.json'), JSON.stringify(report, null, 2));

  if (process.argv.includes('--csv')) {
    const csvPath = process.argv[process.argv.indexOf('--csv') + 1] || join(OUT_DIR, 'coverage.csv');
    const header = 'file,type,human_failure_kind,human_primary_mod,engine_category,engine_unknown,golden\n';
    const rows = allEntries.map((e) =>
      [e.file, e.type, e.human_failure_kind, e.human_primary_mod || '', e.engine_category, e.engine_would_be_unknown, e.golden_fixture_candidate].join(','),
    ).join('\n');
    writeFileSync(csvPath, header + rows);
  }

  console.log(`analyze-crash-corpus OK — ${allEntries.length} files`);
  console.log(`  engine unknown: ${report.engine_unknown_pct}% (${engineUnknown})`);
  console.log(`  human unknown:  ${report.human_unknown_pct}% (${humanUnknown})`);
  console.log(`  output: ${OUT_DIR}`);
}

main();
