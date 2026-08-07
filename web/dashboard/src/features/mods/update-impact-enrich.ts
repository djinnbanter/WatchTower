import { str } from '@/lib/utils';
import { buildModGraph } from './mod-graph';

function displayNameFor(
  modId: string,
  modsById: Map<string, Record<string, unknown>>,
): string {
  const mod = modsById.get(modId);
  if (!mod) return modId;
  return str(mod.modrinth_title) || str(mod.display_name) || modId;
}

function dedupeByModId(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const id = str(row.mod_id);
    if (!id || byId.has(id)) continue;
    byId.set(id, row);
  }
  return [...byId.values()];
}

/**
 * Ensure update rows expose the full impact checklist for UI.
 * Server/Java enrich always ships blockers/co_updates/dependents arrays — leave those alone.
 * Preview/summary-only rows get a lightweight local fill (Create↔Flywheel + dependents).
 */
export function enrichUpdateImpactForDisplay(
  row: Record<string, unknown>,
  mods: Record<string, unknown>[],
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  const modId = str(row.mod_id);
  if (!modId) return out;

  if ((modId === 'create' || modId === 'flywheel') && !str(out.related_pair)) {
    out.related_pair = modId === 'create' ? 'flywheel' : 'create';
  }

  const hasServerImpact =
    Array.isArray(row.blockers) ||
    Array.isArray(row.co_updates) ||
    Array.isArray(row.dependents);
  if (hasServerImpact) {
    return out;
  }

  const graph = buildModGraph(mods);
  const blockers: Record<string, unknown>[] = [];
  const coUpdates: Record<string, unknown>[] = [];
  const dependents: Record<string, unknown>[] = [];

  for (const dependentId of graph.dependentsOf(modId)) {
    dependents.push({
      mod_id: dependentId,
      display_name: displayNameFor(dependentId, graph.byId),
      mandatory: true,
    });
    coUpdates.push({
      mod_id: dependentId,
      display_name: displayNameFor(dependentId, graph.byId),
      current: str(graph.byId.get(dependentId)?.version) || undefined,
      detail: `Depends on ${displayNameFor(modId, graph.byId)} — retest after updating.`,
    });
  }

  const related = str(out.related_pair);
  if (related) {
    const partner = graph.byId.get(related);
    if (partner) {
      coUpdates.push({
        mod_id: related,
        display_name: displayNameFor(related, graph.byId),
        current: str(partner.version) || undefined,
        detail: `Update ${displayNameFor(related, graph.byId)} together with ${displayNameFor(modId, graph.byId)}.`,
      });
    } else {
      blockers.push({
        mod_id: related,
        display_name: related,
        kind: 'need_install',
        detail: `Paired mod ${related} is missing from the pack.`,
      });
    }
  }

  out.blockers = blockers;
  out.co_updates = dedupeByModId(coUpdates);
  out.dependents = dependents;

  if (blockers.length) {
    out.impact_verdict = 'break';
    out.confidence = str(out.confidence) || 'medium';
    out.impact_summary =
      'This update likely breaks the pack without co-updates or installs.';
  } else if (coUpdates.length || dependents.length) {
    out.impact_verdict = 'caution';
    out.confidence = str(out.confidence) || 'low';
    out.impact_summary =
      'Update looks possible; review co-updates and dependents first.';
  } else {
    out.blockers = [];
    out.co_updates = [];
    out.dependents = [];
  }

  return out;
}
