import * as ep from './endpoints.js';
import {
  live, samples, overviewMeta, players, reports, opsCache,
  issuesPeek, activity, updateCheck, dataSources, spark,
  performance, settings, auth, noReportYet, acks, crashGroups, inbox,
  issueSuppressions, modrinthScan,
} from '../state/stores.js';

/**
 * Live source — fetches real data from the embedded server API and
 * updates the corresponding store signals.
 */
export class LiveSource {
  // ── Live & samples ────────────────────────────────────────────────────────

  async fetchLive(signal) {
    const data = await ep.live(signal);
    live.value = { envelope: data, latest: data?.latest ?? null, error: null, at: Date.now() };
    return data;
  }

  async fetchSamples(window, signal) {
    const { kind = 'hours', value = 1 } = window ?? {};
    const minutes = kind === 'hours' ? value * 60 : kind === 'days' ? value * 1440 : value;
    const data = await ep.samples(minutes, 500, signal);
    samples.value = {
      ...samples.value,
      series: data,
      window: { kind, value },
      points: _countPoints(data),
      at: Date.now(),
      error: null,
    };
    return data;
  }

  // ── Overview meta ─────────────────────────────────────────────────────────

  async fetchMeta() {
    const data = await ep.overviewMeta();
    overviewMeta.value = { data, at: Date.now() };
    return data;
  }

  async fetchDataSources() {
    const data = await ep.dataSources();
    dataSources.value = {
      liveAt: data?.live_at ?? null,
      scanAt: data?.scan_at ?? data?.ops_scan_at ?? null,
      reportAt: data?.report_at ?? data?.full_report_at ?? null,
      nextScheduledMin: data?.next_scheduled_minutes ?? data?.next_scheduled_min ?? null,
      opsPollSec: data?.ops_poll_sec ?? 60,
    };
    return data;
  }

  // ── Players ───────────────────────────────────────────────────────────────

  async fetchPlayers() {
    const data = await ep.players();
    players.value = { directory: data?.player_directory ?? null, at: Date.now() };
    return data;
  }

  // ── Reports ───────────────────────────────────────────────────────────────

  async fetchReportsIndex() {
    const data = await ep.reportsIndex();
    reports.value = { ...reports.value, index: data?.reports ?? [] };
    return data;
  }

  async fetchReportsLatest() {
    try {
      const data = await ep.reportsLatest();
      if (data?.facts) {
        noReportYet.value = false;
        reports.value = {
          ...reports.value,
          activeId: reports.value.activeId || 'latest',
          facts: data.facts,
          brief: data.brief ?? null,
          error: null,
        };
      } else if (!reports.value.facts) {
        noReportYet.value = true;
      }
      return data;
    } catch (err) {
      // 404 no_report — authentic empty state (do not wipe facts already in memory)
      if (err?.status === 404 || err?.body?.error === 'no_report') {
        if (!reports.value.facts) noReportYet.value = true;
        return null;
      }
      reports.value = { ...reports.value, error: err?.message || String(err) };
      throw err;
    }
  }

  async fetchReport(factsFile) {
    const data = await ep.reportsGet(factsFile);
    return data;
  }

  /**
   * Boot/refresh hydrate: index → latest → get-fallback → restore selected report.
   * Ensures Overview / Mods / Issues keep the last saved report after a hard refresh.
   */
  async hydrateReports() {
    try {
      await this.fetchReportsIndex();
    } catch (err) {
      console.warn('[WatchTower] reports/index failed:', err);
    }

    try {
      await this.fetchReportsLatest();
    } catch (err) {
      console.warn('[WatchTower] reports/latest failed:', err);
    }

    const index = Array.isArray(reports.value.index) ? reports.value.index : [];

    // If latest failed but files exist, load the newest via /get
    if (!reports.value.facts && index.length) {
      const pick = index[0];
      try {
        const data = await this.fetchReport(pick.facts);
        if (data?.facts) {
          noReportYet.value = false;
          reports.value = {
            ...reports.value,
            activeId: pick.id || 'latest',
            facts: data.facts,
            brief: data.brief ?? null,
            error: null,
          };
        }
      } catch (err) {
        console.warn('[WatchTower] reports/get fallback failed:', err);
      }
    }

    // Restore previously selected report (prev-N) when still in the index
    let selected = null;
    try {
      selected = JSON.parse(localStorage.getItem('wt.selectedReport'));
    } catch { /* ignore */ }
    if (
      selected
      && selected !== 'latest'
      && reports.value.facts
      && index.some((r) => r.id === selected)
    ) {
      const pick = index.find((r) => r.id === selected);
      try {
        const data = await this.fetchReport(pick.facts);
        if (data?.facts) {
          reports.value = {
            ...reports.value,
            activeId: pick.id,
            facts: data.facts,
            prevFacts: data.facts,
            brief: data.brief ?? reports.value.brief,
          };
        }
      } catch {
        // Keep latest facts already loaded
      }
    }

    if (!reports.value.facts && !index.length) {
      noReportYet.value = true;
    } else if (reports.value.facts) {
      noReportYet.value = false;
    }
  }

  async fetchReportStatus() {
    const data = await ep.reportsStatus();
    const running = data?.running ?? false;
    const prev = reports.value.run;
    reports.value = {
      ...reports.value,
      run: {
        running,
        startedAt: data?.started_at ?? prev.startedAt,
        message: data?.message ?? null,
        success: running ? null : (data?.success ?? null),
        // Keep last stage while running if the payload omitted it
        stage: running
          ? (data?.stage ?? prev.stage)
          : (data?.stage ?? null),
        stageLabel: running
          ? (data?.stage_label ?? prev.stageLabel)
          : (data?.stage_label ?? null),
        stageDetail: running
          ? (data?.stage_detail ?? prev.stageDetail)
          : null,
      },
    };
    return data;
  }

  async runReport(payload) {
    return ep.reportsRun(payload);
  }

  async fetchModrinthStatus() {
    const data = await ep.modrinthStatus();
    modrinthScan.value = {
      ...modrinthScan.value,
      status: {
        ...modrinthScan.value.status,
        ...data,
        running: !!data?.running,
      },
    };
    return data;
  }

  async runModrinthScan() {
    return ep.modrinthScanStart();
  }

  // ── Ops cache ─────────────────────────────────────────────────────────────

  async fetchOpsCache() {
    const data = await ep.opsCache();
    opsCache.value = { data, at: Date.now() };
    return data;
  }

  // ── Issues / incidents ────────────────────────────────────────────────────

  async fetchIssuesPeek() {
    const data = await ep.issuesPeek();
    issuesPeek.value = { data, at: Date.now() };
    return data;
  }

  // ── Activity ──────────────────────────────────────────────────────────────

  async scanActivity() {
    return ep.activityScan();
  }

  async fetchActivity(hours) {
    const data = await ep.activityGet(hours);
    activity.value = {
      events: data?.events ?? [],
      at: Date.now(),
      loading: false,
    };
    return data;
  }

  // ── Scans ─────────────────────────────────────────────────────────────────

  async scanCrashes() {
    return ep.crashesScan();
  }

  async scanMods() {
    return ep.modsScan();
  }

  async fetchModsTree(modId) {
    return ep.modsTree(modId);
  }

  async scanBackups() {
    return ep.backupsScan();
  }

  async saveBackupDirs(dirs) {
    const data = await ep.backupsDirs(dirs);
    await this.fetchOpsCache().catch(() => null);
    await this.fetchSettings().catch(() => null);
    return data;
  }

  async saveBackupExternal(payload) {
    const data = await ep.backupsExternal(payload);
    if (data?.settings) {
      settings.value = { ...settings.value, data: data.settings, error: null };
    } else {
      await this.fetchSettings().catch(() => null);
    }
    await this.fetchOpsCache().catch(() => null);
    return data;
  }

  // ── Crash acks / groups / inbox ───────────────────────────────────────────

  async fetchCrashAcks() {
    const data = await ep.crashesAcks();
    acks.value = {
      ...acks.value,
      crashes: data?.acknowledged_crashes ?? {},
    };
    return data;
  }

  async fetchIssueAcks() {
    const data = await ep.issuesAcks();
    acks.value = {
      ...acks.value,
      issues: data?.acknowledged_issues ?? {},
    };
    return data;
  }

  async fetchIssueSuppressions() {
    const data = await ep.listIssueSuppressions();
    issueSuppressions.value = { data, at: Date.now() };
    return data;
  }

  async ackIssue(payload) {
    const data = await ep.issuesAck(payload);
    if (data?.acknowledged_issues) {
      acks.value = { ...acks.value, issues: data.acknowledged_issues };
    }
    const id = payload?.id;
    if (payload?.reviewed !== false && typeof id === 'string' && id.startsWith('modrinth:')) {
      const modId = id.slice('modrinth:'.length);
      const inboxId = `mod_update:${modId}`;
      try {
        await ep.inboxDismiss({ id: inboxId });
        inbox.value = {
          items: (inbox.value.items ?? []).filter((it) => it.id !== inboxId),
          at: Date.now(),
          dismissals: { ...inbox.value.dismissals, [inboxId]: true },
        };
      } catch {
        /* ignore */
      }
    } else {
      await this.fetchInbox().catch(() => null);
    }
    return data;
  }

  async acknowledgeAllIssues(payload = {}) {
    const data = await ep.issuesAcknowledgeAll(payload);
    if (data?.acknowledged_issues) {
      acks.value = { ...acks.value, issues: data.acknowledged_issues };
    }
    const ids = Array.isArray(payload?.ids) ? payload.ids : [];
    for (const id of ids) {
      if (typeof id !== 'string' || !id.startsWith('modrinth:')) continue;
      const modId = id.slice('modrinth:'.length);
      const inboxId = `mod_update:${modId}`;
      try {
        await ep.inboxDismiss({ id: inboxId });
        inbox.value = {
          items: (inbox.value.items ?? []).filter((it) => it.id !== inboxId),
          at: Date.now(),
          dismissals: { ...inbox.value.dismissals, [inboxId]: true },
        };
      } catch {
        /* ignore */
      }
    }
    await this.fetchInbox().catch(() => null);
    return data;
  }

  async dismissInboxItem(payload) {
    const data = await ep.inboxDismiss(payload);
    const id = payload?.id;
    if (id) {
      inbox.value = {
        items: (inbox.value.items ?? []).filter((it) => it.id !== id),
        at: Date.now(),
        dismissals: { ...inbox.value.dismissals, [id]: true },
      };
      if (typeof id === 'string' && id.startsWith('mod_update:')) {
        const modId = id.slice('mod_update:'.length);
        const issueKey = `modrinth:${modId}`;
        if (!acks.value.issues?.[issueKey]) {
          try {
            const ackData = await ep.issuesAck({ id: issueKey, reviewed: true });
            if (ackData?.acknowledged_issues) {
              acks.value = { ...acks.value, issues: ackData.acknowledged_issues };
            } else {
              acks.value = {
                ...acks.value,
                issues: {
                  ...(acks.value.issues ?? {}),
                  [issueKey]: { ackedAt: new Date().toISOString(), by: 'dashboard' },
                },
              };
            }
          } catch {
            /* ignore */
          }
        }
      }
    }
    return data;
  }

  async ackCrash(payload) {
    const data = await ep.crashesAck(payload);
    if (data?.acknowledged_crashes) {
      acks.value = { ...acks.value, crashes: data.acknowledged_crashes };
    }
    await this.fetchCrashesGrouped().catch(() => null);
    return data;
  }

  async fetchCrashesGrouped() {
    const data = await ep.crashesGrouped();
    crashGroups.value = {
      groups: data?.groups ?? [],
      count: data?.count ?? 0,
      unreviewed: data?.unreviewed ?? 0,
      unreviewed_groups: data?.unreviewed_groups ?? 0,
      scanned_at: data?.scanned_at ?? null,
      at: Date.now(),
    };
    return data;
  }

  async acknowledgeAllCrashes(payload = {}) {
    const data = await ep.crashesAcknowledgeAll(payload);
    if (data?.acknowledged_crashes) {
      acks.value = { ...acks.value, crashes: data.acknowledged_crashes };
    }
    crashGroups.value = {
      groups: data?.groups ?? crashGroups.value.groups,
      count: data?.count ?? crashGroups.value.count,
      unreviewed: data?.unreviewed ?? 0,
      unreviewed_groups: data?.unreviewed_groups ?? 0,
      scanned_at: data?.scanned_at ?? crashGroups.value.scanned_at,
      at: Date.now(),
    };
    await this.fetchInbox().catch(() => null);
    return data;
  }

  async fetchInbox() {
    const data = await ep.inboxGet();
    inbox.value = { items: data?.items ?? [], at: Date.now(), dismissals: inbox.value.dismissals };
    return data;
  }

  async fetchCrashContext(file, minutes) {
    return ep.crashesContext(file, minutes);
  }

  async fetchCrashReport(file) {
    const data = await ep.crashesReport(file);
    return data?.content ?? (typeof data === 'string' ? data : null);
  }

  // ── Logs ──────────────────────────────────────────────────────────────────

  async fetchLogsList() {
    return ep.logsList();
  }

  async fetchLogContent(file, tail = 2000) {
    return ep.logsContent(file, tail);
  }

  // ── Client mod ignores ────────────────────────────────────────────────────

  async fetchClientModIgnores() {
    return ep.clientModsIgnores();
  }

  async ignoreClientMod(payload) {
    return ep.clientModsIgnore(payload);
  }

  // ── Spark ─────────────────────────────────────────────────────────────────

  async fetchSparkProfiles() {
    const data = await ep.sparkProfiles();
    spark.value = {
      ...spark.value,
      profiles: data?.profiles ?? [],
      searchDirs: data?.search_dirs ?? [],
      enabled: data?.spark_enabled !== false && data?.enabled !== false,
    };
    return data;
  }

  async fetchSparkProfile(path) {
    const data = await ep.sparkProfile(path);
    const profile = data?.spark_profile ?? data;
    spark.value = { ...spark.value, profile, activePath: path, loading: false, error: null };
    return profile;
  }

  // ── Performance ───────────────────────────────────────────────────────────

  async fetchPerformance(window) {
    const w = window ?? '7d';
    const [dashboard, insights, rollups] = await Promise.all([
      ep.performanceDashboard(w).catch(() => null),
      ep.performanceInsights(w).catch(() => null),
      ep.performanceRollups(w === '30d' ? 720 : 168).catch(() => null),
    ]);
    performance.value = { window: w, dashboard, insights, rollups, at: Date.now() };
    return { dashboard, insights, rollups };
  }

  async fetchPerformanceRollups(hours) {
    const data = await ep.performanceRollups(hours);
    performance.value = { ...performance.value, rollups: data, at: Date.now() };
    return data;
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  async fetchSettings() {
    const data = await ep.settingsGet();
    settings.value = { ...settings.value, data, error: null };
    return data;
  }

  async saveSettings(payload) {
    const data = await ep.settingsPost(payload);
    settings.value = { ...settings.value, data: { ...settings.value.data, ...payload }, error: null };
    return data;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async fetchConfig() {
    return ep.config();
  }

  async fetchSession() {
    const data = await ep.authSession();
    auth.value = { ...auth.value, session: data };
    return data;
  }

  // ── Update check ──────────────────────────────────────────────────────────

  async fetchUpdateCheck() {
    const data = await ep.updateCheck();
    updateCheck.value = { data, at: Date.now() };
    return data;
  }

  // ── Incident pin ──────────────────────────────────────────────────────────

  async pinIncident(note) {
    return ep.incidentPin(note);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function _countPoints(raw) {
  if (!raw) return 0;
  return [
    'tps', 'mspt', 'host_cpu', 'players', 'heap_mb',
    'mem_available_gb', 'disk_use_pct', 'net_rx_mbps',
    'net_tx_mbps', 'disk_read_mb_s', 'disk_write_mb_s',
    'thermal_package', 'thermal_ambient',
  ].reduce((n, k) => n + (raw[k]?.length ?? 0), 0);
}
