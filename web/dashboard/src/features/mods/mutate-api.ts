import { api } from '@/api/client';
import { str } from '@/lib/utils';

export type MutateJobState =
  | 'queued'
  | 'fetching'
  | 'verifying'
  | 'backing_up'
  | 'applying'
  | 'done'
  | 'failed'
  | 'cancelled'
  | string;

export type MutateVersion = {
  id: string;
  version_number: string;
  name?: string;
  changelog?: string;
  date_published?: string;
  files?: Array<{
    filename?: string;
    url?: string;
    hashes?: { sha512?: string; sha1?: string };
    primary?: boolean;
  }>;
};

export type MutateStatus = {
  busy: boolean;
  job_id?: string;
  needs_restart: boolean;
  live_server: boolean;
  actor?: string;
  kind?: string;
  state?: string;
  mod_id?: string;
};

export type MutateJob = {
  id: string;
  kind: string;
  state: MutateJobState;
  mod_id?: string;
  version_id?: string;
  backup_id?: string;
  error?: string;
  error_code?: string;
  steps?: Array<{
    mod_id?: string;
    version_id?: string;
    state?: string;
    error?: string;
    backup_id?: string;
  }>;
};

export const MUTATE_TERMINAL = new Set(['done', 'failed', 'cancelled']);

export const MUTATE_STAGE_LABELS: Record<string, string> = {
  queued: 'Queued',
  fetching: 'Fetching',
  verifying: 'Verifying',
  backing_up: 'Backing up',
  applying: 'Applying',
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

/** Stable fingerprint of the impact + version the operator reviewed before confirming. */
export function impactFingerprint(parts: {
  mod_id?: string | null;
  version_id?: string | null;
  verdict?: string | null;
  summary?: string | null;
  blockers?: unknown;
}): string {
  const raw = [
    'v1',
    String(parts.mod_id ?? '').trim(),
    String(parts.version_id ?? '').trim(),
    String(parts.verdict ?? '').trim(),
    String(parts.summary ?? '').trim(),
    blockersCanonical(parts.blockers),
  ].join('\n');
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `ifp_${(h >>> 0).toString(16)}`;
}

/** Sorted mod_id list as `[a, b]` — matches Java {@code List.toString()}. */
export function blockersCanonical(blockers: unknown): string {
  if (!Array.isArray(blockers)) return '[]';
  const ids: string[] = [];
  for (const b of blockers) {
    if (!b || typeof b !== 'object') continue;
    const row = b as Record<string, unknown>;
    const id = typeof row.mod_id === 'string' ? row.mod_id : typeof row.id === 'string' ? row.id : '';
    if (id.trim()) ids.push(id.trim());
  }
  ids.sort();
  return `[${ids.join(', ')}]`;
}

export function fingerprintFromUpdateRow(
  row: Record<string, unknown> | null | undefined,
  versionId?: string | null,
): string {
  if (!row) {
    return impactFingerprint({
      mod_id: '',
      version_id: versionId ?? '',
    });
  }
  return impactFingerprint({
    mod_id: str(row.mod_id) || str(row.id),
    version_id: versionId || versionIdFromUpdateRow(row),
    verdict: str(row.impact_verdict),
    summary: str(row.impact_summary),
    blockers: row.blockers,
  });
}

/** Batch fingerprint: binds sorted mod:version pairs + worst ops-cache verdict. */
export function fingerprintForBatch(
  steps: Array<{ mod_id: string; modrinth_version_id: string }>,
  updateRows?: Array<Record<string, unknown> | null | undefined>,
): string {
  const keys = steps
    .map((s) => `${s.mod_id.trim()}:${s.modrinth_version_id.trim()}`)
    .sort()
    .join(',');
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of updateRows ?? []) {
    if (!row) continue;
    const id = str(row.mod_id) || str(row.id);
    if (id) byId.set(id, row);
  }
  let worst = '';
  for (const s of steps) {
    const row = byId.get(s.mod_id);
    worst = worseVerdict(worst, str(row?.impact_verdict));
  }
  const summary =
    'batch:' +
    [...new Set(steps.map((s) => s.mod_id.trim()).filter(Boolean))].sort().join(',');
  return impactFingerprint({
    mod_id: 'batch',
    version_id: keys,
    verdict: worst,
    summary,
    blockers: steps,
  });
}

/** break > caution > unknown > safe > empty — matches server ModMutateHttp.worseVerdict */
export function worseVerdict(a: string, b: string): string {
  return verdictRank(a) >= verdictRank(b) ? normalizeVerdict(a) : normalizeVerdict(b);
}

function normalizeVerdict(v: string): string {
  return String(v ?? '')
    .trim()
    .toLowerCase();
}

function verdictRank(v: string): number {
  switch (normalizeVerdict(v)) {
    case 'break':
      return 4;
    case 'caution':
      return 3;
    case 'unknown':
      return 2;
    case 'safe':
      return 1;
    default:
      return 0;
  }
}

/** Prefer the Modrinth compatible / latest version id from a scan update row. */
export function versionIdFromUpdateRow(row: Record<string, unknown> | null | undefined): string {
  if (!row) return '';
  return (
    str(row.compatible_version_id) ||
    str(row.modrinth_compatible_version_id) ||
    str(row.latest_compatible_version_id) ||
    str(row.version_id) ||
    ''
  );
}

/** Prefer files[].primary === true, else first file; return sha512 or undefined. */
export function primaryFileSha512(version: MutateVersion | null | undefined): string | undefined {
  const files = version?.files ?? [];
  const primary = files.find((f) => f?.primary) || files[0];
  const sha = primary?.hashes?.sha512;
  return sha && String(sha).trim() ? String(sha).trim() : undefined;
}

export async function fetchMutateStatus(): Promise<MutateStatus> {
  const body = await api.modsMutateStatus();
  return {
    busy: body.busy === true,
    job_id: typeof body.job_id === 'string' ? body.job_id : undefined,
    needs_restart: body.needs_restart === true,
    live_server: body.live_server !== false,
    actor: typeof body.actor === 'string' ? body.actor : undefined,
    kind: typeof body.kind === 'string' ? body.kind : undefined,
    state: typeof body.state === 'string' ? body.state : undefined,
    mod_id: typeof body.mod_id === 'string' ? body.mod_id : undefined,
  };
}

export async function fetchMutateVersions(modId: string): Promise<MutateVersion[]> {
  const body = await api.modsMutateVersions({ mod_id: modId });
  const list = Array.isArray(body.versions) ? body.versions : [];
  const out: MutateVersion[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const r = raw as Record<string, unknown>;
    const id = str(r.id) || str(r.version_id);
    if (!id) continue;
    out.push({
      id,
      version_number: str(r.version_number) || str(r.name) || id,
      name: str(r.name) || undefined,
      changelog: str(r.changelog) || undefined,
      date_published: str(r.date_published) || undefined,
      files: Array.isArray(r.files) ? (r.files as MutateVersion['files']) : undefined,
    });
  }
  return out;
}

export async function fetchMutateJob(id: string): Promise<MutateJob> {
  const body = await api.modsMutateJob(id);
  return {
    id: str(body.id, id),
    kind: str(body.kind, 'swap'),
    state: str(body.state, 'queued'),
    mod_id: str(body.mod_id) || undefined,
    version_id: str(body.version_id) || undefined,
    backup_id: str(body.backup_id) || undefined,
    error: str(body.error) || undefined,
    error_code: str(body.error_code) || undefined,
    steps: Array.isArray(body.steps)
      ? (body.steps as MutateJob['steps'])
      : undefined,
  };
}

export function jobIdFromAccepted(body: Record<string, unknown>): string {
  return str(body.job_id) || str((body.job as Record<string, unknown> | undefined)?.id);
}
