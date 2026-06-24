/** Watchtower dashboard API client (embedded mod or static preview fallback) */
function watchtowerApiFetch(url, options = {}) {
  if (typeof WatchtowerAuth !== 'undefined' && WatchtowerAuth.isEmbedded()) {
    return WatchtowerAuth.apiFetch(url, options);
  }
  return fetch(url, options);
}

const WatchtowerApi = {
  isEmbedded() {
    return document.documentElement.dataset.embedded === 'true';
  },

  async fetchConfig() {
    const r = await watchtowerApiFetch('/api/config');
    if (!r.ok) throw new Error('config unavailable');
    return r.json();
  },

  async fetchSettings() {
    const r = await watchtowerApiFetch('/api/settings');
    if (!r.ok) throw new Error('settings unavailable');
    return r.json();
  },

  async fetchDataSources() {
    const r = await watchtowerApiFetch('/api/data-sources');
    if (!r.ok) throw new Error('data sources unavailable');
    return r.json();
  },

  async get(path) {
    const r = await watchtowerApiFetch(path);
    if (!r.ok) throw new Error(`${path} unavailable`);
    return r.json();
  },

  async saveSettings(payload) {
    const r = await watchtowerApiFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'settings save failed');
    }
    return r.json();
  },

  async fetchLive() {
    const r = await watchtowerApiFetch('/api/live');
    if (!r.ok) throw new Error('live unavailable');
    return r.json();
  },

  async fetchPlayers() {
    const r = await watchtowerApiFetch('/api/players');
    if (!r.ok) throw new Error('players unavailable');
    return r.json();
  },

  async fetchSamples(windowMinutes = 1440, maxPoints = 500, signal) {
    const r = await watchtowerApiFetch(
      `/api/samples?minutes=${windowMinutes}&max_points=${maxPoints}`,
      { signal },
    );
    if (!r.ok) throw new Error('samples unavailable');
    return r.json();
  },

  async fetchReportsIndex() {
    const r = await watchtowerApiFetch('/api/reports/index');
    if (!r.ok) throw new Error('reports index unavailable');
    return r.json();
  },

  async fetchLatestReport() {
    const r = await watchtowerApiFetch('/api/reports/latest');
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('latest report unavailable');
    return r.json();
  },

  async fetchReport(factsFile) {
    const r = await watchtowerApiFetch(`/api/reports/get?facts=${encodeURIComponent(factsFile)}`);
    if (!r.ok) throw new Error('report unavailable');
    return r.json();
  },

  async fetchReportStatus() {
    const r = await watchtowerApiFetch('/api/reports/status');
    if (!r.ok) throw new Error('status unavailable');
    return r.json();
  },

  async fetchActivity(hours = 24) {
    const r = await watchtowerApiFetch(`/api/activity?hours=${hours}`);
    if (!r.ok) throw new Error('activity unavailable');
    return r.json();
  },

  async runReport(payload) {
    const r = await watchtowerApiFetch('/api/reports/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 409) return data;
    if (!r.ok) throw new Error(data.message || data.error || 'run failed');
    return data;
  },

  async fetchCrashAcks() {
    const r = await watchtowerApiFetch('/api/crashes/acks');
    if (!r.ok) throw new Error('crash acks unavailable');
    return r.json();
  },

  async postCrashAck(payload) {
    const r = await watchtowerApiFetch('/api/crashes/ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error('crash ack failed');
    return r.json();
  },

  async fetchClientModIgnores() {
    const r = await watchtowerApiFetch('/api/client-mods/ignores');
    if (!r.ok) throw new Error('client mod ignores unavailable');
    return r.json();
  },

  async postClientModIgnore(payload) {
    const r = await watchtowerApiFetch('/api/client-mods/ignore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error('client mod ignore failed');
    return r.json();
  },

  async fetchCrashContext(file, minutes = 10) {
    const r = await watchtowerApiFetch(`/api/crashes/context?file=${encodeURIComponent(file)}&minutes=${minutes}`);
    if (!r.ok) throw new Error('crash context unavailable');
    return r.json();
  },

  async fetchCrashReport(file) {
    const r = await watchtowerApiFetch(`/api/crashes/report?file=${encodeURIComponent(file)}`);
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(text || 'crash report unavailable');
    }
    return r.json();
  },

  async postCrashScan() {
    const r = await watchtowerApiFetch('/api/crashes/scan', { method: 'POST' });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || 'crash scan failed');
    }
    return r.json();
  },

  async postModsScan() {
    const r = await watchtowerApiFetch('/api/mods/scan', { method: 'POST' });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || 'mod scan failed');
    }
    return r.json();
  },

  async fetchOpsCache() {
    const r = await watchtowerApiFetch('/api/ops-cache');
    if (!r.ok) throw new Error('ops cache unavailable');
    return r.json();
  },

  async postActivityScan() {
    const r = await watchtowerApiFetch('/api/activity/scan', { method: 'POST' });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || 'activity scan failed');
    }
    return r.json();
  },

  async fetchIssuesPeek() {
    const r = await watchtowerApiFetch('/api/issues/peek');
    if (!r.ok) throw new Error('issues peek unavailable');
    return r.json();
  },

  async fetchIncidents() {
    const r = await watchtowerApiFetch('/api/incidents');
    if (!r.ok) throw new Error('incidents unavailable');
    return r.json();
  },

  async fetchIncident(id) {
    const r = await watchtowerApiFetch(`/api/incidents/get?id=${encodeURIComponent(id)}`);
    if (!r.ok) throw new Error('incident unavailable');
    return r.json();
  },

  async postIncidentPin(note) {
    const r = await watchtowerApiFetch('/api/incidents/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: note || null }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || 'pin failed');
    }
    return r.json();
  },

  async postBackupScan() {
    const r = await watchtowerApiFetch('/api/backups/scan', { method: 'POST' });
    if (!r.ok) throw new Error('backup scan failed');
    return r.json();
  },

  async postOnboardingAudit() {
    const r = await watchtowerApiFetch('/api/onboarding/audit', { method: 'POST' });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || 'onboarding audit failed');
    }
    return r.json();
  },

  async fetchFsRoots() {
    const r = await watchtowerApiFetch('/api/fs/roots');
    if (!r.ok) throw new Error('fs roots unavailable');
    return r.json();
  },

  async fetchFsList(path) {
    const r = await watchtowerApiFetch(`/api/fs/list?path=${encodeURIComponent(path)}`);
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'fs list failed');
    }
    return r.json();
  },

  async postBackupDirs(dirs) {
    const r = await watchtowerApiFetch('/api/backups/dirs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dirs }),
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(text || 'backup dirs save failed');
    }
    return r.json();
  },

  async postBackupExternal(payload) {
    if (!this.isEmbedded()) {
      return { ok: true, settings: {} };
    }
    const r = await watchtowerApiFetch('/api/backups/external', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || 'external backup save failed');
    }
    return r.json();
  },

  async postBackupExternalTest() {
    if (!this.isEmbedded()) {
      return {
        ok: true,
        backup_external: {
          configured: true,
          status: 'success',
          source: 'dashboard-test',
          stale: false,
        },
      };
    }
    const r = await watchtowerApiFetch('/api/backups/external/test', { method: 'POST' });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || 'test heartbeat failed');
    }
    return r.json();
  },

  async fetchUpdateCheck() {
    const r = await watchtowerApiFetch('/api/update/check');
    if (!r.ok) throw new Error('update check unavailable');
    return r.json();
  },

  async fetchOverviewMeta() {
    const r = await watchtowerApiFetch('/api/overview/meta');
    if (!r.ok) throw new Error('overview meta unavailable');
    return r.json();
  },

  async fetchPerformanceRollups(hours = 24) {
    const r = await watchtowerApiFetch(`/api/performance/rollups?hours=${encodeURIComponent(hours)}`);
    if (!r.ok) throw new Error('performance rollups unavailable');
    return r.json();
  },

  async fetchPerformanceDashboard(window = '7d') {
    const r = await watchtowerApiFetch(`/api/performance/dashboard?window=${encodeURIComponent(window)}`);
    if (!r.ok) throw new Error('performance dashboard unavailable');
    return r.json();
  },

  async fetchPerformanceInsights(window = '7d') {
    const r = await watchtowerApiFetch(`/api/performance/insights?window=${encodeURIComponent(window)}`);
    if (!r.ok) throw new Error('performance insights unavailable');
    return r.json();
  },

  async downloadPerformanceExport(window = '7d') {
    const r = await watchtowerApiFetch(`/api/performance/export?window=${encodeURIComponent(window)}&format=csv`);
    if (!r.ok) throw new Error('performance export unavailable');
    return r.blob();
  },

  async downloadSupportBundle() {
    const r = await watchtowerApiFetch('/api/support/bundle');
    if (!r.ok) throw new Error('support bundle unavailable');
    return r.blob();
  },

  async fetchSparkProfiles() {
    const r = await watchtowerApiFetch('/api/spark/profiles');
    if (!r.ok) throw new Error('spark profiles unavailable');
    return r.json();
  },

  async fetchSparkProfile(path) {
    const r = await watchtowerApiFetch(`/api/spark/profile?path=${encodeURIComponent(path)}`);
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || 'spark profile unavailable');
    }
    return r.json();
  },
};
