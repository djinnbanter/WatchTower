/**
 * Port of LogScanner (DR subset) — latest.log tail scan.
 * 1.0.13: Done duration, map_render, startup_profile, fml_issues.
 */
import { aggregateModLogErrors } from './modErrorCategory.js';
import { parseFmlIssues } from './fmlIssueParser.js';
import { scanStartupProfile } from './startupProfileScanner.js';

const LOG_TIME_RE = /^\[(\d{2}\w{3}\d{4} \d{2}:\d{2}:\d{2}(?:\.\d+)?)\]/;
const SERVER_STARTED_RE = /Done \((\d+\.?\d*)s\)! For help, type "help"/i;
const DONE_DURATION_RE = /Done \(([\d.]+)s\)!/i;
const CLEAN_SHUTDOWN_RE = /Stopping server/i;
const OOM_RE = /OutOfMemoryError|java\.heap\.space|GC overhead limit/i;
const SQUAREMAP_RUNTIME_RE = /squaremap/i;
const SQUAREMAP_RUNTIME_ACTION = /FullRender|render|UpdatePlayers|task|queue depth/i;
const BLUEMAP_RUNTIME_RE = /bluemap/i;
const BLUEMAP_RUNTIME_ACTION = /render|update|task|FullRender/i;
const MOD_DISCOVERER_SCAN = /ModDiscoverer|SCAN/i;
const MAX_LINES = 15000;

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

function tailLines(content, maxLines = MAX_LINES) {
  const lines = content.split(/\r?\n/);
  if (lines.length <= maxLines) return lines;
  return lines.slice(lines.length - maxLines);
}

function isMapRenderRuntime(line) {
  if (!line || MOD_DISCOVERER_SCAN.test(line)) return null;
  if (SQUAREMAP_RUNTIME_RE.test(line) && SQUAREMAP_RUNTIME_ACTION.test(line)) {
    return 'squaremap';
  }
  if (BLUEMAP_RUNTIME_RE.test(line) && BLUEMAP_RUNTIME_ACTION.test(line)) {
    return 'bluemap';
  }
  return null;
}

/**
 * @param {{ name: string, content: string }[]} logFiles — prefer latest.log
 * @param {{ previousTotalSec?: number|null }} [opts]
 */
export function scanLogs(logFiles, opts = {}) {
  const mc = {
    log_had_activity_in_window: false,
    clean_shutdown_seen: false,
    oom_in_logs: false,
    cant_keep_up_count: 0,
    new_crash_reports: [],
    tick_lag_evidence: [],
    oom_evidence: [],
    worst_tick_lag_ms: 0,
  };
  const events = [];
  let allLines = [];
  let primaryLog = 'logs/latest.log';

  const sorted = [...logFiles].sort((a, b) => {
    const aLatest = a.name.includes('latest.log') ? 0 : 1;
    const bLatest = b.name.includes('latest.log') ? 0 : 1;
    return aLatest - bLatest || a.name.localeCompare(b.name);
  });

  for (const f of sorted) {
    const lines = tailLines(f.content);
    allLines = allLines.concat(lines);
    if (f.name.includes('latest.log')) primaryLog = f.name;
  }

  let maxTs = null;
  let maxLine = '';
  let maxLineNo = 0;
  let serverStarted = null;
  let errorCount = 0;
  let doneDurationSec = null;
  let mapRender = null;
  let sawFmlIssue = false;

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const ts = parseLogTimestamp(line);
    if (ts && (!maxTs || ts > maxTs)) {
      maxTs = ts;
      maxLine = line.length > 300 ? line.slice(0, 300) : line;
      maxLineNo = i + 1;
    }
    const doneMatch = SERVER_STARTED_RE.exec(line) || DONE_DURATION_RE.exec(line);
    if (doneMatch) {
      serverStarted = ts || new Date().toISOString();
      const sec = Number.parseFloat(doneMatch[1]);
      if (Number.isFinite(sec)) {
        doneDurationSec = Math.round(sec * 10) / 10;
      }
    }
    if (CLEAN_SHUTDOWN_RE.test(line)) mc.clean_shutdown_seen = true;
    if (OOM_RE.test(line)) {
      mc.oom_in_logs = true;
      mc.oom_evidence.push({ time: ts, line: line.slice(0, 200) });
    }
    if (line.includes("Can't keep up!")) mc.cant_keep_up_count++;
    if (line.includes('[ERROR]') || line.includes('[FATAL]')) errorCount++;
    if (line.includes('Mod loading has failed') || line.includes('Failed to start the minecraft server')) {
      mc.log_had_activity_in_window = true;
    }
    if (line.includes('Mod loading issue')) sawFmlIssue = true;

    const mapSrc = isMapRenderRuntime(line);
    if (mapSrc) {
      mapRender = {
        active: true,
        source: mapSrc,
        last_line: line.length > 240 ? line.slice(0, 240) : line,
        time: ts,
      };
    }
  }

  if (allLines.length > 0) mc.log_had_activity_in_window = true;

  if (maxLine) {
    mc.last_log_line = maxLine;
    mc.last_log_file = primaryLog;
    mc.last_log_line_no = maxLineNo;
  }
  if (maxTs) {
    mc.last_log_time = maxTs;
    const gapMin = (Date.now() - new Date(maxTs).getTime()) / 60000;
    mc.health_log_gap_minutes = Math.min(Math.max(gapMin, 0), 9999);
  }
  if (serverStarted) mc.server_started = serverStarted;
  if (doneDurationSec != null) mc.done_duration_sec = doneDurationSec;

  const modLogErrors = aggregateModLogErrors(allLines);
  const startupProfile = scanStartupProfile(allLines, {
    previousTotalSec: opts.previousTotalSec ?? null,
  });
  const fmlIssues = sawFmlIssue ? parseFmlIssues(allLines.join('\n')) : [];

  return {
    minecraft: mc,
    modLogErrors,
    events,
    health_log_gap_minutes: mc.health_log_gap_minutes ?? null,
    logPath: primaryLog,
    allLines,
    mapRender,
    startupProfile,
    fmlIssues,
  };
}
