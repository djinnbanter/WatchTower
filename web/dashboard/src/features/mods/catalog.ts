import { asArray, asRecord, get } from '@/lib/utils';
import {
  BUCKET_TONE,
  CLIENT_BUCKETS,
  CLIENT_SIDE_IDS,
  bucketLabel,
  catalogSideRank,
} from './side';
import type { BadgeMaps, BadgeSpec, CatalogRow, CatalogSort } from './types';

/** Merge mod rows by id; later layers overlay earlier ones (Modrinth scan wins). */
export function mergeModSources(
  ...layers: Record<string, unknown>[][]
): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const layer of layers) {
    for (const m of layer) {
      const id = String(m.id ?? m.mod_id ?? '');
      if (!id) continue;
      const prev = byId.get(id) ?? {};
      byId.set(id, { ...prev, ...m, id });
    }
  }
  return [...byId.values()];
}

/** Facts + ops-cache Modrinth scan output for catalog / icon fields. */
export function enrichedFactsMods(
  ops: Record<string, unknown> | null | undefined,
  factsOptional: Record<string, unknown> | null | undefined,
): Record<string, unknown>[] {
  const facts = asRecord(factsOptional);
  const fromFacts = asArray<Record<string, unknown>>(facts.mods);
  const fromLight = asArray<Record<string, unknown>>(get(ops, 'mods_light', 'mods'));
  const fromScan = asArray<Record<string, unknown>>(get(ops, 'modrinth_scan', 'mods'));
  const base = fromFacts.length ? fromFacts : fromLight;
  if (!fromScan.length) return base;
  return mergeModSources(base, fromScan);
}

/** Primary Library chrome filters (Updates lives in the main sidebar under Mods). */
export const CATALOG_FILTERS = [
  { value: 'all' as const, label: 'All' },
  { value: 'enabled' as const, label: 'Enabled' },
  { value: 'disabled' as const, label: 'Disabled' },
  { value: 'client' as const, label: 'Client' },
  { value: 'server' as const, label: 'Server' },
];

export const CATALOG_SORT_OPTIONS = [
  { value: 'name' as const, label: 'Name A–Z' },
  { value: 'name-desc' as const, label: 'Name Z–A' },
  { value: 'id' as const, label: 'Mod ID' },
  { value: 'side' as const, label: 'Server → Client' },
  { value: 'updates' as const, label: 'Updates first' },
  { value: 'version' as const, label: 'Version' },
];

export function buildBadgeMaps(
  opsCacheData: Record<string, unknown> | null | undefined,
  factsOptional: Record<string, unknown> | null | undefined,
): BadgeMaps {
  const ops = asRecord(opsCacheData);
  const facts = asRecord(factsOptional);
  const sideById = new Map<string, string>();
  const clientBucketById = new Map<string, string>();
  const clientOnlyById = new Map<string, Record<string, unknown>>();
  const metaById = new Map<string, { is_mcreator: boolean; loader_hint?: string | null }>();
  const connectorById = new Map<string, Record<string, unknown>>();
  const securityById = new Map<string, Record<string, unknown>>();
  const worldRiskById = new Map<string, Record<string, unknown>>();

  const lightMods = asArray<Record<string, unknown>>(get(ops, 'mods_light', 'mods'));
  const factsMods = asArray<Record<string, unknown>>(facts.mods);
  const mods = lightMods.length ? lightMods : factsMods;

  for (const m of mods) {
    const id = String(m.id ?? m.mod_id ?? '');
    if (!id) continue;
    if (m.side_score) sideById.set(id, String(m.side_score));
    metaById.set(id, { is_mcreator: !!m.is_mcreator, loader_hint: (m.loader_hint as string) ?? null });
    if (m.world_risk && typeof m.world_risk === 'object') {
      worldRiskById.set(id, m.world_risk as Record<string, unknown>);
    }
  }

  if (lightMods.length) {
    for (const m of factsMods) {
      const id = String(m.id ?? m.mod_id ?? '');
      if (!id) continue;
      const prev = metaById.get(id) || { is_mcreator: false, loader_hint: null };
      metaById.set(id, {
        ...prev,
        is_mcreator: !!m.is_mcreator || !!prev.is_mcreator,
        loader_hint: (m.loader_hint as string) ?? prev.loader_hint,
      });
      if (m.side_score && !sideById.has(id)) sideById.set(id, String(m.side_score));
    }
  }

  const clientOnlySrc = asArray<Record<string, unknown>>(
    get(ops, 'mods_light', 'client_only_mods_summary', 'mods') ?? facts.client_only_mods,
  );
  for (const m of clientOnlySrc) {
    const id = String(m.mod_id ?? '');
    if (!id) continue;
    clientBucketById.set(id, String(m.bucket ?? ''));
    clientOnlyById.set(id, m);
  }

  for (const w of asArray<Record<string, unknown>>(facts.connector_warnings)) {
    const id = String(w.mod_id ?? w.id ?? '');
    if (id) connectorById.set(id, w);
  }
  for (const f of asArray<Record<string, unknown>>(facts.security_flags)) {
    const id = String(f.mod_id ?? f.id ?? '');
    if (id) securityById.set(id, f);
  }

  return {
    sideById,
    clientBucketById,
    clientOnlyById,
    metaById,
    connectorById,
    securityById,
    worldRiskById,
    hasFacts: mods.length > 0,
    connectorWarnings: asArray<Record<string, unknown>>(facts.connector_warnings),
    securityFlags: asArray<Record<string, unknown>>(facts.security_flags),
  };
}

export function buildCatalogRows(
  runningMods: Record<string, unknown> | null | undefined,
  factsMods: Record<string, unknown>[],
  badgeMaps: BadgeMaps,
): CatalogRow[] {
  const live = asArray<Record<string, unknown>>(asRecord(runningMods).mods);
  const byId = new Map<string, Record<string, unknown>>();
  for (const m of factsMods) {
    const id = String(m.id ?? m.mod_id ?? '');
    if (id) byId.set(id, m);
  }

  const nestedIds = new Set<string>();
  const markNested = (m: Record<string, unknown>) => {
    for (const id of asArray(m.nested_mod_ids)) {
      if (id) nestedIds.add(String(id).toLowerCase());
    }
    for (const j of asArray<Record<string, unknown>>(m.jar_in_jar)) {
      const nid = j?.id ?? j?.mod_id;
      if (nid) nestedIds.add(String(nid).toLowerCase());
    }
  };
  for (const m of factsMods) markNested(m);
  for (const m of live) markNested(m);

  const isNestedPeer = (m: Record<string, unknown>) => {
    if (m.nested === true) return true;
    if (m.parent_jar) return true;
    const id = String(m.id ?? m.mod_id ?? '').toLowerCase();
    return Boolean(id && nestedIds.has(id));
  };

  const ids = new Set<string>();
  const rows: CatalogRow[] = [];
  for (const liveMod of live) {
    const id = String(liveMod.id ?? '');
    if (!id || isNestedPeer(liveMod)) continue;
    ids.add(id);
    const fact = byId.get(id) ?? {};
    rows.push({
      ...fact,
      ...liveMod,
      id,
      display_name: String(fact.modrinth_title || liveMod.display_name || fact.display_name || id),
      version: (liveMod.version ?? fact.version) as string | undefined,
      jar_in_jar: (fact.jar_in_jar ?? liveMod.jar_in_jar) as unknown[] | undefined,
      nested_mod_ids: (fact.nested_mod_ids ?? liveMod.nested_mod_ids) as string[] | undefined,
      side_score: (fact.side_score as string) ?? badgeMaps.sideById.get(id),
      client_bucket: badgeMaps.clientBucketById.get(id),
      meta: badgeMaps.metaById.get(id),
    });
  }
  for (const fact of factsMods) {
    const id = String(fact.id ?? fact.mod_id ?? '');
    if (!id || ids.has(id) || isNestedPeer(fact)) continue;
    rows.push({
      ...fact,
      id,
      display_name: String(fact.modrinth_title || fact.display_name || id),
      client_bucket: badgeMaps.clientBucketById.get(id),
      meta: badgeMaps.metaById.get(id),
    });
  }
  return rows;
}

export function sortCatalogRows(
  rows: CatalogRow[],
  sortKey: CatalogSort,
  showTechNames: boolean,
): CatalogRow[] {
  const list = rows.slice();
  const nameOf = (m: CatalogRow) =>
    (showTechNames ? m.id || '' : m.display_name || m.id || '').toLowerCase();

  list.sort((a, b) => {
    switch (sortKey) {
      case 'name-desc':
        return nameOf(b).localeCompare(nameOf(a));
      case 'id':
        return (a.id || '').localeCompare(b.id || '');
      case 'updates': {
        const au = a.modrinth_outdated ? 0 : 1;
        const bu = b.modrinth_outdated ? 0 : 1;
        if (au !== bu) return au - bu;
        return nameOf(a).localeCompare(nameOf(b));
      }
      case 'side': {
        const d = catalogSideRank(a) - catalogSideRank(b);
        if (d) return d;
        return nameOf(a).localeCompare(nameOf(b));
      }
      case 'version': {
        const d = String(b.version || '').localeCompare(String(a.version || ''), undefined, {
          numeric: true,
        });
        if (d) return d;
        return nameOf(a).localeCompare(nameOf(b));
      }
      case 'name':
      default:
        return nameOf(a).localeCompare(nameOf(b));
    }
  });
  return list;
}

export function sideBadgeSpecsForRow(
  row: CatalogRow,
  badgeMaps: BadgeMaps,
  opts?: { omitUpdateBadge?: boolean },
): BadgeSpec[] {
  const badges: BadgeSpec[] = [];
  const id = row.id;
  const side = row.side_score;
  const clientBucket = row.client_bucket;
  const meta = row.meta;

  if (side === 'server_required') {
    badges.push({ key: 'sr', tone: 'ok', label: 'server' });
  } else if (clientBucket) {
    badges.push({
      key: 'b',
      tone: BUCKET_TONE[clientBucket] ?? 'neutral',
      label: bucketLabel(clientBucket),
    });
  } else if (side && CLIENT_BUCKETS.has(side)) {
    badges.push({ key: 's', tone: BUCKET_TONE[side] ?? 'neutral', label: bucketLabel(side) });
  } else if (CLIENT_SIDE_IDS.has(id) && !badgeMaps.hasFacts) {
    badges.push({ key: 'c', tone: 'info', label: 'client' });
  } else if (!row.modrinth_url && !side) {
    badges.push({ key: 'u', tone: 'neutral', label: 'unresolved' });
  }

  if (row.modrinth_outdated && !opts?.omitUpdateBadge) {
    badges.push({ key: 'upd', tone: 'warn', label: 'Update' });
  }
  if (meta?.is_mcreator) badges.push({ key: 'mc', tone: 'neutral', label: 'MCreator' });
  if (meta?.loader_hint === 'fabric_in_neoforge_jar') {
    badges.push({ key: 'fab', tone: 'warn', label: 'Fabric jar' });
  }
  if (badgeMaps.connectorById.has(id)) {
    badges.push({ key: 'conn', tone: 'info', label: 'Connector' });
  }
  if (badgeMaps.securityById.has(id)) {
    badges.push({ key: 'sec', tone: 'danger', label: 'Security risk' });
  }
  const wr = badgeMaps.worldRiskById.get(id) ?? (row.world_risk as Record<string, unknown> | undefined);
  if (wr && String(wr.level ?? '') === 'high') {
    badges.push({ key: 'wr', tone: 'warn', label: 'World risk' });
  }
  if (row.disabled === true) {
    badges.push({ key: 'dis', tone: 'neutral', label: 'Disabled' });
  }
  const nestedCount = Array.isArray(row.jar_in_jar)
    ? row.jar_in_jar.length
    : Array.isArray(row.nested_mod_ids)
      ? row.nested_mod_ids.length
      : 0;
  if (nestedCount > 0) {
    badges.push({ key: 'nest', tone: 'neutral', label: `+${nestedCount} nested` });
  }
  return badges;
}
