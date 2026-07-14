#!/usr/bin/env node
/**
 * Parity check: DR crash intelligence vs golden fixtures
 * (samples/fixtures/crash-intelligence/expected.json)
 * plus CA parity classify rules (samples/fixtures/ca-parity/expected.json).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCrashReport } from '../web/dr-viewer/analyze/crashScanner.js';
import { classifyCrash } from '../web/dr-viewer/analyze/crashClassifier.js';
import { parseFmlIssues } from '../web/dr-viewer/analyze/fmlIssueParser.js';
import { scanStartupProfile } from '../web/dr-viewer/analyze/startupProfileScanner.js';
import { linkCrashIncidents } from '../web/dr-viewer/analyze/drFactsBuilder.js';
import * as MixinConfigIndex from '../web/dr-viewer/analyze/mixinConfigIndex.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(__dirname, '..', 'samples', 'fixtures', 'crash-intelligence');
const caParityDir = join(__dirname, '..', 'samples', 'fixtures', 'ca-parity');
const expectedPath = join(fixtureDir, 'expected.json');
const caExpectedPath = join(caParityDir, 'expected.json');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function approxEqual(a, b, eps = 0.05) {
  return Math.abs(a - b) <= eps;
}

function parseCrashTime(text, fallbackIso) {
  const m = /^Time:\s*(.+)$/m.exec(text);
  if (!m) return fallbackIso;
  const d = new Date(m[1].trim().replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return fallbackIso;
  return d.toISOString();
}

function loadText(name) {
  return readFileSync(join(fixtureDir, name), 'utf8');
}

function loadCaText(name) {
  return readFileSync(join(caParityDir, name), 'utf8');
}

function classifyFile(name) {
  const text = loadText(name);
  const time = parseCrashTime(text, '2026-01-01T00:00:00.000Z');
  const report = parseCrashReport(text, name, time);
  const classification = classifyCrash(report);
  return { report, classification };
}

function crashFromCaFixture(text, exception) {
  return {
    exception,
    description: text,
    summary: text.length > 80 ? text.slice(0, 80) : text,
  };
}

const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
assert(expected.schema === 'crash-intelligence-v1', 'unexpected schema');

const cases = expected.cases;

// --- create-npe ---
{
  const { classification } = classifyFile(cases['create-npe'].file);
  const want = cases['create-npe'].expected;
  assert(classification.failure_kind === want.failure_kind,
    `create-npe failure_kind: expected ${want.failure_kind}, got ${classification.failure_kind}`);
  assert(classification.primary_mod_id === want.primary_mod_id,
    `create-npe primary_mod_id: expected ${want.primary_mod_id}, got ${classification.primary_mod_id}`);
  assert(classification.category === want.category,
    `create-npe category: expected ${want.category}, got ${classification.category}`);
}

// --- nbt-corrupt ---
{
  const { classification } = classifyFile(cases['nbt-corrupt'].file);
  const want = cases['nbt-corrupt'].expected;
  assert(classification.failure_kind === want.failure_kind,
    `nbt-corrupt failure_kind: expected ${want.failure_kind}, got ${classification.failure_kind}`);
  assert(classification.category === want.category,
    `nbt-corrupt category: expected ${want.category}, got ${classification.category}`);
}

// --- watchdog-seconds ---
{
  const { report, classification } = classifyFile(cases['watchdog-seconds'].file);
  const want = cases['watchdog-seconds'].expected;
  assert(classification.failure_kind === want.failure_kind,
    `watchdog-seconds failure_kind: expected ${want.failure_kind}, got ${classification.failure_kind}`);
  assert(report.watchdog_tick_ms === want.watchdog_tick_ms,
    `watchdog-seconds watchdog_tick_ms: expected ${want.watchdog_tick_ms}, got ${report.watchdog_tick_ms}`);
  assert(classification.category === want.category,
    `watchdog-seconds category: expected ${want.category}, got ${classification.category}`);
}

// --- watchdog-pregen ---
{
  const { report, classification } = classifyFile(cases['watchdog-pregen'].file);
  const want = cases['watchdog-pregen'].expected;
  assert(classification.failure_kind === want.failure_kind,
    `watchdog-pregen failure_kind: expected ${want.failure_kind}, got ${classification.failure_kind}`);
  assert(classification.stall_mod_id === want.stall_mod_id,
    `watchdog-pregen stall_mod_id: expected ${want.stall_mod_id}, got ${classification.stall_mod_id}`);
  assert(classification.primary_mod_id === want.primary_mod_id
    || classification.suspect_mod_id === want.primary_mod_id,
    `watchdog-pregen primary_mod_id: expected ${want.primary_mod_id}, got ${classification.primary_mod_id}`);
  assert(report.watchdog_tick_ms === want.watchdog_tick_ms,
    `watchdog-pregen watchdog_tick_ms: expected ${want.watchdog_tick_ms}, got ${report.watchdog_tick_ms}`);
  assert(classification.category === want.category,
    `watchdog-pregen category: expected ${want.category}, got ${classification.category}`);
}

// --- fml-multiblock ---
{
  const text = loadText(cases['fml-multiblock'].file);
  const issues = parseFmlIssues(text);
  const wantLen = cases['fml-multiblock'].expected.fml_issues_length;
  assert(issues.length === wantLen,
    `fml-multiblock length: expected ${wantLen}, got ${issues.length}`);
}

// --- boot-loot ---
{
  const text = loadText(cases['boot-loot'].file);
  const lines = text.split(/\r?\n/);
  const profile = scanStartupProfile(lines);
  const want = cases['boot-loot'].expected.startup_profile;
  assert(approxEqual(profile.total_sec, want.total_sec),
    `boot-loot total_sec: expected ~${want.total_sec}, got ${profile.total_sec}`);
  const pride = (profile.errors || []).find((e) => e.mod_id === 'pride');
  assert(pride, 'boot-loot expected pride error in startup_profile.errors');
  assert(pride.blocking === want.pride_blocking,
    `boot-loot pride blocking: expected ${want.pride_blocking}, got ${pride.blocking}`);
}

// --- create-npe-paired ---
{
  const files = cases['create-npe-paired'].files;
  const want = cases['create-npe-paired'].expected;
  const summaries = files.map((name) => {
    const text = loadText(name);
    const time = parseCrashTime(text, '2026-01-01T00:00:00.000Z');
    const report = parseCrashReport(text, name, time);
    const classification = classifyCrash(report);
    return {
      ...report,
      failure_kind: classification.failure_kind,
      category: classification.category,
      primary_mod_id: classification.primary_mod_id,
      stall_mod_id: classification.stall_mod_id,
      suspect_mod_id: classification.suspect_mod_id,
    };
  });
  linkCrashIncidents(summaries);
  if (want.same_incident_id) {
    assert(summaries[0].incident_id && summaries[1].incident_id,
      'create-npe-paired: missing incident_id');
    assert(summaries[0].incident_id === summaries[1].incident_id,
      `create-npe-paired incident_id mismatch: ${summaries[0].incident_id} vs ${summaries[1].incident_id}`);
  }
  assert(summaries[1].failure_kind === want.followup_failure_kind,
    `create-npe-paired followup: expected ${want.followup_failure_kind}, got ${summaries[1].failure_kind}`);
}

// --- CA parity goldens ---
const caExpected = JSON.parse(readFileSync(caExpectedPath, 'utf8'));
assert(caExpected.schema === 'ca-parity-v1', 'unexpected ca-parity schema');
assert(Array.isArray(caExpected.cases) && caExpected.cases.length >= 12,
  `ca-parity expected ≥12 cases, got ${caExpected.cases?.length}`);

let caPass = 0;
for (const c of caExpected.cases) {
  const text = loadCaText(c.file);
  const crash = crashFromCaFixture(text, c.exception);
  let mods = c.mods || null;
  if (c.mods_file) {
    const modsJson = JSON.parse(loadCaText(c.mods_file));
    mods = modsJson.mods || modsJson;
  }
  const ctx = {
    mods,
    mixinIndex: MixinConfigIndex.fromMods(mods),
    bootFailed: !!c.boot_failed,
  };
  const got = classifyCrash(crash, ctx);
  const want = c.expected;
  assert(got.failure_kind === want.failure_kind,
    `${c.id} failure_kind: expected ${want.failure_kind}, got ${got.failure_kind}`);
  if (want.primary_mod_id != null) {
    assert(got.primary_mod_id === want.primary_mod_id,
      `${c.id} primary_mod_id: expected ${want.primary_mod_id}, got ${got.primary_mod_id}`);
  }
  if (want.suspect_mod_id != null) {
    assert(got.suspect_mod_id === want.suspect_mod_id,
      `${c.id} suspect_mod_id: expected ${want.suspect_mod_id}, got ${got.suspect_mod_id}`);
  }
  if (want.oom_kind != null) {
    assert(got.details?.oom_kind === want.oom_kind,
      `${c.id} oom_kind: expected ${want.oom_kind}, got ${got.details?.oom_kind}`);
  }
  caPass += 1;
}

console.log(`OK crash-intel-parity — golden fixtures match DR classifier/parsers; ca-parity ${caPass}/${caExpected.cases.length} passed`);
