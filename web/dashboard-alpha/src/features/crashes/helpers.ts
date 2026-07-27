import { asArray, asRecord, str } from '@/lib/utils';
import { bareFile, type CrashGroup, type GroupedCrashes } from './groups';
import { humanFailureLabel } from './fix-plan';

export type CrashSummary = Record<string, unknown>;

export type EnrichedCrash = {
  group: CrashGroup;
  summary: CrashSummary;
};

export const KIND_FILTERS = [
  { value: 'all', label: 'All kinds' },
  { value: 'mod', label: 'Mod-related' },
  { value: 'hang', label: 'Server hang' },
  { value: 'host', label: 'Host' },
] as const;

export type KindFilter = (typeof KIND_FILTERS)[number]['value'];

export const DETAIL_PANELS = [
  { id: 'fix', label: 'Fix' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'details', label: 'Details' },
] as const;

export type DetailPanel = (typeof DETAIL_PANELS)[number]['id'];

export function formatAge(mtimeOrIso: string | number | null | undefined): string {
  if (mtimeOrIso == null || mtimeOrIso === '') return '—';
  let ms: number;
  if (typeof mtimeOrIso === 'number') {
    ms = mtimeOrIso > 1e12 ? mtimeOrIso : mtimeOrIso * 1000;
  } else {
    ms = Date.parse(mtimeOrIso);
  }
  if (Number.isNaN(ms)) return '—';
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

export function dayKeyFromAt(mtimeOrIso: string | number | null | undefined): string {
  if (mtimeOrIso == null) return 'unknown';
  let ms: number;
  if (typeof mtimeOrIso === 'number') {
    ms = mtimeOrIso > 1e12 ? mtimeOrIso : mtimeOrIso * 1000;
  } else {
    ms = Date.parse(String(mtimeOrIso));
  }
  if (Number.isNaN(ms)) return 'unknown';
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayDayKey(): string {
  return dayKeyFromAt(Date.now());
}

export function formatInboxDayLabel(dayKey: string): string {
  if (!dayKey || dayKey === 'unknown') return 'Unknown date';
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return dayKey;
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey === todayDayKey()) return 'Today';
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return 'Yesterday';
  }
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function groupEnrichedByDay(enriched: EnrichedCrash[]): {
  key: string;
  label: string;
  items: EnrichedCrash[];
}[] {
  const map = new Map<string, EnrichedCrash[]>();
  for (const row of enriched) {
    const at = row.group.last_at || row.group.first_at;
    const key = dayKeyFromAt(at);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  const keys = [...map.keys()].sort((a, b) => {
    if (a === 'unknown') return 1;
    if (b === 'unknown') return -1;
    return b.localeCompare(a);
  });
  return keys.map((key) => ({
    key,
    label: formatInboxDayLabel(key),
    items: map.get(key)!,
  }));
}

export function truncate(s: unknown, n = 120): string {
  if (!s) return '';
  const t = String(s).trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

export function summaryByFileMap(facts: Record<string, unknown> | null | undefined): Map<string, CrashSummary> {
  const optional = asRecord(facts?.optional);
  const list = asArray<CrashSummary>(optional.crash_summaries);
  const map = new Map<string, CrashSummary>();
  for (const s of list) {
    if (s?.file) map.set(bareFile(String(s.file)), s);
  }
  return map;
}

export function leadMember(group: CrashGroup) {
  const members = group.members ?? [];
  return members.find((m) => !m.acknowledged) || members[0] || null;
}

export function resolveSummary(
  group: CrashGroup,
  factsMap: Map<string, CrashSummary>,
  facts: Record<string, unknown> | null | undefined,
): CrashSummary {
  const lead = leadMember(group);
  if (!lead) {
    return {
      failure_kind: group.failure_kind,
      stall_mod_id: group.stall_mod_id,
      primary_mod_id: null,
      plain_english: null,
    };
  }
  const fromFacts = factsMap.get(bareFile(lead.file));
  let summary: CrashSummary;
  if (fromFacts) {
    summary = {
      ...fromFacts,
      failure_kind: fromFacts.failure_kind ?? group.failure_kind ?? lead.failure_kind,
      stall_mod_id: fromFacts.stall_mod_id ?? group.stall_mod_id ?? lead.stall_mod_id,
    };
  } else {
    summary = {
      file: lead.file,
      failure_kind: lead.failure_kind ?? group.failure_kind,
      stall_mod_id: lead.stall_mod_id ?? group.stall_mod_id,
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
    };
  }
  if (!summary.matched_rule_id) {
    const fname = bareFile(lead.file);
    const hits = asArray<Record<string, unknown>>(asRecord(facts?.optional).crash_rule_hits);
    const hit = hits.find(
      (h) => bareFile(str(h.crash_file)) === fname || String(h.crash_file || '').endsWith(fname),
    );
    if (hit?.rule_id) {
      summary = { ...summary, matched_rule_id: hit.rule_id, matched_pack_id: hit.pack_id };
    }
  }
  return summary;
}

function exceptionClassName(exception: unknown): string | null {
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

function isUnknownFailureKind(kind: unknown): boolean {
  const k = String(kind || '').toLowerCase();
  return !k || k === 'unknown';
}

export function groupTitle(group: CrashGroup, summary: CrashSummary): string {
  const kind = summary.failure_kind ?? group.failure_kind;
  const unknownKind = isUnknownFailureKind(kind);
  let title = humanFailureLabel(
    unknownKind ? '' : String(kind || ''),
    str(summary.stall_mod_id ?? group.stall_mod_id) || null,
    str(summary.primary_mod_id) || null,
    str(summary.create_issue) || null,
  );
  const weakTitle = !title || title === 'Crash' || String(title).toLowerCase() === 'unknown';
  if (weakTitle || unknownKind) {
    const lead = leadMember(group);
    const fallback =
      str(summary.display_label) ||
      lead?.display_label ||
      exceptionClassName(summary.exception || lead?.exception) ||
      str(summary.plain_english) ||
      lead?.plain_english ||
      (group.label && String(group.label).toLowerCase() !== 'unknown' ? group.label : null);
    if (fallback) title = truncate(String(fallback), 100);
  }
  return title || group.label || 'Crash group';
}

export function isModRelated(group: CrashGroup, summary: CrashSummary): boolean {
  const kind = String(summary.failure_kind ?? group.failure_kind ?? '').toLowerCase();
  if (kind.startsWith('mod_') || kind === 'loader') return true;
  return !!(summary.primary_mod_id || summary.suspect_mod_id || summary.mod_fix);
}

export function isServerHang(group: CrashGroup, summary: CrashSummary): boolean {
  const kind = String(summary.failure_kind ?? group.failure_kind ?? '').toLowerCase();
  return kind.startsWith('watchdog');
}

export function isHostRelated(group: CrashGroup, summary: CrashSummary): boolean {
  // Hang is exclusive — watchdog failures belong only under Hang filter/chip
  if (isServerHang(group, summary)) return false;
  const kind = String(summary.failure_kind ?? group.failure_kind ?? '').toLowerCase();
  if (kind === 'host_resource' || kind.startsWith('host') || kind.startsWith('world_nbt')) return true;
  if (kind === 'platform_mismatch' || kind === 'env_lock') return true;
  const cat = String(summary.category ?? '').toLowerCase();
  return cat.includes('oom') || cat.includes('memory') || cat.includes('host');
}

export function kindChip(group: CrashGroup, summary: CrashSummary): {
  label: string;
  tone: 'danger' | 'warn' | 'neutral';
} {
  if (isServerHang(group, summary)) return { label: 'Hang', tone: 'danger' };
  if (isHostRelated(group, summary)) return { label: 'Host', tone: 'danger' };
  if (isModRelated(group, summary)) return { label: 'Mod', tone: 'warn' };
  return { label: 'Other', tone: 'neutral' };
}

/** Row severity tone for list chrome — Hang/Host critical, Mod warn. */
export function groupSeverityTone(group: CrashGroup, summary: CrashSummary): 'danger' | 'warn' | 'info' | 'neutral' {
  if (isServerHang(group, summary) || isHostRelated(group, summary)) return 'danger';
  if (isModRelated(group, summary)) return 'warn';
  return 'info';
}

export function dayKeyForGroup(group: CrashGroup): string {
  return dayKeyFromAt(group.last_at || group.first_at);
}

export function enrichGroups(
  grouped: GroupedCrashes | null | undefined,
  facts: Record<string, unknown> | null | undefined,
): EnrichedCrash[] {
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

export function filterEnriched(
  enriched: EnrichedCrash[],
  {
    search,
    kind,
    needsReviewOnly,
    reviewedOnly,
  }: {
    search?: string;
    kind?: KindFilter | string;
    needsReviewOnly?: boolean;
    reviewedOnly?: boolean;
  },
): EnrichedCrash[] {
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
      summary.plain_english,
      summary.exception,
      summary.primary_mod_id,
      summary.stall_mod_id,
      summary.suspect_mod_id,
      ...(group.members ?? []).map((m) => m.file),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function normalizeView(raw: string | undefined | null): 'review' | 'reviewed' | 'tools' | null {
  if (raw === 'needs-review') return 'review';
  if (raw === 'all') return 'reviewed';
  if (raw === 'review' || raw === 'reviewed' || raw === 'tools') return raw;
  return null;
}

export function resolveDeepLinkView(
  groupFp: string | null | undefined,
  groups: CrashGroup[] | null | undefined,
): 'review' | 'reviewed' {
  if (!groupFp || !groups?.length) return 'review';
  const g = groups.find((x) => x.fingerprint === groupFp);
  if (!g) return 'review';
  return g.unreviewed > 0 ? 'review' : 'reviewed';
}

export function inboxKeyForFile(file: string): string {
  return `crash:${bareFile(file)}`;
}
