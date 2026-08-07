export type CpuDisplaySetting = 'auto' | 'panel' | 'quota' | 'host';
export type CpuDisplayMode = 'panel' | 'quota' | 'host';

export type CpuDisplayInputs = {
  coresUsed?: number | null;
  limitCores?: number | null;
  hostCpuPct?: number | null;
};

export function normalizeCpuDisplaySetting(value: unknown): CpuDisplaySetting {
  const v = String(value ?? 'auto').trim().toLowerCase();
  if (v === 'panel' || v === 'quota' || v === 'host' || v === 'auto') return v;
  return 'auto';
}

export function resolveEffectiveCpuMode(
  setting: CpuDisplaySetting,
  inputs: CpuDisplayInputs,
): CpuDisplayMode {
  const hasCores = inputs.coresUsed != null && Number.isFinite(inputs.coresUsed);
  const hasLimit =
    inputs.limitCores != null && Number.isFinite(inputs.limitCores) && (inputs.limitCores as number) > 0;

  if (setting === 'host') return 'host';
  if (setting === 'panel') return hasCores ? 'panel' : 'host';
  if (setting === 'quota') {
    if (hasCores && hasLimit) return 'quota';
    if (hasCores) return 'panel';
    return 'host';
  }
  // auto
  return hasCores ? 'panel' : 'host';
}

/** Derived CPU percent for the active display mode (panel may exceed 100). */
export function deriveCpuPct(
  setting: CpuDisplaySetting | string,
  inputs: CpuDisplayInputs,
): number | null {
  const mode = resolveEffectiveCpuMode(normalizeCpuDisplaySetting(setting), inputs);
  const cores = inputs.coresUsed;
  const limit = inputs.limitCores;
  const host = inputs.hostCpuPct;

  if (mode === 'panel') {
    if (cores == null || !Number.isFinite(cores)) return host ?? null;
    return round1(cores * 100);
  }
  if (mode === 'quota') {
    if (cores == null || limit == null || !Number.isFinite(cores) || !Number.isFinite(limit) || limit <= 0) {
      return host ?? null;
    }
    return round1((cores / limit) * 100);
  }
  if (host == null || !Number.isFinite(host)) return null;
  return round1(host);
}

export function cpuModeLabel(mode: CpuDisplayMode): string {
  switch (mode) {
    case 'panel':
      return 'panel style';
    case 'quota':
      return 'of plan';
    case 'host':
      return 'of host';
  }
}

/** Caption like "3.0 of 12.0 cores · panel style". */
export function formatCpuCaption(
  setting: CpuDisplaySetting | string,
  inputs: CpuDisplayInputs,
): string {
  const normalized = normalizeCpuDisplaySetting(setting);
  const mode = resolveEffectiveCpuMode(normalized, inputs);
  const parts: string[] = [];
  if (inputs.coresUsed != null && Number.isFinite(inputs.coresUsed)) {
    if (inputs.limitCores != null && Number.isFinite(inputs.limitCores) && inputs.limitCores > 0) {
      parts.push(`${inputs.coresUsed.toFixed(1)} of ${inputs.limitCores.toFixed(1)} cores`);
    } else {
      parts.push(`${inputs.coresUsed.toFixed(1)} cores`);
    }
  }
  parts.push(cpuModeLabel(mode));
  return parts.join(' · ') || '—';
}

/** Map a cores series point to display % for charts; fall back to host value. */
export function deriveCpuSeriesValue(
  setting: CpuDisplaySetting | string,
  point: { cores?: number | null; host?: number | null; limitCores?: number | null },
): number | null {
  return deriveCpuPct(setting, {
    coresUsed: point.cores,
    hostCpuPct: point.host,
    limitCores: point.limitCores,
  });
}

/** Elevated tone for CPU vitals — of-plan when quota known, else host % (not display scale). */
export function cpuElevated(
  inputs: CpuDisplayInputs,
  thresholdPct = 85,
): boolean {
  const cores = inputs.coresUsed;
  const limit = inputs.limitCores;
  if (
    cores != null &&
    limit != null &&
    Number.isFinite(cores) &&
    Number.isFinite(limit) &&
    limit > 0
  ) {
    return (cores / limit) * 100 >= thresholdPct;
  }
  const host = inputs.hostCpuPct;
  return host != null && Number.isFinite(host) && host >= thresholdPct;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
