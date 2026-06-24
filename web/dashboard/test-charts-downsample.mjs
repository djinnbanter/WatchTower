/**
 * Quick stability check for time-bucket downsampling.
 * Run: node web/dashboard/test-charts-downsample.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const chartsSrc = readFileSync(join(dir, 'charts.js'), 'utf8');
const ctx = {
  window: {},
  console,
  Map,
  Date,
  Math,
  Number,
  parseInt,
  requestAnimationFrame: (fn) => fn(),
  matchMedia: () => ({ matches: false }),
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  ResizeObserver: class { observe() {} disconnect() {} },
  MutationObserver: class { observe() {} disconnect() {} },
};
vm.createContext(ctx);
vm.runInContext(chartsSrc, ctx);

const downsampleByTimeBuckets = ctx.window.downsampleByTimeBuckets;
const parseChartTimeMs = ctx.window.parseChartTimeMs;

const windowStart = Date.now() - 60_000;
const windowEnd = Date.now();
const base = [];
for (let i = 0; i < 200; i++) {
  const ms = windowStart + i * 300;
  base.push({ t: new Date(ms).toISOString(), v: 19 + (i % 3) * 0.1 });
}

const a = downsampleByTimeBuckets(base, windowStart, windowEnd, 40);
const extended = [...base, { t: new Date(windowEnd - 100).toISOString(), v: 18.5 }];
const b = downsampleByTimeBuckets(extended, windowStart, windowEnd, 40);

let prefixStable = true;
const len = Math.min(a.length, b.length) - 1;
for (let i = 0; i < len; i++) {
  if (parseChartTimeMs(a[i].t) !== parseChartTimeMs(b[i].t) || a[i].v !== b[i].v) {
    prefixStable = false;
    break;
  }
}

if (!prefixStable) {
  console.error('FAIL: prefix buckets changed after tail append');
  process.exit(1);
}
console.log('OK: downsample prefix stable after tail append');
