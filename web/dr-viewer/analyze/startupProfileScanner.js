/**
 * Port of StartupProfileScanner.java subset (S-01..S-06).
 * Boot window = start → Done (Xs)!; non-fatal boot errors get blocking:false when Done reached.
 */

const DONE_RE = /Done \(([\d.]+)s\)!/i;
const LOG_TIME_RE = /^\[(\d{2}\w{3}\d{4} \d{2}:\d{2}:\d{2}(?:\.\d+)?)\]/;

const PHASE_MARKERS = [
  { id: 'construct', label: 'Mod construct', match: /ModLauncher starting|FMLServiceProvider|NeoForge version/i },
  { id: 'registry', label: 'Registry freeze', match: /Freezing registries|Registry freeze complete/i },
  { id: 'common_setup', label: 'Common setup', match: /FMLCommonSetupEvent|Common setup/i },
  { id: 'datapack', label: 'Datapack / loot load', match: /Couldn't parse element ResourceKey|Preparing start region/i },
];

const WARNING_PATTERNS = [
  { id: 'loot_parse', substring: "Couldn't parse element ResourceKey" },
  { id: 'recipe_parse', substring: 'Parsing error loading recipe' },
  { id: 'registry_missing', substring: 'is not found from registry' },
  { id: 'client_on_server', substring: 'Attempted to load class net/minecraft/client' },
];

const PROVIDED_BY_MOD = /provided by mod\s+(\w+)/i;
const MOD_LOADING = /Mod\s+\(([^)]+)\)/i;

function parseLogTimestamp(line) {
  const m = LOG_TIME_RE.exec(line);
  if (!m) return null;
  try {
    const d = new Date(m[1].replace(/(\d{2})(\w{3})(\d{4})/, '$2 $1 $3'));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

function detectBootError(line) {
  if (!line) return null;
  const lower = line.toLowerCase();
  const provided = PROVIDED_BY_MOD.exec(line);
  if (provided && lower.includes('does not exist')) {
    return { mod_id: provided[1].trim(), kind: 'mod_corrupt' };
  }
  if (/Mod loading has failed|ModLoadingCrashException/i.test(line)) {
    const mod = MOD_LOADING.exec(line);
    return { mod_id: mod ? mod[1].trim() : 'unknown', kind: 'mod_load_failed' };
  }
  if (lower.includes('corrupt') && /\[(?:ERROR|FATAL|WARN)\]/i.test(line)) {
    const pride = /\b(pride|[\w-]+)\b.*corrupt|corrupt.*\b(pride|[\w-]+)\b/i.exec(line);
    if (pride) {
      return { mod_id: (pride[1] || pride[2] || 'unknown').toLowerCase(), kind: 'mod_corrupt' };
    }
  }
  // Access transformer missing / non-blocking load warnings
  if (/Access transformer file .+ provided by mod (\w+)/i.test(line)
    || /Mod (\w+) reported non-blocking/i.test(line)) {
    const m = /(?:provided by mod|Mod)\s+(\w+)/i.exec(line);
    return { mod_id: m ? m[1].trim().toLowerCase() : 'unknown', kind: 'mod_corrupt' };
  }
  return null;
}

/**
 * @param {string[]} lines
 * @param {{ previousTotalSec?: number|null }} [opts]
 */
export function scanStartupProfile(lines, opts = {}) {
  const list = Array.isArray(lines) ? lines : String(lines || '').split(/\r?\n/);
  const warningCounts = Object.fromEntries(WARNING_PATTERNS.map((p) => [p.id, 0]));
  const errorsByMod = new Map();
  const phaseHits = [];
  let totalSec = null;
  let doneAt = null;
  let doneReached = false;
  let bootLineCount = 0;

  for (const line of list) {
    if (!doneReached) bootLineCount++;

    const done = DONE_RE.exec(line);
    if (done && !doneReached) {
      totalSec = Math.round(Number.parseFloat(done[1]) * 10) / 10;
      doneAt = parseLogTimestamp(line);
      doneReached = true;
    }

    if (!doneReached || done) {
      for (const marker of PHASE_MARKERS) {
        if (marker.match.test(line) && !phaseHits.some((p) => p.id === marker.id)) {
          phaseHits.push({
            id: marker.id,
            label: marker.label,
            line_index: bootLineCount,
            ts: parseLogTimestamp(line),
          });
        }
      }
      for (const wp of WARNING_PATTERNS) {
        if (line.includes(wp.substring)) warningCounts[wp.id]++;
      }
      const err = detectBootError(line);
      if (err) {
        const key = `${err.mod_id}:${err.kind}`;
        if (!errorsByMod.has(key)) {
          errorsByMod.set(key, { mod_id: err.mod_id, kind: err.kind });
        }
      }
    }

    if (doneReached && done) {
      // include Done line in boot window only; stop collecting new boot errors after
    }
  }

  // Estimate phase durations from log timestamps when available
  const phases = [];
  for (let i = 0; i < phaseHits.length; i++) {
    const cur = phaseHits[i];
    const next = phaseHits[i + 1];
    let sec = null;
    if (cur.ts && next?.ts) {
      sec = Math.round(((new Date(next.ts) - new Date(cur.ts)) / 1000) * 10) / 10;
    } else if (cur.ts && doneAt && i === phaseHits.length - 1) {
      sec = Math.round(((new Date(doneAt) - new Date(cur.ts)) / 1000) * 10) / 10;
    } else if (totalSec != null && phaseHits.length) {
      sec = Math.round((totalSec / phaseHits.length) * 10) / 10;
    }
    const row = { id: cur.id, label: cur.label };
    if (sec != null && Number.isFinite(sec) && sec >= 0) row.sec = sec;
    phases.push(row);
  }

  const withSec = phases.filter((p) => p.sec != null).sort((a, b) => b.sec - a.sec);
  const slowest = withSec.slice(0, 3).map((p) => ({ phase: p.id, sec: p.sec }));

  const warnings = WARNING_PATTERNS
    .filter((p) => warningCounts[p.id] > 0)
    .map((p) => ({ id: p.id, count: warningCounts[p.id] }));

  const errors = [...errorsByMod.values()].map((e) => ({
    mod_id: e.mod_id,
    kind: e.kind,
    blocking: doneReached ? false : true,
  }));

  let status = 'ok';
  if (errors.some((e) => e.blocking)) status = 'errors';
  else if (warnings.length || errors.length) status = 'warnings';
  else if (totalSec == null) status = 'incomplete';

  const profile = {
    total_sec: totalSec,
    done_at: doneAt,
    status,
    phases,
    slowest,
    warnings,
    errors,
  };

  const prev = opts.previousTotalSec;
  if (prev != null && Number.isFinite(prev) && totalSec != null) {
    const delta = Math.round((totalSec - prev) * 10) / 10;
    profile.compare_to_last_boot = {
      delta_sec: delta,
      direction: delta > 0.5 ? 'slower' : delta < -0.5 ? 'faster' : 'similar',
    };
  }

  return profile;
}
