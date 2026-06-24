/**
 * Port of CrashReportScanner + CrashDetails + CrashReportParser (subset).
 */
const MOD_FILE_RE = /Mod File:\s*(.+)/i;
const DESCRIPTION_RE = /^Description:\s*(.+)/m;
const FAILURE_RE = /^Failure message:\s*(.+)/m;
const CAUSED_BY_RE = /^Caused by:\s*(.+)/m;
const EXCEPTION_LINE_RE = /^([a-z][\w.$]*(?:Exception|Error)):\s*(.+)/m;
const STACK_FRAME_RE = /^\tat\s+(\S+)\((.+?)\)/m;
const WATCHDOG_MS_RE = /single server tick took (\d+) milliseconds/i;

export function parseCrashSummary(text) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('Description:')) {
      const desc = trimmed.slice('Description:'.length).trim();
      return desc.length > 200 ? desc.slice(0, 200) : desc;
    }
    if (trimmed.includes('Caused by:')) {
      return trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed;
    }
    if (trimmed.includes('Mod File:') || trimmed.includes('Failure message:')) {
      return trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed;
    }
  }
  const limit = Math.min(30, lines.length);
  for (let i = 0; i < limit; i++) {
    const s = lines[i].trim();
    if (s && !s.startsWith('----') && !s.includes('Time:')) {
      return s.length > 200 ? s.slice(0, 200) : s;
    }
  }
  return '';
}

function stripJar(raw) {
  let s = raw.trim();
  if (s.includes('/')) s = s.slice(s.lastIndexOf('/') + 1);
  if (s.includes('\\')) s = s.slice(s.lastIndexOf('\\') + 1);
  return s;
}

function parseCrashDetails(text) {
  const summary = parseCrashSummary(text);
  let modFile = '';
  const mod = MOD_FILE_RE.exec(text);
  if (mod) modFile = stripJar(mod[1].trim());
  let exception = '';
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.includes('Caused by:')) {
      const cb = CAUSED_BY_RE.exec(trimmed);
      exception = cb ? truncate(cb[1].trim(), 200) : truncate(trimmed, 200);
      break;
    }
    if (!exception && /^[a-z][\w.$]*(?:Exception|Error):.+/.test(trimmed)) {
      exception = truncate(trimmed, 200);
    }
  }
  return { summary, modFile, exception };
}

function truncate(s, max) {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function formatLabel(exception, modFile, summary) {
  const mf = modFile && !modFile.startsWith('java.lang.') ? modFile : '';
  if (exception && mf) return `${truncate(exception, 80)} (${mf})`;
  if (exception) return truncate(exception, 120);
  if (summary && summary !== 'Watching Server') return summary;
  return summary || '';
}

export function parseCrashReport(text, fileName, mtimeIso) {
  const lines = text.split(/\r?\n/);
  const quote = lines[0]?.length > 200 ? lines[0].slice(0, 200) : (lines[0] || '');
  const details = parseCrashDetails(text);
  const desc = DESCRIPTION_RE.exec(text);
  const failure = FAILURE_RE.exec(text);
  const causedBy = CAUSED_BY_RE.exec(text);
  const excLine = EXCEPTION_LINE_RE.exec(text);
  const watchdog = WATCHDOG_MS_RE.exec(text);

  const stackFrames = [];
  for (const line of lines) {
    const m = /^\tat\s+(\S+)\((.+?)\)/.exec(line);
    if (m && stackFrames.length < 8) {
      stackFrames.push({ method: m[1], location: m[2] });
    }
  }

  const report = {
    file: fileName,
    time: mtimeIso || new Date().toISOString(),
    quote,
    summary: details.summary,
    mod_file: details.modFile || undefined,
    exception: details.exception || undefined,
    display_label: formatLabel(details.exception, details.modFile, details.summary),
  };
  if (desc) report.description = desc[1].trim();
  if (failure) report.failure_message = failure[1].trim();
  if (causedBy) report.caused_by = causedBy[1].trim();
  if (excLine) report.root_exception = `${excLine[1]}: ${excLine[2]}`.trim();
  if (watchdog) report.watchdog_tick_ms = parseInt(watchdog[1], 10);
  if (stackFrames.length) report.stack_frames = stackFrames;
  return report;
}

/**
 * @param {{ name: string, content: string, mtime?: number }[]} crashFiles
 * @param {number} cutoffEpochSec
 */
export function scanCrashReports(crashFiles, cutoffEpochSec) {
  const reports = [];
  const events = [];
  const sorted = [...crashFiles].sort((a, b) => (b.mtime || 0) - (a.mtime || 0));

  for (const f of sorted) {
    const mtime = f.mtime || Math.floor(Date.now() / 1000);
    if (mtime < cutoffEpochSec) continue;
    const when = new Date(mtime * 1000).toISOString();
    const report = parseCrashReport(f.content, f.name, when);
    reports.push(report);
    events.push({
      time: when,
      type: 'crash_report',
      source: 'upload',
      detail: report.display_label || report.summary || f.name,
      importance: 10,
    });
  }
  return { reports, events };
}
