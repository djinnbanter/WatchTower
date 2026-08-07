function clean(s: unknown): string {
  return String(s ?? '').trim();
}

export function updatesVersionSides(
  row: Record<string, unknown> | null | undefined,
): { current?: string; latest?: string } {
  const current = clean(row?.current_version);
  const latest = clean(row?.latest_compatible);
  const out: { current?: string; latest?: string } = {};
  if (current) out.current = current;
  if (latest) out.latest = latest;
  return out;
}

export function updatesImpactSummary(
  row: Record<string, unknown> | null | undefined,
): string {
  return clean(row?.impact_summary);
}

export function updatesImpactVerdict(
  row: Record<string, unknown> | null | undefined,
): string {
  return clean(row?.impact_verdict) || 'unknown';
}

export function updatesModrinthUrl(
  updateRow: Record<string, unknown> | null | undefined,
  mod: { modrinth_compatible_url?: string; modrinth_cta_url?: string },
): string {
  return (
    clean(updateRow?.modrinth_compatible_url) ||
    clean(updateRow?.modrinth_cta_url) ||
    clean(mod.modrinth_compatible_url) ||
    clean(mod.modrinth_cta_url) ||
    ''
  );
}
