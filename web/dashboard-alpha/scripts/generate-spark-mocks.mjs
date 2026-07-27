#!/usr/bin/env node
/**
 * Build spark-profile-mocks.json and spark-profiles.json from parser golden files.
 * Also copies full call trees (*.tree.json.gz) for preview /api/spark/tree.
 * Run: ./gradlew :watchtower-core:sparkAuditFixtures && node web/dashboard-alpha/scripts/generate-spark-mocks.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const dataDir = path.resolve(__dirname, '../data');
const fixtureDir = path.join(repoRoot, 'samples/fixtures/spark');
const treeDir = path.join(dataDir, 'spark-trees');

const FIXTURE_MAP = [
  { key: 'h5bvv4annz', file: 'H5BVV4Annz.sparkprofile' },
  { key: 'cxrvhrnd1r', file: 'CXrvhrNd1R.sparkprofile' },
  { key: 'vbk9p8wibc', file: 'VBK9P8wiBc.sparkprofile' },
  { key: 'zsz5e2hnrb', file: 'ZSz5E2HnRb.sparkprofile' },
  { key: 'uurblpnmju', file: 'uUrbLpnMju.sparkprofile' },
  { key: 'profile-2026-07-23_20.37.29', file: 'profile-2026-07-23_20.37.29.sparkprofile' },
  { key: 'homestead-prod_profile-2026-07-13_12.59.52', file: 'homestead-prod_profile-2026-07-13_12.59.52.sparkprofile' },
  { key: 'homestead-prod_profile-2026-07-13_13.30.25', file: 'homestead-prod_profile-2026-07-13_13.30.25.sparkprofile' },
  { key: 'homestead-staging_profile-2026-07-13_07.25.40', file: 'homestead-staging_profile-2026-07-13_07.25.40.sparkprofile' },
];

function mockSourcePath(fileName) {
  return `watchtower/spark-upload/${fileName}`;
}

function loadGolden(key) {
  const goldenPath = path.join(fixtureDir, `expected-${key}.json`);
  if (!fs.existsSync(goldenPath)) {
    console.warn(`Missing golden: ${goldenPath} — run gradlew :watchtower-core:sparkAuditFixtures`);
    return null;
  }
  return JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
}

function normalizeProfile(profile, fileName) {
  const sourcePath = mockSourcePath(fileName);
  return {
    ...profile,
    source_file: fileName,
    source_kind: 'spark_upload',
    source_path: sourcePath,
    fresh: profile.fresh !== false,
  };
}

function fixtureStats(fileName) {
  const fixturePath = path.join(fixtureDir, fileName);
  if (!fs.existsSync(fixturePath)) return {};
  const st = fs.statSync(fixturePath);
  return {
    mtime: st.mtime.toISOString(),
    size_bytes: st.size,
  };
}

fs.mkdirSync(treeDir, { recursive: true });

const profiles = {};
const listEntries = [];
const treeIndex = {};

for (const { key, file } of FIXTURE_MAP) {
  const golden = loadGolden(key);
  if (!golden) continue;
  const normalized = normalizeProfile(golden, file);
  const sourcePath = normalized.source_path;
  profiles[sourcePath] = normalized;
  const stats = fixtureStats(file);
  listEntries.push({
    source_path: sourcePath,
    source_file: file,
    source_kind: 'spark_upload',
    captured_at: normalized.captured_at,
    mtime: stats.mtime || normalized.captured_at,
    size_bytes: stats.size_bytes || 0,
    fresh: normalized.fresh !== false,
  });

  const treeSrc = path.join(fixtureDir, `expected-${key}.tree.json.gz`);
  if (fs.existsSync(treeSrc)) {
    const treeDestName = `${key}.tree.json.gz`;
    fs.copyFileSync(treeSrc, path.join(treeDir, treeDestName));
    treeIndex[sourcePath] = treeDestName;
    const mb = (fs.statSync(treeSrc).size / (1024 * 1024)).toFixed(2);
    console.log(`Full tree ${key}: ${mb} MB gz -> data/spark-trees/${treeDestName}`);
  } else {
    console.warn(`Missing full tree for ${key}: ${treeSrc}`);
  }
}

listEntries.sort((a, b) => Date.parse(b.captured_at || 0) - Date.parse(a.captured_at || 0));
listEntries.forEach((entry, index) => {
  entry.auto_captured = index === 0;
});

const mocksOut = { profiles };
fs.writeFileSync(path.join(dataDir, 'spark-profile-mocks.json'), `${JSON.stringify(mocksOut)}\n`);
fs.writeFileSync(path.join(dataDir, 'spark-tree-index.json'), `${JSON.stringify(treeIndex, null, 2)}\n`);

const defaultPath = listEntries[0]?.source_path || mockSourcePath('H5BVV4Annz.sparkprofile');
const listOut = {
  spark_enabled: true,
  enabled: true,
  search_dirs: ['watchtower/spark-upload/', 'config/spark/'],
  report_profile_path: defaultPath,
  auto_profile_path: defaultPath,
  auto_capture: {
    enabled: true,
    reason: 'tick_lag',
    captured_at: listEntries[0]?.captured_at || null,
    source_path: defaultPath,
    in_flight: false,
  },
  profiles: listEntries,
};
fs.writeFileSync(path.join(dataDir, 'spark-profiles.json'), `${JSON.stringify(listOut, null, 2)}\n`);

const h5 = profiles[mockSourcePath('H5BVV4Annz.sparkprofile')];
if (h5) {
  const factsPath = path.join(dataDir, 'facts.json');
  const facts = JSON.parse(fs.readFileSync(factsPath, 'utf8'));
  if (!facts.optional) facts.optional = {};
  facts.optional.spark_profile = h5;
  fs.writeFileSync(factsPath, `${JSON.stringify(facts, null, 2)}\n`);
}

console.log(`Wrote ${Object.keys(profiles).length} spark profile mocks to data/spark-profile-mocks.json`);
console.log(`Wrote spark-profiles.json (${listEntries.length} entries)`);
console.log(`Wrote spark-tree-index.json (${Object.keys(treeIndex).length} full trees)`);
if (h5) console.log('Updated facts.json optional.spark_profile from parser golden');

let invalid = 0;
for (const { file } of FIXTURE_MAP) {
  const sourcePath = mockSourcePath(file);
  const p = profiles[sourcePath];
  if (!p?.verdict?.headline) {
    console.error(`Missing verdict for ${file}`);
    invalid += 1;
    continue;
  }
  if (!p.top_methods?.length || p.top_methods.length < 3) {
    console.error(`Expected >= 3 top_methods for ${file}, got ${p.top_methods?.length ?? 0}`);
    invalid += 1;
  }
  if (p.analysis_version !== 2 || !p.call_tree?.threads?.length || !p.source_rollups?.length) {
    console.error(`Expected additive Spark v2 contract for ${file}`);
    invalid += 1;
  }
}
if (invalid) {
  process.exit(1);
}
