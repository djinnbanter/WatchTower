export type ModViewId =
  | 'overview'
  | 'updates'
  | 'conflicts'
  | 'log-errors'
  | 'changes'
  | 'modrinth'
  | 'forensics';

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

export type CatalogFilter =
  | 'all'
  | 'client'
  | 'server'
  | 'unresolved'
  | 'enabled'
  | 'disabled'
  | 'updates';

export type CatalogSort =
  | 'name'
  | 'name-desc'
  | 'id'
  | 'side'
  | 'updates'
  | 'version';

export type VerdictFilter = 'all' | 'safe' | 'caution' | 'break' | 'unknown';

export type SideSummary = {
  role: string;
  title: string;
  tone: Tone;
  bucket: string | null;
  reason: string;
  advice: string;
  confidence: string | null;
  signals: string[];
};

export type BadgeSpec = {
  key: string;
  tone: Tone;
  label: string;
};

export type CatalogRow = Record<string, unknown> & {
  id: string;
  display_name?: string;
  version?: string;
  side_score?: string;
  client_bucket?: string;
  modrinth_outdated?: boolean;
  modrinth_url?: string;
  modrinth_slug?: string;
  modrinth_title?: string;
  jar_file?: string;
  jar?: string;
  disabled?: boolean;
  world_risk?: Record<string, unknown>;
  jar_in_jar?: unknown[];
  nested_mod_ids?: string[];
  meta?: { is_mcreator?: boolean; loader_hint?: string | null };
};

export type BadgeMaps = {
  sideById: Map<string, string>;
  clientBucketById: Map<string, string>;
  clientOnlyById: Map<string, Record<string, unknown>>;
  metaById: Map<string, { is_mcreator: boolean; loader_hint?: string | null }>;
  connectorById: Map<string, Record<string, unknown>>;
  securityById: Map<string, Record<string, unknown>>;
  worldRiskById: Map<string, Record<string, unknown>>;
  hasFacts: boolean;
  connectorWarnings: Record<string, unknown>[];
  securityFlags: Record<string, unknown>[];
};

export type LogErrorRow = {
  mod_id: string;
  total: number;
  sample_lines: string[];
  sample_line?: string;
  by_category: Record<string, unknown>;
  top_recipes: unknown[];
  sources: string[];
  from_report?: boolean;
  display_name?: string;
  category_label?: string;
  top_category?: string;
  boot_only?: boolean;
  explanation?: string;
  worry_level?: string;
  severity?: string;
  why?: string;
  fix_steps?: string[];
  doc_url?: string;
};

export type DepTreeNode = {
  mod_id: string;
  mandatory: boolean;
  display_name?: string;
  version?: string;
  side_score?: string;
  is_mcreator?: boolean;
  loader_hint?: string;
  children: DepTreeNode[];
};
