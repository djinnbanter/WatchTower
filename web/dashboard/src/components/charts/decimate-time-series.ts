/**
 * Time-aligned bucket downsample for sliding live windows.
 * Bucket ids are absolute (`floor(t / bucketMs)`), so as the viewport slides,
 * existing samples keep identity instead of LTTB reshuffling every poll.
 *
 * Interior buckets keep the *first* sample (stable under merge/stride refill).
 * The oldest and newest in-range samples are always forced in so the live tip
 * (and left edge) track reality instead of freezing on a wide tip bucket.
 */
export function downsampleTimeBuckets<T extends { date: Date }>(
  data: T[],
  maxPoints: number,
  rangeStartMs: number,
  rangeEndMs: number
): T[] {
  const len = data.length;
  if (len <= maxPoints || maxPoints < 2) {
    return data;
  }
  const span = rangeEndMs - rangeStartMs;
  if (!(span > 0)) {
    return data;
  }

  const bucketMs = span / (maxPoints - 1);
  const buckets = new Map<number, T>();
  let oldest: T | null = null;
  let oldestMs = Number.POSITIVE_INFINITY;
  let newest: T | null = null;
  let newestMs = Number.NEGATIVE_INFINITY;

  for (const row of data) {
    const t = row.date.getTime();
    if (t < rangeStartMs || t > rangeEndMs) {
      continue;
    }
    if (t < oldestMs) {
      oldestMs = t;
      oldest = row;
    }
    if (t >= newestMs) {
      newestMs = t;
      newest = row;
    }
    const id = Math.floor(t / bucketMs);
    if (!buckets.has(id)) {
      buckets.set(id, row);
    }
  }

  if (buckets.size === 0) {
    return data.slice(0, maxPoints);
  }

  // Force oldest / tip into their buckets so first-wins cannot drop the live edge.
  if (oldest) {
    buckets.set(Math.floor(oldestMs / bucketMs), oldest);
  }
  if (newest) {
    buckets.set(Math.floor(newestMs / bucketMs), newest);
  }

  const out = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row);

  // If forcing edges overflowed the cap, drop interior points (never tip/oldest).
  if (out.length > maxPoints && out.length >= 2) {
    const tip = out[out.length - 1]!;
    const head = out[0]!;
    const interior = out.slice(1, -1);
    const keep = maxPoints - 2;
    if (keep <= 0) {
      return [head, tip];
    }
    if (interior.length > keep) {
      const step = interior.length / keep;
      const picked: T[] = [];
      for (let i = 0; i < keep; i++) {
        picked.push(interior[Math.min(interior.length - 1, Math.floor(i * step))]!);
      }
      return [head, ...picked, tip];
    }
  }

  return out;
}

export function decimateTimeSeries<T extends Record<string, unknown>>(
  data: T[],
  maxPoints: number,
  valueKeys: string[] = []
): T[] {
  const len = data.length;
  if (maxPoints >= len || maxPoints < 3) {
    return data;
  }

  const getY = (point: T, index: number): number => {
    if (valueKeys.length === 0) {
      for (const val of Object.values(point)) {
        if (typeof val === "number") {
          return val;
        }
      }
      return index;
    }

    let sum = 0;
    let count = 0;
    for (const key of valueKeys) {
      const val = point[key];
      if (typeof val === "number") {
        sum += val;
        count++;
      }
    }
    return count > 0 ? sum / count : index;
  };

  const sampled: T[] = [data[0] as T];
  const bucketSize = (len - 2) / (maxPoints - 2);
  let previousIndex = 0;

  for (let i = 0; i < maxPoints - 2; i++) {
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, len - 1);

    const nextRangeStart = Math.floor((i + 2) * bucketSize) + 1;
    const nextRangeEnd = Math.min(Math.floor((i + 3) * bucketSize) + 1, len);
    const nextCount = Math.max(0, nextRangeEnd - nextRangeStart);

    let avgX = len - 1;
    let avgY = getY(data[len - 1] as T, len - 1);
    if (nextCount > 0) {
      avgX = 0;
      avgY = 0;
      for (let j = nextRangeStart; j < nextRangeEnd; j++) {
        avgX += j;
        avgY += getY(data[j] as T, j);
      }
      avgX /= nextCount;
      avgY /= nextCount;
    }

    const pointA = data[previousIndex] as T;
    const ax = previousIndex;
    const ay = getY(pointA, previousIndex);

    let maxArea = -1;
    let maxIndex = rangeStart;

    for (let j = rangeStart; j < rangeEnd; j++) {
      const area =
        Math.abs(
          (ax - avgX) * (getY(data[j] as T, j) - ay) - (ax - j) * (avgY - ay)
        ) * 0.5;
      if (area > maxArea) {
        maxArea = area;
        maxIndex = j;
      }
    }

    sampled.push(data[maxIndex] as T);
    previousIndex = maxIndex;
  }

  sampled.push(data[len - 1] as T);
  return sampled;
}

/** ~1.5 points per pixel — enough for crisp curves without over-drawing. */
export function maxRenderPointsForWidth(innerWidth: number): number {
  return Math.max(64, Math.ceil(innerWidth * 1.5));
}

/** Bucket OHLC rows into fewer candles while preserving high/low extremes. */
export function decimateOhlcData<T extends Record<string, unknown>>(
  data: T[],
  maxPoints: number
): T[] {
  const len = data.length;
  if (maxPoints >= len || maxPoints < 2) {
    return data;
  }

  const bucketSize = len / maxPoints;
  const sampled: T[] = [];

  for (let i = 0; i < maxPoints; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.min(len, Math.floor((i + 1) * bucketSize));
    if (start >= end) {
      continue;
    }

    const bucket = data.slice(start, end);
    const first = bucket[0] as T;
    const last = bucket.at(-1) as T;

    let high = Number.NEGATIVE_INFINITY;
    let low = Number.POSITIVE_INFINITY;
    for (const row of bucket) {
      const rowHigh = row.high;
      const rowLow = row.low;
      if (typeof rowHigh === "number" && rowHigh > high) {
        high = rowHigh;
      }
      if (typeof rowLow === "number" && rowLow < low) {
        low = rowLow;
      }
    }

    sampled.push({
      ...last,
      open: first.open,
      high: Number.isFinite(high) ? high : last.high,
      low: Number.isFinite(low) ? low : last.low,
      close: last.close,
    } as T);
  }

  return sampled;
}
