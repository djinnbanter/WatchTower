import { scaleLinear } from "@visx/scale";
import type { LineConfig } from "./chart-context";
import { type ChartPhase, Y_DOMAIN_TWEEN_SKIP_THRESHOLD } from "./chart-phase";
import { groupLinesByYAxisId, normalizeYAxisId } from "./y-axis-scales";

export type YDomain = [number, number];

/** Apply visx `nice()` to raw domain endpoints for stable grid ticks. */
export function niceYDomain(domain: YDomain): YDomain {
  const scale = scaleLinear({ domain, range: [0, 1], nice: true });
  const niceDomain = scale.domain();
  return [niceDomain[0] ?? domain[0], niceDomain[1] ?? domain[1]];
}

/**
 * Expand-only merge for live sliding viewports.
 * Prevents max*1.1 + nice() from vertically "breathing" as the window slides
 * or tip samples tick — spikes keep headroom until the lock key resets (preset).
 */
export function expandOnlyYDomains(
  prev: Record<string, YDomain>,
  next: Record<string, YDomain>,
): Record<string, YDomain> {
  const out: Record<string, YDomain> = {};
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const axisId of keys) {
    const a = prev[axisId];
    const b = next[axisId];
    if (!a && b) {
      out[axisId] = b;
      continue;
    }
    if (a && !b) {
      out[axisId] = a;
      continue;
    }
    if (!(a && b)) continue;
    out[axisId] = [Math.min(a[0], b[0]), Math.max(a[1], b[1])];
  }
  return out;
}

/** True when every shared axis in `next` sits meaningfully inside `locked`. */
export function yDomainsWellBelow(
  locked: Record<string, YDomain>,
  next: Record<string, YDomain>,
  /** Fraction of locked span the next max must sit under (default 35%). */
  marginFrac = 0.35,
): boolean {
  const keys = Object.keys(locked);
  if (keys.length === 0) return false;
  for (const axisId of keys) {
    const a = locked[axisId];
    const b = next[axisId];
    if (!a || !b) return false;
    const span = Math.max(1e-9, a[1] - a[0]);
    const headroom = a[1] - b[1];
    if (headroom < span * marginFrac) return false;
  }
  return true;
}

/**
 * Expand-only with slow recover: after `recoverAfterMs` of staying well below
 * the locked max, re-seed to `next` so a spike does not permanently crush the line.
 */
export function expandOnlyYDomainsWithRecover(
  prev: Record<string, YDomain>,
  next: Record<string, YDomain>,
  state: { belowSinceMs: number | null },
  nowMs: number,
  recoverAfterMs = 8_000,
): Record<string, YDomain> {
  const expanded = expandOnlyYDomains(prev, next);
  if (yDomainsWellBelow(expanded, next)) {
    if (state.belowSinceMs == null) {
      state.belowSinceMs = nowMs;
    } else if (nowMs - state.belowSinceMs >= recoverAfterMs) {
      state.belowSinceMs = null;
      return next;
    }
  } else {
    state.belowSinceMs = null;
  }
  return expanded;
}

/**
 * Skip Y tween when both endpoints move less than the threshold relative to span.
 * When in doubt callers should tween — beauty wins over micro-optimization.
 */
export function shouldTweenYDomain(from: YDomain, to: YDomain): boolean {
  const span = Math.max(
    Math.abs(to[1] - to[0]),
    Math.abs(from[1] - from[0]),
    1
  );
  const deltaMin = Math.abs(to[0] - from[0]) / span;
  const deltaMax = Math.abs(to[1] - from[1]) / span;
  return (
    deltaMin >= Y_DOMAIN_TWEEN_SKIP_THRESHOLD ||
    deltaMax >= Y_DOMAIN_TWEEN_SKIP_THRESHOLD
  );
}

/** Phases where the chart shows loading chrome (shimmer, pulse, label). */
export function isLoadingChromePhase(phase: ChartPhase): boolean {
  return phase === "loading" || phase === "revealingLoading";
}

/** Phases where grid lines use loading stroke styling (muted / dashed chrome). */
export function isLoadingGridChromePhase(phase: ChartPhase): boolean {
  return (
    phase === "loading" || phase === "exiting" || phase === "gridTweenLoading"
  );
}

/** Phases where Y-domain tween runs after the series has exited. */
export function isYDomainTweenPhase(phase: ChartPhase): boolean {
  return phase === "gridTweenLoading" || phase === "gridTweenReady";
}

/** Phases where {@link ReferenceArea} bands are shown (fade in/out on transitions). */
export function isReferenceAreaVisiblePhase(phase: ChartPhase): boolean {
  return (
    phase === "ready" || phase === "revealing" || phase === "gridTweenReady"
  );
}

export function resolveAnimatedYDestinationDomains(
  chartPhase: ChartPhase,
  skeletonByAxis: Record<string, YDomain>,
  targetByAxis: Record<string, YDomain>
): Record<string, YDomain> {
  switch (chartPhase) {
    case "loading":
    case "exiting":
    case "gridTweenLoading":
      return skeletonByAxis;
    case "exitingReady":
    case "gridTweenReady":
    case "revealing":
    case "ready":
      return targetByAxis;
    default:
      return targetByAxis;
  }
}

export function computeYDomainsByAxis({
  lines,
  resolveDomain,
}: {
  lines: LineConfig[];
  resolveDomain: (dataKeys: string[]) => YDomain;
}): Record<string, YDomain> {
  const groups = groupLinesByYAxisId(lines);
  const domains: Record<string, YDomain> = {};

  for (const [axisId, axisLines] of groups) {
    const dataKeys = axisLines.map((line) => line.dataKey);
    domains[normalizeYAxisId(axisId)] = niceYDomain(resolveDomain(dataKeys));
  }

  if (!domains.left) {
    domains.left = niceYDomain([0, 100]);
  }

  return domains;
}

/** Merge domain maps, normalizing axis ids to strings. */
export function mergeYDomainRecords(
  ...records: Record<string, YDomain>[]
): Record<string, YDomain> {
  const merged: Record<string, YDomain> = {};
  for (const record of records) {
    for (const [axisId, domain] of Object.entries(record)) {
      merged[normalizeYAxisId(axisId)] = domain;
    }
  }
  return merged;
}

export function domainsEqual(
  left: Record<string, YDomain>,
  right: Record<string, YDomain>
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (const axisId of leftKeys) {
    const from = left[axisId];
    const to = right[axisId];
    if (!(from && to) || from[0] !== to[0] || from[1] !== to[1]) {
      return false;
    }
  }

  return true;
}
