export type UnknownRecord = Record<string, unknown>;

export type SparkSummary = {
  sourcePath: string;
  sourceFile: string;
  sourceKind: string;
  capturedAt: string;
  mtime: string;
  sizeBytes: number;
  fresh: boolean;
  autoCaptured: boolean;
  status: string;
  reason: string;
};

export type SparkEvidence = {
  label: string;
  value: string;
  unit: string;
  path: string;
  raw: string;
};

export type SparkFinding = {
  id: string;
  title: string;
  detail: string;
  severity: string;
  confidence: 'observed' | 'correlated' | 'contextual';
  evidence: SparkEvidence[];
  caveats: string[];
};

export type SparkSource = {
  id: string;
  label: string;
  ownPct: number;
  involvementPct: number;
  methodCount: number;
  topLabel: string;
};

export type SparkMethod = {
  label: string;
  className: string;
  method: string;
  source: string;
  pct: number;
  ownPct: number;
  parentChain: string[];
};

export type SparkTimelinePoint = {
  at: string;
  endAt: string;
  tps: number;
  mspt: number;
  msptMax: number;
  players: number;
  entities: number;
  chunks: number;
  cpu: number;
};

export function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

export function array<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function text(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  return String(value)
    .replaceAll('Â·', '·')
    .replaceAll('â€”', '—')
    .replaceAll('â€“', '–')
    .replaceAll('â†’', '→');
}

export function numeric(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function truthy(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : value == null ? fallback : value === 'true';
}

export function firstValue(root: UnknownRecord, paths: string[][]): unknown {
  for (const path of paths) {
    let value: unknown = root;
    for (const key of path) value = record(value)[key];
    if (value != null) return value;
  }
  return undefined;
}

export function unwrapProfile(value: unknown): UnknownRecord {
  const root = record(value);
  const nested = record(root.profile);
  return Object.keys(nested).length ? nested : root;
}

export function profileSummaries(index: unknown): SparkSummary[] {
  const root = record(index);
  const normal = array<UnknownRecord>(root.profiles).map((row) => summaryFrom(row));
  const skipped = array<UnknownRecord>(root.skipped_profiles ?? root.skipped).map((row) =>
    summaryFrom({ ...row, status: row.status ?? 'skipped' }),
  );
  return [...normal, ...skipped].filter((row) => row.sourcePath || row.sourceFile);
}

function summaryFrom(row: UnknownRecord): SparkSummary {
  return {
    sourcePath: text(row.source_path ?? row.path),
    sourceFile: text(row.source_file ?? row.file ?? row.source_path ?? row.path, 'Unknown profile'),
    sourceKind: text(row.source_kind ?? row.kind, 'spark_upload'),
    capturedAt: text(row.captured_at ?? row.created_at ?? row.mtime),
    mtime: text(row.mtime ?? row.modified_at),
    sizeBytes: numeric(row.size_bytes ?? row.size),
    fresh: truthy(row.fresh, text(row.status) !== 'stale'),
    autoCaptured: truthy(row.auto_captured ?? row.automatic),
    status: text(row.status, 'ready'),
    reason: text(row.reason ?? row.skip_reason ?? row.detail),
  };
}

export function findings(profile: UnknownRecord): SparkFinding[] {
  const raw = array<UnknownRecord>(
    firstValue(profile, [
      ['analysis', 'findings'],
      ['findings'],
      ['key_findings'],
    ]),
  );
  return raw
    .map((row) => {
      const severity = text(row.severity ?? row.level, 'info');
      const confidenceText = text(row.confidence).toLowerCase();
      const confidence: SparkFinding['confidence'] =
        confidenceText === 'observed' || confidenceText === 'correlated' || confidenceText === 'contextual'
          ? confidenceText
          : 'contextual';
      const detail = text(row.detail ?? row.summary ?? row.description);
      const evidenceRows = array<unknown>(row.evidence ?? row.signals)
        .map((item) => toEvidence(item))
        .filter((item): item is SparkEvidence => Boolean(item));
      const caveatRows = array<unknown>(row.caveats ?? row.limitations).map((item) => text(item));
      return {
        id: text(row.id, `${text(row.kind, 'finding')}:${text(row.title)}`),
        title: text(row.title ?? row.headline ?? row.kind, 'Profile finding'),
        detail,
        severity,
        confidence,
        evidence: evidenceRows.length
          ? evidenceRows
          : detail
            ? [{ label: 'Summary', value: '', unit: '', path: '', raw: detail }]
            : [],
        caveats: caveatRows.filter(Boolean).length
          ? caveatRows.filter(Boolean)
          : ['Profiler samples show correlation, not definitive ownership.'],
      };
    })
    .sort(
      (a, b) =>
        severityRank(b.severity) - severityRank(a.severity) ||
        confidenceRank(b.confidence) - confidenceRank(a.confidence) ||
        a.id.localeCompare(b.id),
    );
}

function friendlyMetricLabel(metric: string): string {
  const known: Record<string, string> = {
    tps_1m: 'TPS (1 min)',
    tps_5m: 'TPS (5 min)',
    tps_15m: 'TPS (15 min)',
    mspt_mean_1m: 'Typical tick',
    mspt_p95_1m: 'Slow ticks (p95)',
    mspt_max_1m: 'Worst tick (1 min)',
    mspt_max_5m: 'Worst hitch (5 min)',
    breached_windows: 'Missed windows',
    total_windows: 'Total windows',
    cpu_process: 'Process CPU',
    cpu_system: 'System CPU',
  };
  if (known[metric]) return known[metric];
  return metric
    .replaceAll('_', ' ')
    .replace(/\bmspt\b/gi, 'MSPT')
    .replace(/\btps\b/gi, 'TPS');
}

function shortenUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase();
  if (normalized === 'ticks per second') return 'TPS';  if (normalized === 'milliseconds') return 'ms';
  if (normalized === 'seconds') return 's';
  if (normalized === 'windows') return 'windows';
  if (normalized.includes('percent')) return '%';
  return unit.replaceAll('_', ' ');
}

function displayEvidenceValue(value: string, unit: string): { value: string; unit: string } {
  const numericValue = Number(value.replaceAll(',', ''));
  if (!Number.isFinite(numericValue)) return { value, unit: shortenUnit(unit) };
  const shortened = shortenUnit(unit);
  if ((shortened === 'ms' || unit.toLowerCase().includes('millisecond')) && numericValue >= 1000) {
    return { value: (numericValue / 1000).toFixed(numericValue >= 10000 ? 1 : 2), unit: 's' };
  }
  if (Math.abs(numericValue) >= 100) return { value: numericValue.toFixed(0), unit: shortened };
  if (Math.abs(numericValue) >= 10) return { value: numericValue.toFixed(1), unit: shortened };
  return { value: numericValue.toFixed(2), unit: shortened };
}

function parseEvidenceString(raw: string): SparkEvidence {
  const match = /^([^:]+):\s*([-\d.,]+)\s*(.*?)\s*(?:·\s*(.+))?$/.exec(raw.trim());
  if (!match) {
    return { label: 'Note', value: '', unit: '', path: '', raw };
  }
  const metric = match[1]?.trim() || 'evidence';
  const shown = displayEvidenceValue(match[2] || '', match[3] || '');
  return {
    label: friendlyMetricLabel(metric),
    value: shown.value,
    unit: shown.unit,
    path: (match[4] || '').trim(),
    raw,
  };
}

function toEvidence(item: unknown): SparkEvidence | null {
  if (typeof item === 'string') {
    const raw = text(item);
    return raw ? parseEvidenceString(raw) : null;
  }
  const evidence = record(item);
  const explicit = text(evidence.label ?? evidence.detail);
  const metric = text(evidence.metric ?? evidence.path, 'evidence');
  const value = text(evidence.value);
  const unit = text(evidence.unit).replaceAll('_', ' ');
  const path = text(evidence.path ?? evidence.source);
  if (explicit && !value) {
    return { label: explicit, value: '', unit: '', path, raw: explicit };
  }
  const shown = displayEvidenceValue(value || 'recorded', unit);
  const label = explicit || friendlyMetricLabel(metric);
  const raw = `${metric}: ${value || 'recorded'}${unit ? ` ${unit}` : ''}${path ? ` · ${path}` : ''}`;
  return {
    label,
    value: shown.value,
    unit: shown.unit,
    path,
    raw,
  };
}

function confidenceRank(value: SparkFinding['confidence']): number {
  return value === 'observed' ? 3 : value === 'correlated' ? 2 : 1;
}

function severityRank(value: string): number {
  if (value === 'critical' || value === 'danger' || value === 'error') return 3;
  if (value === 'warn' || value === 'warning') return 2;
  return 1;
}

export function sources(profile: UnknownRecord): SparkSource[] {
  const raw = array<UnknownRecord>(
    firstValue(profile, [
      ['analysis', 'sources'],
      ['source_rollups'],
      ['sources'],
      ['mod_rollups'],
    ]),
  );
  return raw
    .map((row) => {
      const own = numeric(row.own_pct ?? row.self_pct ?? row.pct);
      return {
        id: text(row.id ?? row.source_id ?? row.mod_id ?? row.name, 'unknown'),
        label: text(row.display_name ?? row.label ?? row.name ?? row.mod_id, 'Unknown source'),
        ownPct: own,
        involvementPct: numeric(row.involvement_pct ?? row.total_pct ?? row.inclusive_pct, own),
        methodCount: numeric(row.method_count ?? row.samples),
        topLabel: text(row.top_label ?? row.top_method),
      };
    })
    .sort((a, b) => b.involvementPct - a.involvementPct);
}

export function sourceWindowIds(profile: UnknownRecord): number[] {
  return array<unknown>(record(profile.call_tree).time_windows).map((value) => numeric(value));
}

export function sourcesAtWindow(profile: UnknownRecord, windowIndex: number): SparkSource[] {
  const tree = record(profile.call_tree);
  const threads = array<UnknownRecord>(tree.threads);
  const thread = threads.find((row) => row.selected === true) ?? threads[0];
  if (!thread || windowIndex < 0) return sources(profile);
  const denominator = numeric(array<unknown>(thread.inclusive_by_window)[windowIndex]);
  if (denominator <= 0) return [];
  const catalog = record(profile.mod_catalog);
  const totals = new Map<string, { own: number; involvement: number; methods: number; top: string; topOwn: number }>();
  const visit = (value: unknown, parentModId: string | null) => {
    const node = record(value);
    const id = text(node.mod_id, 'unknown');
    const own = numeric(array<unknown>(node.self_by_window)[windowIndex]);
    const inclusive = numeric(array<unknown>(node.inclusive_by_window)[windowIndex]);
    const current = totals.get(id) ?? { own: 0, involvement: 0, methods: 0, top: '', topOwn: -1 };
    current.own += own;
    // Match parser semantics: count inclusive only at source entry points.
    if (parentModId == null || parentModId !== id) {
      current.involvement += inclusive;
    }
    current.methods += 1;
    if (own > current.topOwn) {
      current.topOwn = own;
      current.top = [text(node.class).split('.').at(-1), text(node.method)].filter(Boolean).join('.');
    }
    totals.set(id, current);
    array<unknown>(node.children).forEach((child) => visit(child, id));
  };
  array<unknown>(thread.children).forEach((child) => visit(child, null));
  return [...totals.entries()]
    .map(([id, values]) => {
      const meta = record(catalog[id]);
      return {
        id,
        label: text(meta.name, id),
        ownPct: (values.own / denominator) * 100,
        involvementPct: Math.min(100, (values.involvement / denominator) * 100),
        methodCount: values.methods,
        topLabel: values.top,
      };
    })
    .sort((a, b) => b.involvementPct - a.involvementPct);
}

export function methods(profile: UnknownRecord): SparkMethod[] {
  const raw = array<UnknownRecord>(
    firstValue(profile, [
      ['analysis', 'call_paths'],
      ['call_paths'],
      ['deep', 'top_methods'],
      ['top_methods'],
    ]),
  );
  return raw.slice(0, 240).map((row) => {
    const className = text(row.class ?? row.class_name);
    const method = text(row.method ?? row.name);
    const source = text(row.source ?? row.mod_id ?? row.owner, 'unknown');
    const fallbackLabel = [className.split('.').at(-1), method].filter(Boolean).join('.');
    return {
      label: text(row.label ?? row.display_name, fallbackLabel || 'Unknown method'),
      className,
      method,
      source,
      pct: numeric(row.total_pct ?? row.involvement_pct ?? row.pct),
      ownPct: numeric(row.own_pct ?? row.self_pct ?? row.pct),
      parentChain: array<unknown>(row.parent_chain ?? row.ancestors ?? row.path).map((v) => text(v)),
    };
  });
}

export function timeline(profile: UnknownRecord): SparkTimelinePoint[] {
  const raw = array<UnknownRecord>(
    firstValue(profile, [
      ['analysis', 'timeline'],
      ['metrics', 'timeline'],
      ['timeline'],
    ]),
  );
  return raw.map((row) => ({
    at: text(row.start_at ?? row.at ?? row.timestamp),
    endAt: text(row.end_at ?? row.end),
    tps: numeric(row.tps),
    // Timeline windows expose median/max, not p95 — prefer typical tick over worst hitch.
    mspt: numeric(row.mspt_p95 ?? row.mspt_median ?? row.mspt_mean ?? row.mspt ?? row.mspt_max),
    msptMax: numeric(row.mspt_max),
    players: numeric(row.players),
    entities: numeric(row.entities),
    chunks: numeric(row.chunks),
    cpu: numeric(row.cpu_process ?? row.cpu),
  }));
}

/** Timeline points → Bklit series rows for WtAreaChart. */
export function timelineToBklitRows(profile: UnknownRecord): Array<{
  date: Date;
  tps: number;
  mspt: number;
  players: number;
  entities: number;
  cpu: number;
}> {
  return timeline(profile)
    .map((row, index) => {
      const parsed = row.at ? new Date(row.at) : null;
      const date = parsed && !Number.isNaN(parsed.getTime())
        ? parsed
        : new Date(Date.UTC(2020, 0, 1, 0, index));
      return {
        date,
        tps: row.tps,
        mspt: row.mspt,
        players: row.players,
        entities: row.entities,
        cpu: row.cpu,
      };
    });
}

export type PieSegment = { label: string; value: number; color?: string };

const ENTITY_PIE_COLORS = [
  'var(--wt-accent)',
  'var(--wt-warn)',
  'var(--wt-info, var(--wt-accent))',
  'var(--wt-ok)',
  'var(--wt-danger)',
  'color-mix(in srgb, var(--wt-accent) 55%, var(--wt-warn))',
];

const ENTITY_TYPE_LABELS: Record<string, string> = {
  'minecraft:item': 'Dropped items',
  'minecraft:experience_orb': 'XP orbs',
  'create:super_glue': 'Create glue',
  'simulated:honey_glue': 'Honey glue',
  'create:stationary_contraption': 'Create contraption',
  'create:contraption': 'Create contraption',
  'minecraft:player': 'Players',
  'minecraft:player_mannequin': 'Mannequins',
};

/** Friendly label for a namespaced entity id. */
export function entityTypeLabel(id: string): string {
  const known = ENTITY_TYPE_LABELS[id];
  if (known) return known;
  const leaf = id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;
  return leaf
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || id;
}

const WORLD_LABELS: Record<string, string> = {
  overworld: 'Overworld',
  the_nether: 'The Nether',
  the_end: 'The End',
  'minecraft:overworld': 'Overworld',
  'minecraft:the_nether': 'The Nether',
  'minecraft:the_end': 'The End',
};

/** Friendly label for a Spark world / dimension id. */
export function worldDimensionLabel(id: string): string {
  const key = id.trim();
  if (!key) return 'Unknown world';
  const known = WORLD_LABELS[key] ?? WORLD_LABELS[key.toLowerCase()];
  if (known) return known;
  const leaf = key.includes(':') ? key.slice(key.indexOf(':') + 1) : key;
  return leaf
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || key;
}

export const MAP_HOTSPOT_CAP = 256;

export type ChunkBBox = { minX: number; maxX: number; minZ: number; maxZ: number };

export function hotspotDimensions(hotspots: UnknownRecord[]): string[] {
  const dims = new Set<string>();
  for (const row of hotspots) {
    const dim = text(row.dimension);
    if (dim) dims.add(dim);
  }
  return [...dims].sort(
    (a, b) => worldDimensionLabel(a).localeCompare(worldDimensionLabel(b)) || a.localeCompare(b),
  );
}

export function busiestHotspotDimension(hotspots: UnknownRecord[]): string {
  const totals = new Map<string, number>();
  for (const row of hotspots) {
    const dim = text(row.dimension);
    if (!dim) continue;
    const x = numeric(row.chunk_x, NaN);
    const z = numeric(row.chunk_z, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    totals.set(dim, (totals.get(dim) ?? 0) + numeric(row.total_entities));
  }
  let best = '';
  let bestTotal = -1;
  for (const [dim, total] of totals) {
    if (total > bestTotal) {
      bestTotal = total;
      best = dim;
    }
  }
  return best;
}

export function mapHotspotsForDimension(
  hotspots: UnknownRecord[],
  dimension: string,
): UnknownRecord[] {
  return hotspots
    .filter((row) => text(row.dimension) === dimension)
    .filter((row) => {
      const x = numeric(row.chunk_x, NaN);
      const z = numeric(row.chunk_z, NaN);
      return Number.isFinite(x) && Number.isFinite(z);
    })
    .sort((a, b) => numeric(b.total_entities) - numeric(a.total_entities))
    .slice(0, MAP_HOTSPOT_CAP);
}

export function hotspotChunkBBox(hotspots: UnknownRecord[]): ChunkBBox | null {
  if (!hotspots.length) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const row of hotspots) {
    const x = numeric(row.chunk_x, NaN);
    const z = numeric(row.chunk_z, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, maxX, minZ, maxZ };
}

export function hotspotHeatIntensity(totalEntities: number, maxEntities: number): number {
  if (maxEntities <= 0) return 0;
  return Math.min(1, Math.max(0, totalEntities / maxEntities));
}

/**
 * Entity pie segments (counts, not lag proof).
 * Prefers `top_entities` (top N types + Other); falls back to automation composition buckets.
 */
export function compositionPieSegments(context: UnknownRecord, limit = 6): PieSegment[] {
  const composition = record(context.entity_composition);
  const total = numeric(
    composition.total_entities ?? context.world_entities,
  );
  const top = array<UnknownRecord>(context.top_entities)
    .map((row) => ({ id: text(row.id), count: numeric(row.count) }))
    .filter((row) => row.id && row.count > 0)
    .sort((a, b) => b.count - a.count);

  if (top.length) {
    const head = top.slice(0, Math.max(1, limit));
    const shown = head.reduce((sum, row) => sum + row.count, 0);
    const other = Math.max(0, (total > 0 ? total : shown) - shown);
    const segments: PieSegment[] = head.map((row, index) => ({
      label: entityTypeLabel(row.id),
      value: row.count,
      color: ENTITY_PIE_COLORS[index % ENTITY_PIE_COLORS.length],
    }));
    if (other > 0) {
      segments.push({ label: 'Other', value: other, color: 'var(--wt-text-low)' });
    }
    return segments;
  }

  if (!Object.keys(composition).length) return [];
  const xp = numeric(composition.xp_orbs);
  const items = numeric(composition.items);
  const glue = numeric(composition.glue_family);
  const fallbackTotal = total || xp + items + glue;
  const other = Math.max(0, fallbackTotal - xp - items - glue);
  return [
    { label: 'XP orbs', value: xp, color: 'var(--wt-warn)' },
    { label: 'Dropped items', value: items, color: 'var(--wt-accent)' },
    { label: 'Create glue', value: glue, color: 'var(--wt-info, var(--wt-accent))' },
    { label: 'Other', value: other, color: 'var(--wt-text-low)' },
  ].filter((row) => row.value > 0);
}

export type MeterRow = { label: string; value: number; valueLabel?: string; tone?: 'accent' | 'warn' | 'ok' };

/** Top-N chunk concentration shares for BarMeter. */
export function concentrationBarRows(context: UnknownRecord): MeterRow[] {
  const concentration = record(context.entity_concentration);
  const topShare = record(concentration.top_n_share_pct);
  if (!Object.keys(topShare).length) return [];
  const pct = (key: string) => Math.round(numeric(topShare[key]) * 10) / 10;
  return [
    { label: 'Top 5 chunks hold', value: pct('5'), valueLabel: `${pct('5').toFixed(1)}%`, tone: 'warn' },
    { label: 'Top 20 chunks hold', value: pct('20'), valueLabel: `${pct('20').toFixed(1)}%`, tone: 'accent' },
    { label: 'Top 50 chunks hold', value: pct('50'), valueLabel: `${pct('50').toFixed(1)}%`, tone: 'ok' },
  ];
}

export type ConcentrationBand = {
  id: string;
  label: string;
  detail: string;
  value: number;
  color: string;
};

/** Cumulative top-N shares → exclusive bands (rounded). */
export function concentrationBands(context: UnknownRecord): ConcentrationBand[] {
  const concentration = record(context.entity_concentration);
  const topShare = record(concentration.top_n_share_pct);
  if (!Object.keys(topShare).length) return [];
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const top5 = Math.max(0, numeric(topShare['5']));
  const top20 = Math.max(top5, numeric(topShare['20']));
  const top50 = Math.max(top20, numeric(topShare['50']));
  const rest = Math.max(0, 100 - top50);
  return [
    {
      id: 'top5',
      label: 'Busiest 5 chunks',
      detail: 'Most packed chunks',
      value: round1(top5),
      color: 'var(--wt-warn)',
    },
    {
      id: 'top20',
      label: 'Chunks 6–20',
      detail: 'Through top 20',
      value: round1(Math.max(0, top20 - top5)),
      color: 'var(--wt-accent)',
    },
    {
      id: 'top50',
      label: 'Chunks 21–50',
      detail: 'Through top 50',
      value: round1(Math.max(0, top50 - top20)),
      color: 'var(--wt-ok)',
    },
    {
      id: 'rest',
      label: 'Other chunks',
      detail: `${Math.max(0, numeric(concentration.chunks_with_entities) - 50)}+ quieter chunks`,
      value: round1(rest),
      color: 'var(--wt-text-low)',
    },
  ].filter((band) => band.value > 0.05);
}

export type SourceBarRow = {
  id: string;
  label: string;
  detail: string;
  value: number;
};

/** Ranked mod time rows for BarMeter / CompareBars. */
export function sourcesAsBarRows(
  profile: UnknownRecord,
  metric: 'own' | 'involvement' = 'own',
  limit = 15,
): SourceBarRow[] {
  return sources(profile)
    .slice()
    .sort((a, b) => (metric === 'own' ? b.ownPct - a.ownPct : b.involvementPct - a.involvementPct))
    .slice(0, limit)
    .map((source) => ({
      id: source.id,
      label: source.label,
      detail: source.topLabel || `${source.methodCount} sampled methods`,
      value: metric === 'own' ? source.ownPct : source.involvementPct,
    }));
}

export function gradeGlowTone(grade: string): 'ok' | 'warn' | 'danger' {
  if (grade === 'critical' || grade === 'danger' || grade === 'error') return 'danger';
  if (grade === 'degraded' || grade === 'warn' || grade === 'warning') return 'warn';
  if (grade === 'healthy' || grade === 'ok' || grade === 'good') return 'ok';
  return 'warn';
}

export function profileDuration(profile: UnknownRecord): number {
  return numeric(firstValue(profile, [['window', 'duration_sec'], ['duration_sec'], ['duration_seconds']]));
}

export function profileCompatibility(a: UnknownRecord, b: UnknownRecord): string[] {
  const issues: string[] = [];
  const platformA = record(a.platform);
  const platformB = record(b.platform);
  const modeA = text(a.mode ?? platformA.mode);
  const modeB = text(b.mode ?? platformB.mode);
  const engineA = text(a.engine ?? platformA.engine);
  const engineB = text(b.engine ?? platformB.engine);
  const mcA = text(platformA.minecraft);
  const mcB = text(platformB.minecraft);
  const threadA = selectedThreadName(a);
  const threadB = selectedThreadName(b);
  if (modeA && modeB && modeA !== modeB) issues.push(`Capture mode differs (${modeA} vs ${modeB})`);
  if (engineA && engineB && engineA !== engineB) issues.push(`Engine differs (${engineA} vs ${engineB})`);
  if (mcA && mcB && mcA !== mcB) issues.push(`Minecraft version differs (${mcA} vs ${mcB})`);
  if (threadA && threadB && threadA !== threadB) issues.push(`Thread scope differs (${threadA} vs ${threadB})`);
  return issues;
}

function selectedThreadName(profile: UnknownRecord): string {
  const threads = array<UnknownRecord>(record(profile.call_tree).threads);
  const selected = threads.find((thread) => thread.selected === true) ?? threads[0];
  return text(selected?.name);
}

const PLATFORM_SOURCES = new Set(['minecraft', 'neoforge', 'forge', 'jvm', 'native', 'unknown']);
const INFRASTRUCTURE_SOURCES = new Set([
  'pehkui',
  'forgeconfigapiport',
  'architectury',
  'mixinextras',
  'fabric-api',
  'cloth-config',
  'cloth-config2',
  'modmenu',
  'jade',
  'wthit',
]);

function isInfrastructureSource(id: string): boolean {
  const key = id.toLowerCase();
  if (INFRASTRUCTURE_SOURCES.has(key)) return true;
  if (key.startsWith('fabric-') && (key.includes('-api') || /-(v0|v1|v2|v3)$/.test(key))) return true;
  if (key.includes('forgeconfigapi') || key.startsWith('mixinextras')) return true;
  return false;
}

export function topNonPlatformSource(profile: UnknownRecord): SparkSource | null {
  return sources(profile).find(
    (source) => !PLATFORM_SOURCES.has(source.id) && !isInfrastructureSource(source.id),
  ) ?? null;
}

export function buildOperatorReportMarkdown(profile: UnknownRecord, path = ''): string {
  const context = record(profile.context);
  const verdict = record(profile.verdict);
  const summary = record(profile.evidence_summary);
  const system = record(profile.system);
  const memory = record(system.memory);
  const composition = record(context.entity_composition);
  const concentration = record(context.entity_concentration);
  const hotspots = array<UnknownRecord>(context.entity_hotspots).slice(0, 5);
  const findingRows = findings(profile).slice(0, 12);
  const topSource = topNonPlatformSource(profile);
  const viewer = text(profile.spark_viewer_url ?? record(profile.links).viewer);
  const lines = [
    `# What this profile found`,
    path ? `Profile: \`${path}\`` : '',
    `Captured: ${text(profile.captured_at, 'unknown')}`,
    `Grade: ${text(verdict.grade, 'analyzed')}`,
    '',
    '## Server vitals',
    `- TPS 1m/5m/15m: ${numeric(context.tps_1m).toFixed(2)} / ${numeric(context.tps_5m).toFixed(2)} / ${numeric(context.tps_15m).toFixed(2)}`,
    `- Typical tick / slow ticks (p95) / worst (1m): ${numeric(context.mspt_mean_1m).toFixed(2)} / ${numeric(context.mspt_p95_1m).toFixed(2)} / ${numeric(context.mspt_max_1m).toFixed(2)} ms`,
    `- Worst tick (last 5 min): ${numeric(context.mspt_max_5m).toFixed(2)} ms`,
    `- Players: ${numeric(context.players)} · Entities: ${numeric(context.world_entities)}`,
    `- Duration: ${profileDuration(profile).toFixed(1)} s`,
    '',
    '## Evidence summary',
    `- What happened: ${text(summary.what_happened)}`,
    `- Why we flagged this: ${text(summary.why_watchtower_says_this)}`,
    `- Try this next: ${text(summary.do_this_next)}`,
    `- What this can’t prove: ${text(summary.what_this_cannot_prove)}`,
    '',
  ];
  if (Object.keys(composition).length) {
    lines.push(
      '## What’s in the world (counts ≠ lag proof)',
      `- XP + dropped items: ${numeric(composition.xp_items_share_pct).toFixed(1)}% (${numeric(composition.xp_orbs)} XP, ${numeric(composition.items)} items)`,
      `- Create glue entities: ${numeric(composition.glue_share_pct).toFixed(1)}%`,
      `- XP + items + glue: ${numeric(composition.automation_share_pct).toFixed(1)}%`,
      `- Top 20 chunks hold: ${numeric(record(concentration.top_n_share_pct)['20']).toFixed(1)}% of entities`,
      '',
    );
  }
  if (topSource) {
    lines.push(
      '## Mod that used the most server time',
      `- ${topSource.label}: ${topSource.ownPct.toFixed(2)}% own code / ${topSource.involvementPct.toFixed(2)}% on the stack`,
      `- Top step: ${topSource.topLabel || 'n/a'}`,
      '',
    );
  }
  if (hotspots.length) {
    lines.push('## Busy chunks');
    for (const row of hotspots) {
      const distance = row.nearest_player_chunk_distance != null
        ? `${numeric(row.nearest_player_chunk_distance)} chunks from nearest player`
        : numeric(row.same_dimension_players) === 0
          ? 'nobody online in this world — it may still be loaded'
          : 'player distance unknown';
      lines.push(
        `- ${text(row.dimension)} chunk ${numeric(row.chunk_x)},${numeric(row.chunk_z)}`
          + ` (blocks ~${numeric(row.block_x_min)}..${numeric(row.block_x_max)},`
          + ` ${numeric(row.block_z_min)}..${numeric(row.block_z_max)})`
          + ` · ${numeric(row.total_entities)} entities · ${text(row.top_type)}`
          + ` · ${distance}`,
      );
    }
    lines.push('');
  }
  lines.push(
    '## Host machine',
    `- Swap used: ${numeric(memory.swap_used_gb).toFixed(2)} GiB / ${numeric(memory.swap_total_gb).toFixed(2)} GiB`,
    `- RAM used: ${numeric(memory.physical_used_gb).toFixed(2)} GiB / ${numeric(memory.physical_total_gb).toFixed(2)} GiB`,
    '',
    '## Findings',
  );
  for (const finding of findingRows) {
    lines.push(`- [${finding.severity}/${finding.confidence}] ${finding.title}: ${finding.detail}`);
  }
  lines.push('', '## What this can’t prove');
  lines.push('- A profile shows what was busy during the capture. It doesn’t prove the single cause or how much faster the server will get.');
  lines.push('- Entity counts and settings are clues, not proof they made the server lag.');
  lines.push('- Own-code percentages describe where time showed up — not a promised TPS gain.');
  if (viewer) lines.push('', `Spark viewer: ${viewer}`);
  return lines.filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n');
}
