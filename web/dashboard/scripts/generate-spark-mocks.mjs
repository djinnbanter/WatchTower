#!/usr/bin/env node
/**
 * Build spark-profile-mocks.json and spark-profiles.json from parser golden files.
 * Run: ./gradlew :watchtower-core:sparkAuditFixtures && node web/dashboard/scripts/generate-spark-mocks.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const dataDir = path.resolve(__dirname, '../data');
const fixtureDir = path.join(repoRoot, 'samples/fixtures/spark');

const FIXTURE_MAP = [
  { key: 'h5bvv4annz', file: 'H5BVV4Annz.sparkprofile' },
  { key: 'cxrvhrnd1r', file: 'CXrvhrNd1R.sparkprofile' },
  { key: 'vbk9p8wibc', file: 'VBK9P8wiBc.sparkprofile' },
  { key: 'zsz5e2hnrb', file: 'ZSz5E2HnRb.sparkprofile' },
  { key: 'uurblpnmju', file: 'uUrbLpnMju.sparkprofile' },
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

const profiles = {};
const listEntries = [];

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
}

listEntries.sort((a, b) => Date.parse(b.captured_at || 0) - Date.parse(a.captured_at || 0));

const mocksOut = { profiles };
fs.writeFileSync(path.join(dataDir, 'spark-profile-mocks.json'), `${JSON.stringify(mocksOut, null, 2)}\n`);

const defaultPath = listEntries[0]?.source_path || mockSourcePath('H5BVV4Annz.sparkprofile');
const listOut = {
  spark_enabled: true,
  search_dirs: ['watchtower/spark-upload/', 'config/spark/'],
  report_profile_path: defaultPath,
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
}
if (invalid) {
  process.exit(1);
}
