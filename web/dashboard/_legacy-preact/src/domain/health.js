/**
 * Health domain — pure functions ported from legacy health.js.
 * No side-effects, no store access. All inputs are plain objects.
 */

// ── Severity helpers ──────────────────────────────────────────────────────────

function severityRank(s) {
  if (s === 'critical') return 3;
  if (s === 'warning') return 2;
  return 1;
}

// ── Ack helpers (passed in, not imported) ─────────────────────────────────────

function isAcked(acks, file) {
  if (!acks || !file) return false;
  const bare = _bareFile(file);
  for (const [key, val] of Object.entries(acks)) {
    if (_bareFile(key) === bare && val) return true;
  }
  return false;
}

/** True when a stable Issues-tab key is in acknowledged_issues. */
export function isIssueAcked(issueAcks, key) {
  if (!issueAcks || !key) return false;
  return !!issueAcks[key];
}

/** True when an issue id is in the active suppression snapshot. */
export function isIssueSuppressed(suppressions, issueId) {
  if (!issueId || !suppressions) return false;
  const merged = Array.isArray(suppressions.merged)
    ? suppressions.merged
    : (Array.isArray(suppressions) ? suppressions : []);
  const needle = String(issueId).toLowerCase();
  return merged.some((e) => String(e?.id ?? '').toLowerCase() === needle);
}

/** Stable ack key for live peek rows. */
export function peekIssueAckKey(kind, entry) {
  if (!entry) return null;
  if (kind === 'lag') {
    const id = entry.incident_id || entry.id;
    return id ? `lag:${id}` : null;
  }
  if (kind === 'mod') {
    const id = entry.mod_id || entry.id;
    return id ? `mod:${id}` : null;
  }
  if (kind === 'log_stale') return 'log_stale';
  return null;
}

function unacknowledgedCrashes(facts, acks) {
  const summaries = facts?.optional?.crash_summaries ?? [];
  return summaries.filter((c) => !isAcked(acks, c.file));
}

/**
 * True when ops-cache alone can produce action-queue cards (backups, crashes, live issues).
 * Callers should still invoke buildActionQueue when facts exist.
 */
export function opsCanDriveActionQueue(opsCacheData) {
  if (!opsCacheData) return false;
  if (Array.isArray(opsCacheData.issues_live) && opsCacheData.issues_live.length > 0) return true;
  if (opsCacheData.crashes) return true;
  if (opsCacheData.backups_live) return true;
  if (opsCacheData.backup_external) return true;
  return false;
}

function _bareFile(f) {
  if (!f) return '';
  return f.replace(/^.*[/\\]/, '').replace(/\.txt$/, '');
}

// ── Backup driver ─────────────────────────────────────────────────────────────

function isExternalFresh(ext) {
  if (!ext?.configured) return false;
  return (ext.status === 'success' || ext.status === 'running') && !ext.stale;
}

/** Prefer live scan last_backup when present; else facts. Exported for unit tests. */
export function resolveLocalBackup(facts, opsCacheData) {
  const live = opsCacheData?.backups_live?.last_backup;
  if (live && (live.status || live.age_hours != null || live.age_days != null || live.path || live.file)) {
    return live;
  }
  return facts?.optional?.last_backup ?? null;
}

function backupAgeHours(b) {
  if (!b) return null;
  if (b.age_hours != null && Number.isFinite(Number(b.age_hours))) return Number(b.age_hours);
  if (b.age_days != null && Number.isFinite(Number(b.age_days))) return Number(b.age_days) * 24;
  return null;
}

/** BAU Issues freshness: backup within 24h (not report LOOKBACK_HOURS / warn-days alone). */
const BACKUP_FRESH_HOURS = 24;

function isLocalBackupFresh(b) {
  if (!b) return false;
  const st = b.status;
  if (st === 'not_found' || st === 'unconfigured' || st === 'missing') return false;
  if (st === 'stale' || b.stale) return false;
  const age = backupAgeHours(b);
  if (age != null && age > BACKUP_FRESH_HOURS) return false;
  return st === 'success' || (age != null && age <= BACKUP_FRESH_HOURS);
}

export function backupDriver(facts, opsCacheData, trackingEnabled = true) {
  if (trackingEnabled === false) return null;
  if (facts?.meta?.backup_tracking_enabled === false) return null;

  const b = resolveLocalBackup(facts, opsCacheData);
  const ext = facts?.optional?.backup_external ?? opsCacheData?.backup_external;

  if (isExternalFresh(ext)) {
    return { id: 'BACKUP_OK', kind: 'backup', severity: 'ok', title: 'Backups OK', historical: false, fixes: [] };
  }

  if (ext?.configured) {
    if (ext.status === 'running') {
      return { id: 'BACKUP_OK', kind: 'backup', severity: 'ok', title: 'Backup running', historical: false, fixes: [] };
    }
    if (ext.stale || ext.status === 'stale') {
      // Local fresh still OK in hybrid
      if (isLocalBackupFresh(b)) {
        return { id: 'BACKUP_OK', kind: 'backup', severity: 'ok', title: 'Backups OK', historical: false, fixes: [] };
      }
      return { id: 'BACKUP_STALE', kind: 'backup', severity: 'warning', title: 'Backup is stale', historical: false, fixes: [] };
    }
    if (ext.status === 'missing' || ext.status === 'failed') {
      if (isLocalBackupFresh(b)) {
        return { id: 'BACKUP_OK', kind: 'backup', severity: 'ok', title: 'Backups OK', historical: false, fixes: [] };
      }
      return { id: 'BACKUP_NOT_FOUND', kind: 'backup', severity: 'warning', title: 'Backup failure', historical: false, fixes: [] };
    }
  }

  if (!b) return null;
  const st = b.status;
  if (st === 'unconfigured') return null;
  if (st === 'not_found' || st === 'missing') {
    return { id: 'BACKUP_NOT_FOUND', kind: 'backup', severity: 'warning', title: 'Backup failure', historical: false, fixes: [] };
  }
  if (isLocalBackupFresh(b)) {
    return { id: 'BACKUP_OK', kind: 'backup', severity: 'ok', title: 'Backups OK', historical: false, fixes: [] };
  }
  const age = backupAgeHours(b);
  if (st === 'stale' || b.stale || (age != null && age > BACKUP_FRESH_HOURS)) {
    return { id: 'BACKUP_STALE', kind: 'backup', severity: 'warning', title: 'Backup is stale', historical: false, fixes: [] };
  }
  if (st === 'success') {
    return { id: 'BACKUP_OK', kind: 'backup', severity: 'ok', title: 'Backups OK', historical: false, fixes: [] };
  }
  return null;
}

// ── Issue drivers ─────────────────────────────────────────────────────────────

function issueDrivers(facts, trackingEnabled = true, opsCacheData = null) {
  const trackingOff = trackingEnabled === false || facts?.meta?.backup_tracking_enabled === false;
  const skip = new Set(['CRASH_REPORT', 'MOD_LOAD_FAILED', 'BACKUP_NOT_CONFIGURED', 'BACKUP_NOT_FOUND', 'BACKUP_STALE']);
  return (facts?.issues ?? [])
    .filter((i) => !skip.has(i.id))
    .filter((i) => !(trackingOff && typeof i.id === 'string' && i.id.startsWith('BACKUP_')))
    .map((i) => ({
      id: i.id,
      kind: 'issue',
      severity: i.severity || 'warning',
      title: _issueTitle(i.id),
      summary: _issueSummary(i),
      historical: !!i.historical,
      fixes: [],
    }));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build the ordered action queue for Issues / Overview panels.
 * @param {object} facts  - Latest facts object
 * @param {object} acks   - Crash acks map { file: record }
 * @param {object} [opsCacheData] - ops-cache data for backup_external / crash entries
 * @param {object} [crashGroupsData] - grouped crashes { unreviewed_groups, unreviewed, count }
 * @param {object} [issueAcks] - Issue acks map { key: { ackedAt, by } }
 * @param {{ backupTrackingEnabled?: boolean }} [options]
 * @returns {{ now: ActionItem[], soon: ActionItem[], historical: ActionItem[], reviewed: ActionItem[] }}
 */
export function buildActionQueue(facts, acks, opsCacheData, crashGroupsData, issueAcks, options) {
  const trackingEnabled = options?.backupTrackingEnabled !== false;
  const suppressions = options?.issueSuppressions ?? null;
  const items = [];
  const coveredIssueIds = new Set();
  const issues = facts?.issues ?? [];

  // Crashes — prefer fingerprint groups when available
  const unacked = unacknowledgedCrashes(facts, acks);
  const unreviewedGroups =
    crashGroupsData?.unreviewed_groups
    ?? opsCacheData?.crashes?.unreviewed_groups
    ?? null;
  const unreviewedFiles =
    crashGroupsData?.unreviewed
    ?? opsCacheData?.crashes?.unreviewed
    ?? unacked.length;

  if ((unreviewedGroups != null && unreviewedGroups > 0) || (unreviewedGroups == null && unacked.length)) {
    coveredIssueIds.add('CRASH_REPORT');
    const evidence = unacked.slice(0, 3).map((c) => ({
      file: c.file,
      quote: c.exception || c.summary || c.plain_english || '',
      time: c.time,
    }));
    const groupCount = unreviewedGroups != null ? unreviewedGroups : null;
    const title = groupCount != null
      ? `${groupCount} crash group${groupCount === 1 ? '' : 's'} need review`
      : `${unacked.length} unreviewed crash${unacked.length === 1 ? '' : 'es'}`;
    const summary = groupCount != null
      ? (unreviewedFiles > 0
        ? `${unreviewedFiles} file${unreviewedFiles === 1 ? '' : 's'} across ${groupCount} group${groupCount === 1 ? '' : 's'} — open Crashes for fix steps.`
        : 'Open Crashes for numbered fix steps, then mark reviewed.')
      : 'Review crash reports and acknowledge on the Crashes tab when resolved.';
    items.push({
      key: 'crash:unreviewed',
      kind: 'crash',
      severity: 'critical',
      tier: unacked.length && unacked.every((c) => c.historical) ? 'historical' : 'now',
      title,
      summary,
      primaryAction: { label: 'Open Crashes', tab: 'crashes' },
      evidence,
      when: unacked[0]?.time ?? null,
      meta: {
        count: unreviewedFiles,
        unreviewed_groups: groupCount,
      },
    });
  }

  // Backup
  const backup = backupDriver(facts, opsCacheData, trackingEnabled);
  if (backup && backup.severity !== 'ok') {
    ['BACKUP_NOT_CONFIGURED', 'BACKUP_NOT_FOUND', 'BACKUP_STALE'].forEach((id) => coveredIssueIds.add(id));
    const backupIssue = issues.find((i) => i.id.startsWith('BACKUP_')) ?? null;
    const fallbackSummary = backup.id === 'BACKUP_STALE'
      ? 'No backup in the last 24 hours.'
      : 'No backup archive found.';
    items.push({
      key: `backup:${backup.id}`,
      kind: 'backup',
      severity: 'warning',
      tier: backupIssue?.historical ? 'historical' : 'now',
      title: backup.title,
      summary: backupIssue?.message ?? fallbackSummary,
      primaryAction: { label: 'Open Backups', tab: 'backups' },
      evidence: backupIssue?.evidence ?? [],
      when: null,
      meta: { backupId: backup.id, issueId: backup.id },
    });
  }

  // Modrinth outdated mods (report-time, opt-in) — soon tier unless crash-linked
  const modUpdates = facts?.optional?.modrinth_updates;
  if (Array.isArray(modUpdates) && modUpdates.length) {
    const crashLinked = new Set();
    for (const c of (facts?.optional?.crash_summaries ?? [])) {
      for (const k of ['primary_mod_id', 'stall_mod_id', 'suspect_mod_id', 'linked_mod_id']) {
        if (c?.[k]) crashLinked.add(String(c[k]).toLowerCase());
      }
    }
    for (const u of modUpdates.slice(0, 8)) {
      const modId = u?.mod_id;
      if (!modId) continue;
      const linked = crashLinked.has(String(modId).toLowerCase());
      const titleName = u.title || modId;
      const latest = u.latest_compatible;
      items.push({
        key: `modrinth:${modId}`,
        kind: 'mod_update',
        severity: linked ? 'warning' : 'info',
        tier: linked ? 'now' : 'soon',
        title: `${titleName} has a newer Modrinth build`,
        summary: latest
          ? `Compatible build ${latest} is available — open Modrinth (Watchtower does not download jars).`
          : 'A newer loader-compatible build is on Modrinth — open the link to update manually.',
        primaryAction: u.modrinth_compatible_url
          ? { label: 'Open Modrinth', href: u.modrinth_compatible_url }
          : { label: 'Open Updates', tab: 'mods', params: { view: 'updates', mod: modId } },
        evidence: [],
        when: null,
        meta: {
          mod_id: modId,
          latest_compatible: latest ?? null,
          related_pair: u.related_pair ?? null,
        },
      });
    }
  }

  // Continuous issue ledger (ops-cache.issues_live) — primary for Active queue
  const liveIssues = Array.isArray(opsCacheData?.issues_live) ? opsCacheData.issues_live : [];
  for (const li of liveIssues) {
    const id = li?.id || li?.key;
    if (!id) continue;
    const status = String(li.status || 'open').toLowerCase();
    if (status === 'resolved' || status === 'suppressed') continue;
    if (isIssueSuppressed(suppressions, id)) continue;
    coveredIssueIds.add(String(id).toUpperCase());
    coveredIssueIds.add(String(id));
    const tab = _issueActionTab(id);
    const item = {
      key: `issue:${id}`,
      kind: 'issue',
      severity: li.severity || 'warning',
      tier: status === 'reviewed' ? 'reviewed' : 'now',
      title: _issueTitle(id),
      summary: li.message || _issueSummary({ id, message: li.message }),
      detail: li.message ?? null,
      primaryAction: tab
        ? {
            label: tab === 'mods' && id === 'MOD_UPDATE_CONFLICT' ? 'Open Conflicts' : `Open ${tab[0].toUpperCase()}${tab.slice(1)}`,
            tab,
            params: tab === 'mods' ? { view: id === 'MOD_UPDATE_CONFLICT' ? 'conflicts' : 'overview' } : undefined,
          }
        : null,
      evidence: [],
      when: li.last_seen || li.first_seen || null,
      meta: {
        issueId: id,
        source: li.source || 'ops',
        fingerprint: li.evidence_fingerprint || null,
      },
      fixSteps: Array.isArray(li.fix_steps) ? li.fix_steps : [],
    };
    if (status === 'reviewed') {
      // handled below via issueAcks / tier reviewed
    }
    items.push(item);
  }

  // Mod issues from facts.issues not already covered by ledger
  issues.forEach((i) => {
    if (coveredIssueIds.has(i.id) || coveredIssueIds.has(String(i.id).toUpperCase())) return;
    if (isIssueSuppressed(suppressions, i.id)) return;
    const tab = _issueActionTab(i.id);
    items.push({
      key: `issue:${i.id}`,
      kind: 'issue',
      severity: i.severity || 'warning',
      tier: i.historical ? 'historical' : 'now',
      title: _issueTitle(i.id),
      summary: _issueSummary(i),
      detail: i.message ?? null,
      primaryAction: tab
        ? {
            label: tab === 'mods' && i.id === 'MOD_UPDATE_CONFLICT' ? 'Open Conflicts' : `Open ${tab[0].toUpperCase()}${tab.slice(1)}`,
            tab,
            params: tab === 'mods' ? { view: i.id === 'MOD_UPDATE_CONFLICT' ? 'conflicts' : 'overview' } : undefined,
          }
        : null,
      evidence: i.evidence ?? [],
      when: i.event_time ?? null,
      meta: { issueId: i.id, source: 'catchup' },
    });
  });

  const reviewedItems = [];
  const activeItems = [];
  for (const item of items) {
    const issueId = item.meta?.issueId
      ?? (item.key?.startsWith('issue:') ? item.key.slice(6) : null);
    if (issueId && isIssueSuppressed(suppressions, issueId)) continue;
    // Crash cards clear via crash acks, not issue acks
    if (item.kind !== 'crash' && isIssueAcked(issueAcks, item.key)) {
      const rec = issueAcks[item.key];
      reviewedItems.push({
        ...item,
        tier: 'reviewed',
        ackedAt: rec?.ackedAt ?? null,
      });
    } else {
      activeItems.push(item);
    }
  }

  const tierOrder = { now: 0, soon: 1, historical: 2, reviewed: 3 };
  activeItems.sort((a, b) => {
    const td = (tierOrder[a.tier] ?? 2) - (tierOrder[b.tier] ?? 2);
    if (td !== 0) return td;
    return severityRank(b.severity) - severityRank(a.severity);
  });
  reviewedItems.sort((a, b) => {
    const ta = a.ackedAt || '';
    const tb = b.ackedAt || '';
    return tb.localeCompare(ta);
  });

  return {
    now: activeItems.filter((i) => i.tier === 'now'),
    soon: activeItems.filter((i) => i.tier === 'soon'),
    historical: activeItems.filter((i) => i.tier === 'historical'),
    reviewed: reviewedItems,
  };
}

/**
 * Compute the display health: effective grade, label, tone.
 * @param {object} facts
 * @param {object} acks
 * @param {object} [opsCacheData]
 * @param {{ backupTrackingEnabled?: boolean }} [options]
 * @returns {{ grade: string, label: string, tone: string, overall: string, current: string }}
 */
export function displayHealth(facts, acks, opsCacheData, options) {
  const trackingEnabled = options?.backupTrackingEnabled !== false;
  const h = facts?.health ?? {};
  const overall = h.status || 'ok';
  const current = h.current_status || overall;

  const drivers = _buildDrivers(facts, acks, opsCacheData, trackingEnabled);

  let effective = overall;

  const criticalDrivers = drivers.filter((d) => d.severity === 'critical');
  const crashesCleared =
    unacknowledgedCrashes(facts, acks).length === 0
    && !(Number(opsCacheData?.crashes?.unreviewed_groups) > 0);
  const allCriticalResolved =
    criticalDrivers.length === 0 ||
    (criticalDrivers.some((d) => d.id === 'CRASH_REPORT') && crashesCleared);

  if (overall === 'critical' && allCriticalResolved) {
    const activeWorst = drivers
      .filter((d) => !d.historical)
      .reduce((w, d) => Math.max(w, severityRank(d.severity)), 0);
    effective = activeWorst >= 3 ? 'critical' : activeWorst >= 2 ? 'warning' : 'ok';
  }

  const toneMap = { ok: 'positive', warning: 'warning', critical: 'critical' };

  return {
    overall,
    current,
    effective,
    grade: effective,
    label: _healthLabel(effective),
    tone: toneMap[effective] ?? 'neutral',
    drivers,
  };
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function _buildDrivers(facts, acks, opsCacheData, trackingEnabled = true) {
  const drivers = [];
  const backup = backupDriver(facts, opsCacheData, trackingEnabled);
  if (backup && backup.severity !== 'ok') drivers.push(backup);

  const crash = _crashDriver(facts, acks, opsCacheData);
  if (crash) drivers.push(crash);

  drivers.push(...issueDrivers(facts, trackingEnabled, opsCacheData));
  return drivers;
}

function _crashDriver(facts, acks, opsCacheData) {
  const unacked = unacknowledgedCrashes(facts, acks);
  const unreviewedGroups = opsCacheData?.crashes?.unreviewed_groups ?? null;
  const unreviewedFiles = opsCacheData?.crashes?.unreviewed ?? unacked.length;

  if (unreviewedGroups != null && unreviewedGroups > 0) {
    const count = Number(unreviewedFiles) > 0 ? Number(unreviewedFiles) : unreviewedGroups;
    return {
      id: 'CRASH_REPORT',
      kind: 'crash',
      severity: 'critical',
      title: `Unresolved Crashes (${count})`,
      summary: `${count} crash report(s) need review`,
      historical: false,
      fixes: [],
      crashes: unacked,
    };
  }

  if (!unacked.length) return null;
  return {
    id: 'CRASH_REPORT',
    kind: 'crash',
    severity: 'critical',
    title: `Unresolved Crashes (${unacked.length})`,
    summary: `${unacked.length} crash report(s) need review`,
    historical: unacked.every((c) => c.historical),
    fixes: [],
    crashes: unacked,
  };
}

function _healthLabel(status) {
  const m = { ok: 'Healthy', warning: 'Warning', critical: 'Critical' };
  return m[status] ?? (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown');
}

function _issueTitle(id) {
  const m = {
    MOD_LOAD_FAILED: 'Mod problem',
    MOD_UPDATE_CONFLICT: 'Mod update conflicts',
    CRASH_REPORT: 'Crash reports on disk',
    BACKUP_NOT_CONFIGURED: 'Backups not set up',
    BACKUP_NOT_FOUND: 'Backup failure',
    BACKUP_STALE: 'Backup is stale',
    MANUAL_REBOOT: 'Server machine rebooted',
    OOM: 'Out of memory',
    DISK_HIGH: 'Disk almost full',
    DISK_FILL_PROJECTED: 'Disk filling soon',
    MEM_LOW: 'Low system memory',
    GC_PRESSURE: 'GC / heap pressure',
    TICK_LAG: 'Server falling behind',
    MSPT_HIGH: 'High tick time',
    TPS_LOW: 'Low TPS',
    DH_PREGEN_THROTTLE: 'World pregen slowing server',
    DH_PREGEN_STALL: 'World pregen may be stuck',
    CHUNKY_PREGEN_STALL: 'Chunky pregen may be stuck',
    CHUNKY_PREGEN_DEGRADED: 'Chunky pregen running slowly',
    CHUNKY_PREGEN_THROTTLE: 'Chunky pregen during high load',
    CHUNK_GEN_DURING_PREGEN: 'Chunk errors during pregen',
    PANEL_DOWN: 'Control panel offline',
    LOG_STALE: 'Logs look stale',
  };
  return m[id] || id.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function _issueSummary(i) {
  if (i.id === 'CRASH_REPORT') return 'Crash reports need review before the next session.';
  if (i.id === 'GC_PRESSURE') return 'Heap is full or GC is eating wall time — check Live GC before adding RAM.';
  if (i.id === 'BACKUP_NOT_CONFIGURED') return 'No backup directory configured.';
  if (i.id === 'BACKUP_NOT_FOUND') return 'No backup archive found.';
  if (i.id === 'BACKUP_STALE') return 'No backup in the last 24 hours.';
  if (i.id === 'MOD_LOAD_FAILED') return 'One or more mods failed to load correctly.';
  return (i.message || '').split('—')[0].trim().slice(0, 120);
}

function _issueActionTab(issueId) {
  if (issueId === 'CRASH_REPORT') return 'crashes';
  if (issueId === 'GC_PRESSURE') return 'live';
  if (issueId === 'DISK_HIGH' || issueId === 'DISK_FILL_PROJECTED') return 'insights';
  if (issueId === 'MOD_LOAD_FAILED' || issueId === 'MOD_UPDATE_CONFLICT') return 'mods';
  if (issueId?.startsWith('BACKUP_')) return 'backups';
  return null;
}
