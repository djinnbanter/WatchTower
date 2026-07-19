/**
 * Issues Active / Reviewed — permanent list + detail split.
 */
import { html, useState, useEffect, useMemo } from '../../lib/preact.js';
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
        ${item.docUrl ? html`
          <a class="issues-fix__doc" href=${item.docUrl} target="_blank" rel="noopener noreferrer">
            Open mod docs
            <${Icon} name="external-link" size=${12} />
          </a>
        ` : null}
      </div>

      ${!isCrash && steps.length ? html`
        <div class="crashes-cta-row crashes-cta-row--tools">
          <${CopyButton} text=${stepsText} label="Copy steps" />
        </div>
      ` : null}

      <div class="crashes-panel__done">
        ${reviewed
          ? html`<${Button} kind="neutral" size="sm" onClick=${() => onUnack(item.key)}>Undo</${Button}>`
          : html`
            <div class="issues-panel__done-actions">
              <${Button} kind="neutral" size="sm" loading=${marking} onClick=${handleDone}>
                ${isCrash ? 'Mark crashes reviewed' : 'Mark reviewed'}
              </${Button}>
              ${item.issueId && onSuppress ? html`
                <${Button} kind="neutral" size="sm" onClick=${() => onSuppress(item.issueId)}>
                  Don't show again
                </${Button}>
              ` : null}
            </div>
          `}
      </div>

      ${why && !reviewed ? html`
        <div class="crashes-panel__footer">
          <div class="crashes-why">
            <div class="crashes-why__label">Why</div>
            <p class="crashes-why__text">${why}</p>
          </div>
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
      ${item.summary ? html`
        <${PanelBlock} title="Summary" hint="What happened and why it matters">
          <p class="issues-panel__prose">${item.summary}</p>
          ${item.detail && item.detail !== item.summary
            ? html`<p class="issues-panel__prose issues-panel__prose--muted">${item.detail}</p>`
            : null}
        </${PanelBlock}>
      ` : null}
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
    : '';
  const age = formatAge(item.when) || formatAge(item.ackedAt);
  const crashPeek = item.kind === 'crash'
    ? (item.raw?.meta?.unreviewed_groups != null
      ? `${item.raw.meta.unreviewed_groups} group${item.raw.meta.unreviewed_groups === 1 ? '' : 's'}`
      : 'Open Crashes')
    : null;

  return html`
    <button
      type="button"
      class=${`issues-row${active ? ' issues-row--active' : ''}${reviewed ? ' issues-row--reviewed' : ''}`}
      role="option"
      aria-selected=${active}
      onClick=${() => onSelect(item.key)}
    >
      <div class="issues-row__top">
        <span class="issues-row__title">${item.title}</span>
        <${Badge} tone=${tone}>${reviewed ? 'reviewed' : item.severity}</${Badge}>
        <${Badge} tone="neutral">${sourceLabel(item.source)}</${Badge}>
      </div>
      ${peek ? html`<p class="issues-row__cause">${peek}</p>` : null}
      <div class="issues-row__meta">
        ${age ? html`<span>${age}</span>` : null}
        ${crashPeek ? html`<span class="issues-row__peek">${crashPeek}</span>` : null}
        ${item.primaryAction && !crashPeek
          ? html`<span class="issues-row__peek">${item.primaryAction.label}</span>`
          : null}
      </div>
    </button>
  `;
}

/**
 * @param {'active'|'reviewed'} mode
 */
export function QueueTab({
  mode,
  items,
  selectedKey,
  onSelect,
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

  const reviewed = mode === 'reviewed';
  const filtered = useMemo(
    () => filterItems(items, { search, source }),
    [items, search, source],
  );

  const bands = useMemo(
    () => (reviewed ? [{ key: 'reviewed', label: 'Marked reviewed', tone: 'ok', items: filtered }] : groupByBand(filtered)),
    [filtered, reviewed],
  );

  const bandKeysSig = bands.map((b) => b.key).join('|');

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
  }, [selectedKey, bands]);

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedKey && filtered.some((i) => i.key === selectedKey)) return;
    if (selectedKey) return;
    onSelect(filtered[0].key);
  }, [filtered, selectedKey, onSelect]);

  const selected = filtered.find((i) => i.key === selectedKey) || null;

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
    } finally {
      setMarking(false);
    }
  }

  async function handleAckCrash() {
    setMarking(true);
    try {
      await onAckCrash();
    } finally {
      setMarking(false);
    }
  }

  const chrome = html`
    <div class="feat-queue-chrome issues-queue__chrome">
      <${TextField}
        icon="search"
        value=${search}
        onInput=${(e) => setSearch(e.target.value)}
        placeholder="Search issues…"
        aria-label="Search issues"
      />
      <${Segmented} options=${SOURCE_FILTERS} value=${source} onChange=${setSource} size="sm" />
      <span class="feat-queue-chrome__count issues-queue__count">${filtered.length} issue${filtered.length === 1 ? '' : 's'}</span>
    </div>
  `;

  if (!items.length) {
    return html`
      <${EmptyState}
        title=${reviewed ? 'No reviewed issues yet' : noReport ? 'No report yet' : 'All clear'}
        body=${reviewed
          ? 'Mark items reviewed on the Active tab. They’ll land here so you can undo later if needed.'
          : noReport
            ? 'Run a report to populate the fix queue. Live peek alerts will also appear here when the ops scan finds them.'
            : 'No active issues detected. Peek at Live charts or Insights if you want a deeper look.'}
        action=${reviewed ? html`
          <${Button} kind="neutral" size="sm" onClick=${() => navigate('issues', { view: 'active' })}>
            Back to Active
          </${Button}>
        ` : noReport ? html`
          <${Button} kind="accent" size="sm" onClick=${() => openModal('run-report')}>Run Report</${Button}>
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
                        key=${item.key}
                        item=${item}
                        active=${selected?.key === item.key}
                        reviewed=${reviewed}
                        onSelect=${onSelect}
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
