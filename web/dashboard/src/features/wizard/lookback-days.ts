export const LOOKBACK_PRESET_DAYS = [1, 7, 30] as const;

export function clampLookbackDays(days: number): number {
  if (!Number.isFinite(days)) return 1;
  return Math.min(30, Math.max(1, Math.trunc(days)));
}

export function daysToHours(days: number): number {
  return clampLookbackDays(days) * 24;
}

export function hoursToLookbackSelection(
  hours: number | null | undefined,
): { kind: 'preset' | 'custom'; days: number } {
  if (typeof hours !== 'number' || !Number.isFinite(hours)) {
    return { kind: 'preset', days: 1 };
  }
  const h = Math.trunc(hours);
  if (h === 24) return { kind: 'preset', days: 1 };
  if (h === 168) return { kind: 'preset', days: 7 };
  if (h === 720) return { kind: 'preset', days: 30 };
  if (h >= 24 && h <= 720 && h % 24 === 0) {
    return { kind: 'custom', days: clampLookbackDays(h / 24) };
  }
  return { kind: 'preset', days: 1 };
}
