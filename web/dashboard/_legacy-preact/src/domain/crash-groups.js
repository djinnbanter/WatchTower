/**
 * Minimal JS port of CrashFingerprintGrouper for fixture/preview mode.
 * Fingerprint: {failure_kind}|{stall_or_primary_or_-}|{exception_class_or_-}|{top_transformer_mods_csv}
 */

function bareFile(file) {
  if (!file) return '';
  return file.startsWith('crash-reports/') ? file.slice('crash-reports/'.length) : file;
}

function isAcked(acks, file) {
  if (!acks || !file) return false;
  const bare = bareFile(file);
  return !!(acks[bare] || acks[`crash-reports/${bare}`] || acks[file]);
}

function dash(v) {
  return v && String(v).trim() ? String(v).trim() : '-';
}

function topTransformerMods(row) {
  const frames = Array.isArray(row?.stack_frames) ? row.stack_frames : [];
  const mods = [];
  const seen = new Set();
  for (const frame of frames) {
    const s = typeof frame === 'string' ? frame : frame?.raw ?? frame?.class ?? '';
    const m = String(s).match(/TRANSFORMER\/([a-z0-9_]+)@/i);
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

export function crashFingerprint(row) {
  const kind = dash(row?.failure_kind || row?.category || 'unknown');
  const stallOrPrimary = dash(row?.stall_mod_id || row?.primary_mod_id || row?.suspect_mod_id);
  const exception = dash(row?.exception);
  const mods = topTransformerMods(row);
  return `${kind}|${stallOrPrimary}|${exception}|${mods}`;
}

function groupLabel(row, fingerprint) {
  const kind = row?.failure_kind || '';
  const stall = row?.stall_mod_id;
  const primary = row?.primary_mod_id;
  if (kind === 'watchdog_pregen' && stall) return `Pregen / map stall (${stall})`;
  if (kind === 'watchdog' || kind === 'watchdog_followup') return 'Generic tick stall';
  if (kind === 'mod_runtime' && primary) return `Mod crash (${primary})`;
  if (kind === 'world_nbt_corrupt') return 'Corrupt world NBT';
  if (kind) return kind.replace(/_/g, ' ');
  return fingerprint.split('|')[0] || 'Crash group';
}

function rowTime(row) {
  return row?.time || (row?.mtime != null ? new Date(Number(row.mtime) * 1000).toISOString() : '');
}

/**
 * @param {object[]} rows crash summaries or ops entries
 * @param {Record<string, unknown>} acks acknowledged_crashes map
 * @returns {{ groups: object[], count: number, unreviewed: number, unreviewed_groups: number }}
 */
export function groupCrashes(rows, acks = {}) {
  const list = Array.isArray(rows) ? rows : [];
  /** @type {Map<string, object>} */
  const byFp = new Map();

  for (const row of list) {
    const fp = crashFingerprint(row);
    let g = byFp.get(fp);
    if (!g) {
      g = {
        fingerprint: fp,
        label: groupLabel(row, fp),
        failure_kind: row?.failure_kind ?? null,
        stall_mod_id: row?.stall_mod_id ?? null,
        count: 0,
        first_at: null,
        last_at: null,
        unreviewed: 0,
        incident_ids: [],
        members: [],
      };
      byFp.set(fp, g);
    }
    const file = row?.file ?? '';
    const acknowledged = isAcked(acks, file);
    const time = rowTime(row);
    g.count += 1;
    if (!acknowledged) g.unreviewed += 1;
    if (time && (!g.first_at || time < g.first_at)) g.first_at = time;
    if (time && (!g.last_at || time > g.last_at)) g.last_at = time;
    if (row?.incident_id && !g.incident_ids.includes(row.incident_id)) {
      g.incident_ids.push(row.incident_id);
    }
    g.members.push({
      file,
      time: time || null,
      incident_id: row?.incident_id ?? null,
      acknowledged,
      display_label: row?.display_label ?? row?.plain_english ?? null,
      plain_english: row?.plain_english ?? null,
      summary: row?.summary ?? null,
      // Parity with Java CrashFingerprintGrouper member extras
      exception: row?.exception ?? null,
      primary_mod_id: row?.primary_mod_id ?? null,
      suspect_mod_id: row?.suspect_mod_id ?? null,
      stall_mod_id: row?.stall_mod_id ?? null,
      failure_kind: row?.failure_kind ?? null,
      category: row?.category ?? null,
      fix_hints: row?.fix_hints ?? null,
      mod_fix: row?.mod_fix ?? null,
      likely_cause: row?.likely_cause ?? null,
      confidence: row?.confidence ?? null,
      watchdog_tick_ms: row?.watchdog_tick_ms ?? null,
      paired_primary_file: row?.paired_primary_file ?? null,
      watchdog_followup: row?.watchdog_followup ?? null,
      mod_file: row?.mod_file ?? null,
    });
  }

  let groups = [...byFp.values()];
  for (const g of groups) {
    g.members.sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')));
  }
  groups.sort((a, b) => String(b.last_at || '').localeCompare(String(a.last_at || '')));

  // Cap: merge smallest same-failure_kind groups into {kind}|other|-|- until ≤12
  while (groups.length > 12) {
    const byKind = new Map();
    for (const g of groups) {
      const k = g.failure_kind || 'unknown';
      if (!byKind.has(k)) byKind.set(k, []);
      byKind.get(k).push(g);
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

/**
 * Merge facts.crash_summaries with ops-cache entries (prefer summaries).
 */
export function mergeCrashRows(summaries, entries) {
  const entryByBare = new Map();
  for (const e of entries || []) {
    if (e?.file) entryByBare.set(bareFile(e.file), e);
  }
  if (summaries?.length) {
    return summaries.map((s) => {
      const entry = entryByBare.get(bareFile(s.file));
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
