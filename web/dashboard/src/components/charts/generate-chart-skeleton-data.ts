const DEFAULT_SKELETON_DATA_KEY = "value";
const DEFAULT_SKELETON_POINT_COUNT = 7;
/** Cap skeleton density — long windows must not create thousands of placeholder points. */
const MAX_SKELETON_POINTS = 48;

export interface GenerateChartSkeletonDataOptions {
  /** Key used for y values in each row. Default: `"value"`. */
  dataKey?: string;
  /** Number of points. Default: 7. */
  pointCount?: number;
  /** Start date for the x axis. Default: 2025-01-01. */
  baseDate?: Date;
}

/** Placeholder series used while `status="loading"` and data is empty. */
export function generateChartSkeletonData(
  options: GenerateChartSkeletonDataOptions = {}
): Record<string, unknown>[] {
  const dataKey = options.dataKey ?? DEFAULT_SKELETON_DATA_KEY;
  const pointCount = options.pointCount ?? DEFAULT_SKELETON_POINT_COUNT;
  const baseDate = options.baseDate ?? new Date("2025-01-01");

  return Array.from({ length: pointCount }, (_, index) => {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + index);
    return {
      date,
      [dataKey]: Math.round(110 + Math.sin(index * 1.15) * 36 + index * 9),
    };
  });
}

function sampleTargetRows(
  targetData: Record<string, unknown>[],
  maxPoints: number
): Record<string, unknown>[] {
  if (targetData.length <= maxPoints) {
    return targetData;
  }

  const sampled: Record<string, unknown>[] = [];
  const lastIndex = targetData.length - 1;
  for (let i = 0; i < maxPoints; i += 1) {
    const index =
      i === maxPoints - 1
        ? lastIndex
        : Math.round((i / (maxPoints - 1)) * lastIndex);
    const row = targetData[index];
    if (row && sampled[sampled.length - 1] !== row) {
      sampled.push(row);
    }
  }
  return sampled;
}

function resolveSkeletonBand(
  rows: Record<string, unknown>[],
  dataKey: string
): { mid: number; amp: number } {
  let minVal = Number.POSITIVE_INFINITY;
  let maxVal = Number.NEGATIVE_INFINITY;

  for (const row of rows) {
    const value = row[dataKey];
    if (typeof value === "number" && Number.isFinite(value)) {
      minVal = Math.min(minVal, value);
      maxVal = Math.max(maxVal, value);
    }
  }

  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
    return { mid: 100, amp: 36 };
  }

  const span = Math.max(1, maxVal - minVal);
  const mid = minVal + span * 0.45;
  const amp = Math.max(span * 0.28, Math.abs(mid) * 0.08, 1);
  return { mid, amp };
}

/**
 * Skeleton rows that mirror target dates with magnitudes near the real series.
 * Always capped — never `index * k` across the full series (that blows Y to 20k+).
 */
export function generateChartSkeletonFromTarget(
  targetData: Record<string, unknown>[],
  dataKey: string | string[]
): Record<string, unknown>[] {
  const dataKeys = (Array.isArray(dataKey) ? dataKey : [dataKey]).filter(
    Boolean
  );
  const primaryKey = dataKeys[0] ?? DEFAULT_SKELETON_DATA_KEY;

  if (targetData.length === 0) {
    return generateChartSkeletonData({ dataKey: primaryKey });
  }

  const sampled = sampleTargetRows(targetData, MAX_SKELETON_POINTS);
  const bands = new Map(
    dataKeys.map((key) => [key, resolveSkeletonBand(sampled, key)] as const)
  );

  return sampled.map((row, index) => {
    const next: Record<string, unknown> = {
      date: row.date,
    };
    for (const key of dataKeys) {
      const { mid, amp } = bands.get(key) ?? { mid: 100, amp: 36 };
      next[key] = Math.round(mid + Math.sin(index * 1.05) * amp);
    }
    return next;
  });
}

export { DEFAULT_SKELETON_DATA_KEY, DEFAULT_SKELETON_POINT_COUNT, MAX_SKELETON_POINTS };
