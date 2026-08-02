#!/usr/bin/env node
/**
 * Bake fixture-api responses into dist-demo/demo-api/ for the static demo.
 * Invoked as: npx tsx scripts/bake-demo-api.mjs
 */
import { mkdirSync, writeFileSync, rmSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalKey } from '../src/api/demo-key.mjs';
import {
  DEMO_GET_ROUTES,
  expandDemoRoutes,
  applySizeCircuitBreaker,
} from './demo-routes.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist-demo', 'demo-api');
const MAX_BYTES = 100 * 1024 * 1024; // circuit breaker ~100 MB

function dirSize(dir) {
  let total = 0;
  for (const name of readdirSync(dir)) {
    total += statSync(join(dir, name)).size;
  }
  return total;
}

async function bakeRoutes(session, handleFixtureRequest, routes, manifest, startIndex) {
  let i = startIndex;
  let totalBytes = 0;
  const written = [];

  for (const route of routes) {
    const u = new URL(route, 'http://demo.local');
    const key = canonicalKey('GET', u.pathname, u.search);
    if (manifest[key]) continue;

    const result = await handleFixtureRequest(session, 'GET', u.pathname + u.search);
    if (!result) {
      console.warn('bake-demo-api: skip (null)', key);
      continue;
    }

    const isJson =
      result.contentType.includes('json') ||
      (typeof result.body === 'string' &&
        (result.body.trimStart().startsWith('{') || result.body.trimStart().startsWith('[')));
    const isCsv = result.contentType.includes('csv');
    const ext = isCsv ? 'csv' : isJson ? 'json' : 'bin';
    const file = `r${String(++i).padStart(4, '0')}.${ext}`;
    const abs = join(OUT, file);
    writeFileSync(abs, result.body);
    const size = statSync(abs).size;
    totalBytes += size;
    written.push({ key, file, size });
    manifest[key] = file;
  }

  return { i, totalBytes, written };
}

async function main() {
  const { createFixtureSession, handleFixtureRequest } = await import('./fixture-api-core.ts');

  // Never touch public/ or dist/ — only dist-demo/
  if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const session = createFixtureSession();
  const manifest = {};
  let routes = await expandDemoRoutes(DEMO_GET_ROUTES);
  console.log(`bake-demo-api: expanding to ${routes.length} routes`);

  let { i } = await bakeRoutes(session, handleFixtureRequest, routes, manifest, 0);
  let total = dirSize(OUT);
  console.log(
    `bake-demo-api: first pass ${Object.keys(manifest).length} routes, ${(total / 1e6).toFixed(1)} MB`,
  );

  let circuitBreakerHit = false;
  if (total > MAX_BYTES) {
    circuitBreakerHit = true;
    console.warn(
      'bake-demo-api: exceeds ~100 MB — dropping 30d rollups/windows and spark trees, rebaking',
    );
    rmSync(OUT, { recursive: true, force: true });
    mkdirSync(OUT, { recursive: true });
    for (const k of Object.keys(manifest)) delete manifest[k];

    const { routes: slim, dropped, stubRoutes } = applySizeCircuitBreaker(routes);
    console.warn(`bake-demo-api: dropped ${dropped.length} heavy routes`);
    routes = slim;
    ({ i } = await bakeRoutes(session, handleFixtureRequest, routes, manifest, 0));

    // Honest empty stubs for dropped spark trees so deep Spark UI fails soft.
    for (const route of stubRoutes || []) {
      const u = new URL(route, 'http://demo.local');
      const key = canonicalKey('GET', u.pathname, u.search);
      if (manifest[key]) continue;
      const file = `r${String(++i).padStart(4, '0')}.json`;
      const stub = {
        analysis_version: 1,
        source_path: u.searchParams.get('path') || '',
        tree: {
          threads: [],
          nodes_emitted: 0,
          truncated: false,
          query_applied: false,
          demo_omitted: true,
          message: 'Deep Spark trees are not available in the demo',
        },
        truncated: false,
        returned_nodes: 0,
        demo_omitted: true,
      };
      writeFileSync(join(OUT, file), JSON.stringify(stub));
      manifest[key] = file;
    }

    total = dirSize(OUT);
  }

  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  total = dirSize(OUT);

  console.log(
    `bake-demo-api: ${Object.keys(manifest).length} routes, ${readdirSync(OUT).length} files, ${(total / 1e6).toFixed(1)} MB` +
      (circuitBreakerHit ? ' (circuit breaker applied)' : ''),
  );

  if (total > MAX_BYTES) {
    console.error('bake-demo-api: still exceeds ~100 MB after circuit breaker');
    process.exit(1);
  }

  // Emit stats for the agent summary
  writeFileSync(
    join(OUT, '_bake-stats.json'),
    JSON.stringify(
      {
        routes: Object.keys(manifest).length,
        files: readdirSync(OUT).length,
        bytes: total,
        circuitBreakerHit,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
