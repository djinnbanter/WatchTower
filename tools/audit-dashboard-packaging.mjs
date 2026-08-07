#!/usr/bin/env node
/**
 * Guard: production dashboard sync must build from web/dashboard (Vite React).
 * Checks Gradle sync includes and (if present) a built jar listing.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gradle = join(ROOT, 'mods', 'neoforge-1.21', 'build.gradle');

const text = readFileSync(gradle, 'utf8');
const fails = [];

if (!text.includes("web/dashboard") && !text.includes('dashboardDir')) {
  fails.push('build.gradle must sync from web/dashboard (dashboardDir)');
}

if (/dashboard-alpha|dashboardAlphaDir/.test(text)) {
  fails.push('build.gradle still references dashboard-alpha / dashboardAlphaDir');
}

if (!/syncDashboard/.test(text)) {
  fails.push('Expected syncDashboard task for the React dashboard');
}

if (/dashboardPocDir/.test(text)) {
  fails.push('build.gradle still has legacy dashboardPocDir');
}

// Soft check: inspect the newest watchtower NeoForge jar only (mtime).
// Older leftovers under build/libs (e.g. 1.0.x Preact builds) must not false-alarm.
const jarCandidates = [];
function walk(dir, depth = 0) {
  if (depth > 6 || !existsSync(dir)) return;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    if (name.isDirectory()) walk(full, depth + 1);
    else if (name.name.endsWith('.jar') && name.name.includes('watchtower-neoforge')) {
      jarCandidates.push(full);
    }
  }
}
walk(join(ROOT, 'mods', 'neoforge-1.21', 'build', 'libs'));

jarCandidates.sort((a, b) => {
  try {
    return statSync(b).mtimeMs - statSync(a).mtimeMs;
  } catch {
    return 0;
  }
});

const latestJar = jarCandidates[0];
if (latestJar) {
  try {
    const listing = execSync(`jar tf "${latestJar}"`, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    if (/assets\/watchtower\/web\/src\/main\.js/.test(listing) || /vendor\/preact\.module\.js/.test(listing)) {
      fails.push(`Latest JAR still embeds legacy Preact dashboard (rebuild mod): ${latestJar}`);
    }
    if (!/assets\/watchtower\/web\/index\.html/.test(listing)) {
      fails.push(`Latest JAR missing dashboard index.html: ${latestJar}`);
    }
    if (!/assets\/watchtower\/web\/assets\/watchtower-icon-simple\.png/.test(listing)) {
      fails.push(`Latest JAR missing watchtower-icon-simple.png: ${latestJar}`);
    }
    const hasViteChunk = listing
      .split(/\r?\n/)
      .some((line) => line.startsWith('assets/watchtower/web/assets/') && line.endsWith('.js'));
    if (!hasViteChunk) {
      fails.push(`Latest JAR missing Vite JS chunks under assets/watchtower/web/assets/: ${latestJar}`);
    }
    // Static marketing demo must never ship inside the NeoForge jar.
    if (/assets\/watchtower\/web\/demo-api\//.test(listing)) {
      fails.push(`JAR must not embed demo-api/: ${latestJar}`);
    }
  } catch {
    /* jar tool may be unavailable — skip soft check */
  }
}

// Soft check: jar-synced web output dir (if present) must not contain dist-demo artefacts
const webOut = join(ROOT, 'mods', 'neoforge-1.21', 'build', 'generated', 'resources', 'assets', 'watchtower', 'web');
if (existsSync(join(webOut, 'demo-api'))) {
  fails.push(`Generated web out contains demo-api/ (must not sync dist-demo): ${webOut}`);
}
if (existsSync(join(webOut, 'demo-api', 'manifest.json'))) {
  fails.push(`Generated web out contains demo-api/manifest.json: ${webOut}`);
}

// Hard requirement: demo-api/ must never land in the jar sync tree (dist/).
if (existsSync(join(ROOT, 'web', 'dashboard', 'dist', 'demo-api'))) {
  fails.push('web/dashboard/dist/ contains demo-api/ — static demo must only write dist-demo/');
}

const iconSrc = join(ROOT, 'web', 'dashboard', 'assets', 'watchtower-icon-simple.png');
if (!existsSync(iconSrc)) {
  fails.push('web/dashboard/assets/watchtower-icon-simple.png missing (copy from web/dashboard-archive/assets/)');
}

const distIcon = join(ROOT, 'web', 'dashboard', 'dist', 'assets', 'watchtower-icon-simple.png');
if (existsSync(join(ROOT, 'web', 'dashboard', 'dist')) && !existsSync(distIcon)) {
  fails.push('web/dashboard/dist/assets/watchtower-icon-simple.png missing after build (copy-static-assets.mjs must copy assets/)');
}

if (fails.length) {
  console.error('audit-dashboard-packaging FAILED:');
  for (const f of fails) console.error('  -', f);
  process.exit(1);
}

console.log('audit-dashboard-packaging OK — React web/dashboard is the Gradle sync source');
