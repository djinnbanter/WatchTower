/**
 * Time-series downsampling — Largest-Triangle-Three-Buckets (LTTB) algorithm.
 * Preserves visual shape while reducing point count.
 *
 * Points are expected to be { t: string|number, v: number } objects.
 * The returned array has the same shape.
 */

/**
 * Downsample a series to at most maxPoints while preserving shape (LTTB).
 * @param {{ t: string|number, v: number }[]} points
 * @param {number} maxPoints  Target number of output points (>= 2)
 * @returns {{ t: string|number, v: number }[]}
 */
export function downsampleSeries(points, maxPoints) {
  if (!Array.isArray(points) || points.length === 0) return [];
  if (maxPoints <= 0 || points.length <= maxPoints) return points;
  if (maxPoints === 1) return [points[0]];
  if (maxPoints === 2) return [points[0], points[points.length - 1]];

  const n = points.length;
  const out = [];

  // Always include first point
  out.push(points[0]);

  const bucketSize = (n - 2) / (maxPoints - 2);

  let prevSelected = 0;

  for (let i = 0; i < maxPoints - 2; i++) {
    // Bucket range for the next bucket (used to compute average)
    const nextBucketStart = Math.floor((i + 1) * bucketSize) + 1;
    const nextBucketEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, n);

    // Average of next bucket
    let avgX = 0;
    let avgY = 0;
    const nextBucketLen = nextBucketEnd - nextBucketStart;
    for (let j = nextBucketStart; j < nextBucketEnd; j++) {
      avgX += _x(points[j]);
      avgY += points[j].v;
    }
    avgX /= nextBucketLen;
    avgY /= nextBucketLen;

    // Current bucket range
    const curBucketStart = Math.floor(i * bucketSize) + 1;
    const curBucketEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, n);

    const ax = _x(points[prevSelected]);
    const ay = points[prevSelected].v;

    let maxArea = -1;
    let maxIdx = curBucketStart;

    for (let j = curBucketStart; j < curBucketEnd; j++) {
      const area = Math.abs(
        (ax - avgX) * (points[j].v - ay) -
        (ax - _x(points[j])) * (avgY - ay)
      );
      if (area > maxArea) {
        maxArea = area;
        maxIdx = j;
      }
    }

    out.push(points[maxIdx]);
    prevSelected = maxIdx;
  }

  // Always include last point
  out.push(points[n - 1]);

  return out;
}

/**
 * Downsample a map of series arrays keyed by metric name.
 * @param {Record<string, {t: string|number, v: number}[]>} seriesMap
 * @param {number} maxPoints
 * @returns {Record<string, {t: string|number, v: number}[]>}
 */
export function downsampleSeriesMap(seriesMap, maxPoints) {
  if (!seriesMap) return {};
  const out = {};
  for (const [key, pts] of Object.entries(seriesMap)) {
    out[key] = downsampleSeries(pts, maxPoints);
  }
  return out;
}

// ── Internal ───────────────────────────────────────────────────────────────────

function _x(pt) {
  if (typeof pt.t === 'number') return pt.t;
  return Date.parse(pt.t) || 0;
}
