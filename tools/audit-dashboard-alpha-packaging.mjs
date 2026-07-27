#!/usr/bin/env node
/**
 * Guard: production dashboard sync must build from dashboard-alpha (Vite React).
 * Checks Gradle sync includes and (if present) a built jar listing.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gradle = join(ROOT, 'mods', 'neoforge-1.21', 'build.gradle');

const text = readFileSync(gradle, 'utf8');
const fails = [];

if (!text.includes("web/dashboard-alpha") && !text.includes('dashboardAlphaDir')) {
  fails.push('build.gradle must sync from web/dashboard-alpha (dashboardAlphaDir)');
}

if (!/syncDashboard/.test(text)) {
  fails.push('Expected syncDashboard task for the React dashboard');
}

if (/dashboardPocDir/.test(text) && /web\/dashboard'\)/.test(text) && !/dashboard-alpha/.test(text)) {
  fails.push('build.gradle still points sync at legacy Preact web/dashboard');
}

// Soft check: if a jar exists under build, scan for alpha paths / legacy preact
const jarCandidates = [];
function walk(dir, depth = 0) {
  if (depth > 6 || !existsSync(dir)) return;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    if (name.isDirectory()) walk(full, depth + 1);
    else if (name.name.endsWith('.jar') && name.name.includes('watchtower')) jarCandidates.push(full);
  }
}
walk(join(ROOT, 'mods', 'neoforge-1.21', 'build', 'libs'));

for (const jar of jarCandidates.slice(0, 3)) {
  try {
    const listing = execSync(`jar tf "${jar}"`, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    if (/assets\/watchtower\/web\/src\/main\.js/.test(listing)) {
      console.warn(
        `audit-dashboard-alpha-packaging NOTE: stale JAR still has Preact src/main.js (rebuild mod): ${jar}`,
      );
    }
    if (!/assets\/watchtower\/web\/index\.html/.test(listing)) {
      fails.push(`JAR missing dashboard index.html: ${jar}`);
    }
  } catch {
    /* jar tool may be unavailable — skip soft check */
  }
}

if (fails.length) {
  console.error('audit-dashboard-alpha-packaging FAILED:');
  for (const f of fails) console.error('  -', f);
  process.exit(1);
}

console.log('audit-dashboard-alpha-packaging OK — React dashboard-alpha is the Gradle sync source');
