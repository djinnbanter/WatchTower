/**
 * Port of LogScanner (DR subset) — latest.log tail scan.
 */
import { aggregateModLogErrors } from './modErrorCategory.js';

const LOG_TIME_RE = /^\[(\d{2}\w{3}\d{4} \d{2}:\d{2}:\d{2}(?:\.\d+)?)\]/;
const SERVER_STARTED_RE = /Done \((\d+\.?\d*)s\)! For help, type "help"/i;
const CLEAN_SHUTDOWN_RE = /Stopping server/i;
const OOM_RE = /OutOfMemoryError|java\.heap\.space|GC overhead limit/i;
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

/**
 * @param {{ name: string, content: string }[]} logFiles — prefer latest.log
 */
export function scanLogs(logFiles) {
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

  linesLoop: for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const ts = parseLogTimestamp(line);
    if (ts && (!maxTs || ts > maxTs)) {
      maxTs = ts;
      maxLine = line.length > 300 ? line.slice(0, 300) : line;
      maxLineNo = i + 1;
    }
    if (SERVER_STARTED_RE.test(line)) {
      serverStarted = ts || new Date().toISOString();
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

  const modLogErrors = aggregateModLogErrors(allLines);

  return {
    minecraft: mc,
    modLogErrors,
    events,
    health_log_gap_minutes: mc.health_log_gap_minutes ?? null,
    logPath: primaryLog,
    allLines,
  };
}
