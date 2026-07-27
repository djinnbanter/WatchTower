import type { LogErrorRow } from './types';

export function sampleLinesFrom(row: Record<string, unknown> | null | undefined): string[] {
  if (Array.isArray(row?.sample_lines) && row.sample_lines.length) {
    return row.sample_lines.map(String);
  }
  if (row?.sample_line) return [String(row.sample_line)];
  return [];
}

export function mergeLogErrorRows({
  opsBlock,
  factsErrors,
  recommendations,
  modIssues,
  hasReport,
  ackedModIds,
}: {
  opsBlock: Record<string, unknown> | null | undefined;
  factsErrors: unknown;
  recommendations: Record<string, unknown>[];
  modIssues: Record<string, unknown>[];
  hasReport: boolean;
  /** Mod ids whose Issues `mod:{id}` row was reviewed — omit from the active list. */
  ackedModIds?: Iterable<string> | null;
}): LogErrorRow[] {
  const acked = new Set(
    [...(ackedModIds ?? [])].map((id) => String(id).trim().toLowerCase()).filter(Boolean),
  );
  const byId = new Map<string, LogErrorRow>();

  function upsert(raw: Record<string, unknown> | null | undefined, source: string) {
    if (!raw || typeof raw !== 'object') return;
    const id = String(raw.mod_id ?? raw.id ?? '');
    if (!id) return;
    const prev =
      byId.get(id) ??
      ({
        mod_id: id,
        total: 0,
        sample_lines: [],
        by_category: {},
        top_recipes: [],
        sources: [],
      } satisfies LogErrorRow);
    const preferReport = source === 'report' || !prev.from_report;
    const next: LogErrorRow = { ...prev, sources: [...prev.sources, source] };
    if (source === 'report') next.from_report = true;

    const total = Number(raw.total);
    if (Number.isFinite(total)) {
      next.total = preferReport || !prev.total ? total : Math.max(prev.total, total);
    }
    if (raw.display_name && (preferReport || !prev.display_name)) {
      next.display_name = String(raw.display_name);
    }
    if (raw.category_label && (preferReport || !prev.category_label)) {
      next.category_label = String(raw.category_label);
    }
    if (raw.top_category && (preferReport || !prev.top_category)) {
      next.top_category = String(raw.top_category);
    }
    if (raw.boot_only != null && (preferReport || prev.boot_only == null)) {
      next.boot_only = !!raw.boot_only;
    }
    if (raw.explanation && (preferReport || !prev.explanation)) {
      next.explanation = String(raw.explanation);
    }
    if (raw.worry_level && (preferReport || !prev.worry_level)) {
      next.worry_level = String(raw.worry_level);
    }
    if (raw.severity && (preferReport || !prev.severity)) {
      next.severity = String(raw.severity);
    }

    if (raw.by_category && typeof raw.by_category === 'object') {
      const cat = raw.by_category as Record<string, unknown>;
      next.by_category =
        preferReport && Object.keys(cat).length ? { ...cat } : { ...prev.by_category, ...cat };
    }
    const samples = sampleLinesFrom(raw);
    if (samples.length) {
      const merged = [...(preferReport ? samples : prev.sample_lines)];
      for (const s of preferReport ? prev.sample_lines : samples) {
        if (!merged.includes(s)) merged.push(s);
      }
      next.sample_lines = merged.slice(0, 8);
      next.sample_line = next.sample_lines[0];
    }
    if (Array.isArray(raw.top_recipes) && raw.top_recipes.length) {
      const recipes = preferReport ? [...raw.top_recipes] : [...prev.top_recipes];
      for (const r of preferReport ? prev.top_recipes : raw.top_recipes) {
        if (!recipes.includes(r)) recipes.push(r);
      }
      next.top_recipes = recipes.slice(0, 8);
    }
    byId.set(id, next);
  }

  const factsArr = Array.isArray(factsErrors)
    ? factsErrors
    : Array.isArray((factsErrors as { entries?: unknown })?.entries)
      ? ((factsErrors as { entries: unknown[] }).entries)
      : [];
  for (const e of factsArr) upsert(e as Record<string, unknown>, 'report');
  for (const e of (opsBlock?.entries as Record<string, unknown>[]) ?? []) upsert(e, 'scan');

  const recById = new Map<string, Record<string, unknown>>();
  for (const r of recommendations ?? []) {
    if (r?.mod_id) recById.set(String(r.mod_id), r);
  }
  const issueById = new Map<string, Record<string, unknown>>();
  for (const iss of modIssues ?? []) {
    if (iss?.resolved) continue;
    const id = String(iss.mod_id ?? '');
    if (!id) continue;
    if (!issueById.has(id)) issueById.set(id, iss);
  }

  const out: LogErrorRow[] = [];
  for (const row of byId.values()) {
    if (acked.has(String(row.mod_id).toLowerCase())) continue;
    const rec = recById.get(row.mod_id);
    const iss = issueById.get(row.mod_id);
    if (rec) {
      row.why = String(rec.why ?? row.why ?? row.explanation ?? '');
      row.severity = String(rec.severity ?? row.severity ?? '');
      row.worry_level = String(rec.worry_level ?? row.worry_level ?? '');
      const steps: string[] = [];
      if (Array.isArray(rec.fix_steps)) steps.push(...rec.fix_steps.filter(Boolean).map(String));
      if (!steps.length && rec.fix) steps.push(String(rec.fix));
      if (rec.install_hint && !steps.includes(String(rec.install_hint))) {
        steps.push(String(rec.install_hint));
      }
      row.fix_steps = steps;
      if (rec.doc_url) row.doc_url = String(rec.doc_url);
      if (!row.explanation && rec.explanation) row.explanation = String(rec.explanation);
    } else if (iss) {
      row.why = String(iss.narrative ?? row.why ?? '');
      row.severity = String(iss.severity ?? row.severity ?? '');
      const steps: string[] = [];
      if (Array.isArray(iss.fix_steps) && iss.fix_steps.length) {
        steps.push(...iss.fix_steps.filter(Boolean).map(String));
      } else if (Array.isArray(iss.hints)) {
        for (const h of iss.hints) {
          if (!h) continue;
          if (hasReport && /run a full report/i.test(String(h))) continue;
          steps.push(String(h));
        }
      }
      row.fix_steps = steps;
      if (iss.doc_url) row.doc_url = String(iss.doc_url);
    }
    if (!row.category_label && row.top_category) {
      row.category_label = String(row.top_category).replace(/_/g, ' ');
    }
    out.push(row);
  }

  out.sort(
    (a, b) =>
      (b.total ?? 0) - (a.total ?? 0) || String(a.mod_id).localeCompare(String(b.mod_id)),
  );
  return out;
}
