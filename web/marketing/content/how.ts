/**
 * How it works: mechanism pipeline copy.
 * Sources: PRODUCT.md (Collect/Advise capabilities), README.md.
 * Hyphens only. No Fabric shipping claims. No promises / not-our-job.
 * Category level only - no worked "X causes Y" examples.
 */

export type PipelineNode = {
  id: string;
  label: string;
  detail?: string;
};

export const HOW_LEDE =
  'WatchTower reads what the server is doing while it runs, then turns that into a short list of what to fix.';

export const COLLECT_NODES: readonly PipelineNode[] = [
  { id: 'vitals', label: 'Vitals', detail: 'TPS, MSPT, heap, CPU, disk' },
  { id: 'logs', label: 'Logs', detail: 'latest.log tail, crash reports' },
  { id: 'mods', label: 'Mods', detail: 'Jar inventory, checksums' },
  { id: 'world', label: 'World', detail: 'Chunk load, entity and item counts' },
  { id: 'backups', label: 'Backups', detail: 'Presence, age' },
] as const;

export const UNDERSTAND_LABEL = 'Analysis engine';

export const UNDERSTAND_COPY =
  'Looks for crashes, lag, overloaded worlds, and failed joins in that data, then writes a next step for each one.';

export const ADVISE_NODES: readonly PipelineNode[] = [
  { id: 'fix-inbox', label: 'Fix inbox', detail: 'Ranked issues, one next step each' },
  { id: 'overview', label: 'Overview grade', detail: 'Health grade, needs-attention list' },
  { id: 'insights', label: 'Insights trends', detail: 'Schedule, load, and storage over time' },
  { id: 'support', label: 'Support pack', detail: 'Redacted bundle to share' },
] as const;
