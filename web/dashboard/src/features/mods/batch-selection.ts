/** Row shape used when defaulting batch update selection. */
export type BatchSelectableRow = {
  mod_id?: string | null;
  id?: string | null;
  impact_verdict?: string | null;
};

function rowId(row: BatchSelectableRow): string {
  const id = typeof row.mod_id === 'string' && row.mod_id.trim()
    ? row.mod_id.trim()
    : typeof row.id === 'string' && row.id.trim()
      ? row.id.trim()
      : '';
  return id;
}

/**
 * Default multi-select for Apply N updates: Safe impact only.
 * Caution / Break stay unchecked until the operator opts in.
 */
export function defaultSafeSelection(rows: BatchSelectableRow[]): string[] {
  const out: string[] = [];
  for (const row of rows) {
    const id = rowId(row);
    if (!id) continue;
    if (String(row.impact_verdict ?? '').trim().toLowerCase() !== 'safe') continue;
    out.push(id);
  }
  return out;
}

/** True when any selected id is not Safe (needs allow_non_safe confirm). */
export function selectionHasNonSafe(
  selectedIds: Iterable<string>,
  rows: BatchSelectableRow[],
): boolean {
  const byId = new Map<string, BatchSelectableRow>();
  for (const row of rows) {
    const id = rowId(row);
    if (id) byId.set(id, row);
  }
  for (const id of selectedIds) {
    const row = byId.get(id);
    const verdict = String(row?.impact_verdict ?? '').trim().toLowerCase();
    if (verdict && verdict !== 'safe') return true;
  }
  return false;
}
