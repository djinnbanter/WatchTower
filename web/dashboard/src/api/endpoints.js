import { apiFetch } from './http.js';

function isFixturePreview() {
  return typeof document !== 'undefined'
    && document.documentElement?.dataset?.embedded !== 'true';
}

async function loadFixtureJson(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Fixture missing: ${path}`);
  return r.json();
}

// ── Config ──────────────────────────────────────────────────────────────────

export async function config() {
  return apiFetch('/api/config');
}

export async function settingsGet() {
  return apiFetch('/api/settings');
}

export async function settingsPost(payload) {
  return apiFetch('/api/settings', { method: 'POST', body: payload });
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function authSession() {
  return apiFetch('/api/auth/session');
}

export async function login(username, password, remember) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: { username, password, remember: !!remember },
  });
}

export async function totp(code, recovery = false) {
  return apiFetch('/api/auth/totp', {
    method: 'POST',
    body: { code, recovery },
  });
}

export async function logout() {
  return apiFetch('/api/auth/logout', { method: 'POST' });
}

export async function changePassword(currentPassword, newPassword, username) {
  const body = {
    current_password: currentPassword,
    new_password: newPassword,
  };
  if (username != null && String(username).trim()) {
    body.username = String(username).trim();
  }
  return apiFetch('/api/auth/change-password', {
    method: 'POST',
    body,
  });
}

export async function changeUsername(username) {
  return apiFetch('/api/auth/change-username', { method: 'POST', body: { username } });
}

export async function totpSetup() {
  return apiFetch('/api/auth/totp/setup', { method: 'POST' });
}

export async function totpConfirm(code) {
  return apiFetch('/api/auth/totp/confirm', { method: 'POST', body: { code } });
}

export async function totpDisable(password, code) {
  return apiFetch('/api/auth/totp/disable', { method: 'POST', body: { password, code } });
}

export async function recoveryRegenerate(password, code) {
  return apiFetch('/api/auth/recovery/regenerate', { method: 'POST', body: { password, code } });
}

// ── Live & samples ────────────────────────────────────────────────────────────

export async function live(signal) {
  return apiFetch('/api/live', { signal });
}

export async function samples(windowMinutes = 60, maxPoints = 500, signal) {
  return apiFetch(`/api/samples?minutes=${windowMinutes}&max_points=${maxPoints}`, { signal });
}

export async function players() {
  return apiFetch('/api/players');
}

// ── Performance ───────────────────────────────────────────────────────────────

export async function performanceRollups(hours = 168) {
  return apiFetch(`/api/performance/rollups?hours=${encodeURIComponent(hours)}`);
}

export async function performanceInsights(window = '7d') {
  return apiFetch(`/api/performance/insights?window=${encodeURIComponent(window)}`);
}

export async function performanceDashboard(window = '7d') {
  return apiFetch(`/api/performance/dashboard?window=${encodeURIComponent(window)}`);
}

/** Freeze a new performance baseline from recent healthy L1 history. */
export async function performanceBaselineSetNow() {
  return apiFetch('/api/performance/baseline', {
    method: 'POST',
    body: { action: 'set_now' },
  });
}

/** Returns a Blob (CSV). Caller responsible for triggering download. */
export async function performanceExport(window = '7d') {
  const r = await fetch(`/api/performance/export?window=${encodeURIComponent(window)}&format=csv`, {
    credentials: 'include',
  });
  if (!r.ok) throw new Error('performance export unavailable');
  return r.blob();
}

// ── Server icon ───────────────────────────────────────────────────────────────

export function serverIconUrl() {
  return '/api/server-icon';
}

// ── Overview ──────────────────────────────────────────────────────────────────

export async function overviewMeta() {
  return apiFetch('/api/overview/meta');
}

export async function dataSources() {
  return apiFetch('/api/data-sources');
}

// ── Reports ───────────────────────────────────────────────────────────────────

export async function reportsIndex() {
  return apiFetch('/api/reports/index');
}

export async function reportsLatest() {
  return apiFetch('/api/reports/latest');
}

export async function reportsGet(factsFile) {
  return apiFetch(`/api/reports/get?facts=${encodeURIComponent(factsFile)}`);
}

export async function reportsStatus() {
  return apiFetch('/api/reports/status');
}

export async function reportsRun(payload) {
  return apiFetch('/api/reports/run', { method: 'POST', body: payload });
}

export async function modrinthStatus() {
  return apiFetch('/api/modrinth/status');
}

export async function modrinthScanStart() {
  return apiFetch('/api/modrinth/scan', { method: 'POST', body: {} });
}

// ── Ops cache ─────────────────────────────────────────────────────────────────

export async function opsCache() {
  return apiFetch('/api/ops-cache');
}

// ── Issues ────────────────────────────────────────────────────────────────────

export async function issuesPeek() {
  return apiFetch('/api/issues/peek');
}

export async function issuesAcks() {
  return apiFetch('/api/issues/acks');
}

export async function issuesAck(payload) {
  return apiFetch('/api/issues/ack', { method: 'POST', body: payload });
}

export async function issuesAcknowledgeAll(payload = {}) {
  return apiFetch('/api/issues/acknowledge-all', { method: 'POST', body: payload });
}

export async function listIssueSuppressions() {
  if (isFixturePreview()) {
    return { conf_ids: ['CLIENT_ON_SERVER'], state: [], merged: [{ id: 'CLIENT_ON_SERVER', source: 'conf' }] };
  }
  return apiFetch('/api/issues/suppressions');
}

export async function suppressIssue(payload) {
  if (isFixturePreview()) {
    return { ok: true, suppressions: { merged: [{ id: payload?.issue_id, source: 'state' }] } };
  }
  return apiFetch('/api/issues/suppress', { method: 'POST', body: payload });
}

export async function unsuppressIssue(payload) {
  if (isFixturePreview()) {
    return { ok: true, removed: true, suppressions: { merged: [] } };
  }
  return apiFetch('/api/issues/unsuppress', { method: 'POST', body: payload });
}

export async function listCrashRules() {
  if (isFixturePreview()) {
    return {
      packs: [{
        id: 'builtin',
        name: 'WatchTower builtin crash rules',
        priority: 50,
        builtin: true,
        source: 'classpath:builtin-rules/create-contraption-npe.yaml',
        rules: [{ id: 'create-contraption-npe', priority: 200, description: 'Create contraption mf.axis NPE' }],
      }],
      warnings: [],
    };
  }
  return apiFetch('/api/rules');
}

export async function validateCrashRules(yaml) {
  if (isFixturePreview()) {
    const bad = /exec|jexl|\bhttp\b/i.test(yaml || '');
    return bad
      ? { valid: false, errors: ['Forbidden or unknown key in preview validate'] }
      : { valid: true, errors: [] };
  }
  return apiFetch('/api/rules/validate', { method: 'POST', body: { yaml } });
}

// ── Activity ──────────────────────────────────────────────────────────────────

export async function activityScan() {
  return apiFetch('/api/activity/scan', { method: 'POST' });
}

export async function activityGet(hours = 24) {
  return apiFetch(`/api/activity?hours=${hours}`);
}

// ── Mods ──────────────────────────────────────────────────────────────────────

export async function modsScan() {
  return apiFetch('/api/mods/scan', { method: 'POST' });
}

export async function modsTree(modId) {
  return apiFetch(`/api/mods/tree?mod_id=${encodeURIComponent(modId)}`);
}

export async function forensicsStatus() {
  if (isFixturePreview()) {
    return loadFixtureJson('data/forensics-status.json');
  }
  return apiFetch('/api/mods/forensics/status');
}

export async function forensicsFindClass(payload) {
  if (isFixturePreview()) {
    const fixture = await loadFixtureJson('data/forensics-find-class.json');
    const q = String(payload?.class || '').replace(/\./g, '/').toLowerCase();
    const hits = (fixture.matches || []).filter((m) => {
      const cls = String(m.class || m.inner_path || '').toLowerCase();
      return !q || cls.includes(q) || q.includes('contraption') || q.includes('luckperms');
    });
    return {
      ...fixture,
      query: payload?.class ?? fixture.query,
      matches: hits.length ? hits : (fixture.matches || []).slice(0, 1),
      truncated: false,
    };
  }
  return apiFetch('/api/mods/forensics/find-class', { method: 'POST', body: payload });
}

export async function forensicsFindPackage(payload) {
  if (isFixturePreview()) {
    const fixture = await loadFixtureJson('data/forensics-find-class.json');
    return {
      package: payload?.package ?? 'com.simibubi.create',
      mode: payload?.mode ?? 'prefix',
      matches: (fixture.matches || []).slice(0, 3),
    };
  }
  return apiFetch('/api/mods/forensics/find-package', { method: 'POST', body: payload });
}

export async function forensicsScanCorrupt() {
  if (isFixturePreview()) {
    return {
      enabled: false,
      reason: 'FORENSICS_CORRUPT_JAR_WALK=false in preview — log-pattern corrupt jars still shown from facts',
      corrupt_jars: [],
    };
  }
  return apiFetch('/api/mods/forensics/scan-corrupt', { method: 'POST' });
}

export async function forensicsConfigHealth() {
  if (isFixturePreview()) {
    return loadFixtureJson('data/forensics-config-health.json');
  }
  return apiFetch('/api/mods/forensics/config-health');
}

// ── Crashes ───────────────────────────────────────────────────────────────────

export async function crashesScan() {
  return apiFetch('/api/crashes/scan', { method: 'POST' });
}

export async function crashesAcks() {
  return apiFetch('/api/crashes/acks');
}

export async function crashesAck(payload) {
  return apiFetch('/api/crashes/ack', { method: 'POST', body: payload });
}

export async function crashesGrouped() {
  return apiFetch('/api/crashes');
}

export async function crashesAcknowledgeAll(payload = {}) {
  return apiFetch('/api/crashes/acknowledge-all', { method: 'POST', body: payload });
}

export async function inboxGet() {
  return apiFetch('/api/inbox');
}

export async function inboxDismiss(payload) {
  return apiFetch('/api/inbox/dismiss', { method: 'POST', body: payload });
}

export async function crashesContext(file, minutes = 10) {
  return apiFetch(`/api/crashes/context?file=${encodeURIComponent(file)}&minutes=${minutes}`);
}

export async function crashesReport(file) {
  return apiFetch(`/api/crashes/report?file=${encodeURIComponent(file)}`);
}

// ── Logs ──────────────────────────────────────────────────────────────────────

export async function logsList() {
  return apiFetch('/api/logs/list');
}

export async function logsContent(file, tail = 2000) {
  return apiFetch(`/api/logs/content?file=${encodeURIComponent(file)}&tail=${encodeURIComponent(tail)}`);
}

// ── Onboarding ────────────────────────────────────────────────────────────────

export async function onboardingAudit() {
  if (isFixturePreview()) {
    return discoveryStart();
  }
  return apiFetch('/api/onboarding/audit', { method: 'POST' });
}

export async function discoveryStart() {
  if (isFixturePreview()) {
    return { status: 'started', running: true, message: 'Initial discovery started (preview)' };
  }
  return apiFetch('/api/onboarding/discovery/start', { method: 'POST' });
}

export async function discoveryStatus() {
  if (isFixturePreview()) {
    return null; // FixtureSource owns simulated progress
  }
  return apiFetch('/api/onboarding/discovery/status');
}

/** Read-only server.properties + JVM summary audit (1.1.8). */
export async function configAuditGet() {
  if (isFixturePreview()) {
    try {
      const facts = await loadFixtureJson('data/facts.json');
      const audit = facts?.optional?.config_launch_audit;
      if (audit) return audit;
    } catch {
      /* fall through */
    }
    return {
      updated_at: new Date().toISOString(),
      source: 'server.properties',
      path: 'server.properties',
      status: 'ok',
      read_only: true,
      properties: [
        {
          key: 'view-distance',
          value: '12',
          value_num: 12,
          verdict: 'consider_lowering',
          title: 'View distance',
          detail: '12 is above the usual 6–10 range for modded dedicated servers. Higher view-distance loads more chunks per player — often the first place modded servers cut lag.',
          tab_link: 'startup',
        },
        {
          key: 'simulation-distance',
          value: '8',
          value_num: 8,
          verdict: 'fine',
          title: 'Simulation distance',
          detail: 'Simulation distance 8 is in the usual range for modded dedicated servers.',
          tab_link: 'startup',
        },
        {
          key: 'max-tick-time',
          value: '60000',
          value_num: 60000,
          verdict: 'fine',
          title: 'Max tick time',
          detail: 'max-tick-time 60000ms gives the server room before a watchdog kill.',
          tab_link: 'startup',
        },
        {
          key: 'sync-chunk-writes',
          value: 'true',
          verdict: 'consider_lowering',
          title: 'Sync chunk writes',
          detail: 'sync-chunk-writes is true. Consider setting false on dedicated servers to reduce stutter from synchronous disk flushes.',
          tab_link: 'startup',
        },
      ],
      jvm: {
        flags_profile: 'g1_basic',
        advice: 'Worth adding missing flags from the Aikar / flags.sh baseline.',
        tab_link: 'insights',
        tab_params: { view: 'configs' },
      },
      summary: { fine: 2, consider: 2, missing: 0 },
    };
  }
  return apiFetch('/api/config-audit');
}

// ── Incidents ─────────────────────────────────────────────────────────────────

export async function incidents() {
  return apiFetch('/api/incidents');
}

export async function incidentGet(id) {
  return apiFetch(`/api/incidents/get?id=${encodeURIComponent(id)}`);
}

export async function incidentPin(note) {
  return apiFetch('/api/incidents/pin', { method: 'POST', body: { note: note ?? null } });
}

// ── Backups ───────────────────────────────────────────────────────────────────

export async function backupsScan() {
  return apiFetch('/api/backups/scan', { method: 'POST' });
}

export async function backupsDirs(dirs) {
  return apiFetch('/api/backups/dirs', { method: 'POST', body: { dirs } });
}

export async function backupsExternal(payload) {
  return apiFetch('/api/backups/external', { method: 'POST', body: payload });
}

export async function backupsExternalTest() {
  return apiFetch('/api/backups/external/test', { method: 'POST' });
}

// ── Filesystem ────────────────────────────────────────────────────────────────

export async function fsRoots() {
  return apiFetch('/api/fs/roots');
}

export async function fsList(path) {
  return apiFetch(`/api/fs/list?path=${encodeURIComponent(path)}`);
}

// ── Spark ─────────────────────────────────────────────────────────────────────

export async function sparkProfiles() {
  return apiFetch('/api/spark/profiles');
}

export async function sparkProfile(path) {
  return apiFetch(`/api/spark/profile?path=${encodeURIComponent(path)}`);
}

export async function sparkImport(url) {
  return apiFetch('/api/spark/import', { method: 'POST', body: { url } });
}

// ── Client mods ───────────────────────────────────────────────────────────────

export async function clientModsIgnores() {
  return apiFetch('/api/client-mods/ignores');
}

export async function clientModsIgnore(payload) {
  return apiFetch('/api/client-mods/ignore', { method: 'POST', body: payload });
}

// ── Update check ──────────────────────────────────────────────────────────────

export async function updateCheck() {
  return apiFetch('/api/update/check');
}

// ── Support ───────────────────────────────────────────────────────────────────

/** Returns a Blob (.zip). Caller responsible for triggering download. */
export async function supportBundle() {
  return supportBundleDownload();
}

export async function supportCatalog() {
  return apiFetch('/api/support/catalog');
}

export async function supportCompose(options) {
  return apiFetch('/api/support/compose', { method: 'POST', body: options || {} });
}

/** Download ready zip after compose (optional ?path= basename). */
export async function supportBundleDownload(path) {
  const q = path ? `?path=${encodeURIComponent(path)}` : '';
  const r = await fetch(`/api/support/bundle${q}`, { credentials: 'include' });
  if (!r.ok) {
    let msg = 'support bundle unavailable';
    try {
      const j = await r.json();
      if (j?.message) msg = j.message;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return r.blob();
}
