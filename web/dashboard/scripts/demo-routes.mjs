/** Single source list of requests to bake for the static demo. */
export const DEMO_GET_ROUTES = [
  '/api/auth/session',
  '/api/auth/session?role=owner',
  '/api/auth/session?role=admin',
  '/api/auth/session?role=viewer',
  '/api/live',
  '/api/players',
  // Sample windows used by Live, Overview, Session, Insights storage, wizard
  '/api/samples?minutes=30&max_points=48',
  '/api/samples?minutes=60&max_points=500',
  '/api/samples?minutes=10080&max_points=10000',
  '/api/samples?minutes=20160&max_points=8000',
  '/api/samples?minutes=43200&max_points=10000',
  '/api/overview/meta',
  '/api/data-sources',
  '/api/ops-cache',
  '/api/issues/peek',
  '/api/issues/acks',
  '/api/issues/suppressions',
  '/api/performance/dashboard?window=7d',
  '/api/performance/dashboard?window=30d',
  '/api/performance/insights?window=7d',
  '/api/performance/insights?window=30d',
  '/api/performance/rollups?hours=24',
  '/api/performance/rollups?hours=168',
  '/api/performance/rollups?hours=720',
  '/api/performance/export?format=csv&window=7d',
  '/api/spark/profiles',
  '/api/logs/list',
  '/api/crash-contexts',
  '/api/crashes',
  '/api/crashes/acks',
  '/api/reports/latest',
  '/api/reports/index',
  '/api/reports/status',
  '/api/facts',
  '/api/brief',
  '/api/update-check',
  '/api/config-audit',
  '/api/config',
  '/api/weekly-digest',
  '/api/modrinth/status',
  '/api/mods/forensics/status',
  '/api/forensics/status',
  '/api/forensics/config-health',
  '/api/settings',
  '/api/accounts',
  '/api/audit-log?limit=200',
  '/api/support/catalog',
  '/api/fs/roots',
  '/api/onboarding/discovery/status',
  '/api/preview/profile',
  '/api/mods/configs',
  '/api/mods/mutate/status',
  '/api/mods/mutate/versions',
  '/api/mods/mutate/backups',
  '/api/soft-hang/dump',
];

/**
 * Append parameterized GETs discovered from fixture JSON so every tab resolves.
 * Call from bake-demo-api.mjs: `const routes = await expandDemoRoutes(DEMO_GET_ROUTES)`.
 */
export async function expandDemoRoutes(base) {
  const { readFileSync, existsSync, readdirSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
  const out = [...base];

  // Prefer spark-profile-mocks.json keys (full profile set); fall back to spark-profiles list.
  const mocksPath = join(dataDir, 'spark-profile-mocks.json');
  if (existsSync(mocksPath)) {
    const mocks = JSON.parse(readFileSync(mocksPath, 'utf8'));
    const profiles = mocks?.profiles && typeof mocks.profiles === 'object' ? mocks.profiles : {};
    for (const path of Object.keys(profiles)) {
      if (!path) continue;
      out.push(`/api/spark/profile?path=${encodeURIComponent(path)}`);
      out.push(`/api/spark/tree?path=${encodeURIComponent(path)}&max_nodes=250000`);
    }
  } else {
    const profilesPath = join(dataDir, 'spark-profiles.json');
    if (existsSync(profilesPath)) {
      const profiles = JSON.parse(readFileSync(profilesPath, 'utf8'));
      const list = Array.isArray(profiles)
        ? profiles
        : Array.isArray(profiles.profiles)
          ? profiles.profiles
          : [];
      for (const row of list) {
        const path = String(row.path || row.id || row.file || '').trim();
        if (!path) continue;
        out.push(`/api/spark/profile?path=${encodeURIComponent(path)}`);
        out.push(`/api/spark/tree?path=${encodeURIComponent(path)}&max_nodes=250000`);
      }
    }
  }

  const logsPath = join(dataDir, 'logs-index.json');
  if (existsSync(logsPath)) {
    const logs = JSON.parse(readFileSync(logsPath, 'utf8'));
    const files = Array.isArray(logs) ? logs : Array.isArray(logs.files) ? logs.files : [];
    for (const f of files.slice(0, 5)) {
      const name = String(f.file || f.name || f).trim();
      if (name) out.push(`/api/logs/content?file=${encodeURIComponent(name)}&tail=2000`);
    }
  }

  const crashDir = join(dataDir, 'crash-reports');
  if (existsSync(crashDir)) {
    for (const name of readdirSync(crashDir).filter((n) => n.endsWith('.txt')).slice(0, 13)) {
      out.push(`/api/crashes/report?file=${encodeURIComponent(name)}`);
      out.push(`/api/crashes/context?file=${encodeURIComponent(name)}&minutes=10`);
    }
  }

  return [...new Set(out)];
}

/**
 * Drop heavy 30d / large spark tree routes when bake would exceed the size budget.
 * Returns { routes, dropped, stubRoutes } where stubRoutes get tiny empty-state JSON.
 */
export function applySizeCircuitBreaker(routes) {
  const dropped = [];
  const stubRoutes = [];
  const filtered = routes.filter((route) => {
    if (route.includes('window=30d') || route.includes('hours=720')) {
      dropped.push(route);
      return false;
    }
    return true;
  });
  const withoutTrees = filtered.filter((route) => {
    if (route.startsWith('/api/spark/tree')) {
      dropped.push(route);
      stubRoutes.push(route);
      return false;
    }
    return true;
  });
  return { routes: withoutTrees, dropped, stubRoutes };
}

/** Allowlisted /api/ literals in client.ts that need not be baked (POST-only or unused in demo). */
export const DEMO_MANIFEST_ALLOWLIST = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/totp',
  '/api/auth/change-password',
  '/api/auth/change-username',
  '/api/auth/totp/setup',
  '/api/auth/totp/confirm',
  '/api/auth/totp/disable',
  '/api/auth/recovery/regenerate',
  '/api/settings',
  '/api/performance/baseline',
  '/api/spark/import',
  '/api/spark/upload',
  '/api/spark/compare',
  '/api/spark/tree',
  '/api/crashes/ack',
  '/api/crashes/acknowledge-all',
  '/api/crashes/scan',
  '/api/forensics/find-class',
  '/api/mods/scan',
  '/api/mods/disable',
  '/api/mods/enable',
  '/api/modrinth/scan',
  '/api/weekly-digest',
  '/api/issues/ack',
  '/api/issues/acknowledge-all',
  '/api/issues/suppress',
  '/api/issues/unsuppress',
  '/api/onboarding/discovery/start',
  '/api/backups/dirs',
  '/api/backups/external',
  '/api/backups/external/test',
  '/api/backups/scan',
  '/api/backups/verify',
  '/api/backups/test-restore',
  '/api/backups/test-restore/status',
  '/api/backups/test-restore/cleanup',
  '/api/support/compose',
  '/api/support/bundle',
  '/api/accounts',
  '/api/accounts/update',
  '/api/accounts/me/minecraft',
  '/api/accounts/me/appearance',
  '/api/accounts/reset-password',
  '/api/accounts/delete',
  '/api/mods/configs/undo',
  '/api/mods/mutate/swap',
  '/api/mods/mutate/batch',
  '/api/mods/mutate/install',
  '/api/mods/mutate/quarantine',
  '/api/mods/mutate/undo',
  '/api/mods/mutate/jobs/',
  '/api/support/quality-gate',
  '/api/fs/',
  '/api/fs/list',
];
