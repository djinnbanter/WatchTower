#!/usr/bin/env node
/**
 * Deep audit of fixtures/server-logs/ — corpus v2 log harness.
 *
 * Usage: node tools/analyze-log-corpus.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOG_DIR = join(ROOT, 'fixtures', 'server-logs');
const CRASH_DIR = join(ROOT, 'fixtures', 'crashlogs');
const OUT_DIR = join(ROOT, 'fixtures', 'corpus-audit-v2');
const SHARDS_MD = join(LOG_DIR, '_shards.md');

const LOG_TS = /^\[(\d{2}[A-Za-z]{3}\d{4} \d{2}:\d{2}:\d{2}\.\d{3})\]/;

// Mirrors ModErrorCategory.classify (subset)
function modErrorCategory(line) {
  if (!line || line.includes('dev.mcstatus.watchtower')) return 'engine_packaging';
  if (line.includes('Attempted to load class net/minecraft/client')) return 'client_on_server';
  if (/provided by mod\s+(\w+)/i.test(line) && /does not exist/i.test(line)) return 'mod_corrupt';
  if (/Mod loading has failed|ModLoadingCrashException/i.test(line)) return 'mod_load_failed';
  if (/Parsing error loading recipe/i.test(line)) return 'recipe_missing_item';
  if (/Unknown item '/i.test(line)) return 'recipe_missing_item';
  if (/is not found from registry/i.test(line)) return 'registry_missing';
  if (/Couldn't parse element ResourceKey/i.test(line)) return 'loot_parse';
  if (/ingredient_serializer/i.test(line)) return 'recipe_format';
  if (/\/(ERROR|FATAL)\]/i.test(line)) {
    const m = line.match(/\/(ERROR|FATAL)\]\s*\[([^/\]]+)\//i);
    if (m) {
      let mod = m[2].toLowerCase();
      if (mod.includes('.')) mod = mod.slice(mod.lastIndexOf('.') + 1);
      if (!mod.startsWith('net.minecraft') && !mod.startsWith('net.neoforged') && !mod.startsWith('cpw.mods')) {
        return 'logger_error';
      }
    }
  }
  return null;
}

const PATTERN_RULES = [
  { id: 'tick_lag_cant_keep_up', re: /Can't keep up/i, cat: 'tick_lag', logscanner: 'cant_keep_up_*' },
  { id: 'tick_lag_ms_behind', re: /Running \d+ms or \d+ ticks behind/i, cat: 'tick_lag', logscanner: 'tick_lag_evidence' },
  { id: 'watchdog_fatal', re: /Server Watchdog\/FATAL|single server tick took \d+\.?\d* seconds/i, cat: 'watchdog', logscanner: 'none' },
  { id: 'shtreimel_lag', re: /shtreimel\.lag.*ewma=/i, cat: 'tick_lag', logscanner: 'none' },
  { id: 'oom_heap', re: /OutOfMemoryError|Java heap space/i, cat: 'oom', logscanner: 'oom_evidence' },
  { id: 'chunky_pregen', re: /\[Chunky\] Task running|\[Server thread\/INFO\].*\[Chunky\]/i, cat: 'pregen_chunky', logscanner: 'none', bootNoise: /ModDiscoverer\/SCAN.*Chunky/i },
  { id: 'squaremap_render', re: /squaremap-render|squaremap\/.*render|VanillaChunkSnapshotProvider/i, cat: 'pregen_squaremap', logscanner: 'none', bootNoise: /ModDiscoverer\/SCAN.*squaremap/i },
  { id: 'bluemap_render', re: /\[BlueMap\/\]:|Baking resources|Loading map .* for/i, cat: 'map_render', logscanner: 'none', bootNoise: /ModDiscoverer\/SCAN.*bluemap/i },
  { id: 'distant_horizons', re: /Distant Horizons|dh_|Generated radius:/i, cat: 'pregen_dh', logscanner: 'dh_pregen' },
  { id: 'create_contraption', re: /\/(ERROR|FATAL)\].*(ContinuousOBBCollider|mf\.axis is null|LecternControllerBlockEntity)/i, cat: 'mod_runtime', logscanner: 'none' },
  { id: 'kubejs_script', re: /\/(ERROR|FATAL)\].*(kubejs|StartupScripts|startup script|ScriptSyntax)/i, cat: 'kubejs', logscanner: 'none', bootNoise: /ModDiscoverer\/SCAN.*kubejs|Added bindings for script type/i },
  { id: 'modpack_update', re: /Modpack update! Update your modpack/i, cat: 'panel', logscanner: 'none' },
  { id: 'mod_version_missing', re: /\(version .* -> MISSING\)/i, cat: 'mod_load', logscanner: 'none' },
  { id: 'login_disconnect_storm', re: /lost connection: Disconnected/i, cat: 'network', logscanner: 'none' },
  { id: 'server_done', re: /Done \(\d+\.?\d*s\)! For help/i, cat: 'lifecycle', logscanner: 'server_started' },
  { id: 'server_stop', re: /Stopping server/i, cat: 'lifecycle', logscanner: 'clean_shutdown' },
  { id: 'watchdog_precursor', re: /Can't keep up.*\d{4,}/i, cat: 'watchdog_precursor', logscanner: 'tick_lag_evidence' },
  { id: 'panel_restart', re: /restart_server|start_server|kill_server/i, cat: 'panel', logscanner: 'none' },
];

function parseShards(md) {
  const shards = {};
  let current = null;
  for (const line of md.split(/\r?\n/)) {
    const h = line.match(/^## Shard (L\d) —/);
    if (h) {
      current = h[1];
      shards[current] = [];
      continue;
    }
    if (current && line.endsWith('.log')) shards[current].push(line.trim());
  }
  return shards;
}

function parseLogTimestamp(line) {
  const m = line.match(LOG_TS);
  if (!m) return null;
  const raw = m[1];
  const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  const p = raw.match(/^(\d{2})([A-Za-z]{3})(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
  if (!p) return null;
  const mo = months[p[2]] || '01';
  return `${p[3]}-${mo}-${p[1]}T${p[4]}:${p[5]}:${p[6]}`;
}

async function analyzeLogFile(filename) {
  const path = join(LOG_DIR, filename);
  const counts = {
    error_lines: 0,
    fatal_lines: 0,
    cant_keep_up: 0,
    player_joins: 0,
    mod_error_category_hits: {},
    uncategorized_error_lines: 0,
  };
  const patterns = {};
  const patternSamples = {};
  let lineCount = 0;
  let firstTs = null;
  let lastTs = null;
  let containsFullBoot = false;
  let containsCleanShutdown = false;
  const bootIssues = [];
  const runtimeThemes = new Set();
  const tailEvents = [];

  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  const lines = [];
  for await (const line of rl) {
    lines.push(line);
  }
  lineCount = lines.length;

  let doneLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ts = parseLogTimestamp(line);
    if (ts) {
      if (!firstTs) firstTs = ts;
      lastTs = ts;
    }
    if (/Done \(\d/.test(line) && line.includes('/INFO]')) {
      containsFullBoot = true;
      doneLineIndex = i;
    }
    if (line.includes('Stopping server')) containsCleanShutdown = true;

    if (/\/ERROR\]/i.test(line)) {
      counts.error_lines++;
      const cat = modErrorCategory(line);
      if (cat) {
        counts.mod_error_category_hits[cat] = (counts.mod_error_category_hits[cat] || 0) + 1;
      } else {
        counts.uncategorized_error_lines++;
      }
    }
    if (/\/FATAL\]/i.test(line)) counts.fatal_lines++;
    if (/Can't keep up/i.test(line)) counts.cant_keep_up++;
    if (/joined the game/i.test(line) || /\[\+\]\s+\S/.test(line) || /logged in with entity id/i.test(line)) {
      counts.player_joins++;
    }

    for (const rule of PATTERN_RULES) {
      if (!rule.re.test(line)) continue;
      if (rule.bootNoise?.test(line)) continue;
      patterns[rule.id] = (patterns[rule.id] || 0) + 1;
      if (!patternSamples[rule.id]) {
        patternSamples[rule.id] = { line_no: i + 1, sample: line.slice(0, 200) };
      }
      if (rule.cat.startsWith('pregen') || rule.cat === 'tick_lag') runtimeThemes.add(rule.cat);
      if (i < 500 && rule.cat !== 'lifecycle') bootIssues.push(rule.id);
      if (i >= lines.length - 300) tailEvents.push(rule.id);
    }
  }

  const durationHours = firstTs && lastTs
    ? Math.round((new Date(lastTs) - new Date(firstTs)) / 3600000 * 10) / 10
    : null;

  const patternEntries = Object.entries(patterns).map(([id, freq]) => {
    const rule = PATTERN_RULES.find((r) => r.id === id);
    const sample = patternSamples[id];
    const cat = modErrorCategory(sample?.sample || '');
    return {
      pattern_id: id,
      log_file: filename,
      line_no: sample?.line_no,
      line_sample: sample?.sample?.slice(0, 200) || '',
      pattern_category: rule?.cat || 'unknown',
      mod_id_guess: guessModFromLine(sample?.sample || ''),
      frequency_in_file: freq,
      moderrorcategory_match: cat,
      logscanner_would_capture: rule?.logscanner || 'none',
      operator_severity: severityFor(id, freq),
      should_be_issue: shouldBeIssue(id),
      should_be_activity_event: ['tick_lag_cant_keep_up', 'panel_restart', 'chunky_pregen'].includes(id),
      false_positive_risk: rule.bootNoise ? 'high' : id === 'watchdog_precursor' ? 'medium' : 'low',
      suggested_engine_home: homeFor(id),
      suggested_rule_sketch: rule?.re?.source || id,
      operator_headline: headlineFor(id),
    };
  });

  const engineGaps = patternEntries
    .filter((p) => p.logscanner_would_capture === 'none' && p.should_be_issue)
    .slice(0, 10)
    .map((p) => ({ pattern_id: p.pattern_id, fix: `Add ${p.suggested_engine_home} rule for ${p.pattern_id}` }));

  let goldenExcerpt = null;
  const topGap = patternEntries.find((p) => p.logscanner_would_capture === 'none' && p.operator_severity >= 4);
  if (topGap && topGap.line_no) {
    goldenExcerpt = {
      start: Math.max(1, topGap.line_no - 2),
      end: topGap.line_no + 2,
      why: topGap.operator_headline,
    };
  }

  return {
    log_file: filename,
    line_count: lineCount,
    time_start: firstTs,
    time_end: lastTs,
    duration_hours: durationHours,
    contains_full_boot: containsFullBoot,
    contains_clean_shutdown: containsCleanShutdown,
    session_phases: {
      boot_issues: [...new Set(bootIssues)].slice(0, 8),
      runtime_themes: [...runtimeThemes],
      tail_events: [...new Set(tailEvents)].slice(0, 8),
    },
    counts,
    patterns: patternEntries,
    engine_gaps: engineGaps,
    golden_log_excerpt_lines: goldenExcerpt,
  };
}

function guessModFromLine(line) {
  const m = line.match(/\[([a-z][\w-]+)\//i);
  if (m && !['Server thread', 'main'].includes(m[1])) return m[1].toLowerCase();
  if (/create/i.test(line)) return 'create';
  if (/kubejs/i.test(line)) return 'kubejs';
  if (/chunky/i.test(line)) return 'chunky';
  if (/squaremap/i.test(line)) return 'squaremap';
  return null;
}

function severityFor(id, freq) {
  if (id === 'oom_heap' || id === 'watchdog_fatal') return 5;
  if (id.startsWith('tick_lag') || id === 'watchdog_precursor' || id === 'shtreimel_lag') return 4;
  if (id.includes('pregen') || id.includes('map')) return 3;
  return freq > 10 ? 3 : 2;
}

function shouldBeIssue(id) {
  return !['server_done', 'server_stop', 'lifecycle'].includes(id) && !id.startsWith('panel');
}

function homeFor(id) {
  if (id === 'chunky_pregen') return 'ChunkyScanner(new)';
  if (id.includes('squaremap') || id.includes('bluemap')) return 'LogScanner';
  if (id.includes('create')) return 'ModErrorCategory';
  if (id.includes('tick')) return 'LogScanner';
  return 'LogScanner';
}

function headlineFor(id) {
  const map = {
    chunky_pregen: 'Chunky world pregen active — monitor for stall during heavy gen',
    squaremap_render: 'squaremap rendering chunks — can block main thread',
    tick_lag_cant_keep_up: 'Server cannot keep up with tick rate',
    create_contraption: 'Create contraption error in logs',
    kubejs_script: 'KubeJS script error during load',
    oom_heap: 'Out of memory in server logs',
    watchdog_precursor: 'Sustained tick lag may precede watchdog crash',
  };
  return map[id] || `Pattern ${id} detected in logs`;
}

function linkCrashes(logEntry) {
  if (!logEntry.time_start || !logEntry.time_end) return [];
  const start = new Date(logEntry.time_start).getTime();
  const end = new Date(logEntry.time_end).getTime();
  const linked = [];
  try {
    const crashes = readdirSync(CRASH_DIR).filter((f) => f.startsWith('crash-') && f.endsWith('.txt'));
    for (const c of crashes) {
      const m = c.match(/crash-(\d{4}-\d{2}-\d{2})_(\d{2})\.(\d{2})/);
      if (!m) continue;
      const t = new Date(`${m[1]}T${m[2]}:${m[3]}:00`).getTime();
      if (t >= start - 60000 && t <= end + 60000) linked.push(c);
    }
  } catch {
    /* ignore */
  }
  return linked.slice(0, 5);
}

function shardSummary(shardId, logs) {
  let errorTotal = 0;
  let uncatTotal = 0;
  const patternTotals = {};
  const catHits = {};

  for (const log of logs) {
    errorTotal += log.counts.error_lines;
    uncatTotal += log.counts.uncategorized_error_lines;
    for (const [k, v] of Object.entries(log.counts.mod_error_category_hits)) {
      catHits[k] = (catHits[k] || 0) + v;
    }
    for (const p of log.patterns) {
      patternTotals[p.pattern_id] = (patternTotals[p.pattern_id] || 0) + p.frequency_in_file;
    }
  }

  const topPatterns = Object.entries(patternTotals).sort((a, b) => b[1] - a[1]).slice(0, 30);

  return {
    shard: shardId,
    error_line_total: errorTotal,
    uncategorized_error_total: uncatTotal,
    uncategorized_pct: errorTotal ? Math.round((uncatTotal / errorTotal) * 1000) / 10 : 0,
    top_pattern_ids: Object.fromEntries(topPatterns),
    moderrorcategory_hits: catHits,
    top_engine_gaps: logs.flatMap((l) => l.engine_gaps).slice(0, 15),
    golden_excerpts: logs.filter((l) => l.golden_log_excerpt_lines).map((l) => ({
      file: l.log_file,
      ...l.golden_log_excerpt_lines,
    })),
    crash_cross_refs: logs.map((l) => ({ log: l.log_file, crashes: linkCrashes(l) })).filter((x) => x.crashes.length),
  };
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const shards = parseShards(readFileSync(SHARDS_MD, 'utf8'));
  const allLogs = [];

  for (const [shardId, files] of Object.entries(shards)) {
    const logs = [];
    for (const f of files) {
      const entry = await analyzeLogFile(f);
      entry.linked_crash_files = linkCrashes(entry);
      logs.push(entry);
      allLogs.push(entry);
    }
    const out = {
      shard: shardId,
      files_analyzed: logs.length,
      logs,
      incidents: [],
      shard_summary: shardSummary(shardId, logs),
    };
    writeFileSync(join(OUT_DIR, `shard-${shardId}.json`), JSON.stringify(out, null, 2));
  }

  let errTotal = 0;
  let uncatTotal = 0;
  for (const l of allLogs) {
    errTotal += l.counts.error_lines;
    uncatTotal += l.counts.uncategorized_error_lines;
  }

  writeFileSync(
    join(OUT_DIR, 'log-corpus.json'),
    JSON.stringify({
      count: allLogs.length,
      error_line_total: errTotal,
      uncategorized_error_total: uncatTotal,
      uncategorized_pct: errTotal ? Math.round((uncatTotal / errTotal) * 1000) / 10 : 0,
      logs: allLogs,
    }, null, 2),
  );

  console.log(`analyze-log-corpus OK — ${allLogs.length} log files`);
  console.log(`  uncategorized ERROR: ${uncatTotal}/${errTotal} (${errTotal ? Math.round((uncatTotal / errTotal) * 100) : 0}%)`);
}

main();
