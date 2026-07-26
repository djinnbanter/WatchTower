import { addToast } from '../../state/actions.js';
import { humanFailureLabel } from '../../domain/crash-fix.js';

export function formatAge(mtimeOrIso) {
  if (!mtimeOrIso) return '—';
  let ms;
  if (typeof mtimeOrIso === 'number') {
    ms = mtimeOrIso > 1e12 ? mtimeOrIso : mtimeOrIso * 1000;
  } else {
    ms = Date.parse(mtimeOrIso);
  }
  if (isNaN(ms)) return '—';
  const diffMs = Date.now() - ms;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours === 0) return `${Math.max(0, Math.floor(diffMs / 60000))}m ago`;
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

/** Local calendar day key YYYY-MM-DD (or 'unknown'). */
export function dayKeyFromAt(mtimeOrIso) {
  if (!mtimeOrIso && mtimeOrIso !== 0) return 'unknown';
  let ms;
  if (typeof mtimeOrIso === 'number') {
    ms = mtimeOrIso > 1e12 ? mtimeOrIso : mtimeOrIso * 1000;
  } else {
    ms = Date.parse(mtimeOrIso);
  }
  if (isNaN(ms)) return 'unknown';
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayDayKey() {
  return dayKeyFromAt(Date.now());
}

export function formatInboxDayLabel(dayKey) {
  if (!dayKey || dayKey === 'unknown') return 'Unknown date';
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return dayKey;
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey === todayDayKey()) return 'Today';
  if (
    date.getFullYear() === yesterday.getFullYear()
    && date.getMonth() === yesterday.getMonth()
    && date.getDate() === yesterday.getDate()
  ) {
    return 'Yesterday';
  }
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Group enriched crash rows by local calendar day of last_at (newest day first).
 * @returns {{ key: string, label: string, items: object[] }[]}
 */
export function groupEnrichedByDay(enriched) {
  const map = new Map();
  for (const row of enriched) {
    const at = row.group?.last_at || row.group?.first_at;
    const key = dayKeyFromAt(at);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  const keys = [...map.keys()].sort((a, b) => {
    if (a === 'unknown') return 1;
    if (b === 'unknown') return -1;
    return b.localeCompare(a);
  });
  return keys.map((key) => ({
    key,
    label: formatInboxDayLabel(key),
    items: map.get(key),
  }));
}

export function truncate(s, n = 120) {
  if (!s) return '';
  const t = String(s).trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

export function bareFile(file) {
  if (!file) return '';
  return file.startsWith('crash-reports/') ? file.slice('crash-reports/'.length) : file;
}

export function summaryByFileMap(facts) {
  const list = facts?.optional?.crash_summaries ?? [];
  const map = new Map();
  for (const s of list) {
    if (s?.file) map.set(bareFile(s.file), s);
  }
  return map;
}

export function leadMember(group) {
  const members = group?.members ?? [];
  const unrev = members.find((m) => !m.acknowledged);
  return unrev || members[0] || null;
}

export function resolveSummary(group, factsMap, facts) {
  const lead = leadMember(group);
  if (!lead) {
    return {
      failure_kind: group?.failure_kind,
      stall_mod_id: group?.stall_mod_id,
      primary_mod_id: null,
      plain_english: null,
    };
  }
  const fromFacts = factsMap.get(bareFile(lead.file));
  let summary;
  if (fromFacts) {
    summary = {
      ...fromFacts,
      failure_kind: fromFacts.failure_kind ?? group?.failure_kind ?? lead.failure_kind,
      stall_mod_id: fromFacts.stall_mod_id ?? group?.stall_mod_id ?? lead.stall_mod_id,
    };
  } else {
    summary = {
      file: lead.file,
      failure_kind: lead.failure_kind ?? group?.failure_kind,
      stall_mod_id: lead.stall_mod_id ?? group?.stall_mod_id,
      primary_mod_id: lead.primary_mod_id,
      suspect_mod_id: lead.suspect_mod_id,
      plain_english: lead.plain_english,
      display_label: lead.display_label,
      exception: lead.exception,
      fix_hints: lead.fix_hints,
      mod_fix: lead.mod_fix,
      likely_cause: lead.likely_cause,
      confidence: lead.confidence,
      watchdog_tick_ms: lead.watchdog_tick_ms,
      category: lead.category,
      mod_file: lead.mod_file,
      paired_primary_file: lead.paired_primary_file,
      matched_rule_id: lead.matched_rule_id,
      matched_pack_id: lead.matched_pack_id,
    };
  }
  if (!summary.matched_rule_id) {
    const fname = bareFile(lead.file);
    const hit = (facts?.optional?.crash_rule_hits ?? []).find((h) =>
      h && (bareFile(h.crash_file) === fname || String(h.crash_file || '').endsWith(fname)));
    if (hit?.rule_id) {
      summary = { ...summary, matched_rule_id: hit.rule_id, matched_pack_id: hit.pack_id };
    }
  }
  return summary;
}

function exceptionClassName(exception) {
  if (!exception) return null;
  const s = String(exception).trim();
  const idx = s.indexOf(':');
  const head = idx > 0 ? s.slice(0, idx).trim() : s;
  if (/(?:Exception|Error)$/i.test(head)) {
    const parts = head.split('.');
    return parts[parts.length - 1] || head;
  }
  return null;
}

function isUnknownFailureKind(kind) {
  const k = String(kind || '').toLowerCase();
  return !k || k === 'unknown';
}

export function groupTitle(group, summary) {
  const kind = summary?.failure_kind ?? group?.failure_kind;
  const unknownKind = isUnknownFailureKind(kind);
  let title = humanFailureLabel(
    unknownKind ? '' : kind,
    summary?.stall_mod_id ?? group?.stall_mod_id,
    summary?.primary_mod_id,
    summary?.create_issue,
  );
  const weakTitle = !title
    || title === 'Crash'
    || String(title).toLowerCase() === 'unknown';
  if (weakTitle || unknownKind) {
    const lead = leadMember(group);
    const fallback =
      summary?.display_label
      || lead?.display_label
      || exceptionClassName(summary?.exception || lead?.exception)
      || summary?.plain_english
      || lead?.plain_english
      || (group?.label && String(group.label).toLowerCase() !== 'unknown' ? group.label : null);
    if (fallback) title = truncate(String(fallback), 100);
  }
  return title || group?.label || 'Crash group';
}

export function isModRelated(group, summary) {
  const kind = String(summary?.failure_kind ?? group?.failure_kind ?? '').toLowerCase();
  if (kind.startsWith('mod_') || kind === 'loader') return true;
  return !!(summary?.primary_mod_id || summary?.suspect_mod_id || summary?.mod_fix);
}

export function isServerHang(group, summary) {
  const kind = String(summary?.failure_kind ?? group?.failure_kind ?? '').toLowerCase();
  return kind.startsWith('watchdog');
}

export function isHostRelated(group, summary) {
  const kind = String(summary?.failure_kind ?? group?.failure_kind ?? '').toLowerCase();
  if (kind === 'host_resource' || kind.startsWith('host') || kind.startsWith('world_nbt')) return true;
  if (kind === 'platform_mismatch' || kind === 'env_lock') return true;
  if (kind.startsWith('watchdog')) return true;
  const cat = String(summary?.category ?? '').toLowerCase();
  return cat.includes('oom') || cat.includes('memory') || cat.includes('host');
}

export function kindChip(group, summary) {
  if (isServerHang(group, summary)) return { label: 'Hang', tone: 'danger' };
  if (isHostRelated(group, summary) && !isModRelated(group, summary)) return { label: 'Host', tone: 'danger' };
  if (isModRelated(group, summary)) return { label: 'Mod', tone: 'warn' };
  return { label: 'Other', tone: 'neutral' };
}

export function openExternal(url) {
  if (!url) return;
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch { /* ignore */ }
}

export function toast(message, tone = 'info') {
  addToast(message, tone);
}

export function enrichGroups(grouped, facts) {
  const factsMap = summaryByFileMap(facts);
  const groups = [...(grouped?.groups ?? [])];
  groups.sort((a, b) => {
    const ua = a.unreviewed > 0 ? 0 : 1;
    const ub = b.unreviewed > 0 ? 0 : 1;
    if (ua !== ub) return ua - ub;
    return String(b.last_at || '').localeCompare(String(a.last_at || ''));
  });
  return groups.map((g) => ({
    group: g,
    summary: resolveSummary(g, factsMap, facts),
  }));
}

export function filterEnriched(enriched, { search, kind, needsReviewOnly, reviewedOnly }) {
  const q = (search || '').trim().toLowerCase();
  return enriched.filter(({ group, summary }) => {
    if (needsReviewOnly && !(group.unreviewed > 0)) return false;
    if (reviewedOnly && group.unreviewed > 0) return false;
    if (kind === 'mod' && !isModRelated(group, summary)) return false;
    if (kind === 'hang' && !isServerHang(group, summary)) return false;
    if (kind === 'host' && !isHostRelated(group, summary)) return false;
    if (!q) return true;
    const haystack = [
      group.label,
      group.fingerprint,
      group.failure_kind,
      summary?.plain_english,
      summary?.exception,
      summary?.primary_mod_id,
      summary?.stall_mod_id,
      summary?.suspect_mod_id,
      ...(group.members ?? []).map((m) => m.file),
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  });
}
