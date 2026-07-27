#!/usr/bin/env node
/**
 * Static smoke checks for React dashboard-alpha.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];

function check(cond, msg) {
  if (!cond) fails.push(msg);
}

function exists(rel) {
  return existsSync(join(root, rel));
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

const pkg = JSON.parse(read('package.json'));
check(pkg.name === 'watchtower-dashboard-alpha', 'package name');
check(exists('index.html'), 'index.html');
check(exists('src/main.tsx'), 'src/main.tsx');
check(exists('vite.config.ts'), 'vite.config.ts');
check(exists('dist/index.html') || exists('dist/assets'), 'build output dist/ (run build first)');
check(exists('data/live-samples.json'), 'fixtures');
check(exists('data/ops-cache.json'), 'ops-cache');
check(exists('data/alpha-profiles.json'), 'alpha-profiles');
check(exists('scripts/data/route-catalog.json'), 'route catalog');
check(exists('src/features/lab/view.tsx'), 'lab feature source (unlinked from nav)');
check(exists('src/features/overview/view.tsx'), 'Overview');
check(exists('src/ui/charts/index.tsx'), 'chart kit');
check(exists('src/ui/motion/index.tsx'), 'motion kit');

const html = read('index.html');
check(/WatchTower/i.test(html), 'WatchTower title');
check(!/WatchTower Alpha/i.test(html), 'production title (not Alpha)');
check(!/data-alpha=["']true["']/.test(html), 'no data-alpha branding on ship HTML');
check(!/data-skin/.test(html), 'no data-skin in index');
check(!/cdn\.|unpkg\.com|jsdelivr\.net/i.test(html), 'no CDN');
check(/root/.test(html) && /main\.tsx|src\/main/.test(html), 'Vite React root entry');

check(exists('src/components/border-glow/BorderGlow.tsx'), 'BorderGlow component');
check(exists('src/components/specular-button/SpecularButton.tsx'), 'SpecularButton component');
check(exists('src/components/animated-list/AnimatedList.tsx'), 'AnimatedList component');
check(!/Commons Clause/i.test(read('src/components/border-glow/BorderGlow.tsx')), 'BorderGlow no Commons Clause');
check(!/Commons Clause/i.test(read('src/components/specular-button/SpecularButton.tsx')), 'SpecularButton no Commons Clause');
check(/from ['"]ogl['"]/.test(read('src/components/specular-button/SpecularButton.tsx')), 'SpecularButton uses ogl');
check(!!pkg.dependencies?.ogl, 'ogl dependency present');
check(!pkg.dependencies?.gsap, 'no gsap dependency');

const vite = read('vite.config.ts');
check(/8081/.test(vite), 'port 8081');

const features = readdirSync(join(root, 'src', 'features'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);
for (const id of ['overview', 'live', 'insights', 'settings', 'issues', 'mods', 'spark']) {
  check(features.includes(id), `feature folder ${id}`);
}

check(exists('src/features/spark/view.tsx'), 'spark view');
check(exists('src/features/spark/tabs.tsx'), 'spark tabs');
check(exists('src/features/spark/model.ts'), 'spark model');
check(exists('src/features/spark/call-tree.tsx'), 'spark call tree');
check(exists('data/spark-profiles.json'), 'spark profiles list');
check(exists('data/spark-profile-mocks.json'), 'spark profile mocks');

const sparkMocks = JSON.parse(read('data/spark-profile-mocks.json'));
const sparkProfiles = Object.values(sparkMocks.profiles || {});
check(sparkProfiles.length >= 6, 'at least 6 spark profile mocks');
for (const profile of sparkProfiles) {
  check(Number(profile.analysis_version) === 2, `analysis_version 2 for ${profile.source_file || profile.source_path}`);
  check(!!profile.evidence_summary, `evidence_summary for ${profile.source_file || profile.source_path}`);
  for (const row of profile.source_rollups || []) {
    const own = Number(row.own_pct ?? 0);
    const involvement = Number(row.involvement_pct ?? 0);
    check(own <= 100.05, `own_pct <= 100 for ${row.mod_id}`);
    check(involvement <= 100.05, `involvement_pct <= 100 for ${row.mod_id}`);
  }
}

const h5 = sparkMocks.profiles?.['watchtower/spark-upload/H5BVV4Annz.sparkprofile'];
check(!!h5, 'H5BVV4Annz mock present');
if (h5) {
  const context = h5.context || {};
  const composition = context.entity_composition || {};
  const concentration = context.entity_concentration || {};
  const hotspots = context.entity_hotspots || [];
  const memory = h5.system?.memory || {};
  const findings = h5.key_findings || h5.findings || [];
  const findingIds = new Set(findings.map((row) => row.id));
  const create = (h5.source_rollups || []).find((row) => row.mod_id === 'create');
  const xpHotspot = hotspots.find((row) => row.chunk_x === -102 && row.chunk_z === -17);
  check(Math.abs(Number(composition.xp_items_share_pct) - 52.5) < 0.2, 'H5 XP+items share ~52.5%');
  check(Math.abs(Number(composition.automation_share_pct) - 72.4) < 0.2, 'H5 automation share ~72.4%');
  check(Number(concentration.top_n_share_pct?.['20']) >= 40, 'H5 top-20 concentration >= 40%');
  check(!!xpHotspot, 'H5 XP hotspot -102,-17 present');
  check(Number(xpHotspot?.block_x_min) === -1632, 'H5 hotspot block_x_min');
  check(Number(xpHotspot?.block_z_min) === -272, 'H5 hotspot block_z_min');
  check(Number(xpHotspot?.nearest_player_chunk_distance) === 63, 'H5 hotspot player distance 63');
  check(Math.abs(Number(memory.swap_used_gb) - 44.66) < 0.05, 'H5 swap used 44.66 GiB');
  check(Math.abs(Number(create?.own_pct) - 12.77) < 0.05, 'H5 create own ~12.77%');
  for (const id of [
    'spark.entity.composition',
    'spark.entity.hotspots',
    'spark.entity.concentration',
    'spark.system.swap_pressure',
    'spark.source.create.own_share',
  ]) {
    check(findingIds.has(id), `H5 finding ${id}`);
  }
  const causal = findings.some((row) => /caused|root cause|noticeable improvement|30–40%|30-40%/i.test(
    `${row.title || ''} ${row.detail || ''} ${(row.caveats || row.limitations || []).join(' ')}`,
  ));
  check(!causal, 'H5 findings avoid causal overclaims');
  check(!findingIds.has('spark.source.jvm.own_share'), 'H5 does not treat jvm as non-platform source');
  check(read('src/features/spark/tabs.tsx').includes('What this profile found'), 'Overview plain-language brief label');
  check(read('src/features/spark/tabs.tsx').includes('What to try next'), 'Recommendations plain-language label');
  check(read('src/features/spark/model.ts').includes('What this profile found'), 'Copy report plain-language title');
}

const cxr = sparkMocks.profiles?.['watchtower/spark-upload/CXrvhrNd1R.sparkprofile'];
check(!!cxr, 'CXrvhrNd1R mock present');
if (cxr) {
  const findingIds = new Set((cxr.key_findings || []).map((row) => row.id));
  check(findingIds.has('spark.entity.unattended_hotspots'), 'CXR unattended nether hotspots finding');
  check(!findingIds.has('spark.source.jvm.own_share'), 'CXR does not treat jvm as non-platform source');
  check(findingIds.has('spark.source.create.own_share'), 'CXR create own-share finding');
  check(Number(cxr.context?.mspt_max_5m) >= 1000, 'CXR multi-second MSPT stall present');
  check(cxr.verdict?.grade === 'critical', 'CXR graded critical for stall despite mid TPS');
  const tick = (cxr.key_findings || []).find((row) => row.id === 'spark.tick.health');
  check(/worst|hitch|1\.8|1800/i.test(String(tick?.detail || '')), 'CXR tick detail mentions worst hitch in plain language');
  const why = String(cxr.evidence_summary?.why_watchtower_says_this || '');
  check(!/Shares describe exclusive profiler weight/i.test(why), 'CXR evidence summary skips capture-mode blurb');
}

const longCapture = sparkMocks.profiles?.['watchtower/spark-upload/profile-2026-07-23_20.37.29.sparkprofile'];
check(!!longCapture, 'profile-2026-07-23_20.37.29 mock present');
if (longCapture) {
  const findingIds = new Set((longCapture.key_findings || []).map((row) => row.id));
  check(longCapture.verdict?.grade === 'critical', 'long capture graded critical');
  check((longCapture.timeline || []).length >= 8, 'long capture has multi-window timeline');
  check(Number(longCapture.context?.entity_composition?.automation_share_pct) >= 40, 'long capture automation share');
  check((longCapture.context?.worlds || []).some((w) => w.id === 'shopping_district'), 'long capture shopping_district world');
  check(findingIds.has('spark.source.create.own_share'), 'long capture create own-share finding');
  check(findingIds.has('spark.entity.composition'), 'long capture entity composition finding');
  check((longCapture.timeline || []).every((w) => w.cpu_process != null), 'long capture timeline includes cpu_process');
  check((longCapture.context?.top_entities || []).length >= 6, 'long capture top_entities for pie');
  check((longCapture.context?.top_entities || []).some((row) => row.id === 'powergrid:hanging_wire'), 'long capture hanging_wire in top entities');
  const hotspot = (longCapture.context?.entity_hotspots || [])[0];
  check(Array.isArray(hotspot?.entity_counts) && hotspot.entity_counts.length >= 1, 'long capture hotspot entity_counts');
}

const homesteadProd = sparkMocks.profiles?.['watchtower/spark-upload/homestead-prod_profile-2026-07-13_12.59.52.sparkprofile'];
check(!!homesteadProd, 'homestead prod mock present');
if (homesteadProd) {
  const hintIds = (homesteadProd.mod_hints || []).map((row) => row.mod_id);
  check(homesteadProd.platform?.loader === 'Fabric', 'homestead prod Fabric loader');
  check(homesteadProd.platform?.engine === 'java', 'homestead prod java engine');
  check(hintIds.includes('create'), 'homestead prod create in hints');
  check(!hintIds.includes('pehkui'), 'homestead prod pehkui demoted from hints');
  check(String(homesteadProd.context?.entity_composition?.dominant_custom_id || '').includes('mushling'), 'homestead prod mushling dominant');
  check((homesteadProd.context?.datapacks || []).length >= 8, 'homestead prod structured datapacks');
  check((homesteadProd.context?.worlds || []).some((w) => w.id === 'otherside'), 'homestead prod otherside world');
}

const homesteadStaging = sparkMocks.profiles?.['watchtower/spark-upload/homestead-staging_profile-2026-07-13_07.25.40.sparkprofile'];
check(!!homesteadStaging, 'homestead staging mock present');
if (homesteadStaging) {
  const findingIds = new Set((homesteadStaging.key_findings || []).map((row) => row.id));
  check(homesteadStaging.verdict?.grade === 'healthy', 'homestead staging healthy');
  check(Number(homesteadStaging.context?.entity_composition?.marker_share_pct) >= 40, 'homestead staging marker share');
  check(!findingIds.has('spark.entity.unattended_hotspots'), 'homestead staging suppresses unattended');
  check(!/unattended/i.test(String(homesteadStaging.evidence_summary?.do_this_next || '')), 'homestead staging next step not unattended');
}

check(read('src/features/spark/model.ts').includes('mspt_median'), 'timeline prefers median MSPT');
check(read('src/features/spark/tabs.tsx').includes('Typical ms'), 'Timeline table typical ms column');

check(read('src/features/spark/model.ts').includes('top_entities'), 'entity pie uses top_entities');
check(read('src/features/spark/model.ts').includes('entityTypeLabel'), 'entity pie friendly labels');

check(read('src/features/spark/tabs.tsx').includes('sp-world-grid'), 'World totals card grid');
check(read('src/features/spark/tabs.tsx').includes('sp-world-card'), 'World totals per-world cards');
check(read('src/features/spark/model.ts').includes('worldDimensionLabel'), 'world friendly labels');

check(read('src/features/spark/tabs.tsx').includes('ChunkDetailModal'), 'Busy chunk detail modal');
check(read('src/features/spark/tabs.tsx').includes('Inspect chunk'), 'Busy chunk inspect button');
check(read('src/features/spark/tabs.tsx').includes('sp-chunk-modal__glow'), 'Chunk modal uses BorderGlow');
check(read('src/features/spark/tabs.tsx').includes("className=\"sp-chunk-modal__list\""), 'Chunk modal uses AnimatedList');

check(read('src/features/spark/tabs.tsx').includes('sp-crowded-bars'), 'crowded chunks uses bars');
check(read('src/features/spark/tabs.tsx').includes('sp-brief-card--crowded'), 'crowded chunks distinct card');
check(!/crowdedPie|sp-brief-pie.*crowded|concentrationBands\(context\)/.test(read('src/features/spark/tabs.tsx')), 'crowded chunks not pie-copy');

check(read('src/features/spark/tabs.tsx').includes('sp-evidence-hero'), 'evidence hero statement');
check(read('src/features/spark/tabs.tsx').includes('sp-evidence-steps'), 'evidence step cards');
check(read('src/features/spark/tabs.tsx').includes('Open World view'), 'evidence next-step CTA');

check(read('src/features/spark/tabs.tsx').includes('WorldView'), 'WorldView export');
check(read('src/features/spark/tabs.tsx').includes('buildOperatorReportMarkdown'), 'Copy report helper wired');
check(read('src/features/spark/view.tsx').includes("id: 'world'"), 'World tab registered');
check(read('src/features/spark/view.tsx').includes("id: 'findings'"), 'Findings tab registered');
check(read('src/features/spark/tabs.tsx').includes('export function FindingsView'), 'FindingsView exported');
check(read('src/features/spark/tabs.tsx').includes('sp-findings-desk'), 'Findings triage desk markup');
check(read('src/features/spark/tabs.tsx').includes('sp-next-steps'), 'Findings next-steps ranked layout');
check(read('src/features/spark/tabs.tsx').includes('Start here'), 'Findings Start here group');
check(read('src/features/spark/tabs.tsx').includes('Why this'), 'Findings next-step why copy');
check(read('src/features/spark/tabs.tsx').includes('AnimatedList'), 'Findings uses AnimatedList');
check(
  read('src/components/animated-list/AnimatedList.tsx').includes('Watchtower selectable list'),
  'AnimatedList is Watchtower-owned',
);
check(read('src/app/router.ts').includes('finding?: string'), 'Finding route param');
check(read('src/features/spark/call-tree.tsx').includes('initialSource'), 'Call tree source jump');

if (fails.length) {
  console.error('smoke FAILED:');
  for (const f of fails) console.error(' -', f);
  process.exit(1);
}

console.log('smoke OK — WatchTower dashboard (React)');
console.log(`  features: ${features.length}`);
console.log('  port 8081, Vite ship path, fixtures present');
