export function formatTreemapSize(valueGb: number): string {
  if (!Number.isFinite(valueGb) || valueGb < 0) return '—';
  if (valueGb >= 1) return `${valueGb.toFixed(1)} GB`;

  const valueMb = valueGb * 1024;
  if (valueMb >= 1) {
    return `${valueMb >= 10 ? Math.round(valueMb) : valueMb.toFixed(1)} MB`;
  }

  return `${Math.round(valueMb * 1024)} KB`;
}
