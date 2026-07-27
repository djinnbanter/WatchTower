import { html } from '../../lib/preact.js';
import { dataSources, live, opsCache, reports, settings } from '../../state/stores.js';
import { Page, Section, KeyValue, FreshnessBadge, DataTable } from '../../ui/patterns/index.js';
import { Badge, Card } from '../../ui/primitives/index.js';
import { dataSourcesExplainer } from '../../domain/labels.js';
import { formatAge, ageMs } from '../../domain/freshness.js';

function relAge(at) {
  if (!at) return '—';
  const ms = ageMs(at, Date.now());
  return formatAge(ms);
}

function formatMinutesInterval(min) {
  if (min == null) return '—';
  if (min === -1) return 'Off';
  if (min >= 60) {
    const hours = min / 60;
    const rounded = Number.isInteger(hours) ? hours : Math.round(hours * 10) / 10;
    return `~${rounded} ${rounded === 1 ? 'hour' : 'hours'}`;
  }
  return `~${min}min`;
}

function formatCadenceMinutes(min) {
  if (min == null) return 'Scheduled';
  if (min === -1 || min === 0) return 'Off';
  if (min >= 60) {
    const hours = min / 60;
    const rounded = Number.isInteger(hours) ? hours : Math.round(hours * 10) / 10;
    return `Every ${rounded} ${rounded === 1 ? 'hour' : 'hours'}`;
  }
  return `Every ${min}min`;
}

function StatusDot({ ok }) {
  const cls = ok ? 'feat-src-dot feat-src-dot--ok' : 'feat-src-dot feat-src-dot--off';
  return html`<span class=${cls} aria-hidden="true"></span>`;
}

function LayerCard({ title, description, at, layer, cadenceLabel, detail }) {
  const age = relAge(at);
  const connected = !!at;

  return html`
    <${Card} className="feat-src-card" padding="16">
      <div class="feat-src-card__header">
        <${StatusDot} ok=${connected} />
        <h3 class="feat-src-card__title">${title}</h3>
        <${FreshnessBadge} layer=${layer} at=${at} />
      </div>
      <p class="feat-src-card__desc ui-text-low">${description}</p>
      <div class="feat-src-card__meta">
        <span class="feat-src-card__age">${connected ? `Last update: ${age}` : 'Not connected'}</span>
        ${cadenceLabel && html`<${Badge} tone="neutral">${cadenceLabel}</${Badge}>`}
      </div>
      ${detail && html`<p class="feat-src-card__detail ui-text-low">${detail}</p>`}
    </${Card}>
  `;
}

function ExplainerTable() {
  const { intro, footer, rows } = dataSourcesExplainer();

  const cols = [
    { key: 'area', label: 'Data area' },
    {
      key: 'live',
      label: 'Watching',
      align: 'center',
      render: (v) => v ? html`<span class="feat-src-check">✓</span>` : html`<span class="feat-src-dash">—</span>`,
    },
    {
      key: 'scan',
      label: 'Scanning',
      align: 'center',
      render: (v) => v ? html`<span class="feat-src-check">✓</span>` : html`<span class="feat-src-dash">—</span>`,
    },
    {
      key: 'report',
      label: 'Support compose',
      align: 'center',
      render: (v) => v ? html`<span class="feat-src-check">✓</span>` : html`<span class="feat-src-dash">—</span>`,
    },
  ];

  return html`
    <div class="feat-src-explainer">
      <p class="ui-text-mid" dangerouslySetInnerHTML=${{ __html: intro }}></p>
      <${DataTable}
        columns=${cols}
        rows=${rows}
        rowKey="area"
        density=${36}
      />
      <p class="ui-text-low feat-hint">${footer}</p>
    </div>
  `;
}

export function PageView() {
  const {
    liveAt, scanAt, reportAt, supportComposeAt, issuesLiveAt, nextScheduledMin, opsPollSec, opsLogScanSec,
  } = dataSources.value;
  const { at: liveSignalAt } = live.value;
  const { at: opsCacheAt } = opsCache.value;
  const { index: reportIndex } = reports.value;
  const settingsData = settings.value.data;

  const effectiveLiveAt = liveAt ?? liveSignalAt;
  const effectiveScanAt = scanAt ?? opsCacheAt;
  const effectiveIssuesAt = issuesLiveAt ?? opsCacheAt;
  const effectiveReportAt = reportAt ?? (reportIndex?.[0]?.generated_at ?? null);
  const effectiveSupportAt = supportComposeAt ?? null;

  const scheduleOff = nextScheduledMin === -1
    || settingsData?.schedule === 'off'
    || settingsData?.report_interval_minutes === -1
    || settingsData?.report_interval_minutes === 0;

  const reportCadence = scheduleOff
    ? 'Off'
    : formatCadenceMinutes(settingsData?.report_interval_minutes ?? nextScheduledMin);

  const scanCadence = opsLogScanSec
    ? `~${opsLogScanSec}s`
    : opsPollSec
      ? `~${opsPollSec}s`
      : '~60s';

  const monitoringKvItems = [
    {
      key: 'Watching sample rate',
      value: settingsData?.live_sample_interval_sec
        ? `${settingsData.live_sample_interval_sec}s`
        : 'From server config',
    },
    { key: 'Scanning cadence', value: scanCadence },
    { key: 'Legacy report schedule', value: reportCadence },
    {
      key: 'Next scheduled report',
      value: scheduleOff ? 'Off' : formatMinutesInterval(nextScheduledMin),
    },
    {
      key: 'Issues live',
      value: effectiveIssuesAt ? `Updated ${relAge(effectiveIssuesAt)}` : 'Waiting for first scan',
    },
  ];

  return html`
    <${Page}
      tour="sources"
      title="Data Sources"
      subtitle="Watching, Scanning, and Support compose"
    >
      <${Section} title="Source layers" defaultOpen=${true}>
        <div class="feat-src-cards">
          <${LayerCard}
            title="Watching"
            description="Live vitals while the server runs — TPS, MSPT, heap, and players. Updates charts every few seconds while the dashboard is open."
            at=${effectiveLiveAt}
            layer="live"
            cadenceLabel="~1–5s"
          />
          <${LayerCard}
            title="Scanning"
            description="Background ops scan — crashes, activity, continuous Issues (issues_live), mod log errors, and backup status — even when nobody has the UI open."
            at=${effectiveScanAt}
            layer="scan"
            cadenceLabel=${scanCadence}
            detail=${effectiveIssuesAt
              ? `Issues live last update: ${relAge(effectiveIssuesAt)}`
              : 'Issues live waiting for first ops tick'}
          />
          <${LayerCard}
            title="Support compose"
            description="On-demand zip from continuous stores — rail Support, Settings → Advanced, or /watchtower run."
            at=${effectiveSupportAt}
            layer="report"
            cadenceLabel="On request"
          />
        </div>
      </${Section}>

      <${Section} title="Monitoring cadence" defaultOpen=${false}>
        <${KeyValue} items=${monitoringKvItems} columns=${2} />
        <p class="feat-hint ui-text-low" style="margin-top:12px">
          Legacy report schedule (optional) is configured in
          <code>watchtower.conf</code> or via <code>/watchtower schedule</code> —
          not in Settings. Support bundle: Settings → Advanced or rail Support.
        </p>
      </${Section}>

      <${Section} title="What each layer covers" defaultOpen=${true}>
        <${ExplainerTable} />
      </${Section}>
    </${Page}>
  `;
}
