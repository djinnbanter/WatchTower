import type { CatalogFilter, CatalogRow, SideSummary, Tone } from './types';

export const CLIENT_SIDE_IDS = new Set([
  'sodium',
  'embeddium',
  'oculus',
  'iris',
  'entity_texture_features',
  'playeranimator',
  'xaeros_minimap',
  'xaeros_worldmap',
  'journeymap',
  'appleskin',
  'jei',
  'inventorysorter',
  'trashslot',
  'craftingtweaks',
  'controlling',
  'searchables',
  'jade',
  'carryon',
  'sound_physics_remastered',
]);

export const CLIENT_BUCKETS = new Set([
  'likely_removable',
  'client_library',
  'uncertain',
  'test_remove',
]);

export const BUCKET_TONE: Record<string, Tone> = {
  likely_removable: 'danger',
  client_library: 'info',
  uncertain: 'warn',
  test_remove: 'neutral',
  server_required: 'ok',
};

export const SIDE_COPY: Record<
  string,
  { role: string; title: string; tone: Tone; reason: string; advice: string }
> = {
  server_required: {
    role: 'Server',
    title: 'Required on the server',
    tone: 'ok',
    reason: 'Server-required gameplay or library mod.',
    advice: 'Keep this jar on dedicated servers — removing it will break gameplay or other mods.',
  },
  likely_removable: {
    role: 'Client',
    title: 'Likely client-only',
    tone: 'danger',
    reason: 'Typically client-only on a dedicated server.',
    advice: 'Safe to remove from server mods/ on a dedicated host — keep a backup of the jar.',
  },
  client_library: {
    role: 'Client',
    title: 'Client library',
    tone: 'info',
    reason: 'Client-oriented library — may be required by other mods.',
    advice: 'Do not remove unless you know no other mods need it.',
  },
  uncertain: {
    role: 'Hybrid',
    title: 'May run on both sides',
    tone: 'warn',
    reason: 'May provide server features — review before removing.',
    advice: 'Check mod documentation; some features may run on dedicated servers.',
  },
  test_remove: {
    role: 'Uncertain',
    title: 'Needs a careful test',
    tone: 'warn',
    reason: 'Insufficient signals — test removal one mod at a time.',
    advice: 'Remove one jar, restart, and verify before removing more.',
  },
};

export const UPDATE_VERDICT_FILTERS = [
  { value: 'all' as const, label: 'All' },
  { value: 'safe' as const, label: 'Safe' },
  { value: 'caution' as const, label: 'Caution' },
  { value: 'break' as const, label: 'Break' },
  { value: 'unknown' as const, label: 'Unknown' },
];

export const VERDICT_TONE: Record<string, Tone> = {
  safe: 'ok',
  caution: 'warn',
  break: 'danger',
  unknown: 'neutral',
};

export const VERDICT_LABEL: Record<string, string> = {
  safe: 'Safe',
  caution: 'Caution',
  break: 'Break',
  unknown: 'Unknown',
};

export const MODRINTH_SIGNAL_LABELS: Record<string, string> = {
  'modrinth:server_required': 'Server required',
  'modrinth:client_only': 'Client only',
  'modrinth:optional_both': 'Both sides',
};

export function modDisplayName(mod: Record<string, unknown> | null | undefined, showTechNames: boolean): string {
  if (!mod) return '?';
  if (showTechNames) {
    return String(mod.id ?? mod.mod_id ?? mod.display_name ?? '?');
  }
  return String(mod.modrinth_title || mod.display_name || mod.id || mod.mod_id || '?');
}

export function bucketLabel(bucket: string | null | undefined): string {
  return String(bucket ?? '').replace(/_/g, '-');
}

export function humanizeSideSignal(raw: unknown): string {
  const s = String(raw ?? '');
  if (MODRINTH_SIGNAL_LABELS[s]) return MODRINTH_SIGNAL_LABELS[s];
  if (s.startsWith('modrinth:')) {
    return s
      .slice('modrinth:'.length)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (s.startsWith('ecosystem:')) return `Ecosystem · ${s.slice(10)}`;
  if (s.startsWith('dependent_of:')) return `Depends on ${s.slice(13)}`;
  if (s === 'SERVER_REQUIRED_IDS') return 'Known server mod';
  if (s === 'log_client_refs') return 'Client refs in logs';
  if (s === 'bytecode_scan') return 'Bytecode scan';
  return s.replace(/_/g, ' ');
}

export function sideSummaryForMod(
  mod: Record<string, unknown>,
  badgeMaps: { clientOnlyById: Map<string, Record<string, unknown>>; hasFacts: boolean },
): SideSummary {
  const id = String(mod.id ?? mod.mod_id ?? '');
  const clientRow = badgeMaps.clientOnlyById.get(id);
  const bucket =
    (clientRow?.bucket as string | undefined) ||
    (mod.client_bucket as string | undefined) ||
    (mod.side_score as string | undefined) ||
    null;
  const signals = [
    ...(Array.isArray(mod.side_signals) ? mod.side_signals : []),
    ...(Array.isArray(clientRow?.signals) ? (clientRow.signals as unknown[]) : []),
  ]
    .filter(Boolean)
    .map(String);
  const uniqueSignals = [...new Set(signals)];

  if (bucket && SIDE_COPY[bucket]) {
    const base = SIDE_COPY[bucket];
    return {
      ...base,
      bucket,
      reason: String(clientRow?.reason || base.reason),
      advice: String(clientRow?.removal_advice || base.advice),
      confidence: clientRow?.confidence ? String(clientRow.confidence) : null,
      signals: uniqueSignals,
    };
  }

  if (!badgeMaps.hasFacts && CLIENT_SIDE_IDS.has(id)) {
    return {
      role: 'Client',
      title: 'Known client-side mod',
      tone: 'info',
      bucket: 'client',
      reason: 'Heuristic fallback — Scanning / Modrinth scores refine client vs server.',
      advice: 'Confirm with a Modrinth scan or docs before removing from the server.',
      confidence: 'low',
      signals: uniqueSignals,
    };
  }

  if (!mod.modrinth_url && !mod.side_score) {
    return {
      role: 'Unknown',
      title: 'Side not scored yet',
      tone: 'neutral',
      bucket: null,
      reason: 'No client/server score for this jar yet.',
      advice:
        'Enable Modrinth lookup in Settings → Monitoring, then run a Modrinth scan for clearer side scoring.',
      confidence: null,
      signals: uniqueSignals,
    };
  }

  return {
    role: 'Unknown',
    title: 'No strong side signal',
    tone: 'neutral',
    bucket: null,
    reason: 'Watchtower did not classify this mod as clearly client or server.',
    advice: 'Treat it as needed until you verify in docs or a test world.',
    confidence: null,
    signals: uniqueSignals,
  };
}

export function isClientLeaning(row: CatalogRow, hasFacts: boolean): boolean {
  if (row.side_score === 'server_required') return false;
  if (CLIENT_BUCKETS.has(String(row.side_score || '')) || CLIENT_BUCKETS.has(String(row.client_bucket || ''))) {
    return true;
  }
  if (!hasFacts && CLIENT_SIDE_IDS.has(row.id)) return true;
  return false;
}

export function isUnresolved(row: CatalogRow, hasFacts: boolean): boolean {
  if (row.modrinth_url || row.modrinth_slug) return false;
  if (!hasFacts) return true;
  return !row.side_score;
}

export function matchesCatalogFilter(row: CatalogRow, filter: CatalogFilter, hasFacts: boolean): boolean {
  switch (filter) {
    case 'client':
      return isClientLeaning(row, hasFacts);
    case 'server':
      return row.side_score === 'server_required';
    case 'unresolved':
      return isUnresolved(row, hasFacts);
    default:
      return true;
  }
}

export function catalogSideRank(row: CatalogRow): number {
  const s = row.side_score || row.client_bucket || '';
  if (s === 'server_required') return 0;
  if (s === 'uncertain' || s === 'test_remove') return 1;
  if (s === 'client_library') return 2;
  if (s === 'likely_removable') return 3;
  if (CLIENT_SIDE_IDS.has(row.id)) return 3;
  return 4;
}
