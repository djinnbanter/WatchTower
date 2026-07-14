import { html } from '../../lib/preact.js';
import { useState, useCallback, useEffect } from '../../lib/preact.js';
import {
  reports, opsCache, crashGroups, ui,
} from '../../state/stores.js';
import {
  ackCrash,
  acknowledgeAllCrashes,
  scanCrashes,
  openModal,
  addToast,
  loadCrashContext,
  fetchCrashesGrouped,
} from '../../state/actions.js';
import { forensicsFindClass } from '../../api/endpoints.js';
import { navigate } from '../../app/router.js';
import {
  Page, Section, FilterBar, EmptyState, FreshnessBadge, MetricTile, Sparkline, Timeline, Accordion,
} from '../../ui/patterns/index.js';
import { Badge, Button, Card, Toggle, CopyButton } from '../../ui/primitives/index.js';
import {
  humanFailureLabel,
  buildFixPlan,
  formatConfidenceLabel,
} from '../../domain/crash-fix.js';

// ── Filters ───────────────────────────────────────────────────────────────────

const FILTERS = [
  { value: 'all',        label: 'All' },
  { value: 'unreviewed', label: 'Needs review' },
  { value: 'mod',        label: 'Mod-related' },
  { value: 'hang',       label: 'Server hang' },
  { value: 'host',       label: 'Host' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatAge(mtimeOrIso) {
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

function truncate(s, n = 120) {
  if (!s) return '';
  const t = String(s).trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function bareFile(file) {
  if (!file) return '';
  return file.startsWith('crash-reports/') ? file.slice('crash-reports/'.length) : file;
}

function summaryByFileMap(facts) {
  const list = facts?.optional?.crash_summaries ?? [];
  const map = new Map();
  for (const s of list) {
    if (s?.file) map.set(bareFile(s.file), s);
  }
  return map;
}

/** Prefer newest unreviewed member, else newest. */
function leadMember(group) {
  const members = group?.members ?? [];
  const unrev = members.find((m) => !m.acknowledged);
  return unrev || members[0] || null;
}

function resolveSummary(group, factsMap, facts) {
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

function groupTitle(group, summary) {
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
      summary?.plain_english
      || summary?.display_label
      || lead?.plain_english
      || lead?.display_label
      || exceptionClassName(summary?.exception || lead?.exception)
      || group?.label;
    if (fallback) {
      title = truncate(String(fallback), 100);
    }
  }
  return title || group?.label || 'Crash group';
}

function isModRelated(group, summary) {
  const kind = String(summary?.failure_kind ?? group?.failure_kind ?? '').toLowerCase();
  if (kind.startsWith('mod_') || kind === 'loader') return true;
  return !!(summary?.primary_mod_id || summary?.suspect_mod_id || summary?.mod_fix);
}

function isServerHang(group, summary) {
  const kind = String(summary?.failure_kind ?? group?.failure_kind ?? '').toLowerCase();
  return kind.startsWith('watchdog');
}

function isHostRelated(group, summary) {
  const kind = String(summary?.failure_kind ?? group?.failure_kind ?? '').toLowerCase();
  if (kind === 'host_resource' || kind.startsWith('host') || kind.startsWith('world_nbt')) return true;
  if (kind === 'platform_mismatch' || kind === 'env_lock') return true;
  if (kind.startsWith('watchdog')) return true;
  const cat = String(summary?.category ?? '').toLowerCase();
  return cat.includes('oom') || cat.includes('memory') || cat.includes('host');
}

function failureTone(kind) {
  const k = String(kind || '').toLowerCase();
  if (k.startsWith('watchdog') || k === 'host_resource' || k.startsWith('host') || k.startsWith('world_nbt')
      || k === 'env_lock' || k === 'platform_mismatch') {
    return 'danger';
  }
  if (k.startsWith('mod_') || k === 'loader') return 'warn';
  return 'neutral';
}

function openExternal(url) {
  if (!url) return;
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch { /* ignore */ }
}

// ── Pre-crash context ─────────────────────────────────────────────────────────

function PreCrashPanel({ file }) {
  const [ctx, setCtx] = useState(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCtx(undefined);
    loadCrashContext(file).then((data) => {
      if (cancelled) return;
      setCtx(data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [file]);

  if (loading || ctx === undefined) {
    return html`<p class="crashes-ctx-loading">Loading context…</p>`;
  }
  if (!ctx) {
    return html`<p class="crashes-ctx-unavailable">Pre-crash context not available for this log.</p>`;
  }

  const { window_minutes, tps_samples, events, tps } = ctx;
  const samples = tps_samples ?? tps?.points ?? [];
  const timelineItems = (events ?? []).slice(0, 8).map((ev, i) => ({
    id: i,
    time: ev.t ?? ev.time ?? null,
    tone: 'warn',
    title: ev.type ?? ev.kind ?? 'event',
    detail: ev.detail ?? '',
    badge: html`<${Badge} tone="warn">pre-crash</${Badge}>`,
  }));
  const tpsValues = samples.map((s) => (typeof s === 'number' ? s : s.v)).filter((v) => v != null);
  const tpsMin = tpsValues.length ? Math.min(...tpsValues) : null;
  const tpsMax = tpsValues.length ? Math.max(...tpsValues) : null;

  return html`
    <div class="crashes-pre-crash">
      ${window_minutes ? html`<p class="crashes-ctx-window">${window_minutes}-minute window before crash</p>` : null}
      ${samples.length ? html`
        <div class="crashes-ctx-spark">
          <strong>TPS trend</strong>
          <${Sparkline} series=${samples} tone="warn" fill=${true} width=${240} height=${40} />
          <p class="crashes-ctx-metric">
            ${samples.length} samples · min ${tpsMin?.toFixed?.(1) ?? tpsMin ?? '—'} · max ${tpsMax?.toFixed?.(1) ?? tpsMax ?? '—'}
          </p>
        </div>
      ` : null}
      ${timelineItems.length ? html`
        <div class="crashes-ctx-events">
          <strong>Events</strong>
          <${Timeline} items=${timelineItems} groupByDay=${false} />
        </div>
      ` : null}
    </div>
  `;
}

// ── Fix plan block ────────────────────────────────────────────────────────────

function FixPlanPanel({ plan, onMarkReviewed, marking, groupUnreviewed, onFindOwningJar, findingJar }) {
  if (!plan) return null;
  const stepsText = plan.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');

  return html`
    <div class="crashes-fix-plan">
      <div class="crashes-fix-plan__eyebrow">Do this now</div>
      <p class="crashes-fix-plan__headline">${plan.headline}</p>
      <ol class="crashes-fix-plan__steps">
        ${plan.steps.map((step, i) => html`
          <li key=${i}>${step}</li>
        `)}
      </ol>
      <div class="crashes-cta-row">
        ${plan.modrinthUrl ? html`
          <${Button}
            kind="primary"
            size="sm"
            onClick=${() => openExternal(plan.modrinthUrl)}
          >${plan.modrinthLabel || 'Open Modrinth'}</${Button}>
        ` : null}
        <${Button}
          kind="neutral"
          size="sm"
          onClick=${() => navigate('mods', plan.modsTabParams || { view: 'overview' })}
        >Open Mods</${Button}>
        ${onFindOwningJar ? html`
          <${Button}
            kind="neutral"
            size="sm"
            loading=${findingJar}
            onClick=${onFindOwningJar}
          >Find owning jar</${Button}>
        ` : null}
        <${CopyButton} text=${stepsText} label="Copy steps" />
        <${Button}
          kind="neutral"
          size="sm"
          loading=${marking}
          disabled=${!(groupUnreviewed > 0)}
          onClick=${onMarkReviewed}
        >Mark group reviewed</${Button}>
      </div>
      ${plan.relatedMods?.length ? html`
        <div class="crashes-related-mods">
          <span class="crashes-related-mods__label">Related</span>
          ${plan.relatedMods.map((m) => html`
            <button
              type="button"
              class="crashes-related-mods__chip"
              key=${m.id}
              onClick=${() => openExternal(m.url)}
            >${m.id}</button>
          `)}
        </div>
      ` : null}
    </div>
  `;
}

// ── Group detail ──────────────────────────────────────────────────────────────

function GroupDetail({ group, summary, mods, onAckFile, onMarkGroup, marking }) {
  const [findingJar, setFindingJar] = useState(false);
  const [findResult, setFindResult] = useState(null);
  const plan = buildFixPlan(summary, mods);
  const whyParts = [
    summary?.likely_cause,
    summary?.mod_fix?.why,
    summary?.plain_english && summary.plain_english !== plan.headline ? summary.plain_english : null,
  ].filter(Boolean);
  const why = [...new Set(whyParts)].join(' — ');
  const conf = plan.confidenceLabel || formatConfidenceLabel(summary?.confidence);
  const lead = leadMember(group);
  const members = group.members ?? [];

  async function handleFindOwningJar() {
    const className = summary?.java_mismatch?.class_name
      || summary?.class_name
      || (summary?.exception || '').replace(/^.*\s([a-zA-Z0-9_$/]+(?:Exception|Error))\b.*/, '$1')
      || null;
    const query = className
      || (summary?.exception || '').match(/([a-z][\w$]+(?:[./][\w$]+)+)/i)?.[1]
      || summary?.primary_mod_id;
    if (!query) {
      addToast({ tone: 'warn', message: 'No class name available to look up' });
      return;
    }
    setFindingJar(true);
    try {
      const res = await forensicsFindClass({ class: String(query).replace(/\./g, '/'), include_nested: true });
      setFindResult(res);
      const n = res?.matches?.length ?? 0;
      addToast({
        tone: n ? 'ok' : 'warn',
        message: n ? `Found ${n} owning jar match(es)` : (res?.error || 'No owning jar found'),
      });
    } catch (e) {
      addToast({ tone: 'danger', message: e?.message || 'Find owning jar failed' });
    } finally {
      setFindingJar(false);
    }
  }

  return html`
    <div class="crashes-group__detail">
      <${FixPlanPanel}
        plan=${plan}
        onMarkReviewed=${onMarkGroup}
        marking=${marking}
        groupUnreviewed=${group.unreviewed}
        onFindOwningJar=${handleFindOwningJar}
        findingJar=${findingJar}
      />
      ${findResult?.matches?.length ? html`
        <div class="crashes-why">
          <div class="crashes-why__label">Owning jar</div>
          <ul>
            ${findResult.matches.slice(0, 5).map((m, i) => html`
              <li key=${i}><code>${m.jar}</code> · ${m.mod_id || '?'}</li>
            `)}
          </ul>
        </div>
      ` : null}
      ${why ? html`
        <div class="crashes-why">
          <div class="crashes-why__label">Why</div>
          <p class="crashes-why__text">${why}</p>
          ${conf ? html`<p class="crashes-why__meta">${conf} confidence</p>` : null}
        </div>
      ` : null}

      ${group.incident_ids?.length ? html`
        <div class="crashes-incident">
          <div class="crashes-incident__label">Linked incident</div>
          <p class="crashes-incident__text">
            ${group.incident_ids.length} linked report${group.incident_ids.length === 1 ? '' : 's'}
            ${summary?.paired_primary_file ? html` · pairs with <code>${summary.paired_primary_file}</code>` : null}
          </p>
        </div>
      ` : null}

      <${Accordion} summary="Evidence — pre-crash, members, logs" defaultOpen=${false}>
        <div class="crashes-evidence">
          ${lead?.file ? html`
            <${Section} title="Pre-crash context" density="compact">
              <${PreCrashPanel} file=${lead.file} />
            </${Section}>
          ` : null}

          <${Section} title=${`Members (${members.length})`} density="compact">
            <ul class="crashes-members">
              ${members.map((m) => html`
                <li class="crashes-members__row" key=${m.file}>
                  <div class="crashes-members__info">
                    <span class="crashes-members__file">${m.file}</span>
                    <span class="crashes-members__age">${formatAge(m.time)}</span>
                    ${m.acknowledged
                      ? html`<${Badge} tone="ok">reviewed</${Badge}>`
                      : html`<${Badge} tone="warn">needs review</${Badge}>`}
                  </div>
                  <div class="crashes-members__actions">
                    <${Button}
                      kind="neutral"
                      size="sm"
                      onClick=${() => openModal('crash-log', { file: m.file })}
                    >View log</${Button}>
                    <${Toggle}
                      checked=${!!m.acknowledged}
                      onChange=${(v) => onAckFile(m.file, v)}
                      label="Reviewed"
                    />
                  </div>
                </li>
              `)}
            </ul>
          </${Section}>

          <${Accordion} summary="Technical details" defaultOpen=${false}>
            <dl class="crashes-tech">
              <div><dt>Fingerprint</dt><dd><code>${group.fingerprint}</code></dd></div>
              ${summary?.exception ? html`<div><dt>Exception</dt><dd><code>${summary.exception}</code></dd></div>` : null}
              ${summary?.failure_kind ? html`<div><dt>Kind</dt><dd>${summary.failure_kind}</dd></div>` : null}
              ${summary?.matched_rule_id ? html`<div><dt>Rule</dt><dd><code>${summary.matched_rule_id}</code>${summary.matched_pack_id ? html` <span class="text-caption">(${summary.matched_pack_id})</span>` : null}</dd></div>` : null}
              ${summary?.mixin_config ? html`<div><dt>Mixin config</dt><dd><code>${summary.mixin_config}</code></dd></div>` : null}
              ${summary?.mixin_config_conflict ? html`<div><dt>Conflict config</dt><dd><code>${summary.mixin_config_conflict}</code></dd></div>` : null}
              ${summary?.conflict_mod_id ? html`<div><dt>Conflict mod</dt><dd>${summary.conflict_mod_id}</dd></div>` : null}
              ${summary?.invalid_location ? html`<div><dt>Invalid location</dt><dd><code>${summary.invalid_location}</code></dd></div>` : null}
              ${summary?.config_file || summary?.config_path ? html`<div><dt>Config</dt><dd><code>${summary.config_file || summary.config_path}</code></dd></div>` : null}
              ${summary?.ecosystem ? html`<div><dt>Ecosystem</dt><dd>${summary.ecosystem}</dd></div>` : null}
              ${summary?.duplicate_mod_ids ? html`<div><dt>Duplicate mods</dt><dd><code>${Array.isArray(summary.duplicate_mod_ids) ? summary.duplicate_mod_ids.join(', ') : summary.duplicate_mod_ids}</code></dd></div>` : null}
              ${summary?.duplicate_jars ? html`<div><dt>Duplicate jars</dt><dd><code>${Array.isArray(summary.duplicate_jars) ? summary.duplicate_jars.join(', ') : summary.duplicate_jars}</code></dd></div>` : null}
              ${summary?.locked_path ? html`<div><dt>Locked path</dt><dd><code>${summary.locked_path}</code></dd></div>` : null}
              ${summary?.oom_kind ? html`<div><dt>OOM kind</dt><dd>${summary.oom_kind}</dd></div>` : null}
              ${summary?.java_mismatch ? html`<div><dt>Java mismatch</dt><dd>compiled ${summary.java_mismatch.compiled_java ?? '?'} / runtime ${summary.java_mismatch.runtime_java ?? '?'}</dd></div>` : null}
              ${summary?.mod_file ? html`<div><dt>Mod file</dt><dd>${summary.mod_file}</dd></div>` : null}
              ${lead?.file ? html`<div><dt>Lead file</dt><dd>${lead.file}</dd></div>` : null}
            </dl>
          </${Accordion}>
        </div>
      </${Accordion}>
    </div>
  `;
}

// ── Group row ─────────────────────────────────────────────────────────────────

function CrashGroupCard({
  group, summary, mods, expanded, onToggle, onAckFile, onMarkGroup, marking,
}) {
  const title = groupTitle(group, summary);
  const plan = buildFixPlan(summary, mods);
  const cause = truncate(summary?.plain_english || group.label || title, 120);
  const tone = group.unreviewed > 0 ? failureTone(summary?.failure_kind ?? group.failure_kind) : undefined;
  const range = group.first_at && group.last_at && group.first_at !== group.last_at
    ? `${formatAge(group.last_at)} · first ${formatAge(group.first_at)}`
    : formatAge(group.last_at || group.first_at);

  return html`
    <${Card}
      tone=${tone}
      className=${'crashes-group' + (expanded ? ' crashes-group--open' : '') + (group.unreviewed ? '' : ' crashes-group--reviewed')}
    >
      <button
        type="button"
        class="crashes-group__header"
        aria-expanded=${expanded}
        onClick=${onToggle}
      >
        <div class="crashes-group__title-block">
          <div class="crashes-group__title-row">
            <span class="crashes-group__title">${title}</span>
            <${Badge} tone="neutral" className="crashes-group__count">${group.count}×</${Badge}>
            ${group.unreviewed > 0
              ? html`<${Badge} tone="warn">${group.unreviewed} unreviewed</${Badge}>`
              : html`<${Badge} tone="ok">reviewed</${Badge}>`}
            ${summary?.matched_rule_id
              ? html`<${Badge} tone="neutral" title=${'Matched rule ' + summary.matched_rule_id}>rule:${summary.matched_rule_id}</${Badge}>`
              : null}
          </div>
          <p class="crashes-group__cause">${cause}</p>
          <div class="crashes-group__meta">
            <span class="crashes-group__age">${range}</span>
            ${plan.primaryActionPeek ? html`
              <span class="crashes-group__peek">${plan.primaryActionPeek}</span>
            ` : null}
          </div>
        </div>
        <span class="crashes-group__chevron" aria-hidden="true">${expanded ? '▲' : '▼'}</span>
      </button>

      ${expanded ? html`
        <${GroupDetail}
          group=${group}
          summary=${summary}
          mods=${mods}
          onAckFile=${onAckFile}
          onMarkGroup=${onMarkGroup}
          marking=${marking}
        />
      ` : null}
    </${Card}>
  `;
}

// ── KPI strip ─────────────────────────────────────────────────────────────────

function KpiStrip({ grouped, latestAt, onScan, scanning, onAckAll, acking }) {
  const needsReview = grouped?.unreviewed_groups ?? 0;
  const total = grouped?.count ?? 0;

  return html`
    <div class="crashes-kpi-strip">
      <div class="feat-kpi-row crashes-kpi-strip__metrics">
        <${MetricTile}
          label="Needs review"
          value=${needsReview}
          tone=${needsReview > 0 ? 'danger' : 'ok'}
          padding="12"
        />
        <${MetricTile}
          label="Total crashes"
          value=${total}
          padding="12"
        />
        <${MetricTile}
          label="Latest age"
          value=${latestAt ? 1 : 0}
          format=${() => (latestAt ? formatAge(latestAt) : '—')}
          padding="12"
        />
      </div>
      <div class="crashes-kpi-strip__actions">
        <${Button}
          kind="neutral"
          size="sm"
          loading=${acking}
          disabled=${!(grouped?.unreviewed > 0)}
          onClick=${onAckAll}
        >Mark all reviewed</${Button}>
        <${Button}
          kind="neutral"
          size="sm"
          loading=${scanning}
          onClick=${onScan}
        >Scan now</${Button}>
      </div>
    </div>
  `;
}

// ── PageView ──────────────────────────────────────────────────────────────────

export function crashesBadgeCount() {
  return crashGroups.value?.unreviewed_groups ?? 0;
}

export function PageView() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [scanning, setScanning] = useState(false);
  const [acking, setAcking] = useState(false);
  const [markingFp, setMarkingFp] = useState(null);
  const [expandedFp, setExpandedFp] = useState(null);

  const facts = reports.value.facts;
  const opsCacheData = opsCache.value.data;
  const grouped = crashGroups.value;
  const mods = facts?.optional?.mods ?? [];
  const factsMap = summaryByFileMap(facts);
  const routeGroup = ui.value.route?.params?.group ?? null;
  const crashesAt = grouped?.at ?? opsCache.value.at;

  // Deep-link + ensure groups loaded
  useEffect(() => {
    if (!grouped?.groups?.length) {
      fetchCrashesGrouped?.();
    }
  }, []);

  useEffect(() => {
    if (routeGroup) {
      setExpandedFp(decodeURIComponent(String(routeGroup)));
    }
  }, [routeGroup]);

  const groups = [...(grouped?.groups ?? [])];
  // Sort: unreviewed first, then last_at desc
  groups.sort((a, b) => {
    const ua = a.unreviewed > 0 ? 0 : 1;
    const ub = b.unreviewed > 0 ? 0 : 1;
    if (ua !== ub) return ua - ub;
    return String(b.last_at || '').localeCompare(String(a.last_at || ''));
  });

  const enriched = groups.map((g) => ({
    group: g,
    summary: resolveSummary(g, factsMap, facts),
  }));

  const filtered = enriched.filter(({ group, summary }) => {
    if (search) {
      const q = search.toLowerCase();
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
      if (!haystack.includes(q)) return false;
    }
    if (filter === 'unreviewed') return group.unreviewed > 0;
    if (filter === 'mod') return isModRelated(group, summary);
    if (filter === 'hang') return isServerHang(group, summary);
    if (filter === 'host') return isHostRelated(group, summary);
    return true;
  });

  const latestAt =
    opsCacheData?.crashes?.latest?.mtime
    ?? grouped?.groups?.[0]?.last_at
    ?? null;

  const handleScan = useCallback(async () => {
    setScanning(true);
    await scanCrashes(true);
    await fetchCrashesGrouped();
    setScanning(false);
    addToast('Crash scan complete', 'success');
  }, []);

  const handleAckAll = useCallback(async () => {
    const n = grouped?.unreviewed ?? 0;
    if (!n) return;
    const ok = window.confirm(
      `Mark all ${n} unreviewed crash${n === 1 ? '' : 'es'} as reviewed? Files stay on disk.`,
    );
    if (!ok) return;
    setAcking(true);
    await acknowledgeAllCrashes({ scope: 'unreviewed' });
    setAcking(false);
  }, [grouped?.unreviewed]);

  const handleAckFile = useCallback(async (file, reviewed) => {
    await ackCrash(file, reviewed);
    await fetchCrashesGrouped();
  }, []);

  const handleMarkGroup = useCallback(async (fingerprint) => {
    setMarkingFp(fingerprint);
    await acknowledgeAllCrashes({ fingerprint });
    setMarkingFp(null);
  }, []);

  const noGroups = enriched.length === 0;

  return html`
    <${Page}
      title="Crashes"
      subtitle="Resolve crashes quickly — grouped problems with clear next steps"
    >
      <div data-tour="crashes" class="ui-page__stack">
        <${KpiStrip}
          grouped=${grouped}
          latestAt=${latestAt}
          onScan=${handleScan}
          scanning=${scanning}
          onAckAll=${handleAckAll}
          acking=${acking}
        />

        ${noGroups ? html`
          <${EmptyState}
            title="No crash reports found"
            body="No crash reports have been detected. Run Scan if you expected some."
          />
        ` : html`
          <${FilterBar}
            search=${search}
            onSearch=${setSearch}
            placeholder="Search groups, mods, files…"
            filters=${FILTERS}
            filterValue=${filter}
            onFilterChange=${setFilter}
            resultCount=${filtered.length}
          />

          ${filtered.length === 0 ? html`
            <${EmptyState}
              title=${filter === 'unreviewed' ? "No crashes need review — you're clear." : 'No matching groups'}
              body=${filter === 'unreviewed'
                ? 'All crash groups are marked reviewed.'
                : 'Try a different filter or clear the search.'}
            />
          ` : html`
            <div class="crashes-group-list">
              ${filtered.map(({ group, summary }) => html`
                <${CrashGroupCard}
                  key=${group.fingerprint}
                  group=${group}
                  summary=${summary}
                  mods=${mods}
                  expanded=${expandedFp === group.fingerprint}
                  onToggle=${() => {
                    const next = expandedFp === group.fingerprint ? null : group.fingerprint;
                    setExpandedFp(next);
                    if (next) {
                      navigate('crashes', { group: next }, { replace: true });
                    } else {
                      navigate('crashes', {}, { replace: true });
                    }
                  }}
                  onAckFile=${handleAckFile}
                  onMarkGroup=${() => handleMarkGroup(group.fingerprint)}
                  marking=${markingFp === group.fingerprint}
                />
              `)}
            </div>
          `}
        `}

        ${crashesAt ? html`
          <div class="crashes-freshness">
            <${FreshnessBadge} layer="scan" at=${crashesAt} />
          </div>
        ` : null}
      </div>
    </${Page}>
  `;
}
