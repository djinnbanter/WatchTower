#!/usr/bin/env node
/**
 * Deep 1.0.13 ship-gate audit against local fixtures/crashlogs/.
 * Uses the real DR parser/classifier (post-1.0.13), not the stale harness stub.
 *
 * Usage:
 *   node tools/audit-crash-intel-1013.mjs
 *   node tools/audit-crash-intel-1013.mjs --csv fixtures/corpus-audit-v2/coverage-post-1013.csv
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CRASH_DIR = join(ROOT, 'fixtures', 'crashlogs');
const OUT_DIR = join(ROOT, 'fixtures', 'corpus-audit-v2');

const { parseCrashReport, extractWatchdogMs } = await import(
  pathToFileURL(join(ROOT, 'web/dr-viewer/analyze/crashScanner.js')).href
);
const { classifyCrash } = await import(
  pathToFileURL(join(ROOT, 'web/dr-viewer/analyze/crashClassifier.js')).href
);

const VANILLA = new Set(['minecraft', 'neoforge', 'forge', 'fabricloader', 'java', 'mixin']);

function humanKind(text, parsed, classification) {
  const sig = [
    parsed.exception, parsed.root_exception, parsed.description,
    parsed.failure_message, parsed.summary, text.slice(0, 4000),
  ].filter(Boolean).join(' ').toLowerCase();

  if (sig.includes('serverhangwatchdog') || sig.includes('single server tick took')) {
    if (/squaremap|chunky|bluemap|distant.?horizons/.test(sig)) return 'watchdog_pregen';
    return 'watchdog';
  }
  if (sig.includes('loading nbt data') || (sig.includes('eofexception') && sig.includes('zlib'))) {
    return 'world_nbt_corrupt';
  }
  if (/kubejs.*syntax|startup script|startup_scripts/i.test(sig)) return 'mod_load_script';
  if (sig.includes('mf.axis is null') || sig.includes('continuousobbcollider')) return 'mod_runtime';
  if (parsed.file?.includes('-fml') || /mod loading has failed|modloadingcrash|requires|missing dependency/i.test(sig)) {
    return 'mod_load_dependency';
  }
  if (sig.includes('outofmemory') || sig.includes('heap space')) return 'host_resource';
  if (parsed.primary_mod_id || (classification.primary_mod_id && !VANILLA.has(classification.primary_mod_id))) {
    return 'mod_runtime';
  }
  return 'unknown';
}

function isWatchdogText(text) {
  return /ServerHangWatchdog|single server tick took/i.test(text);
}

function stackHasTransformers(text) {
  return /TRANSFORMER\/([a-z][\w-]*)@/i.test(text);
}

function analyzeFile(name) {
  const text = readFileSync(join(CRASH_DIR, name), 'utf8');
  if (!text || !text.trim()) {
    return {
      file: name,
      type: name.includes('-fml') ? 'fml' : name.includes('-server') ? 'server' : 'other',
      empty: true,
      engine_unknown: false,
      skip_reason: 'empty_file',
    };
  }
  const parsed = parseCrashReport(text, name, null);
  const classification = classifyCrash(parsed);
  const watchdogMs = parsed.watchdog_tick_ms ?? extractWatchdogMs(text);
  const watchdog = isWatchdogText(text);
  const human = humanKind(text, parsed, classification);
  const unknown = classification.failure_kind === 'unknown'
    || (classification.category === 'unknown' && !classification.failure_kind);

  // Runtime server crash without Mod File: — primary_mod correctness target
  const runtimeNoModFile = name.includes('-server.txt')
    && !parsed.mod_file
    && stackHasTransformers(text)
    && !watchdog;

  const primaryOk = runtimeNoModFile
    ? !!(classification.primary_mod_id || parsed.primary_mod_id)
    : null;

  // Only credit pregen stall when the STACK (not the mod list) cites map/pregen mods.
  const stackHead = (text.match(/^\tat .+$/gm) || []).slice(0, 40).join('\n');
  const stallExpected = watchdog && /TRANSFORMER\/(squaremap|chunky|bluemap)@/i.test(stackHead);
  const stallOk = stallExpected
    ? !!(classification.stall_mod_id || classification.failure_kind === 'watchdog_pregen')
    : null;

  return {
    file: name,
    type: name.includes('-fml') ? 'fml' : name.includes('-server') ? 'server' : 'other',
    human_failure_kind: human,
    failure_kind: classification.failure_kind || classification.category,
    category: classification.category,
    primary_mod_id: classification.primary_mod_id || parsed.primary_mod_id || null,
    stall_mod_id: classification.stall_mod_id || null,
    suspect_mod_id: classification.suspect_mod_id || null,
    watchdog,
    watchdog_tick_ms: watchdogMs,
    watchdog_ms_parsed: watchdog ? watchdogMs != null : null,
    runtime_no_mod_file: runtimeNoModFile,
    primary_mod_ok: primaryOk,
    stall_expected: stallExpected,
    stall_ok: stallOk,
    engine_unknown: unknown,
    description: (parsed.description || '').slice(0, 80),
    exception: (parsed.exception || '').slice(0, 120),
  };
}

function pct(num, den) {
  if (!den) return 0;
  return Math.round((num / den) * 1000) / 10;
}

function main() {
  if (!existsSync(CRASH_DIR)) {
    console.error('Missing fixtures/crashlogs — junction or copy the local corpus first.');
    process.exit(1);
  }
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const files = readdirSync(CRASH_DIR).filter((f) => f.startsWith('crash-') && f.endsWith('.txt')).sort();
  const allRows = files.map(analyzeFile);
  const empty = allRows.filter((r) => r.empty);
  const rows = allRows.filter((r) => !r.empty);

  const total = rows.length;
  const unknown = rows.filter((r) => r.engine_unknown).length;
  const watchdogs = rows.filter((r) => r.watchdog);
  const watchdogParsed = watchdogs.filter((r) => r.watchdog_ms_parsed);
  const runtimeTargets = rows.filter((r) => r.runtime_no_mod_file);
  const runtimePrimaryOk = runtimeTargets.filter((r) => r.primary_mod_ok);
  const stallTargets = rows.filter((r) => r.stall_expected);
  const stallOk = stallTargets.filter((r) => r.stall_ok);

  const kindCounts = {};
  for (const r of rows) {
    kindCounts[r.failure_kind] = (kindCounts[r.failure_kind] || 0) + 1;
  }
  const humanCounts = {};
  for (const r of rows) {
    humanCounts[r.human_failure_kind] = (humanCounts[r.human_failure_kind] || 0) + 1;
  }

  const gates = {
    unknown_rate_pct: pct(unknown, total),
    unknown_rate_target: 10,
    unknown_rate_pass: pct(unknown, total) < 10,
    watchdog_parsed: `${watchdogParsed.length}/${watchdogs.length}`,
    watchdog_parsed_pct: pct(watchdogParsed.length, watchdogs.length),
    watchdog_parsed_pass: watchdogs.length === 0 || watchdogParsed.length === watchdogs.length,
    runtime_primary_ok: `${runtimePrimaryOk.length}/${runtimeTargets.length}`,
    runtime_primary_pct: pct(runtimePrimaryOk.length, runtimeTargets.length),
    runtime_primary_pass: runtimeTargets.length === 0 || pct(runtimePrimaryOk.length, runtimeTargets.length) > 90,
    stall_mod_ok: `${stallOk.length}/${stallTargets.length}`,
    stall_mod_pct: pct(stallOk.length, stallTargets.length),
    stall_mod_pass: stallTargets.length === 0 || pct(stallOk.length, stallTargets.length) > 80,
  };

  const stillUnknown = rows.filter((r) => r.engine_unknown).slice(0, 40).map((r) => ({
    file: r.file,
    human: r.human_failure_kind,
    description: r.description,
    exception: r.exception,
  }));

  const runtimeMisses = runtimeTargets.filter((r) => !r.primary_mod_ok).slice(0, 30).map((r) => ({
    file: r.file,
    human: r.human_failure_kind,
    description: r.description,
  }));

  const watchdogMisses = watchdogs.filter((r) => !r.watchdog_ms_parsed).map((r) => r.file);
  const stallMisses = stallTargets.filter((r) => !r.stall_ok).map((r) => ({
    file: r.file,
    failure_kind: r.failure_kind,
    stall_mod_id: r.stall_mod_id,
  }));

  // Reference cases from 1.0.13 spec
  const refs = {
    'create-npe': 'crash-2026-04-21_21.35.01-server.txt',
    'nbt-corrupt': 'crash-2026-05-16_04.55.25-server.txt',
    'watchdog-seconds': 'crash-2026-05-25_02.26.09-server.txt',
    'watchdog-pregen-ish': 'crash-2026-05-31_00.54.39-server.txt',
    'paired-watchdog': 'crash-2026-04-21_21.36.03-server.txt',
  };
  const reference = {};
  for (const [label, file] of Object.entries(refs)) {
    const hit = rows.find((r) => r.file === file);
    reference[label] = hit || { missing: true, file };
  }

  const report = {
    schema: 'crash-intel-1013-audit-v1',
    generated_at: new Date().toISOString(),
    corpus_size: total,
    empty_files_skipped: empty.map((e) => e.file),
    note: 'Local corpus is 147 files (1 empty skipped). Spec cited 250 — this Copy tree is the available set. Watchdog count here is 62 (spec cited 126).',
    gates,
    failure_kind_counts: kindCounts,
    human_failure_kind_counts: humanCounts,
    reference_cases: reference,
    still_unknown_sample: stillUnknown,
    runtime_primary_misses: runtimeMisses,
    watchdog_parse_misses: watchdogMisses,
    stall_misses: stallMisses,
  };

  writeFileSync(join(OUT_DIR, 'coverage-post-1013-report.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(OUT_DIR, 'coverage-post-1013-rows.json'), JSON.stringify({ count: total, files: rows }, null, 2));

  const csvIdx = process.argv.indexOf('--csv');
  const csvPath = csvIdx >= 0
    ? (process.argv[csvIdx + 1] || join(OUT_DIR, 'coverage-post-1013.csv'))
    : join(OUT_DIR, 'coverage-post-1013.csv');
  const header = 'file,type,human_kind,failure_kind,category,primary_mod_id,stall_mod_id,watchdog,watchdog_tick_ms,engine_unknown,runtime_primary_ok\n';
  const csvRows = rows.map((r) => [
    r.file, r.type, r.human_failure_kind, r.failure_kind, r.category,
    r.primary_mod_id || '', r.stall_mod_id || '', r.watchdog, r.watchdog_tick_ms ?? '',
    r.engine_unknown, r.primary_mod_ok ?? '',
  ].join(',')).join('\n');
  writeFileSync(csvPath, header + csvRows);

  const pass = gates.unknown_rate_pass
    && gates.watchdog_parsed_pass
    && gates.runtime_primary_pass
    && gates.stall_mod_pass;

  console.log('=== 1.0.13 crash corpus deep audit (real DR classifier) ===');
  console.log(`corpus: ${total} non-empty crash files` + (empty.length ? ` (${empty.length} empty skipped)` : ''));
  console.log(`unknown rate:     ${gates.unknown_rate_pct}% (${unknown}/${total})  gate <10%  ${gates.unknown_rate_pass ? 'PASS' : 'FAIL'}`);
  console.log(`watchdog ms:      ${gates.watchdog_parsed}  ${gates.watchdog_parsed_pass ? 'PASS' : 'FAIL'}`);
  console.log(`runtime primary:  ${gates.runtime_primary_ok} (${gates.runtime_primary_pct}%)  gate >90%  ${gates.runtime_primary_pass ? 'PASS' : 'FAIL'}`);
  console.log(`stall_mod when pregen stack: ${gates.stall_mod_ok} (${gates.stall_mod_pct}%)  gate >80%  ${gates.stall_mod_pass ? 'PASS' : 'FAIL'}`);
  console.log('failure_kind counts:', kindCounts);
  console.log('reference cases:');
  for (const [k, v] of Object.entries(reference)) {
    if (v.missing) console.log(`  ${k}: MISSING ${v.file}`);
    else console.log(`  ${k}: kind=${v.failure_kind} primary=${v.primary_mod_id} stall=${v.stall_mod_id} ms=${v.watchdog_tick_ms}`);
  }
  if (stillUnknown.length) {
    console.log(`still unknown sample (${stillUnknown.length} shown):`);
    for (const u of stillUnknown.slice(0, 12)) {
      console.log(`  - ${u.file} human=${u.human} :: ${(u.exception || u.description || '').slice(0, 90)}`);
    }
  } else {
    console.log('still unknown: none');
  }
  console.log(`csv: ${csvPath}`);
  console.log(`report: ${join(OUT_DIR, 'coverage-post-1013-report.json')}`);
  console.log(pass ? 'OVERALL: PASS' : 'OVERALL: FAIL — see misses in report JSON');
  process.exit(pass ? 0 : 2);
}

main();
