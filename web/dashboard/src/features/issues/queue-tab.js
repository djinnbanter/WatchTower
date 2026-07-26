/**
 * Issues Active / Reviewed — permanent list + detail split.
 * Selection lives in module state (getIssuesSelection) — not useState, not a
 * Preact signal, and not URL-as-authority — so kickRender cannot dual-update
 * and detach the live DOM (that froze selection / trapped the tab).
 */
import { html, useState, useEffect, useMemo, useRef } from '../../lib/preact.js';
import { setRoute } from '../../state/stores.js';
import { openModal } from '../../state/actions.js';
import { navigate } from '../../app/router.js';
import { EmptyState } from '../../ui/patterns/index.js';
import { Badge, Button, CopyButton, Segmented, TextField } from '../../ui/primitives/index.js';
import { Icon } from '../../ui/icons.js';
import { formatTps, formatMspt } from '../../domain/formats.js';
import {
  SOURCE_FILTERS,
  DETAIL_PANELS,
  severityTone,
  sourceLabel,
  confidenceTone,
  filterItems,
  groupByBand,
  formatAge,
  runPrimaryAction,
} from './helpers.js';
import { useQueueKeyboard } from '../shared/use-queue-keyboard.js';
import { getIssuesSelection, selectIssue } from '../shared/queue-selection.js';

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
  item,
  reviewed,
  onAck,
  onUnack,
  onSuppress,
  onAckCrash,
  marking,
}) {
  const steps = (item.steps?.length ? item.steps : null)
    || (item.hints?.length ? item.hints : []);
  const stepsText = steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const isCrash = item.kind === 'crash';
  const headline = isCrash
    ? 'Open Crashes for the numbered fix plan'
    : (item.summary || item.title);
  const why = item.hints?.length && item.steps?.length
    ? item.hints.join(' · ')
    : (item.detail && item.detail !== item.summary ? item.detail : null);

  function goPrimary() {
    runPrimaryAction(item.primaryAction, { setRoute, openModal, navigate });
  }

  async function handleDone() {
    if (isCrash) {
      await onAckCrash();
      return;
    }
    await onAck(item.key);
  }

  return html`
    <div class="crashes-panel crashes-panel--fix">
      <${PanelHero}
        eyebrow=${reviewed ? 'Reviewed' : 'Do this next'}
        headline=${headline}
      />

      ${!isCrash && steps.length ? html`
        <ol class="crashes-steps" aria-label="Fix steps">
          ${steps.map((step, i) => html`
            <li class="crashes-step" key=${i}>
              <span class="crashes-step__num" aria-hidden="true">${i + 1}</span>
              <span class="crashes-step__text">${step}</span>
            </li>
          `)}
        </ol>
      ` : null}

      ${isCrash ? html`
        <p class="issues-panel__crash-hint">
          Crash groups get Fix · Evidence · Details on the Crashes tab. Issues only tracks that review is still open.
        </p>
      ` : null}

      <div class="crashes-cta-row crashes-cta-row--primary">
        ${item.primaryAction ? html`
          <${Button} kind="primary" size="sm" onClick=${goPrimary}>
            ${item.primaryAction.label}
          </${Button}>
        ` : null}
        ${item.sparkProfilePath ? html`
          <${Button}
            kind="neutral"
            size="sm"
            onClick=${() => navigate('spark', { profile: item.sparkProfilePath })}
          >
            Open in Spark
          </${Button}>
        ` : null}
        ${!reviewed ? html`
          <${Button} kind="accent" size="sm" loading=${marking} onClick=${handleDone}>
            Mark reviewed
          </${Button}>
        ` : html`
          <${Button} kind="neutral" size="sm" onClick=${() => onUnack(item.key)}>
            Move to Active
          </${Button}>
        `}
        ${stepsText ? html`<${CopyButton} text=${stepsText} label="Copy steps" size="sm" />` : null}
      </div>

      ${!reviewed && item.issueId ? html`
        <div class="crashes-cta-row crashes-cta-row--tools">
          <${Button} kind="neutral" size="sm" onClick=${() => onSuppress(item.issueId)}>
            Hide from Active
          </${Button}>
        </div>
      ` : null}

      ${why ? html`
        <div class="crashes-why">
          <div class="crashes-why__label">Why</div>
          <p class="crashes-why__text">${why}</p>
        </div>
      ` : null}
    </div>
  `;
}

function DetailsPanel({ item }) {
  const rows = [
    { label: 'Key', value: item.key },
    { label: 'Source', value: sourceLabel(item.source) },
    { label: 'Kind', value: item.kind },
    { label: 'Severity', value: item.severity },
    item.issueId ? { label: 'Issue id', value: item.issueId } : null,
    item.when ? { label: 'When', value: new Date(item.when).toLocaleString() } : null,
    item.ackedAt ? { label: 'Reviewed', value: new Date(item.ackedAt).toLocaleString() } : null,
    item.primarySuspect ? { label: 'Suspect', value: item.primarySuspect } : null,
    item.sparkProfilePath ? { label: 'Spark profile', value: item.sparkProfilePath } : null,
    item.sparkAutoCaptureStatus ? { label: 'Auto-capture', value: item.sparkAutoCaptureStatus } : null,
  ].filter(Boolean);

  const m = item.metrics;
  const metricRows = m ? [
    { label: 'TPS', value: formatTps(m.tps) },
    { label: 'MSPT', value: formatMspt(m.mspt) },
    { label: 'Players', value: String(m.players_online ?? 0) },
  ] : [];

  return html`
    <div class="crashes-panel crashes-panel--details">
      <${PanelHero}
        eyebrow="Details"
        headline="Identity and context for this finding"
      />
      <${PanelBlock} title="Identity" hint="Stable keys for acks and deep links">
        <${TechRows} rows=${rows} />
      </${PanelBlock}>
      ${metricRows.length ? html`
        <${PanelBlock} title="Live metrics" hint="From the latest lag peek">
          <${TechRows} rows=${metricRows} />
        </${PanelBlock}>
      ` : null}
    </div>
  `;
}

function IssueDetail({
  item,
  reviewed,
  panel,
  onPanelChange,
  onAck,
  onUnack,
  onSuppress,
  onAckCrash,
  marking,
}) {
  const tone = reviewed ? 'neutral' : severityTone(item.severity);
  const age = formatAge(item.when) || formatAge(item.ackedAt);

  return html`
    <aside class="crashes-detail issues-detail">
      <header class="crashes-detail__head">
        <div class="crashes-detail__titles">
          <h2 class="crashes-detail__title">${item.title}</h2>
          <p class="crashes-detail__sub">
            <${Badge} tone=${tone}>${reviewed ? 'reviewed' : item.severity}</${Badge}>
            <${Badge} tone="neutral">${sourceLabel(item.source)}</${Badge}>
            ${age ? html`<span>${age}</span>` : null}
            ${item.confidence && !reviewed
              ? html`<${Badge} tone=${confidenceTone(item.confidence)}>${item.confidence} confidence</${Badge}>`
              : null}
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
            item=${item}
            reviewed=${reviewed}
            onAck=${onAck}
            onUnack=${onUnack}
            onSuppress=${onSuppress}
            onAckCrash=${onAckCrash}
            marking=${marking}
          />
        ` : html`
          <${DetailsPanel} item=${item} />
        `}
      </div>
    </aside>
  `;
}

function IssueRow({ item, active, reviewed, onSelect }) {
  const tone = reviewed ? 'neutral' : severityTone(item.severity);
  const peek = item.summary
    ? (item.summary.length > 90 ? `${item.summary.slice(0, 87)}…` : item.summary)
    : (item.kind === 'crash'
      ? (item.raw?.meta?.unreviewed_groups != null
        ? `${item.raw.meta.unreviewed_groups} group${item.raw.meta.unreviewed_groups === 1 ? '' : 's'} need review`
        : 'Open Crashes for the fix plan')
      : (item.primaryAction?.label || ''));
  const age = formatAge(item.when) || formatAge(item.ackedAt);

  return html`
    <button
      type="button"
      class=${`issues-row${active ? ' issues-row--active' : ''}${reviewed ? ' issues-row--reviewed' : ''}`}
      role="option"
      aria-selected=${active ? 'true' : 'false'}
      data-issue-key=${item.key}
      onClick=${() => onSelect(item.key)}
    >
      <div class="issues-row__top">
        <${Badge} tone=${tone}>${reviewed ? 'reviewed' : item.severity}</${Badge}>
        <span class="issues-row__title">${item.title}</span>
        ${age ? html`<span class="issues-row__age">${age}</span>` : null}
        <${Badge} tone="neutral">${sourceLabel(item.source)}</${Badge}>
        ${item.sparkChip ? html`<${Badge} tone="info">${item.sparkChip}</${Badge}>` : null}
      </div>
      ${peek ? html`<p class="issues-row__cause">${peek}</p>` : null}
    </button>
  `;
}

/**
 * @param {'active'|'reviewed'} mode
 */
export function QueueTab({
  mode,
  items,
  routeKey,
  onAck,
  onUnack,
  onSuppress,
  onAckCrash,
  onOpenTools,
  noReport,
}) {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [panel, setPanel] = useState('fix');
  const [marking, setMarking] = useState(false);
  const [collapsed, setCollapsed] = useState(() => new Set(['older']));
  const searchRef = useRef(null);
  const didSeedFromRoute = useRef(false);
  const didPickDefault = useRef(false);

  const reviewed = mode === 'reviewed';
  const selectedKey = getIssuesSelection();

  const filtered = useMemo(
    () => filterItems(items, { search, source }),
    [items, search, source],
  );

  const bands = useMemo(
    () => (reviewed ? [{ key: 'reviewed', label: 'Marked reviewed', tone: 'ok', items: filtered }] : groupByBand(filtered)),
    [filtered, reviewed],
  );

  const bandKeysSig = bands.map((b) => b.key).join('|');
  const filteredKeys = useMemo(() => filtered.map((i) => i.key), [filtered]);
  const filteredKeysSig = filteredKeys.join('\0');

  // Mode switch: allow a fresh default pick; keep selection if still in the list.
  useEffect(() => {
    didPickDefault.current = false;
    didSeedFromRoute.current = false;
  }, [mode]);

  // Deep-link seed once per mode (URL → signal). Never the other way as authority.
  useEffect(() => {
    if (didSeedFromRoute.current) return;
    if (!routeKey) {
      didSeedFromRoute.current = true;
      return;
    }
    if (!filteredKeys.length) return;
    didSeedFromRoute.current = true;
    if (filteredKeys.includes(routeKey)) {
      selectIssue(routeKey, { syncUrl: false, view: mode });
      didPickDefault.current = true;
    }
  }, [routeKey, filteredKeysSig, mode]);

  // Default pick once when the list has rows — signal only, no navigate.
  useEffect(() => {
    if (didPickDefault.current) return;
    if (!filteredKeys.length) return;
    if (selectedKey && filteredKeys.includes(selectedKey)) {
      didPickDefault.current = true;
      return;
    }
    didPickDefault.current = true;
    selectIssue(filteredKeys[0], { syncUrl: true, view: mode });
  }, [filteredKeysSig, selectedKey, mode]);

  useEffect(() => {
    if (reviewed) {
      setCollapsed(new Set());
      return;
    }
    const next = new Set();
    const hasNeeds = bands.some((b) => b.key === 'needs');
    for (const b of bands) {
      if (b.key === 'older') next.add(b.key);
      if (b.key === 'watching' && hasNeeds) next.add(b.key);
    }
    setCollapsed(next);
  }, [mode, bandKeysSig]);

  useEffect(() => {
    setPanel('fix');
  }, [selectedKey]);

  useEffect(() => {
    if (!selectedKey || !bands.length) return;
    const band = bands.find((g) => g.items.some((i) => i.key === selectedKey));
    if (!band) return;
    setCollapsed((prev) => {
      if (!prev.has(band.key)) return prev;
      const next = new Set(prev);
      next.delete(band.key);
      return next;
    });
  }, [selectedKey, bandKeysSig]);

  const selected = filtered.find((i) => i.key === selectedKey) || null;

  function selectRow(key) {
    selectIssue(key, { syncUrl: true, view: mode });
  }

  function selectNextAfter(key) {
    const idx = filtered.findIndex((i) => i.key === key);
    const remaining = filtered.filter((i) => i.key !== key);
    if (!remaining.length) {
      selectIssue(null, { syncUrl: true, view: mode });
      return;
    }
    const next = remaining[Math.min(Math.max(idx, 0), remaining.length - 1)];
    selectIssue(next.key, { syncUrl: true, view: mode });
  }

  function toggleBand(key) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleAck(key) {
    setMarking(true);
    try {
      await onAck(key);
      selectNextAfter(key);
    } finally {
      setMarking(false);
    }
  }

  async function handleAckCrash() {
    setMarking(true);
    try {
      await onAckCrash();
      if (selectedKey) selectNextAfter(selectedKey);
    } finally {
      setMarking(false);
    }
  }

  useQueueKeyboard({
    enabled: filtered.length > 0,
    searchRef,
    keys: filteredKeys,
    selectedKey,
    onSelect: selectRow,
    onMarkReviewed: reviewed ? undefined : (key) => {
      const item = filtered.find((i) => i.key === key);
      if (!item || marking) return;
      if (item.kind === 'crash') handleAckCrash();
      else handleAck(key);
    },
  });

  const chrome = html`
    <div class="feat-queue-chrome issues-queue__chrome">
      <${TextField}
        icon="search"
        value=${search}
        onInput=${(e) => setSearch(e.target.value)}
        placeholder="Search issues… (/)"
        aria-label="Search issues"
        inputRef=${searchRef}
      />
      <${Segmented} options=${SOURCE_FILTERS} value=${source} onChange=${setSource} size="sm" />
      <span class="feat-queue-chrome__count issues-queue__count">${filtered.length} issue${filtered.length === 1 ? '' : 's'}</span>
    </div>
  `;

  if (!items.length) {
    return html`
      <${EmptyState}
        title=${reviewed ? 'No reviewed issues yet' : noReport ? 'Waiting for scans…' : 'All clear'}
        body=${reviewed
          ? 'Mark items reviewed on the Active tab. They’ll land here so you can undo later if needed.'
          : noReport
            ? 'Continuous Scanning will populate this queue from ops peeks and live issues. No deep audit required for day-to-day triage.'
            : 'No active issues detected. Peek at Live charts or Insights if you want a deeper look.'}
        action=${reviewed ? html`
          <${Button} kind="neutral" size="sm" onClick=${() => navigate('issues', { view: 'active' })}>
            Back to Active
          </${Button}>
        ` : noReport ? html`
          <div class="issues-empty-actions">
            <${Button} kind="accent" size="sm" onClick=${() => navigate('live')}>Open Live</${Button}>
            <${Button} kind="neutral" size="sm" onClick=${() => navigate('sources')}>Sources</${Button}>
          </div>
        ` : html`
          <div class="issues-empty-actions">
            <${Button} kind="neutral" size="sm" onClick=${() => navigate('live')}>Open Live</${Button}>
            <${Button} kind="neutral" size="sm" onClick=${() => navigate('insights')}>Open Insights</${Button}>
            ${onOpenTools ? html`
              <${Button} kind="neutral" size="sm" onClick=${onOpenTools}>Open Tools</${Button}>
            ` : null}
          </div>
        `}
      />
    `;
  }

  if (!filtered.length) {
    return html`
      <div class="issues-queue">
        ${chrome}
        <${EmptyState}
          title="No matching issues"
          body="Try a different source filter or clear the search."
        />
      </div>
    `;
  }

  return html`
    <div class="issues-queue issues-queue--split">
      ${chrome}

      <div class="issues-split">
        <div class="issues-split__list issues-inbox" role="listbox" aria-label=${reviewed ? 'Reviewed issues' : 'Active issues by priority'}>
          ${bands.map(({ key, label, tone, items: bandItems }) => {
            const expanded = !collapsed.has(key);
            return html`
              <section class=${`issues-band${expanded ? ' issues-band--open' : ''}${key === 'needs' ? ' issues-band--needs' : ''}`} key=${key}>
                <button
                  type="button"
                  class="issues-band__header"
                  aria-expanded=${expanded}
                  onClick=${() => toggleBand(key)}
                >
                  <span class="issues-band__chevron" aria-hidden="true">${expanded ? '▾' : '▸'}</span>
                  <span class="issues-band__label">${label}</span>
                  <span class="issues-band__counts">
                    <${Badge} tone=${tone}>${bandItems.length}</${Badge}>
                  </span>
                </button>
                ${expanded ? html`
                  <div class="issues-band__items">
                    ${bandItems.map((item) => html`
                      <${IssueRow}
                        key=${`row:${item.key}`}
                        item=${item}
                        active=${selectedKey === item.key}
                        reviewed=${reviewed}
                        onSelect=${selectRow}
                      />
                    `)}
                  </div>
                ` : null}
              </section>
            `;
          })}
        </div>

        ${selected ? html`
          <${IssueDetail}
            key=${selected.key}
            item=${selected}
            reviewed=${reviewed}
            panel=${panel}
            onPanelChange=${setPanel}
            onAck=${handleAck}
            onUnack=${onUnack}
            onSuppress=${onSuppress}
            onAckCrash=${handleAckCrash}
            marking=${marking}
          />
        ` : html`
          <aside class="crashes-detail crashes-detail--empty issues-detail">
            <${EmptyState} title="Select an issue" body="Pick an item on the left to see what to do next." />
          </aside>
        `}
      </div>
    </div>
  `;
}
