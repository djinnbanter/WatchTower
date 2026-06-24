/**
 * Port of FactsBuilder.java (DR subset).
 */
import { classifyCrash } from './crashClassifier.js';
import { narrateCrash, enrichSummary } from './crashNarrator.js';
import { analyzeModIssues } from './modIssueAdvisor.js';

function addIssue(issues, id, message, severity, extra = {}) {
  issues.push({ id, message, severity, historical: false, ...extra });
}

function enrichCrashModLinks(summaries, recommendations) {
  for (const row of summaries) {
    const suspect = row.suspect_mod_id || row.mod_file?.replace(/\.jar$/, '').split('-')[0]?.toLowerCase();
    if (!suspect) continue;
    const match = recommendations.find((r) => r.mod_id === suspect);
    if (match) {
      row.linked_mod_id = suspect;
      row.mod_fix = {
        action: match.action,
        fix: match.fix,
        install_hint: match.install_hint,
      };
    }
  }
}

function buildCrashSummaries(staging) {
  const mc = staging.minecraft;
  const optional = staging.optional;
  const reports = mc.new_crash_reports || [];
  const summaries = [];
  const serverStarted = mc.server_started ? new Date(mc.server_started) : null;

  for (const c of reports) {
    const row = { ...c };
    if (c.historical !== undefined) row.historical = c.historical;
    else if (serverStarted && c.time) {
      row.historical = new Date(c.time) < serverStarted;
    } else {
      row.historical = false;
    }

    const classification = classifyCrash(c);
    row.category = classification.category;
    if (classification.suspect_mod_id) row.suspect_mod_id = classification.suspect_mod_id;

    const narrative = narrateCrash(c);
    enrichSummary(row, narrative);
    summaries.push(row);
  }

  optional.crash_summaries = summaries;
  enrichCrashModLinks(summaries, optional.mod_recommendations || []);
  return summaries;
}

function deriveHealth(issues) {
  const hasCritical = issues.some((i) => i.severity === 'critical');
  const hasWarning = issues.some((i) => i.severity === 'warning');
  const status = hasCritical ? 'critical' : hasWarning ? 'warning' : 'ok';
  return {
    status,
    current_status: status,
    java_running: false,
    panel_running: false,
    status_note: 'Analyzed from uploaded export (server was not running).',
  };
}

export function buildFacts(staging) {
  const issues = [];
  const mc = staging.minecraft;
  const optional = staging.optional;
  const meta = staging.meta;

  if (!mc.log_had_activity_in_window) {
    addIssue(issues, 'NO_LOG_ACTIVITY', 'No log activity found in the uploaded files.', 'warning');
  }

  if (mc.log_had_activity_in_window && !mc.clean_shutdown_seen) {
    const gap = staging.health_log_gap_minutes;
    if (gap != null && gap < 60) {
      addIssue(issues, 'ABNORMAL_STOP', 'Logs show activity but no clean shutdown — server may have crashed or been killed.', 'warning');
    }
  }

  if (!mc.server_started && mc.log_had_activity_in_window) {
    addIssue(issues, 'SERVER_DOWN', 'Server did not reach "Done!" — likely failed during startup.', 'critical');
  }

  if (mc.oom_in_logs) {
    addIssue(issues, 'OOM', 'OutOfMemoryError detected in logs.', 'critical');
  }

  const { recommendations, severeIssues } = analyzeModIssues(optional);
  optional.mod_recommendations = recommendations;

  for (const sev of severeIssues) {
    addIssue(issues, 'MOD_LOAD_FAILED', sev.message, 'warning', { mod_id: sev.modId });
  }

  const summaries = buildCrashSummaries(staging);
  const unacked = summaries.filter((c) => !c.historical);
  if (unacked.length) {
    const names = unacked.map((c) => c.file).join(', ');
    addIssue(issues, 'CRASH_REPORT', `New crash report(s): ${names}`, 'critical');
  }

  if (optional.prior_mod_changes) {
    optional.mod_changes = optional.prior_mod_changes;
  }

  return {
    meta,
    health: deriveHealth(issues),
    system: {
      disk_use_pct: null,
      mem_available_gb: null,
      note: 'Host metrics unavailable in DR mode.',
    },
    minecraft: {
      ...mc,
      players_online_now: 0,
      tps: null,
    },
    events: staging.events,
    issues,
    optional,
    thresholds: staging.thresholds,
    collection_warnings: staging.collection_warnings,
  };
}
