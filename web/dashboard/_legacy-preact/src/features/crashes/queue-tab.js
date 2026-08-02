import { html, useState, useEffect, useMemo, useRef } from '../../lib/preact.js';
import {
  ackCrash,
  acknowledgeAllCrashes,
  openModal,
  loadCrashContext,
  fetchCrashesGrouped,
} from '../../state/actions.js';
import { forensicsFindClass } from '../../api/endpoints.js';
import { navigate } from '../../app/router.js';
import {
  EmptyState, Sparkline, Timeline,
} from '../../ui/patterns/index.js';
import { Badge, Button, Toggle, CopyButton, Segmented, TextField } from '../../ui/primitives/index.js';
import {
  buildFixPlan,
  formatConfidenceLabel,
} from '../../domain/crash-fix.js';
import {
  formatAge,
  truncate,
  bareFile,
  leadMember,
  groupTitle,
  kindChip,
  openExternal,
  toast,
  enrichGroups,
  filterEnriched,
  groupEnrichedByDay,
  todayDayKey,
} from './helpers.js';
import { useQueueKeyboard } from '../shared/use-queue-keyboard.js';
import { getCrashesSelection, selectCrash } from '../shared/queue-selection.js';

export { formatAge, enrichGroups, toast } from './helpers.js';

export const KIND_FILTERS = [
  { value: 'all', label: 'All kinds' },
  { value: 'mod', label: 'Mod-related' },
  { value: 'hang', label: 'Server hang' },
  { value: 'host', label: 'Host' },
];

export const DETAIL_PANELS = [
  { value: 'fix', label: 'Fix' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'details', label: 'Details' },
];

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
    return html`
      <div class="crashes-pre-crash crashes-pre-crash--loading">
        <p class="crashes-ctx-loading">Loading context…</p>
      </div>
    `;
  }
  if (!ctx) {
    return html`
      <div class="crashes-pre-crash crashes-pre-crash--empty">
        <p class="crashes-ctx-unavailable">No pre-crash TPS or events for this log yet — Scanning enriches context on the next pass.</p>
      </div>
    `;
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
  const hasSpark = samples.length > 0;
  const hasEvents = timelineItems.length > 0;

  if (!hasSpark && !hasEvents) {
    return html`
      <div class="crashes-pre-crash crashes-pre-crash--empty">
        <p class="crashes-ctx-unavailable">
          ${window_minutes ? `${window_minutes}-minute window scanned — ` : ''}no TPS samples or events recorded.
        </p>
      </div>
    `;
  }

  return html`
    <div class="crashes-pre-crash">
      <div class="crashes-pre-crash__meta">
        ${window_minutes ? html`<${Badge} tone="neutral">${window_minutes}m window</${Badge}>` : null}
        ${hasSpark ? html`<${Badge} tone="neutral">${samples.length} TPS samples</${Badge}>` : null}
        ${hasEvents ? html`<${Badge} tone="neutral">${timelineItems.length} events</${Badge}>` : null}
      </div>
      ${hasSpark ? html`
        <div class="crashes-ctx-spark">
          <div class="crashes-ctx-spark__head">
            <strong>TPS trend</strong>
            <span class="crashes-ctx-metric">
              min ${tpsMin?.toFixed?.(1) ?? tpsMin ?? '—'} · max ${tpsMax?.toFixed?.(1) ?? tpsMax ?? '—'}
            </span>
          </div>
          <${Sparkline} series=${samples} tone="warn" fill=${true} width=${280} height=${44} />
        </div>
      ` : null}
      ${hasEvents ? html`
        <div class="crashes-ctx-events">
          <strong>Events before crash</strong>
          <${Timeline} items=${timelineItems} groupByDay=${false} />
        </div>
      ` : null}
    </div>
  `;
}

function confidenceTone(label) {
  if (label === 'High') return 'ok';
  if (label === 'Medium') return 'warn';
  if (label === 'Low') return 'neutral';
  return 'neutral';
}

function PanelHero({ eyebrow, headline }) {
  return html`
    <div class="crashes-panel__hero">
      <div class="crashes-panel__eyebrow">${eyebrow}</div>
      <p class="crashes-panel__headline">${headline}</p>
    </div>
  `;
}

function PanelBlock({ title, children, hint }) {
  return html`
    <section class="crashes-panel__block">
      <div class="crashes-panel__block-head">
        <h3 class="crashes-panel__block-title">${title}</h3>
        ${hint ? html`<p class="crashes-panel__block-hint">${hint}</p>` : null}
      </div>
      <div class="crashes-panel__block-body">
        ${children}
      </div>
    </section>
  `;
}

function TechRows({ rows }) {
  if (!rows?.length) return null;
  return html`
    <dl class="crashes-tech">
      ${rows.map((row) => html`
        <div class="crashes-tech__row" key=${row.label}>
          <dt>${row.label}</dt>
          <dd>${row.value}</dd>
        </div>
      `)}
    </dl>
  `;
}

function FixPanel({
  plan,
  why,
  conf,
  confInHeader,
  findResult,
  onMarkReviewed,
  marking,
  groupUnreviewed,
  onFindOwningJar,
  findingJar,
}) {
  if (!plan) return null;
  const steps = plan.steps ?? [];
  const stepsText = steps.map((s, i) => `${i + 1}. ${s}`).join('\n');

  return html`
    <div class="crashes-panel crashes-panel--fix">
      <${PanelHero} eyebrow="Do this now" headline=${plan.headline} />

      ${steps.length ? html`
        <ol class="crashes-steps" aria-label="Fix steps">
          ${steps.map((step, i) => html`
            <li class="crashes-step" key=${i}>
              <span class="crashes-step__num" aria-hidden="true">${i + 1}</span>
              <span class="crashes-step__text">${step}</span>
            </li>
          `)}
        </ol>
      ` : null}

      <div class="crashes-cta-row crashes-cta-row--primary">
        ${plan.modrinthUrl ? html`
          <${Button} kind="primary" size="sm" onClick=${() => openExternal(plan.modrinthUrl)}>
            ${plan.modrinthLabel || 'Open Modrinth'}
          </${Button}>
        ` : null}
        <${Button} kind="neutral" size="sm" onClick=${() => navigate('mods', plan.modsTabParams || { view: 'overview' })}>
          Open Mods
        </${Button}>
      </div>

      ${plan.relatedMods?.length ? html`
        <div class="crashes-related-mods">
          <span class="crashes-related-mods__label">Related</span>
          ${plan.relatedMods.map((m) => html`
            <button type="button" class="crashes-related-mods__chip" key=${m.id} onClick=${() => openExternal(m.url)}>
              ${m.id}
            </button>
          `)}
        </div>
      ` : null}

      <div class="crashes-cta-row crashes-cta-row--tools">
        <${Button} kind="neutral" size="sm" loading=${findingJar} onClick=${onFindOwningJar}>
          Find owning jar
        </${Button}>
        <${CopyButton} text=${stepsText} label="Copy steps" />
      </div>

      ${findResult?.matches?.length ? html`
        <div class="crashes-jar-results">
          <div class="crashes-jar-results__label">Owning jar</div>
          <ul class="crashes-jar-results__list">
            ${findResult.matches.slice(0, 5).map((m, i) => html`
              <li key=${i}><code>${m.jar}</code> · ${m.mod_id || '?'}</li>
            `)}
          </ul>
        </div>
      ` : null}

      <div class="crashes-panel__done">
        <${Button}
          kind="neutral"
          size="sm"
          loading=${marking}
          disabled=${!(groupUnreviewed > 0)}
          onClick=${onMarkReviewed}
        >Mark group reviewed</${Button}>
      </div>

      ${why ? html`
        <div class="crashes-panel__footer">
          <div class="crashes-why">
            <div class="crashes-why__label">Why</div>
            <p class="crashes-why__text">${why}</p>
            ${conf && !confInHeader ? html`<p class="crashes-why__meta">${conf} confidence</p>` : null}
          </div>
        </div>
      ` : null}
    </div>
  `;
}

function EvidencePanel({ group, summary, onAckFile }) {
  const lead = leadMember(group);
  const members = group.members ?? [];
  const unreviewed = members.filter((m) => !m.acknowledged).length;
  const headline = lead?.file
    ? `${members.length} file${members.length === 1 ? '' : 's'} in this group · lead ${bareFile(lead.file)}`
    : `${members.length} crash file${members.length === 1 ? '' : 's'} in this group`;

  return html`
    <div class="crashes-panel crashes-panel--evidence">
      <${PanelHero} eyebrow="Evidence" headline=${headline} />

      ${lead?.file ? html`
        <${PanelBlock}
          title="Pre-crash context"
          hint="Live signal from the minutes before this crash"
        >
          <${PreCrashPanel} file=${lead.file} />
        </${PanelBlock}>
      ` : null}

      <${PanelBlock}
        title=${`Crash files (${members.length})`}
        hint=${unreviewed > 0
          ? `${unreviewed} still need review — View log, then mark reviewed`
          : 'All files in this group are marked reviewed'}
      >
        <ul class="crashes-members">
          ${members.map((m) => {
            const isLead = lead && m.file === lead.file;
            return html`
              <li class=${`crashes-members__row${isLead ? ' crashes-members__row--lead' : ''}`} key=${m.file}>
                <div class="crashes-members__info">
                  <span class="crashes-members__file">${m.file}</span>
                  <div class="crashes-members__chips">
                    ${isLead ? html`<${Badge} tone="neutral">lead</${Badge}>` : null}
                    <span class="crashes-members__age">${formatAge(m.time)}</span>
                    ${m.acknowledged
                      ? html`<${Badge} tone="ok">reviewed</${Badge}>`
                      : html`<${Badge} tone="warn">needs review</${Badge}>`}
                  </div>
                </div>
                <div class="crashes-members__actions">
                  <${Button} kind="neutral" size="sm" onClick=${() => openModal('crash-log', { file: m.file })}>
                    View log
                  </${Button}>
                  <${Toggle}
                    checked=${!!m.acknowledged}
                    onChange=${(v) => onAckFile(m.file, v)}
                    label="Reviewed"
                  />
                </div>
              </li>
            `;
          })}
        </ul>
      </${PanelBlock}>

      ${group.incident_ids?.length ? html`
        <div class="crashes-panel__footer">
          <div class="crashes-incident">
            <div class="crashes-incident__label">Linked incident</div>
            <p class="crashes-incident__text">
              ${group.incident_ids.length} linked report${group.incident_ids.length === 1 ? '' : 's'}
              ${summary?.paired_primary_file ? html` · pairs with <code>${summary.paired_primary_file}</code>` : null}
            </p>
          </div>
        </div>
      ` : null}
    </div>
  `;
}

function DetailsPanel({ group, summary }) {
  const lead = leadMember(group);

  const identity = [
    { label: 'Fingerprint', value: html`<code>${group.fingerprint}</code>` },
    summary?.exception ? { label: 'Exception', value: html`<code>${summary.exception}</code>` } : null,
    summary?.failure_kind ? { label: 'Kind', value: summary.failure_kind } : null,
    lead?.file ? { label: 'Lead file', value: html`<code>${lead.file}</code>` } : null,
    summary?.mod_file ? { label: 'Mod file', value: html`<code>${summary.mod_file}</code>` } : null,
  ].filter(Boolean);

  const classification = [
    summary?.matched_rule_id ? {
      label: 'Rule',
      value: html`
        <code>${summary.matched_rule_id}</code>
        ${summary.matched_pack_id ? html` <span class="text-caption">(${summary.matched_pack_id})</span>` : null}
      `,
    } : null,
    summary?.ecosystem ? { label: 'Ecosystem', value: summary.ecosystem } : null,
    summary?.oom_kind ? { label: 'OOM kind', value: summary.oom_kind } : null,
    summary?.java_mismatch ? {
      label: 'Java mismatch',
      value: `compiled ${summary.java_mismatch.compiled_java ?? '?'} / runtime ${summary.java_mismatch.runtime_java ?? '?'}`,
    } : null,
  ].filter(Boolean);

  const mixinsConfig = [
    summary?.mixin_config ? { label: 'Mixin config', value: html`<code>${summary.mixin_config}</code>` } : null,
    summary?.mixin_config_conflict ? { label: 'Conflict config', value: html`<code>${summary.mixin_config_conflict}</code>` } : null,
    summary?.conflict_mod_id ? { label: 'Conflict mod', value: summary.conflict_mod_id } : null,
    summary?.invalid_location ? { label: 'Invalid location', value: html`<code>${summary.invalid_location}</code>` } : null,
    (summary?.config_file || summary?.config_path)
      ? { label: 'Config', value: html`<code>${summary.config_file || summary.config_path}</code>` }
      : null,
  ].filter(Boolean);

  const duplicates = [
    summary?.duplicate_mod_ids ? {
      label: 'Duplicate mods',
      value: html`<code>${Array.isArray(summary.duplicate_mod_ids) ? summary.duplicate_mod_ids.join(', ') : summary.duplicate_mod_ids}</code>`,
    } : null,
    summary?.duplicate_jars ? {
      label: 'Duplicate jars',
      value: html`<code>${Array.isArray(summary.duplicate_jars) ? summary.duplicate_jars.join(', ') : summary.duplicate_jars}</code>`,
    } : null,
    summary?.locked_path ? { label: 'Locked path', value: html`<code>${summary.locked_path}</code>` } : null,
  ].filter(Boolean);

  const sections = [
    { title: 'Identity', hint: 'How this crash group is identified', rows: identity },
    classification.length ? { title: 'Classification', hint: 'Rules and failure signals', rows: classification } : null,
    mixinsConfig.length ? { title: 'Mixins & config', hint: 'Loader and config forensics', rows: mixinsConfig } : null,
    duplicates.length ? { title: 'Duplicates & locks', hint: 'Jar conflicts and locked paths', rows: duplicates } : null,
  ].filter(Boolean);

  return html`
    <div class="crashes-panel crashes-panel--details">
      <${PanelHero}
        eyebrow="Details"
        headline="Technical fields for forensics and rule matching"
      />
      ${sections.map((sec) => html`
        <${PanelBlock} title=${sec.title} hint=${sec.hint} key=${sec.title}>
          <${TechRows} rows=${sec.rows} />
        </${PanelBlock}>
      `)}
    </div>
  `;
}

function GroupDetail({ group, summary, mods, onAckFile, onMarkGroup, marking, panel, onPanelChange }) {
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

  async function handleFindOwningJar() {
    const className = summary?.java_mismatch?.class_name
      || summary?.class_name
      || (summary?.exception || '').replace(/^.*\s([a-zA-Z0-9_$/]+(?:Exception|Error))\b.*/, '$1')
      || null;
    const query = className
      || (summary?.exception || '').match(/([a-z][\w$]+(?:[./][\w$]+)+)/i)?.[1]
      || summary?.primary_mod_id;
    if (!query) {
      toast('No class name available to look up', 'warn');
      return;
    }
    setFindingJar(true);
    try {
      const res = await forensicsFindClass({ class: String(query).replace(/\./g, '/'), include_nested: true });
      setFindResult(res);
      const n = res?.matches?.length ?? 0;
      toast(n ? `Found ${n} owning jar match(es)` : (res?.error || 'No owning jar found'), n ? 'success' : 'warn');
    } catch (e) {
      toast(e?.message || 'Find owning jar failed', 'error');
    } finally {
      setFindingJar(false);
    }
  }

  return html`
    <aside class="crashes-detail">
      <header class="crashes-detail__head">
        <div class="crashes-detail__titles">
          <h2 class="crashes-detail__title">${groupTitle(group, summary)}</h2>
          <p class="crashes-detail__sub">
            <span>${group.count}× · ${formatAge(group.last_at || group.first_at)}</span>
            ${group.unreviewed > 0
              ? html`<${Badge} tone="warn">${group.unreviewed} unreviewed</${Badge}>`
              : html`<${Badge} tone="ok">reviewed</${Badge}>`}
            ${conf ? html`<${Badge} tone=${confidenceTone(conf)}>${conf} confidence</${Badge}>` : null}
          </p>
        </div>
        <${Segmented}
          options=${DETAIL_PANELS}
          value=${panel}
          onChange=${onPanelChange}
          size="sm"
        />
      </header>
      <div class="crashes-detail__body">
        ${panel === 'fix' ? html`
          <${FixPanel}
            plan=${plan}
            why=${why}
            conf=${conf}
            confInHeader=${!!conf}
            findResult=${findResult}
            onMarkReviewed=${onMarkGroup}
            marking=${marking}
            groupUnreviewed=${group.unreviewed}
            onFindOwningJar=${handleFindOwningJar}
            findingJar=${findingJar}
          />
        ` : null}
        ${panel === 'evidence' ? html`
          <${EvidencePanel} group=${group} summary=${summary} onAckFile=${onAckFile} />
        ` : null}
        ${panel === 'details' ? html`
          <${DetailsPanel} group=${group} summary=${summary} />
        ` : null}
      </div>
    </aside>
  `;
}

/**
 * Review / Reviewed queue — inbox-style list + detail split, grouped by day.
 */
export function QueueTab({
  mode,
  enriched,
  mods,
  routeKey,
  onScan,
  scanning,
}) {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [panel, setPanel] = useState('fix');
  const [markingFp, setMarkingFp] = useState(null);
  const [collapsedDays, setCollapsedDays] = useState(() => new Set());
  const searchRef = useRef(null);
  const didSeedFromRoute = useRef(false);
  const didPickDefault = useRef(false);

  const needsReviewOnly = mode === 'review';
  const reviewedOnly = mode === 'reviewed';
  const localFp = getCrashesSelection();

  useEffect(() => {
    didPickDefault.current = false;
    didSeedFromRoute.current = false;
  }, [mode]);

  const filtered = useMemo(
    () => filterEnriched(enriched, { search, kind, needsReviewOnly, reviewedOnly }),
    [enriched, search, kind, needsReviewOnly, reviewedOnly],
  );

  const dayGroups = useMemo(() => groupEnrichedByDay(filtered), [filtered]);
  const todayKey = useMemo(() => todayDayKey(), []);
  const dayKeysSig = dayGroups.map((g) => g.key).join('|');
  const filteredKeys = useMemo(
    () => filtered.map((r) => r.group.fingerprint),
    [filtered],
  );
  const filteredKeysSig = filteredKeys.join('\0');

  useEffect(() => {
    if (didSeedFromRoute.current) return;
    if (!routeKey) {
      didSeedFromRoute.current = true;
      return;
    }
    if (!filteredKeys.length) return;
    didSeedFromRoute.current = true;
    if (filteredKeys.includes(routeKey)) {
      selectCrash(routeKey, { syncUrl: false, view: mode });
      didPickDefault.current = true;
    }
  }, [routeKey, filteredKeysSig, mode]);

  useEffect(() => {
    if (didPickDefault.current) return;
    if (!filteredKeys.length) return;
    if (localFp && filteredKeys.includes(localFp)) {
      didPickDefault.current = true;
      return;
    }
    didPickDefault.current = true;
    // Signal only — never navigate('crashes') from an effect (that trapped the tab).
    selectCrash(filteredKeys[0], { syncUrl: true, view: mode });
  }, [filteredKeysSig, localFp, mode]);

  // Default: only Today expanded (if none today, expand the newest day).
  useEffect(() => {
    const preferred = dayGroups.some((g) => g.key === todayKey)
      ? todayKey
      : (dayGroups[0]?.key ?? null);
    const next = new Set();
    for (const g of dayGroups) {
      if (g.key !== preferred) next.add(g.key);
    }
    setCollapsedDays(next);
  }, [mode, todayKey, dayKeysSig]);

  useEffect(() => {
    setPanel('fix');
  }, [localFp]);

  // Expand the day that contains the selected group (deep links / selection).
  useEffect(() => {
    if (!localFp || !dayGroups.length) return;
    const day = dayGroups.find((g) =>
      g.items.some((r) => r.group.fingerprint === localFp));
    if (!day) return;
    setCollapsedDays((prev) => {
      if (!prev.has(day.key)) return prev;
      const next = new Set(prev);
      next.delete(day.key);
      return next;
    });
  }, [localFp, dayKeysSig]);

  function selectRow(fp) {
    selectCrash(fp, { syncUrl: true, view: mode });
  }

  const selected = filtered.find((r) => r.group.fingerprint === localFp) || null;

  function selectNextAfter(fp) {
    const idx = filtered.findIndex((r) => r.group.fingerprint === fp);
    const remaining = filtered.filter((r) => r.group.fingerprint !== fp);
    if (!remaining.length) {
      selectCrash(null, { syncUrl: true, view: mode });
      return;
    }
    const next = remaining[Math.min(Math.max(idx, 0), remaining.length - 1)];
    selectCrash(next.group.fingerprint, { syncUrl: true, view: mode });
  }

  function toggleDay(dayKey) {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayKey)) next.delete(dayKey);
      else next.add(dayKey);
      return next;
    });
  }

  async function handleAckFile(file, reviewed) {
    await ackCrash(file, reviewed);
    await fetchCrashesGrouped();
  }

  async function handleMarkGroup(fingerprint) {
    setMarkingFp(fingerprint);
    await acknowledgeAllCrashes({ fingerprint });
    setMarkingFp(null);
    if (needsReviewOnly) selectNextAfter(fingerprint);
  }

  useQueueKeyboard({
    enabled: filtered.length > 0,
    searchRef,
    keys: filteredKeys,
    selectedKey: localFp,
    onSelect: selectRow,
    onMarkReviewed: needsReviewOnly
      ? (fp) => {
        if (markingFp) return;
        handleMarkGroup(fp);
      }
      : undefined,
  });

  function renderRow({ group, summary }) {
    const title = groupTitle(group, summary);
    const plan = buildFixPlan(summary, mods);
    const chip = kindChip(group, summary);
    const sevTone = chip.tone === 'danger' ? 'danger' : chip.tone === 'warn' ? 'warn' : 'info';
    const sevLabel = chip.tone === 'danger' ? 'critical' : chip.tone === 'warn' ? 'warning' : 'info';
    const active = selected?.group?.fingerprint === group.fingerprint;
    const cause = truncate(summary?.plain_english || group.label || title, 90);
    const age = formatAge(group.last_at || group.first_at);
    return html`
      <button
        type="button"
        class=${`crashes-row${active ? ' crashes-row--active' : ''}${group.unreviewed ? '' : ' crashes-row--reviewed'}`}
        key=${group.fingerprint}
        role="option"
        aria-selected=${active}
        onClick=${() => selectRow(group.fingerprint)}
      >
        <div class="crashes-row__top">
          <${Badge} tone=${sevTone}>${sevLabel}</${Badge}>
          <span class="crashes-row__title">${title}</span>
          ${age ? html`<span class="crashes-row__age">${age}</span>` : null}
          <${Badge} tone=${chip.tone}>${chip.label}</${Badge}>
          <${Badge} tone="neutral">${group.count}×</${Badge}>
        </div>
        <p class="crashes-row__cause">${cause}${plan.primaryActionPeek ? ` · ${plan.primaryActionPeek}` : ''}</p>
      </button>
    `;
  }

  const chrome = html`
    <div class="feat-queue-chrome crashes-queue__chrome">
      <${TextField}
        icon="search"
        value=${search}
        onInput=${(e) => setSearch(e.target.value)}
        placeholder="Search groups, mods, files… (/)"
        aria-label="Search crashes"
        inputRef=${searchRef}
      />
      <${Segmented} options=${KIND_FILTERS} value=${kind} onChange=${setKind} size="sm" />
      <span class="feat-queue-chrome__count crashes-queue__count">${filtered.length} group${filtered.length === 1 ? '' : 's'}</span>
    </div>
  `;

  if (!enriched.length) {
    return html`
      <${EmptyState}
        title="No crash reports found"
        body="No crash reports have been detected yet. Run a scan from Tools if you expected some."
        action=${html`<${Button} kind="primary" size="sm" loading=${scanning} onClick=${onScan}>Scan now</${Button}>`}
      />
    `;
  }

  if (!filtered.length) {
    return html`
      <div class="crashes-queue">
        ${chrome}
        <${EmptyState}
          title=${needsReviewOnly
            ? "You're clear — nothing needs review"
            : reviewedOnly
              ? 'No reviewed groups yet'
              : 'No matching groups'}
          body=${needsReviewOnly
            ? 'All crash groups are marked reviewed. Open Reviewed to browse history, or Tools to scan again.'
            : reviewedOnly
              ? 'Mark a group reviewed from the Review tab and it will show up here.'
              : 'Try a different kind filter or clear the search.'}
          action=${needsReviewOnly ? html`
            <div class="crashes-empty-actions">
              <${Button} kind="neutral" size="sm" onClick=${() => navigate('crashes', { view: 'reviewed' })}>Open Reviewed</${Button}>
              <${Button} kind="neutral" size="sm" onClick=${() => navigate('crashes', { view: 'tools' })}>Open Tools</${Button}>
            </div>
          ` : reviewedOnly ? html`
            <${Button} kind="neutral" size="sm" onClick=${() => navigate('crashes', { view: 'review' })}>Open Review</${Button}>
          ` : null}
        />
      </div>
    `;
  }

  return html`
    <div class="crashes-queue crashes-queue--split">
      ${chrome}

      <div class="crashes-split">
        <div class="crashes-split__list crashes-inbox" role="listbox" aria-label="Crash groups by day">
          ${dayGroups.map(({ key, label, items }) => {
            const expanded = !collapsedDays.has(key);
            const unrev = items.reduce((n, r) => n + (r.group.unreviewed > 0 ? 1 : 0), 0);
            return html`
              <section class=${`crashes-day${expanded ? ' crashes-day--open' : ''}${key === todayKey ? ' crashes-day--today' : ''}`} key=${key}>
                <button
                  type="button"
                  class="crashes-day__header"
                  aria-expanded=${expanded}
                  onClick=${() => toggleDay(key)}
                >
                  <span class="crashes-day__chevron" aria-hidden="true">${expanded ? '▾' : '▸'}</span>
                  <span class="crashes-day__label">${label}</span>
                  <span class="crashes-day__counts">
                    ${unrev > 0 ? html`<${Badge} tone="warn">${unrev}</${Badge}>` : null}
                    <${Badge} tone="neutral">${items.length}</${Badge}>
                  </span>
                </button>
                ${expanded ? html`
                  <div class="crashes-day__items">
                    ${items.map((row) => renderRow(row))}
                  </div>
                ` : null}
              </section>
            `;
          })}
        </div>

        ${selected ? html`
          <${GroupDetail}
            group=${selected.group}
            summary=${selected.summary}
            mods=${mods}
            onAckFile=${handleAckFile}
            onMarkGroup=${() => handleMarkGroup(selected.group.fingerprint)}
            marking=${markingFp === selected.group.fingerprint}
            panel=${panel}
            onPanelChange=${setPanel}
          />
        ` : html`
          <aside class="crashes-detail crashes-detail--empty">
            <${EmptyState} title="Select a crash group" body="Pick a group on the left to see the fix plan." />
          </aside>
        `}
      </div>
    </div>
  `;
}
