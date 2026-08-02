import { canonicalKey } from './demo-key.mjs';
import { isStaticDemo } from '@/app/runtime';

let demoManifest: Record<string, string> | null | undefined;

/**
 * Directory that holds demo-api/. Frozen from the first page URL so a later
 * router rewrite cannot break relative fetches when hosted under /demo-app/.
 */
function computeDemoApiBase(pathname: string): string {
  const marker = '/demo-app';
  const at = pathname.indexOf(marker);
  if (at >= 0) return `${pathname.slice(0, at + marker.length)}/demo-api/`;
  // Root-hosted static demo (Vercel): / or /index.html
  if (pathname.endsWith('/')) return `${pathname}demo-api/`;
  if (pathname.endsWith('.html')) return `${pathname.replace(/\/[^/]+$/, '/')}demo-api/`;
  return '/demo-api/';
}

const DEMO_API_BASE =
  typeof window !== 'undefined'
    ? computeDemoApiBase(window.location.pathname)
    : './demo-api/';

function demoApiUrl(file: string): string {
  return `${DEMO_API_BASE}${file}`;
}

async function loadDemoManifest(): Promise<Record<string, string>> {
  if (demoManifest) return demoManifest;
  const res = await fetch(demoApiUrl('manifest.json'));
  if (!res.ok) throw new Error(`${res.status} ${demoApiUrl('manifest.json')}`);
  demoManifest = (await res.json()) as Record<string, string>;
  return demoManifest;
}

/** Map an /api/... path to a baked demo-api file URL (static demo only). */
export async function resolveDemoAsset(path: string): Promise<string> {
  if (!isStaticDemo()) return path;
  const u = new URL(path, 'http://demo.local');
  const key = canonicalKey('GET', u.pathname, u.search);
  const manifest = await loadDemoManifest();
  const file = manifest[key];
  if (!file) throw new Error(`demo manifest miss for ${key}`);
  return demoApiUrl(file);
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  if (isStaticDemo()) {
    const method = (init?.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      return { ok: true, preview: true } as T;
    }
    const u = new URL(path, 'http://demo.local');
    const key = canonicalKey(method, u.pathname, u.search);
    const manifest = await loadDemoManifest();
    const file = manifest[key];
    if (!file) {
      // Soft empty stubs for optional GETs that are allowlisted but not baked
      // (e.g. spark compare pairs, fs browse). Prefer empty over a hard crash.
      if (u.pathname.startsWith('/api/spark/compare')) {
        return { ok: true, preview: true, baseline: null, target: null, nodes: [] } as T;
      }
      if (u.pathname.startsWith('/api/fs/')) {
        return { ok: true, preview: true, entries: [] } as T;
      }
      throw new Error(`404 ${path}: demo manifest miss for ${key}`);
    }
    const res = await fetch(demoApiUrl(file));
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json') || file.endsWith('.json')) return res.json() as Promise<T>;
    return res.text() as Promise<T>;
  }

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
  softHangDump: (file?: string) => {
    const q = file ? `?file=${encodeURIComponent(file)}` : '';
    return apiFetch<Record<string, unknown>>(`/api/soft-hang/dump${q}`);
  },
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
  modsDisable: (payload: { jar: string; confirm_world_risk?: boolean }) =>
    apiFetch<Record<string, unknown>>('/api/mods/disable', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  modsEnable: (payload: { jar: string }) =>
    apiFetch<Record<string, unknown>>('/api/mods/enable', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  /** List sandboxed files under config/ (Mods → Configs). */
  modsConfigsList: () => apiFetch<Record<string, unknown>>('/api/mods/configs'),
  /** Read one config file by relative path (config/...). */
  modsConfigRead: (path: string) =>
    apiFetch<Record<string, unknown>>(`/api/mods/configs?path=${encodeURIComponent(path)}`),
  /** Save config text or form fields with mtime check; creates a timestamped backup first. */
  modsConfigSave: (payload: {
    path: string;
    expected_mtime: number;
    content?: string;
    fields?: unknown[];
  }) =>
    apiFetch<Record<string, unknown>>('/api/mods/configs', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  /** Restore newest backup for a config path. */
  modsConfigUndo: (path: string) =>
    apiFetch<Record<string, unknown>>('/api/mods/configs/undo', {
      method: 'POST',
      body: JSON.stringify({ path }),
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
  weeklyDigest: () => apiFetch<Record<string, unknown>>('/api/weekly-digest'),
  weeklyDigestGenerate: () =>
    apiFetch<Record<string, unknown>>('/api/weekly-digest', {
      method: 'POST',
      body: JSON.stringify({ action: 'generate_now' }),
    }),
  reportsIndex: () => apiFetch<Record<string, unknown>>('/api/reports/index'),
  reportsStatus: () => apiFetch<Record<string, unknown>>('/api/reports/status'),
  updateCheck: () => apiFetch<Record<string, unknown>>('/api/update-check'),
  modrinthStatus: () => apiFetch<Record<string, unknown>>('/api/modrinth/status'),
  /** Start a Modrinth lookup scan (cached; never downloads jars). */
  modrinthScanStart: () =>
    apiFetch<Record<string, unknown>>('/api/modrinth/scan', { method: 'POST', body: '{}' }),
  activeProfile: () => apiFetch<Record<string, unknown>>('/api/preview/profile'),
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
  backupsVerify: (path: string) =>
    apiFetch<Record<string, unknown>>('/api/backups/verify', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),
  backupsTestRestore: (path: string) =>
    apiFetch<Record<string, unknown>>('/api/backups/test-restore', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),
  backupsTestRestoreStatus: () =>
    apiFetch<Record<string, unknown>>('/api/backups/test-restore/status'),
  backupsTestRestoreCleanup: (id?: string) =>
    apiFetch<Record<string, unknown>>('/api/backups/test-restore/cleanup', {
      method: 'POST',
      body: JSON.stringify(id ? { id } : {}),
    }),
  fsRoots: () => apiFetch<Record<string, unknown>>('/api/fs/roots'),
  fsList: (path: string) =>
    apiFetch<Record<string, unknown>>(`/api/fs/list?path=${encodeURIComponent(path)}`),

  supportCatalog: () => apiFetch<Record<string, unknown>>('/api/support/catalog'),
  supportQualityGate: (payload: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>('/api/support/quality-gate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  supportCompose: (payload: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>('/api/support/compose', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  supportBundleUrl: () => '/api/support/bundle',
  supportBundleDownload: async () => {
    if (isStaticDemo()) return new Blob(['demo'], { type: 'application/zip' });
    const res = await fetch('/api/support/bundle', { credentials: 'include' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${res.status} /api/support/bundle: ${text || res.statusText}`);
    }
    return res.blob();
  },

  accounts: () => apiFetch<Record<string, unknown>>('/api/accounts'),
  createAccount: (username: string, role: string) =>
    apiFetch<Record<string, unknown>>('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ username, role }),
    }),
  updateAccount: (id: string, patch: {
    role?: string;
    disabled?: boolean;
    minecraft_uuid?: string;
    minecraft_name?: string;
    clear_minecraft?: boolean;
  }) =>
    apiFetch<Record<string, unknown>>('/api/accounts/update', {
      method: 'POST',
      body: JSON.stringify({ id, ...patch }),
    }),
  linkMyMinecraft: (body: { uuid: string; name: string } | { clear: true }) =>
    apiFetch<Record<string, unknown>>('/api/accounts/me/minecraft', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** Sync theme mode + accent preset to the signed-in account. */
  appearanceSave: (payload: { theme: string; accent: string }) =>
    apiFetch<Record<string, unknown>>('/api/accounts/me/appearance', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  resetAccountPassword: (id: string, clear2fa = false) =>
    apiFetch<Record<string, unknown>>('/api/accounts/reset-password', {
      method: 'POST',
      body: JSON.stringify({ id, clear_2fa: clear2fa }),
    }),
  deleteAccount: (id: string) =>
    apiFetch<Record<string, unknown>>('/api/accounts/delete', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),
  auditLog: (limit = 200) =>
    apiFetch<Record<string, unknown>>(`/api/audit-log?limit=${limit}`),
};
