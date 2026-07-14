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

function _bareFile(f) {
  if (!f) return '';
  return f.replace(/^.*[/\\]/, '').replace(/\.txt$/, '');
}

// ── Backup driver ─────────────────────────────────────────────────────────────

function backupDriver(facts, opsCacheData, trackingEnabled = true) {
  if (trackingEnabled === false) return null;
  if (facts?.meta?.backup_tracking_enabled === false) return null;

  const b = facts?.optional?.last_backup;
  const ext = facts?.optional?.backup_external ?? opsCacheData?.backup_external;

  if (ext?.configured) {
    if (ext.status === 'success' && !ext.stale) {
      return { id: 'BACKUP_OK', kind: 'backup', severity: 'ok', title: 'Backups OK', historical: false, fixes: [] };
    }
    if (ext.status === 'running') {
      return { id: 'BACKUP_OK', kind: 'backup', severity: 'ok', title: 'Backup running', historical: false, fixes: [] };
    }
    if (ext.stale || ext.status === 'stale') {
      return { id: 'BACKUP_STALE', kind: 'backup', severity: 'warning', title: 'Backup is stale', historical: false, fixes: [] };
    }
    if (ext.status === 'missing' || ext.status === 'failed') {
      return { id: 'BACKUP_NOT_FOUND', kind: 'backup', severity: 'warning', title: 'Backup failure', historical: false, fixes: [] };
    }
  }

  if (!b) return null;
  const st = b.status;
  if (st === 'success') return { id: 'BACKUP_OK', kind: 'backup', severity: 'ok', title: 'Backups OK', historical: false, fixes: [] };
  if (st === 'unconfigured') return null;
  if (st === 'not_found' || st === 'stale' || b.stale) {
    if (ext?.configured && (ext.status === 'success' || ext.status === 'running') && !ext.stale) return null;
    return { id: 'BACKUP_NOT_FOUND', kind: 'backup', severity: 'warning', title: 'Backup failure', historical: false, fixes: [] };
  }
  return null;
}

// ── Issue drivers ─────────────────────────────────────────────────────────────

function issueDrivers(facts, trackingEnabled = true) {
  const trackingOff = trackingEnabled === false || facts?.meta?.backup_tracking_enabled === false;
  const skip = new Set(['CRASH_REPORT', 'MOD_LOAD_FAILED', 'BACKUP_NOT_CONFIGURED', 'BACKUP_NOT_FOUND']);
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
    items.push({
      key: `backup:${backup.id}`,
      kind: 'backup',
      severity: 'warning',
      tier: backupIssue?.historical ? 'historical' : 'now',
      title: backup.title,
      summary: backupIssue?.message ?? 'No recent backup found.',
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
          : { label: 'Open Mods', tab: 'mods', params: { view: 'overview', mod: modId } },
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

  // Mod issues from facts.issues not already covered
  issues.forEach((i) => {
    if (coveredIssueIds.has(i.id)) return;
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
      meta: { issueId: i.id },
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
  const allCriticalResolved =
    criticalDrivers.length === 0 ||
    (criticalDrivers.some((d) => d.id === 'CRASH_REPORT') &&
      unacknowledgedCrashes(facts, acks).length === 0);

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

  const crash = _crashDriver(facts, acks);
  if (crash) drivers.push(crash);

  drivers.push(...issueDrivers(facts, trackingEnabled));
  return drivers;
}

function _crashDriver(facts, acks) {
  const unacked = unacknowledgedCrashes(facts, acks);
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
    MEM_LOW: 'Low system memory',
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
  if (i.id === 'CRASH_REPORT') return 'Crash reports found in the lookback window — review before next session.';
  if (i.id === 'BACKUP_NOT_CONFIGURED') return 'No backup directory configured.';
  if (i.id === 'BACKUP_NOT_FOUND') return 'No backup archive found in the lookback window.';
  if (i.id === 'MOD_LOAD_FAILED') return 'One or more mods failed to load correctly.';
  return (i.message || '').split('—')[0].trim().slice(0, 120);
}

function _issueActionTab(issueId) {
  if (issueId === 'CRASH_REPORT') return 'crashes';
  if (issueId === 'MOD_LOAD_FAILED' || issueId === 'MOD_UPDATE_CONFLICT') return 'mods';
  if (issueId?.startsWith('BACKUP_')) return 'backups';
  return null;
}
