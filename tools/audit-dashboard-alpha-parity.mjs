#!/usr/bin/env node
/**
 * Compare dashboard-alpha (React remake) against production dashboard parity guards.
 * Run from repo root: node tools/audit-dashboard-alpha-parity.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROD = join(ROOT, 'web', 'dashboard');
const ALPHA = join(ROOT, 'web', 'dashboard-alpha');
const GRADLE = join(ROOT, 'mods', 'neoforge-1.21', 'build.gradle');
const ROUTE_CATALOG = join(ALPHA, 'scripts', 'data', 'route-catalog.json');

const fails = [];
const notes = [];

function read(path) {
  return readFileSync(path, 'utf8');
}

function check(condition, message) {
  if (!condition) fails.push(message);
}

function rel(path) {
  return relative(ROOT, path).replace(/\\/g, '/');
}

function featureDirs(base) {
  const dir = join(base, 'src', 'features');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

function pageImports(pagesPath) {
  if (!existsSync(pagesPath)) return [];
  const text = read(pagesPath);
  const imports = [];
  for (const m of text.matchAll(/import\s+['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    let folder = null;
    if (spec.includes('/features/')) {
      folder = spec.split('/features/').pop();
    } else if (spec.startsWith('./') && !spec.includes('/')) {
      folder = spec.slice(2);
    } else if (spec.startsWith('@/features/')) {
      folder = spec.replace('@/features/', '');
    }
    if (!folder) continue;
    folder = folder.replace(/\/index\.(js|ts|tsx)$/, '').replace(/\/$/, '');
    if (folder && folder !== 'register') imports.push(folder);
  }
  return [...new Set(imports)].sort();
}

function resolveFeatureIndex(base, folder) {
  for (const name of ['index.ts', 'index.tsx', 'index.js']) {
    const full = join(base, 'src', 'features', folder, name);
    if (existsSync(full)) return full;
  }
  return null;
}

function resolveView(base, folder) {
  for (const name of ['view.tsx', 'view.ts', 'view.js']) {
    const full = join(base, 'src', 'features', folder, name);
    if (existsSync(full)) return full;
  }
  return null;
}

function registeredPages(base, { react = false } = {}) {
  const entry = react
    ? join(base, 'src', 'features', 'register.ts')
    : join(base, 'src', 'app', 'pages.js');
  const folders = pageImports(entry);
  const registrations = new Map();
  for (const folder of folders) {
    const indexPath = resolveFeatureIndex(base, folder);
    if (!indexPath) {
      fails.push(`${rel(join(base, 'src', 'features', folder, 'index.*'))} missing for registration entry`);
      continue;
    }
    const match = read(indexPath).match(/registerPage\s*\(\s*\{[\s\S]*?\bid\s*:\s*['"]([^'"]+)['"]/);
    if (!match) {
      fails.push(`${rel(indexPath)} does not register a page id`);
      continue;
    }
    if (registrations.has(match[1])) {
      fails.push(`duplicate page id "${match[1]}" in ${rel(indexPath)}`);
    }
    registrations.set(match[1], folder);
  }
  return registrations;
}

function walk(dir, predicate, depth = 0) {
  if (!existsSync(dir) || depth > 8) return [];
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['.git', '.gradle', 'build', 'node_modules', 'dashboard-alpha', '_legacy-preact'].includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full, predicate, depth + 1));
    else if (predicate(full, entry.name)) found.push(full);
  }
  return found;
}

const isReactAlpha = existsSync(join(ALPHA, 'vite.config.ts')) && existsSync(join(ALPHA, 'src', 'main.tsx'));

// ── Page registrations ───────────────────────────────────────────────────────
const prodRegistrations = registeredPages(PROD, { react: false });
const alphaRegistrations = registeredPages(ALPHA, { react: isReactAlpha });
const prodPages = [...prodRegistrations.keys()].sort();
const alphaPages = [...alphaRegistrations.keys()].sort();

const missingInAlpha = prodPages.filter((p) => !alphaPages.includes(p));
if (missingInAlpha.length) {
  fails.push(`alpha missing production registrations: ${missingInAlpha.join(', ')}`);
}

const alphaOnly = alphaPages.filter((p) => !prodPages.includes(p));
check(alphaOnly.length === 0,
  `unexpected alpha-only page registrations: ${alphaOnly.join(', ')}`);
for (const page of prodPages) {
  check(alphaRegistrations.get(page) === prodRegistrations.get(page),
    `alpha page "${page}" must be registered from features/${prodRegistrations.get(page)}`);
}

// ── Feature folders ──────────────────────────────────────────────────────────
const prodFeatures = featureDirs(PROD);
const alphaFeatures = featureDirs(ALPHA).filter((f) => f !== 'register');
const missingFolders = prodFeatures.filter((f) => !alphaFeatures.includes(f));
if (missingFolders.length) {
  fails.push(`alpha missing production feature folders: ${missingFolders.join(', ')}`);
}
const extraFolders = alphaFeatures.filter((f) => !prodFeatures.includes(f));
if (extraFolders.length) {
  notes.push(`alpha extra feature folders (OK): ${extraFolders.join(', ')}`);
}

// ── Required query surfaces (string presence in React views) ─────────────────
const requiredRoutes = {
  insights: {
    folder: 'insights',
    tokens: ['patterns', 'configs', 'mod-changes', 'storage', 'schedule', 'load', 'incidents'],
  },
  issues: {
    folder: 'issues',
    tokens: ['active', 'reviewed', 'tools'],
  },
  crashes: {
    folder: 'crashes',
    tokens: ['review', 'reviewed', 'tools'],
  },
  mods: {
    folder: 'mods',
    tokens: ['overview', 'updates', 'conflicts', 'log-errors', 'changes', 'modrinth', 'forensics'],
  },
  settings: {
    folder: 'settings',
    tokens: ['general', 'monitoring', 'backups', 'rules', 'security', 'advanced', 'about'],
  },
};

for (const [page, def] of Object.entries(requiredRoutes)) {
  const viewPath = resolveView(ALPHA, def.folder);
  check(!!viewPath, `${page} view missing`);
  if (!viewPath) continue;
  const source = read(viewPath);
  const missing = def.tokens.filter((token) => !source.includes(`'${token}'`) && !source.includes(`"${token}"`));
  check(missing.length === 0, `${page} view missing route tokens: ${missing.join(', ')}`);
}

// ── Fixture contract ─────────────────────────────────────────────────────────
const requiredFixtures = [
  'data/reports-index.json',
  'data/facts.json',
  'data/facts-prev.json',
  'data/brief.txt',
  'data/live-samples.json',
  'data/live-envelope.json',
  'data/snapshot.json',
  'data/ops-cache.json',
  'data/overview-meta.json',
  'data/issues-peek.json',
  'data/performance-rollups.json',
  'data/performance-rollups-7d.json',
  'data/performance-rollups-30d.json',
  'data/performance-insights.json',
  'data/performance-insights-30d.json',
  'data/performance-dashboard.json',
  'data/performance-dashboard-30d.json',
  'data/spark-profiles.json',
  'data/spark-profile-mocks.json',
  'data/crash-contexts.json',
  'data/logs-index.json',
  'data/preview-settings.json',
  'data/update-check.json',
  'data/forensics-status.json',
  'data/forensics-find-class.json',
  'data/forensics-config-health.json',
  'data/alpha-profiles.json',
  'data/active-profile.json',
  'data/modrinth-status.json',
  'data/incidents-index.json',
];
for (const fixture of requiredFixtures) {
  check(existsSync(join(ALPHA, fixture)), `missing required alpha fixture: ${fixture}`);
}
for (const fixtureDir of ['data/logs', 'data/crash-reports', 'data/incidents']) {
  const full = join(ALPHA, fixtureDir);
  check(existsSync(full) && statSync(full).isDirectory() && readdirSync(full).length > 0,
    `required alpha fixture directory is missing or empty: ${fixtureDir}`);
}

const fixtureApi = join(ALPHA, 'scripts', 'vite-fixture-api.ts');
const apiClient = join(ALPHA, 'src', 'api', 'client.ts');
check(existsSync(fixtureApi), 'missing scripts/vite-fixture-api.ts');
check(existsSync(apiClient), 'missing src/api/client.ts');

// ── Route catalog ────────────────────────────────────────────────────────────
check(existsSync(ROUTE_CATALOG), 'missing scripts/data/route-catalog.json');
if (existsSync(ROUTE_CATALOG)) {
  try {
    const catalog = JSON.parse(read(ROUTE_CATALOG));
    check(catalog.baseUrl === 'http://127.0.0.1:8081/',
      `route catalog baseUrl must be http://127.0.0.1:8081/ (got ${catalog.baseUrl})`);
    const catalogPages = Array.isArray(catalog.pages) ? catalog.pages : [];
    const catalogIds = catalogPages.map((page) => page.id);
    for (const page of alphaPages) {
      check(catalogIds.includes(page), `route catalog missing page: ${page}`);
    }
    check(new Set(catalogIds).size === catalogIds.length, 'route catalog contains duplicate page ids');
    check(Array.isArray(catalog.deepLinks) && catalog.deepLinks.length >= 5,
      'route catalog must list deep links');
  } catch (error) {
    fails.push(`invalid route catalog JSON: ${error.message}`);
  }
}

// ── React stack / no skins ───────────────────────────────────────────────────
if (isReactAlpha) {
  check(existsSync(join(ALPHA, 'vite.config.ts')), 'missing vite.config.ts');
  check(existsSync(join(ALPHA, 'src', 'main.tsx')), 'missing src/main.tsx');
  check(existsSync(join(ALPHA, 'src', 'ui', 'charts', 'index.tsx')), 'missing Watchtower chart kit');
  check(existsSync(join(ALPHA, 'src', 'ui', 'motion', 'index.tsx')), 'missing motion kit');
  check(existsSync(join(ALPHA, 'src', 'components', 'charts', 'line-chart.tsx')), 'missing installed Bklit line-chart');
  const html = read(join(ALPHA, 'index.html'));
  check(!/data-alpha=["']true["']/.test(html), 'index.html must not declare data-alpha (shipped UI)');
  check(!/data-skin/.test(html), 'index.html must not use data-skin');
  const pkg = JSON.parse(read(join(ALPHA, 'package.json')));
  check(pkg.name === 'watchtower-dashboard-alpha', 'package name');
  check(/vite/.test(pkg.scripts?.dev || ''), 'dev script must use vite');
  check(Boolean(pkg.scripts?.['preview:live']), 'preview:live soak script required');
  check(/8081/.test(read(join(ALPHA, 'vite.config.ts'))), 'vite must default to 8081');
  check(/WATCHTOWER_ORIGIN/.test(read(join(ALPHA, 'vite.config.ts'))), 'vite must support WATCHTOWER_ORIGIN live proxy');
  notes.push('React + Vite + Bklit remake detected');
} else {
  fails.push('alpha is not a React+Vite remake (missing vite.config.ts / src/main.tsx)');
}

// ── Prod-readiness gates ─────────────────────────────────────────────────────
const apiClientSrc = read(join(ALPHA, 'src', 'api', 'client.ts'));
for (const method of [
  'login:',
  'totp:',
  'changePassword:',
  'totpSetup:',
  'totpConfirm:',
  'supportCatalog:',
  'supportBundleDownload:',
  'discoveryStart:',
  'discoveryStatus:',
]) {
  check(apiClientSrc.includes(method), `api client missing ${method}`);
}
check(existsSync(join(ALPHA, 'src', 'app', 'auth-gate.tsx')), 'missing auth-gate');
check(existsSync(join(ALPHA, 'src', 'app', 'session-store.ts')), 'missing session-store');
check(existsSync(join(ALPHA, 'src', 'app', 'runtime.ts')), 'missing runtime helpers');

const wizard = read(join(ALPHA, 'src', 'features', 'wizard', 'view.tsx'));
for (const step of ['welcome', 'options', 'audit', 'backups', 'security']) {
  check(wizard.includes(`'${step}'`) || wizard.includes(`"${step}"`), `wizard missing step ${step}`);
}

const support = read(join(ALPHA, 'src', 'features', 'support', 'bundle-builder-modal.tsx'));
for (const preset of ['QUICK', 'SERVER_TRIAGE', 'WATCHTOWER_BUG', 'FULL_EVIDENCE', 'CUSTOM']) {
  check(support.includes(preset), `support builder missing preset ${preset}`);
}

// Commons Clause / React Bits vendor strings must not remain in component sources
const vendorRoots = [
  join(ALPHA, 'src', 'components', 'border-glow'),
  join(ALPHA, 'src', 'components', 'specular-button'),
  join(ALPHA, 'src', 'components', 'pill-nav'),
  join(ALPHA, 'src', 'components', 'animated-list'),
];
for (const dir of vendorRoots) {
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    if (!/\.(tsx?|css)$/.test(name)) continue;
    const body = read(join(dir, name));
    check(
      !/Commons Clause/i.test(body),
      `${rel(join(dir, name))} still mentions Commons Clause`,
    );
    check(
      !/Vendored from React Bits/i.test(body),
      `${rel(join(dir, name))} still claims React Bits vendor copy`,
    );
  }
}
check(
  !/["']gsap["']/.test(read(join(ALPHA, 'package.json'))),
  'package.json must not depend on gsap',
);
// ogl (MIT) is allowed — SpecularButton WebGL rim depends on it.
check(
  /["']ogl["']/.test(read(join(ALPHA, 'package.json'))),
  'package.json should keep ogl for SpecularButton WebGL',
);
check(
  existsSync(join(ALPHA, 'src', 'components', 'specular-button', 'SpecularButton.tsx')),
  'SpecularButton component present',
);
check(
  /from ['"]ogl['"]/.test(read(join(ALPHA, 'src', 'components', 'specular-button', 'SpecularButton.tsx'))),
  'SpecularButton imports ogl',
);

// ── Gradle sync: React dashboard-alpha is the ship path ──────────────────────
if (!existsSync(GRADLE)) {
  fails.push('mods/neoforge-1.21/build.gradle not found');
} else {
  const gradle = read(GRADLE);
  if (!/dashboard-alpha/.test(gradle) && !/dashboardAlphaDir/.test(gradle)) {
    fails.push('build.gradle must sync from web/dashboard-alpha');
  }
  if (!/syncDashboard/.test(gradle)) {
    fails.push('build.gradle missing syncDashboard task');
  }
  if (!/dashboardAlphaDist|dashboard-alpha\/dist|npm.*run.*build/.test(gradle)) {
    fails.push('build.gradle must build Vite dist from dashboard-alpha');
  }
}

if (fails.length) {
  console.error('audit-dashboard-alpha-parity FAILED:');
  for (const f of fails) console.error('  -', f);
  process.exit(1);
}

console.log('audit-dashboard-alpha-parity OK');
console.log(`  stack: React + Vite remake (production path)`);
console.log(`  page registrations: ${prodPages.length} production (parity)`);
console.log(`  production feature folders in alpha: ${prodFeatures.length}/${prodFeatures.length}`);
if (extraFolders.length) console.log(`  alpha-only feature folders: ${extraFolders.join(', ')}`);
console.log('  query routes: Insights, Issues, Crashes, Mods, Settings');
console.log('  prod gates: auth, wizard, support presets, license cleanup');
console.log(`  fixture paths: ${requiredFixtures.length} files + logs/crashes/incidents`);
console.log(`  route catalog: ${rel(ROUTE_CATALOG)}`);
for (const n of notes) console.log(`  note: ${n}`);
