import { str } from '@/lib/utils';

export function modIconUrl(mod: Record<string, unknown> | null | undefined): string | undefined {
  if (!mod) return undefined;
  return str(mod.modrinth_icon_url) || str(mod.icon_url) || undefined;
}

export const MODRINTH_SCAN_STAGES = [
  { id: 'prepare', label: 'Preparing scan' },
  { id: 'hash', label: 'Hashing jars' },
  { id: 'cache', label: 'Checking cache' },
  { id: 'version_files', label: 'Looking up version files' },
  { id: 'projects', label: 'Fetching projects' },
  { id: 'compat', label: 'Checking compatible updates' },
  { id: 'impact', label: 'Analyzing pack impact' },
  { id: 'persist', label: 'Saving results' },
  { id: 'done', label: 'Done' },
] as const;

export type StageStatus = 'done' | 'active' | 'pending';

export function stageIndex(stageId: string | null | undefined): number {
  if (!stageId) return -1;
  return MODRINTH_SCAN_STAGES.findIndex((s) => s.id === stageId);
}

export function stageStatus(
  stageId: string,
  activeId: string | null | undefined,
  running: boolean,
  success: boolean | null | undefined,
): StageStatus {
  const idx = stageIndex(stageId);
  const activeIdx = stageIndex(activeId);
  if (!running && success === true) return 'done';
  if (!running && success === false && idx <= activeIdx) return 'done';
  if (!running && success === false && idx > activeIdx) return 'pending';
  if (idx < activeIdx) return 'done';
  if (idx === activeIdx) return 'active';
  return 'pending';
}

export function formatElapsed(startedAt: number | null | undefined, nowMs: number): string | null {
  if (startedAt == null) return null;
  const sec = Math.max(0, Math.floor((nowMs - Number(startedAt)) / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function formatEta(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const sec = Math.max(0, Math.round(seconds));
  if (sec < 60) return `~${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `~${m}m ${s}s` : `~${m}m`;
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return iso;
  }
}

export function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `${Math.round(Number(n))}%`;
}
