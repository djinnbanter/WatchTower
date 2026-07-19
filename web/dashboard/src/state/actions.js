/**
 * Domain actions — imperative commands that call source methods and update stores.
 * Components call these; they never touch fetch() directly.
 */

import { batch } from '../lib/signals.js';
import {
  reports, spark, performance, activity, opsCache,
  ui, setUi, issueSuppressions, modrinthScan,
} from './stores.js';

let _source = null;
let _modrinthWasRunning = false;

/** Call once after createSource() */
export function initActions(source) {
  _source = source;
}

function kickReportPoll() {
  // Dynamic import avoids a circular dependency with scheduler.js
  import('./scheduler.js').then((m) => m.kickTask?.('reportStatus')).catch(() => {});
}

function kickModrinthPoll() {
  import('./scheduler.js').then((m) => m.kickTask?.('modrinthStatus')).catch(() => {});
}

// ── Scan debounce ─────────────────────────────────────────────────────────────

const SCAN_DEBOUNCE_MS = 30_000;
const _scanAt = {};
const _scanInFlight = new Set();

function _canScan(key, force = false) {
  if (_scanInFlight.has(key)) return false;
  if (force) return true;
  const last = _scanAt[key] ?? 0;
  return Date.now() - last >= SCAN_DEBOUNCE_MS;
}

function _beginScan(key) {
  _scanInFlight.add(key);
  _scanAt[key] = Date.now();
}

function _endScan(key) {
  _scanInFlight.delete(key);
}

// ── Reports ───────────────────────────────────────────────────────────────────

let _reportWasRunning = false;

export async function runReport({ lookbackHours, since, incremental } = {}) {
  if (!_source) return;
  const payload = {};
  if (lookbackHours != null) payload.lookback_hours = lookbackHours;
  if (since != null) payload.since = since;
  if (incremental != null) payload.incremental = incremental;

  const startedAt = Date.now();
  try {
    reports.value = {
      ...reports.value,
      run: {
        running: true,
        startedAt,
        message: 'Starting report…',
        success: null,
        stage: 'window',
        stageLabel: 'Computing time window',
        stageDetail: 'Starting report…',
      },
      error: null,
    };
    _reportWasRunning = true;
    // Start polling immediately (don't wait for the 2s interval)
    kickReportPoll();

    const data = await _source.runReport(payload);
    // 409 already running — keep polling the in-flight run
    if (data?.status === 'already_running') {
      kickReportPoll();
      return data;
    }
    reports.value = {
      ...reports.value,
      run: {
        running: data?.running !== false,
        startedAt,
        message: data?.message ?? null,
        success: null,
        stage: data?.stage ?? reports.value.run.stage,
        stageLabel: data?.stage_label ?? reports.value.run.stageLabel,
        stageDetail: data?.stage_detail ?? reports.value.run.stageDetail,
      },
    };
    _reportWasRunning = reports.value.run.running;
    kickReportPoll();
    return data;
  } catch (err) {
    // Another client/tab may already be running a report
    if (err?.status === 409 || err?.body?.status === 'already_running') {
      _reportWasRunning = true;
      kickReportPoll();
      return err?.body ?? { status: 'already_running', running: true };
    }
    reports.value = {
      ...reports.value,
      run: { running: false, startedAt: null, message: null, success: false, stage: null, stageLabel: null, stageDetail: null },
      error: err.message,
    };
    addToast(err.message || 'Report start failed', 'error');
    _reportWasRunning = false;
    return null;
  }
}

export async function pollReportStatus() {
  if (!_source) return;
  const wasRunning = _reportWasRunning || reports.value.run?.running === true;
  const localStarted = reports.value.run?.startedAt;
  const prevStage = reports.value.run?.stage;
  const prevLabel = reports.value.run?.stageLabel;
  const prevDetail = reports.value.run?.stageDetail;
  try {
    const data = await _source.fetchReportStatus();
    let nowRunning = reports.value.run?.running ?? false;

    // Ignore a brief "not running" race before the server has begun (or finished) our run.
    if (
      wasRunning
      && !nowRunning
      && localStarted
      && (Date.now() - localStarted) < 8000
    ) {
      const finishedRaw = data?.finished_at;
      const finishedMs = finishedRaw ? Date.parse(finishedRaw) : NaN;
      if (!Number.isFinite(finishedMs) || finishedMs + 500 < localStarted) {
        reports.value = {
          ...reports.value,
          run: {
            ...reports.value.run,
            running: true,
            success: null,
            stage: prevStage || 'window',
            stageLabel: prevLabel || 'Computing time window',
            stageDetail: prevDetail || 'Waiting for server…',
          },
        };
        nowRunning = true;
      }
    }

    if (wasRunning && !nowRunning) {
      const success = reports.value.run?.success;
      if (success) {
        addToast('Report completed', 'success');
        await _source.fetchReportsLatest();
        await _source.fetchReportsIndex();
      } else if (success === false) {
        addToast(reports.value.run?.message || 'Report failed', 'error');
      }
    }
    _reportWasRunning = nowRunning;
  } catch {
    // Keep local running flag so the next poll can recover
  }
}

export async function runModrinthScan() {
  if (!_source) return;
  const startedAt = Date.now();
  try {
    modrinthScan.value = {
      ...modrinthScan.value,
      startedAt,
      error: null,
      status: {
        ...modrinthScan.value.status,
        running: true,
        success: null,
        error: null,
        stage: 'prepare',
        stage_label: 'Preparing Modrinth scan',
        stage_detail: 'Starting scan…',
      },
    };
    _modrinthWasRunning = true;
    kickModrinthPoll();

    const data = await _source.runModrinthScan();
    if (data?.status === 'already_running') {
      kickModrinthPoll();
      return data;
    }
    if (data?.status === 'disabled') {
      modrinthScan.value = {
        ...modrinthScan.value,
        status: {
          ...modrinthScan.value.status,
          enabled: false,
          running: false,
          error: data?.error || 'Modrinth lookup is disabled',
        },
      };
      _modrinthWasRunning = false;
      addToast(data?.error || 'Modrinth lookup is disabled', 'error');
      return data;
    }
    modrinthScan.value = {
      ...modrinthScan.value,
      startedAt,
      status: {
        ...modrinthScan.value.status,
        ...data,
        running: data?.running !== false,
        success: null,
      },
    };
    _modrinthWasRunning = modrinthScan.value.status.running;
    kickModrinthPoll();
    return data;
  } catch (err) {
    if (err?.status === 409 || err?.body?.status === 'already_running') {
      _modrinthWasRunning = true;
      kickModrinthPoll();
      return err?.body ?? { status: 'already_running', running: true };
    }
    if (err?.status === 400 || err?.body?.status === 'disabled') {
      modrinthScan.value = {
        ...modrinthScan.value,
        status: {
          ...modrinthScan.value.status,
          enabled: false,
          running: false,
          error: err?.body?.error || err.message,
        },
      };
      _modrinthWasRunning = false;
      addToast(err?.body?.error || err.message || 'Modrinth lookup is disabled', 'error');
      return err?.body ?? null;
    }
    modrinthScan.value = {
      ...modrinthScan.value,
      error: err.message,
      status: { ...modrinthScan.value.status, running: false, success: false },
    };
    addToast(err.message || 'Modrinth scan failed to start', 'error');
    _modrinthWasRunning = false;
    return null;
  }
}

export async function pollModrinthStatus() {
  if (!_source) return;
  const wasRunning = _modrinthWasRunning || modrinthScan.value?.status?.running === true;
  try {
    const data = await _source.fetchModrinthStatus();
    const nowRunning = !!data?.running;
    if (wasRunning && !nowRunning) {
      if (data?.success) {
        addToast('Modrinth scan completed', 'success');
        await _source.fetchReportsLatest?.();
      } else if (data?.success === false) {
        addToast(data?.error || 'Modrinth scan failed', 'error');
      }
    }
    _modrinthWasRunning = nowRunning;
  } catch {
    // keep local running flag for recovery
  }
}

export async function selectReport(id) {
  if (!_source) return;
  const rep = reports.value.index.find((r) => r.id === id);
  if (!rep) return;

  try {
    const data = await _source.fetchReport(rep.facts);
    if (!data) return;
    const isPrev = id === 'prev' || id?.startsWith('prev');
    reports.value = {
      ...reports.value,
      activeId: id,
      // Always swap the active facts so the dashboard reflects the selected report
      facts: data.facts ?? reports.value.facts,
      prevFacts: isPrev ? (data.facts ?? reports.value.prevFacts) : reports.value.prevFacts,
      brief: data.brief ?? reports.value.brief,
    };

    // Persist selection
    try { localStorage.setItem('wt.selectedReport', JSON.stringify(id)); } catch { }
  } catch (err) {
    addToast(`Failed to load report: ${err.message}`, 'error');
  }
}

// ── Scans ─────────────────────────────────────────────────────────────────────

export async function scanCrashes(force = false) {
  if (!_source || !_canScan('crashes', force)) return null;
  _beginScan('crashes');
  try {
    const result = await _source.scanCrashes();
    await _source.fetchOpsCache();
    return result;
  } catch (err) {
    console.warn('crash scan failed', err);
    return null;
  } finally {
    _endScan('crashes');
  }
}

export async function scanActivity(force = false) {
  if (!_source || !_canScan('activity', force)) return null;
  _beginScan('activity');
  try {
    const result = await _source.scanActivity();
    await _source.fetchOpsCache?.();
    await _source.fetchIssuesPeek?.();
    return result;
  } catch (err) {
    console.warn('activity scan failed', err);
    return null;
  } finally {
    _endScan('activity');
  }
}

export async function scanMods(force = false) {
  if (!_source || !_canScan('mods', force)) return null;
  _beginScan('mods');
  try {
    const result = await _source.scanMods();
    await _source.fetchOpsCache?.();
    await _source.fetchIssuesPeek?.();
    await _source.fetchMeta?.();
    return result;
  } catch (err) {
    console.warn('mod scan failed', err);
    return null;
  } finally {
    _endScan('mods');
  }
}

export async function scanBackups(force = false) {
  if (!_source || !_canScan('backups', force)) return null;
  _beginScan('backups');
  try {
    return await _source.scanBackups();
  } catch (err) {
    console.warn('backup scan failed', err);
    return null;
  } finally {
    _endScan('backups');
  }
}

// ── Crash acks / groups / inbox ───────────────────────────────────────────────

export async function fetchCrashAcks() {
  if (!_source) return;
  try {
    await _source.fetchCrashAcks();
  } catch (err) {
    addToast(`Crash acks unavailable: ${err.message}`, 'error');
  }
}

export async function fetchIssueAcks() {
  if (!_source) return;
  try {
    await _source.fetchIssueAcks?.();
  } catch (err) {
    addToast(`Issue acks unavailable: ${err.message}`, 'error');
  }
}

export async function fetchIssueSuppressions() {
  if (!_source) return;
  try {
    await _source.fetchIssueSuppressions?.();
  } catch (err) {
    console.warn('[WatchTower] Issue suppressions unavailable:', err);
  }
}

/** Apply suppression snapshot from API and patch in-memory facts for Hidden list. */
export function applyIssueSuppressions(snapshot) {
  if (!snapshot) return;
  issueSuppressions.value = { data: snapshot, at: Date.now() };

  const facts = reports.value.facts;
  if (!facts) return;

  const merged = Array.isArray(snapshot.merged) ? snapshot.merged : [];
  const issues = facts.issues ?? [];
  const prevHidden = facts.optional?.suppressed_issues ?? [];
  const hidden = merged.map((entry) => {
    const id = entry?.id;
    if (!id) return null;
    const existing = prevHidden.find((h) => String(h.id).toLowerCase() === String(id).toLowerCase());
    if (existing) return existing;
    const fromFacts = issues.find((i) => String(i.id).toLowerCase() === String(id).toLowerCase());
    return {
      id,
      message: fromFacts?.message ?? `Suppressed (${entry.source ?? 'dashboard'})`,
      severity: fromFacts?.severity ?? 'warning',
      suppressed: true,
    };
  }).filter(Boolean);

  reports.value = {
    ...reports.value,
    facts: {
      ...facts,
      optional: {
        ...facts.optional,
        active_suppressions: snapshot,
        suppressed_issues: hidden,
      },
    },
  };
}

export async function ackIssue(id, reviewed = true) {
  if (!_source) return;
  try {
    await _source.ackIssue({ id, reviewed });
  } catch (err) {
    addToast(`Could not mark issue reviewed: ${err.message}`, 'error');
  }
}

export async function acknowledgeAllIssues(ids = []) {
  if (!_source) return null;
  try {
    return await _source.acknowledgeAllIssues({ ids });
  } catch (err) {
    addToast(`Could not mark issues reviewed: ${err.message}`, 'error');
    return null;
  }
}

export async function ackCrash(file, reviewed = true) {
  if (!_source) return;
  try {
    await _source.ackCrash({ file, reviewed });
  } catch (err) {
    addToast(`Ack failed: ${err.message}`, 'error');
  }
}

export async function fetchCrashesGrouped() {
  if (!_source) return null;
  try {
    return await _source.fetchCrashesGrouped();
  } catch (err) {
    addToast(`Crashes unavailable: ${err.message}`, 'error');
    return null;
  }
}

export async function acknowledgeAllCrashes(payload = {}) {
  if (!_source) return null;
  try {
    const data = await _source.acknowledgeAllCrashes(payload);
    addToast(
      data?.acknowledged
        ? `Marked ${data.acknowledged} crash${data.acknowledged === 1 ? '' : 'es'} reviewed`
        : 'No unreviewed crashes',
      'success',
    );
    return data;
  } catch (err) {
    addToast(`Ack-all failed: ${err.message}`, 'error');
    return null;
  }
}

export async function fetchInbox() {
  if (!_source) return null;
  try {
    return await _source.fetchInbox();
  } catch (err) {
    addToast(`Inbox unavailable: ${err.message}`, 'error');
    return null;
  }
}

export async function dismissInboxItem(id) {
  if (!_source || !id) return;
  try {
    await _source.dismissInboxItem({ id });
  } catch (err) {
    addToast(`Dismiss failed: ${err.message}`, 'error');
  }
}

// ── Client mod ignores ────────────────────────────────────────────────────────

export async function ignoreClientMod(modId, ignored) {
  if (!_source) return;
  try {
    await _source.ignoreClientMod({ mod_id: modId, ignored });
  } catch (err) {
    addToast(`Ignore failed: ${err.message}`, 'error');
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function loadSettings() {
  if (!_source) return null;
  try {
    return await _source.fetchSettings();
  } catch (err) {
    console.warn('settings load failed', err);
    return null;
  }
}

export async function saveBackupDirs(dirs) {
  if (!_source) return null;
  try {
    const data = await _source.saveBackupDirs(dirs);
    addToast('Backup folder saved', 'success');
    return data;
  } catch (err) {
    addToast(`Could not save folder: ${err.message}`, 'error');
    throw err;
  }
}

export async function saveBackupExternal(payload) {
  if (!_source) return null;
  try {
    const data = await _source.saveBackupExternal(payload);
    addToast('External backup settings saved', 'success');
    return data;
  } catch (err) {
    addToast(`Could not save external settings: ${err.message}`, 'error');
    throw err;
  }
}

export async function saveSettings(partial) {
  if (!_source) return;
  try {
    await _source.saveSettings(partial);
    addToast('Settings saved', 'success');
  } catch (err) {
    addToast(`Settings save failed: ${err.message}`, 'error');
    throw err;
  }
}

// ── Incident pin ──────────────────────────────────────────────────────────────

export async function pinIncident(note) {
  if (!_source) return;
  try {
    const data = await _source.pinIncident(note);
    addToast('Lag moment pinned', 'success');
    return data;
  } catch (err) {
    addToast(`Pin failed: ${err.message}`, 'error');
    return null;
  }
}

// ── Spark ─────────────────────────────────────────────────────────────────────

export async function loadSparkProfiles() {
  if (!_source) return;
  try {
    await _source.fetchSparkProfiles();
  } catch (err) {
    addToast(`Spark profiles unavailable: ${err.message}`, 'error');
  }
}

export async function loadSparkProfile(path) {
  if (!_source) return;
  spark.value = { ...spark.value, loading: true, error: null };
  try {
    await _source.fetchSparkProfile(path);
  } catch (err) {
    spark.value = { ...spark.value, loading: false, error: err.message };
    addToast(`Spark profile unavailable: ${err.message}`, 'error');
  }
}

// ── Crash context / log ───────────────────────────────────────────────────────

export async function loadCrashContext(file) {
  if (!_source) return null;
  try {
    const data = await _source.fetchCrashContext(file);
    return data?.pre_crash ?? null;
  } catch {
    return null;
  }
}

export async function fetchCrashReport(file) {
  if (!_source) return null;
  try {
    return await _source.fetchCrashReport?.(file) ?? null;
  } catch {
    return null;
  }
}

export async function fetchLogsList() {
  if (!_source) return { files: [] };
  try {
    return await _source.fetchLogsList?.() ?? { files: [] };
  } catch {
    return { files: [] };
  }
}

export async function fetchLogContent(file, tail = 2000) {
  if (!_source) return null;
  try {
    return await _source.fetchLogContent?.(file, tail) ?? null;
  } catch {
    return null;
  }
}

export async function fetchModsTree(modId) {
  if (!_source) return null;
  try {
    return await _source.fetchModsTree?.(modId) ?? null;
  } catch {
    return null;
  }
}

// ── Performance ───────────────────────────────────────────────────────────────

export async function loadPerformance(window) {
  if (!_source) return;
  performance.value = { ...performance.value, window };
  try {
    await _source.fetchPerformance(window);
  } catch (err) {
    addToast(`Performance data unavailable: ${err.message}`, 'error');
  }
}

// ── Activity ──────────────────────────────────────────────────────────────────

export async function loadActivity(hours) {
  if (!_source) return;
  activity.value = { ...activity.value, loading: true };
  try {
    await _source.fetchActivity(hours);
  } catch (err) {
    activity.value = { ...activity.value, loading: false };
    addToast(`Activity unavailable: ${err.message}`, 'error');
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────

export function openModal(type, props = {}) {
  setUi({ modal: { type, props } });
}

export function closeModal() {
  setUi({ modal: null });
}

let _toastSeq = 0;

export function addToast(message, tone = 'info', durationMs = 4000) {
  const id = ++_toastSeq;
  const toast = { id, message, tone, createdAt: Date.now() };
  setUi({ toasts: [...ui.value.toasts, toast] });
  if (durationMs > 0) {
    setTimeout(() => removeToast(id), durationMs);
  }
  return id;
}

export function removeToast(id) {
  setUi({ toasts: ui.value.toasts.filter((t) => t.id !== id) });
}

export function addBanner(banner) {
  const id = banner.id ?? `banner-${Date.now()}`;
  const b = { ...banner, id };
  setUi({ banners: [...ui.value.banners.filter((x) => x.id !== id), b] });
  return id;
}

export function removeBanner(id) {
  setUi({ banners: ui.value.banners.filter((b) => b.id !== id) });
}
