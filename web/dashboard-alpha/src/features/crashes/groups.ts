/**
 * Slim TS port of production crash-groups.js — same fingerprint scheme.
 * Fingerprint: {failure_kind}|{stall_or_primary_or_-}|{exception_class_or_-}|{top_transformer_mods_csv}
 */

export type CrashRow = Record<string, unknown>;

export type CrashMember = {
  file: string;
  time: string | null;
  incident_id: string | null;
  acknowledged: boolean;
  display_label: string | null;
  plain_english: string | null;
  summary: unknown;
  exception: string | null;
  primary_mod_id: string | null;
  suspect_mod_id: string | null;
  stall_mod_id: string | null;
  failure_kind: string | null;
  category: string | null;
  fix_hints: unknown;
  mod_fix: unknown;
  likely_cause: string | null;
  confidence: unknown;
  watchdog_tick_ms: number | null;
  paired_primary_file: string | null;
  watchdog_followup: unknown;
  mod_file: string | null;
};

export type CrashGroup = {
  fingerprint: string;
  label: string;
  failure_kind: string | null;
  stall_mod_id: string | null;
  count: number;
  first_at: string | null;
  last_at: string | null;
  unreviewed: number;
  incident_ids: string[];
  members: CrashMember[];
};

export type GroupedCrashes = {
  groups: CrashGroup[];
  count: number;
  unreviewed: number;
  unreviewed_groups: number;
  scanned_at?: string | null;
};

export function bareFile(file: string | null | undefined): string {
  if (!file) return '';
  return file.startsWith('crash-reports/') ? file.slice('crash-reports/'.length) : file;
}

export function isAcked(acks: Record<string, unknown> | null | undefined, file: string): boolean {
  if (!acks || !file) return false;
  const bare = bareFile(file);
  return !!(acks[bare] || acks[`crash-reports/${bare}`] || acks[file]);
}

function dash(v: unknown): string {
  return v && String(v).trim() ? String(v).trim() : '-';
}

function topTransformerMods(row: CrashRow): string {
  const frames = Array.isArray(row.stack_frames) ? row.stack_frames : [];
  const mods: string[] = [];
  const seen = new Set<string>();
  for (const frame of frames) {
    const s =
      typeof frame === 'string'
        ? frame
        : String((frame as Record<string, unknown>)?.raw ?? (frame as Record<string, unknown>)?.class ?? '');
    const m = s.match(/TRANSFORMER\/([a-z0-9_]+)@/i);
    if (m) {
      const id = m[1].toLowerCase();
      if (!seen.has(id)) {
        seen.add(id);
        mods.push(id);
      }
    }
    if (mods.length >= 3) break;
  }
  return mods.length ? mods.join(',') : '-';
}

export function crashFingerprint(row: CrashRow): string {
  const kind = dash(row.failure_kind || row.category || 'unknown');
  const stallOrPrimary = dash(row.stall_mod_id || row.primary_mod_id || row.suspect_mod_id);
  const exception = dash(row.exception);
  const mods = topTransformerMods(row);
  return `${kind}|${stallOrPrimary}|${exception}|${mods}`;
}

function groupLabel(row: CrashRow, fingerprint: string): string {
  const kind = String(row.failure_kind || '');
  const stall = row.stall_mod_id ? String(row.stall_mod_id) : null;
  const primary = row.primary_mod_id ? String(row.primary_mod_id) : null;
  if (kind === 'watchdog_pregen' && stall) return `Pregen / map stall (${stall})`;
  if (kind === 'watchdog' || kind === 'watchdog_followup') return 'Generic tick stall';
  if (kind === 'mod_runtime' && primary) return `Mod crash (${primary})`;
  if (kind === 'world_nbt_corrupt') return 'Corrupt world NBT';
  if (kind) return kind.replace(/_/g, ' ');
  return fingerprint.split('|')[0] || 'Crash group';
}

function rowTime(row: CrashRow): string {
  if (typeof row.time === 'string' && row.time) return row.time;
  if (row.mtime != null) return new Date(Number(row.mtime) * 1000).toISOString();
  return '';
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  return s || null;
}

export function groupCrashes(rows: CrashRow[], acks: Record<string, unknown> = {}): GroupedCrashes {
  const list = Array.isArray(rows) ? rows : [];
  const byFp = new Map<string, CrashGroup>();

  for (const row of list) {
    const fp = crashFingerprint(row);
    let g = byFp.get(fp);
    if (!g) {
      g = {
        fingerprint: fp,
        label: groupLabel(row, fp),
        failure_kind: strOrNull(row.failure_kind),
        stall_mod_id: strOrNull(row.stall_mod_id),
        count: 0,
        first_at: null,
        last_at: null,
        unreviewed: 0,
        incident_ids: [],
        members: [],
      };
      byFp.set(fp, g);
    }
    const file = strOrNull(row.file) || '';
    const acknowledged = isAcked(acks, file);
    const time = rowTime(row);
    g.count += 1;
    if (!acknowledged) g.unreviewed += 1;
    if (time && (!g.first_at || time < g.first_at)) g.first_at = time;
    if (time && (!g.last_at || time > g.last_at)) g.last_at = time;
    const incidentId = strOrNull(row.incident_id);
    if (incidentId && !g.incident_ids.includes(incidentId)) g.incident_ids.push(incidentId);
    g.members.push({
      file,
      time: time || null,
      incident_id: incidentId,
      acknowledged,
      display_label: strOrNull(row.display_label) || strOrNull(row.plain_english),
      plain_english: strOrNull(row.plain_english),
      summary: row.summary ?? null,
      exception: strOrNull(row.exception),
      primary_mod_id: strOrNull(row.primary_mod_id),
      suspect_mod_id: strOrNull(row.suspect_mod_id),
      stall_mod_id: strOrNull(row.stall_mod_id),
      failure_kind: strOrNull(row.failure_kind),
      category: strOrNull(row.category),
      fix_hints: row.fix_hints ?? null,
      mod_fix: row.mod_fix ?? null,
      likely_cause: strOrNull(row.likely_cause),
      confidence: row.confidence ?? null,
      watchdog_tick_ms: row.watchdog_tick_ms != null ? Number(row.watchdog_tick_ms) : null,
      paired_primary_file: strOrNull(row.paired_primary_file),
      watchdog_followup: row.watchdog_followup ?? null,
      mod_file: strOrNull(row.mod_file),
    });
  }

  let groups = [...byFp.values()];
  for (const g of groups) {
    g.members.sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')));
  }
  groups.sort((a, b) => String(b.last_at || '').localeCompare(String(a.last_at || '')));

  while (groups.length > 12) {
    const byKind = new Map<string, CrashGroup[]>();
    for (const g of groups) {
      const k = g.failure_kind || 'unknown';
      if (!byKind.has(k)) byKind.set(k, []);
      byKind.get(k)!.push(g);
    }
    let merged = false;
    for (const [kind, listKind] of byKind) {
      if (listKind.length < 2) continue;
      listKind.sort((a, b) => a.count - b.count);
      const a = listKind[0];
      const b = listKind[1];
      const otherFp = `${kind}|other|-|-`;
      let other = groups.find((g) => g.fingerprint === otherFp);
      if (!other) {
        other = {
          fingerprint: otherFp,
          label: `${String(kind).replace(/_/g, ' ')} (other)`,
          failure_kind: kind,
          stall_mod_id: null,
          count: 0,
          first_at: null,
          last_at: null,
          unreviewed: 0,
          incident_ids: [],
          members: [],
        };
        groups.push(other);
      }
      for (const src of [a, b].filter((x) => x.fingerprint !== otherFp)) {
        other.count += src.count;
        other.unreviewed += src.unreviewed;
        other.members.push(...src.members);
        for (const id of src.incident_ids) {
          if (!other.incident_ids.includes(id)) other.incident_ids.push(id);
        }
        if (src.first_at && (!other.first_at || src.first_at < other.first_at)) other.first_at = src.first_at;
        if (src.last_at && (!other.last_at || src.last_at > other.last_at)) other.last_at = src.last_at;
        groups = groups.filter((g) => g !== src);
        merged = true;
      }
      other.members.sort((x, y) => String(y.time || '').localeCompare(String(x.time || '')));
      break;
    }
    if (!merged) break;
  }

  groups.sort((a, b) => String(b.last_at || '').localeCompare(String(a.last_at || '')));
  const count = groups.reduce((n, g) => n + g.count, 0);
  const unreviewed = groups.reduce((n, g) => n + g.unreviewed, 0);
  const unreviewed_groups = groups.filter((g) => g.unreviewed > 0).length;
  return { groups, count, unreviewed, unreviewed_groups };
}

export function mergeCrashRows(summaries: CrashRow[] | null | undefined, entries: CrashRow[] | null | undefined): CrashRow[] {
  const entryByBare = new Map<string, CrashRow>();
  for (const e of entries || []) {
    if (e?.file) entryByBare.set(bareFile(String(e.file)), e);
  }
  if (summaries?.length) {
    return summaries.map((s) => {
      const entry = entryByBare.get(bareFile(String(s.file || '')));
      if (!entry) return { ...s };
      return {
        ...s,
        mtime: s.mtime ?? entry.mtime,
        size: s.size ?? entry.size,
        display_label: s.display_label ?? entry.display_label,
      };
    });
  }
  return [...(entries || [])];
}
