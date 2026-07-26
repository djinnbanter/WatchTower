export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const hasJsonBody = Boolean(init?.body) && !(init?.body instanceof FormData);
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${path}: ${text || res.statusText}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json() as Promise<T>;
  return res.text() as Promise<T>;
}

function unwrapSparkProfile(body: Record<string, unknown>): Record<string, unknown> {
  const nested = body.spark_profile;
  return nested && typeof nested === 'object' && !Array.isArray(nested)
    ? (nested as Record<string, unknown>)
    : body;
}

export const api = {
  session: () => apiFetch<Record<string, unknown>>('/api/auth/session'),
  login: (username: string, password: string, remember = false) =>
    apiFetch<Record<string, unknown>>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, remember }),
    }),
  totp: (code: string, recovery = false) =>
    apiFetch<Record<string, unknown>>('/api/auth/totp', {
      method: 'POST',
      body: JSON.stringify({ code, recovery }),
    }),
  logout: () => apiFetch('/api/auth/logout', { method: 'POST', body: '{}' }),
  changePassword: (currentPassword: string, newPassword: string, username?: string) => {
    const body: Record<string, string> = {
      current_password: currentPassword,
      new_password: newPassword,
    };
    if (username?.trim()) body.username = username.trim();
    return apiFetch<Record<string, unknown>>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  changeUsername: (username: string) =>
    apiFetch<Record<string, unknown>>('/api/auth/change-username', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),
  totpSetup: () => apiFetch<Record<string, unknown>>('/api/auth/totp/setup', { method: 'POST', body: '{}' }),
  totpConfirm: (code: string) =>
    apiFetch<Record<string, unknown>>('/api/auth/totp/confirm', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  totpDisable: (password: string, code: string) =>
    apiFetch<Record<string, unknown>>('/api/auth/totp/disable', {
      method: 'POST',
      body: JSON.stringify({ password, code }),
    }),
  recoveryRegenerate: (password: string, code: string) =>
    apiFetch<Record<string, unknown>>('/api/auth/recovery/regenerate', {
      method: 'POST',
      body: JSON.stringify({ password, code }),
    }),

  settings: () => apiFetch<Record<string, unknown>>('/api/settings'),
  saveSettings: (body: Record<string, unknown>) =>
    apiFetch('/api/settings', { method: 'POST', body: JSON.stringify(body) }),
  live: () => apiFetch<Record<string, unknown>>('/api/live'),
  /** Live player directory (online overlay + Scanning roster). */
  players: () => apiFetch<Record<string, unknown>>('/api/players'),
  samples: (minutes = 60, maxPoints = 500) =>
    apiFetch<Record<string, unknown>>(
      `/api/samples?minutes=${encodeURIComponent(String(minutes))}&max_points=${encodeURIComponent(String(maxPoints))}`,
    ),
  overviewMeta: () => apiFetch<Record<string, unknown>>('/api/overview/meta'),
  /** Watching / Scanning / Support compose freshness + poll intervals. */
  dataSources: () => apiFetch<Record<string, unknown>>('/api/data-sources'),
  opsCache: () => apiFetch<Record<string, unknown>>('/api/ops-cache'),
  issuesPeek: () => apiFetch<Record<string, unknown>>('/api/issues/peek'),
  performanceDashboard: (window = '7d') =>
    apiFetch<Record<string, unknown>>(`/api/performance/dashboard?window=${encodeURIComponent(window)}`),
  performanceInsights: (window = '7d') =>
    apiFetch<Record<string, unknown>>(`/api/performance/insights?window=${encodeURIComponent(window)}`),
  /** Capture / reset performance baseline from the last ~24h of samples. */
  performanceBaselineSetNow: () =>
    apiFetch<Record<string, unknown>>('/api/performance/baseline', { method: 'POST', body: '{}' }),
  /** CSV export URL for the analysis window (fixture may stub). */
  performanceExportCsvUrl: (window = '7d') =>
    `/api/performance/export?format=csv&window=${encodeURIComponent(window)}`,
  rollups: (hours = '24') =>
    apiFetch<Record<string, unknown>>(`/api/performance/rollups?hours=${encodeURIComponent(hours)}`),
  sparkProfiles: () => apiFetch<Record<string, unknown>>('/api/spark/profiles'),
  sparkProfile: async (path: string) =>
    unwrapSparkProfile(
      await apiFetch<Record<string, unknown>>(`/api/spark/profile?path=${encodeURIComponent(path)}`),
    ),
  importSparkProfile: (url: string) =>
    apiFetch<Record<string, unknown>>('/api/spark/import', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),
  uploadSparkProfile: (file: File) =>
    apiFetch<Record<string, unknown>>(`/api/spark/upload?name=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    }),
  sparkTree: (path: string, params: Record<string, string | number> = {}) => {
    const query = new URLSearchParams({ path });
    Object.entries(params).forEach(([key, value]) => query.set(key, String(value)));
    return apiFetch<Record<string, unknown>>(`/api/spark/tree?${query}`);
  },
  compareSparkProfiles: (baseline: string, target: string) =>
    apiFetch<Record<string, unknown>>(
      `/api/spark/compare?baseline=${encodeURIComponent(baseline)}&target=${encodeURIComponent(target)}`,
    ),
  logsIndex: () => apiFetch<Record<string, unknown>>('/api/logs/list'),
  logsContent: (file: string, tail = 2000) =>
    apiFetch<Record<string, unknown>>(
      `/api/logs/content?file=${encodeURIComponent(file)}&tail=${encodeURIComponent(String(tail))}`,
    ),
  crashContexts: () => apiFetch<Record<string, unknown>>('/api/crash-contexts'),
  crashesGrouped: () => apiFetch<Record<string, unknown>>('/api/crashes'),
  crashesAcks: () => apiFetch<Record<string, unknown>>('/api/crashes/acks'),
  ackCrash: (payload: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>('/api/crashes/ack', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  acknowledgeAllCrashes: (payload: Record<string, unknown> = {}) =>
    apiFetch<Record<string, unknown>>('/api/crashes/acknowledge-all', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  scanCrashes: () =>
    apiFetch<Record<string, unknown>>('/api/crashes/scan', { method: 'POST', body: '{}' }),
  crashContext: (file: string, minutes = 10) =>
    apiFetch<Record<string, unknown>>(
      `/api/crashes/context?file=${encodeURIComponent(file)}&minutes=${encodeURIComponent(String(minutes))}`,
    ),
  crashReport: (file: string) =>
    apiFetch<Record<string, unknown> | string>(
      `/api/crashes/report?file=${encodeURIComponent(file)}`,
    ),
  forensicsFindClass: (payload: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>('/api/forensics/find-class', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  /** Live mods_deep / forensics status (Mods → Forensics). */
  forensicsStatus: () => apiFetch<Record<string, unknown>>('/api/mods/forensics/status'),
  /** Refresh mods_light / log-error ledger without a deep audit. */
  modsScan: (force = true) =>
    apiFetch<Record<string, unknown>>('/api/mods/scan', {
      method: 'POST',
      body: JSON.stringify({ force }),
    }),
  /** Latest report facts (live: /api/reports/latest; fixture preview may alias /api/facts). */
  facts: async () => {
    try {
      const res = await apiFetch<Record<string, unknown>>('/api/reports/latest');
      const facts = res.facts;
      return facts && typeof facts === 'object' && !Array.isArray(facts)
        ? (facts as Record<string, unknown>)
        : {};
    } catch (e) {
      const msg = (e as Error)?.message ?? '';
      // No report yet is normal before discovery / first support compose.
      if (msg.includes('404') || msg.includes('no_report')) return {};
      throw e;
    }
  },
  /** Launch & config audit (server.properties + JVM strip). */
  configAudit: () => apiFetch<Record<string, unknown>>('/api/config-audit'),
  reportsIndex: () => apiFetch<Record<string, unknown>>('/api/reports/index'),
  reportsStatus: () => apiFetch<Record<string, unknown>>('/api/reports/status'),
  updateCheck: () => apiFetch<Record<string, unknown>>('/api/update-check'),
  modrinthStatus: () => apiFetch<Record<string, unknown>>('/api/modrinth/status'),
  /** Start a Modrinth lookup scan (cached; never downloads jars). */
  modrinthScanStart: () =>
    apiFetch<Record<string, unknown>>('/api/modrinth/scan', { method: 'POST', body: '{}' }),
  activeProfile: () => apiFetch<Record<string, unknown>>('/api/alpha/profile'),
  issuesAcks: () => apiFetch<Record<string, unknown>>('/api/issues/acks'),
  ackIssue: (payload: Record<string, unknown>) =>
    apiFetch('/api/issues/ack', { method: 'POST', body: JSON.stringify(payload) }),
  acknowledgeAllIssues: (payload: Record<string, unknown> = {}) =>
    apiFetch('/api/issues/acknowledge-all', { method: 'POST', body: JSON.stringify(payload) }),
  issueSuppressions: () => apiFetch<Record<string, unknown>>('/api/issues/suppressions'),
  suppressIssue: (payload: Record<string, unknown>) =>
    apiFetch('/api/issues/suppress', { method: 'POST', body: JSON.stringify(payload) }),
  unsuppressIssue: (payload: Record<string, unknown>) =>
    apiFetch('/api/issues/unsuppress', { method: 'POST', body: JSON.stringify(payload) }),

  discoveryStart: () =>
    apiFetch<Record<string, unknown>>('/api/onboarding/discovery/start', {
      method: 'POST',
      body: '{}',
    }),
  discoveryStatus: () => apiFetch<Record<string, unknown>>('/api/onboarding/discovery/status'),

  /** Save local backup folder paths (writes BACKUP_DIRS + scans). */
  saveBackupDirs: (dirs: string[]) =>
    apiFetch<Record<string, unknown>>('/api/backups/dirs', {
      method: 'POST',
      body: JSON.stringify({ dirs }),
    }),
  /** External / webhook backup tracking (camelCase body). */
  saveBackupExternal: (payload: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>('/api/backups/external', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  testBackupExternal: () =>
    apiFetch<Record<string, unknown>>('/api/backups/external/test', {
      method: 'POST',
      body: '{}',
    }),
  backupsScan: () =>
    apiFetch<Record<string, unknown>>('/api/backups/scan', { method: 'POST', body: '{}' }),
  fsRoots: () => apiFetch<Record<string, unknown>>('/api/fs/roots'),
  fsList: (path: string) =>
    apiFetch<Record<string, unknown>>(`/api/fs/list?path=${encodeURIComponent(path)}`),

  supportCatalog: () => apiFetch<Record<string, unknown>>('/api/support/catalog'),
  supportCompose: (payload: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>('/api/support/compose', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  supportBundleUrl: () => '/api/support/bundle',
  supportBundleDownload: async () => {
    const res = await fetch('/api/support/bundle', { credentials: 'include' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${res.status} /api/support/bundle: ${text || res.statusText}`);
    }
    return res.blob();
  },
};
