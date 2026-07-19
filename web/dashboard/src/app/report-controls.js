import { html, useState } from '../lib/preact.js';
import { reports } from '../state/stores.js';
import { now } from '../state/clock.js';
import { runReport, openModal, closeModal, selectReport, addToast } from '../state/actions.js';
import { supportBundle } from '../api/endpoints.js';
import { isEmbedded } from '../api/index.js';
import { Button } from '../ui/primitives/button.js';
import { Toggle } from '../ui/primitives/toggle.js';
import { Segmented } from '../ui/primitives/segmented.js';
import { Spinner } from '../ui/primitives/spinner.js';
import { Icon } from '../ui/icons.js';

const LOOKBACK_OPTIONS = [
  { value: '24', label: '24h' },
  { value: '48', label: '48h' },
  { value: '168', label: '7d' },
  { value: '720', label: '30d' },
];

export const REPORT_STAGES = [
  { id: 'window', label: 'Computing time window' },
  { id: 'collect', label: 'Collecting logs, crashes, mods, host metrics' },
  { id: 'analyze', label: 'Analyzing health and crashes' },
  { id: 'enrich', label: 'Enriching incidents and scorecard' },
  { id: 'write', label: 'Writing facts and brief' },
  { id: 'finalize', label: 'Saving state and ops cache' },
];

function stageIndex(stageId) {
  if (!stageId) return -1;
  return REPORT_STAGES.findIndex((s) => s.id === stageId);
}

function stageStatus(stageId, activeId, running, success) {
  const idx = stageIndex(stageId);
  const activeIdx = stageIndex(activeId);
  if (!running && success === true) return 'done';
  if (!running && success === false && idx <= activeIdx) return 'done';
  if (!running && success === false && idx > activeIdx) return 'pending';
  if (idx < activeIdx) return 'done';
  if (idx === activeIdx) return 'active';
  return 'pending';
}

function formatElapsed(startedAt, nowMs) {
  if (startedAt == null) return null;
  const sec = Math.max(0, Math.floor((nowMs - Number(startedAt)) / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function ReportStageChecklist({ run }) {
  if (!run.running && run.success == null) return null;

  const activeId = run.stage || REPORT_STAGES[0].id;
  const activeLabel = run.stageLabel || REPORT_STAGES.find((s) => s.id === activeId)?.label;
  const detail = run.stageDetail || null;
  const elapsed = run.running ? formatElapsed(run.startedAt, now.value) : null;
  const stepNum = Math.max(1, stageIndex(activeId) + 1);

  return html`
    <div class="ui-report-stages" role="status" aria-live="polite">
      ${run.running ? html`
        <div class="ui-report-stages__meta">
          <span>Step ${stepNum} of ${REPORT_STAGES.length}</span>
          ${elapsed ? html`<span class="ui-report-stages__elapsed">Elapsed ${elapsed}</span>` : null}
        </div>
      ` : null}
      <ol class="ui-report-stages__list">
        ${REPORT_STAGES.map((stage) => {
          const status = stageStatus(stage.id, activeId, run.running, run.success);
          return html`
            <li
              key=${stage.id}
              class=${`ui-report-stages__item ui-report-stages__item--${status}`}
            >
              <span class="ui-report-stages__marker" aria-hidden="true">
                ${status === 'done'
                  ? html`<${Icon} name="check" size=${14} />`
                  : status === 'active'
                    ? html`<${Spinner} size=${14} />`
                    : html`<span class="ui-report-stages__dot"></span>`}
              </span>
              <span class="ui-report-stages__label">${stage.label}</span>
            </li>
          `;
        })}
      </ol>
      ${run.running
        ? html`
          <div class="ui-report-stages__live">
            <p class="ui-report-stages__current">
              <${Spinner} size=${14} />
              <span>Currently: ${activeLabel}</span>
            </p>
            ${detail
              ? html`<p class="ui-report-stages__detail">${detail}</p>`
              : html`<p class="ui-report-stages__detail ui-report-stages__detail--muted">
                  Still working on this step — long log / Spark scans can take a minute.
                </p>`}
          </div>
        `
        : null}
    </div>
  `;
}

/**
 * Run Report modal content — lookback selector + incremental toggle + run button.
 */
export function RunReportModal() {
  const [lookback, setLookback] = useState('168');
  const [incremental, setIncremental] = useState(true);
  const { run } = reports.value;

  async function handleRun() {
    await runReport({ lookbackHours: Number(lookback), incremental });
  }

  return html`
    <div class="ui-modal-run-report">
      <h2 class="ui-modal__title">Run Report</h2>
      <p class="ui-modal__desc">Generate a fresh server report for the selected time window.</p>

      ${!run.running ? html`
        <div class="ui-modal-run-report__fields">
          <div class="ui-field">
            <label class="ui-field__label">Lookback window</label>
            <${Segmented}
              options=${LOOKBACK_OPTIONS}
              value=${lookback}
              onChange=${setLookback}
            />
          </div>
          <${Toggle}
            label="Incremental (extend last report)"
            checked=${incremental}
            onChange=${setIncremental}
          />
          ${lookback === '720' ? html`
            <p class="ui-modal-run-report__note ui-text-low">
              First full 30-day report can take several minutes (up to ~15 on busy hosts).
            </p>
          ` : null}
        </div>
      ` : null}

      <${ReportStageChecklist} run=${run} />

      ${run.success === false
        ? html`<p class="ui-modal-run-report__error">${run.message || 'Report failed. Check server logs.'}</p>`
        : null}

      <div class="ui-modal-run-report__actions">
        <${Button}
          kind="neutral"
          onClick=${closeModal}
        >
          ${run.running ? 'Hide' : run.success != null ? 'Close' : 'Cancel'}
        </${Button}>
        ${run.running ? html`
          <${Button}
            kind="primary"
            loading=${true}
            disabled=${true}
          >
            Running…
          </${Button}>
        ` : html`
          <${Button}
            kind="primary"
            onClick=${handleRun}
          >
            ${run.success === false ? 'Retry' : run.success === true ? 'Run again' : 'Run Report'}
          </${Button}>
        `}
      </div>
    </div>
  `;
}

async function downloadSupportBundle() {
  if (!isEmbedded()) {
    addToast('Support bundle download is available on the live server dashboard.', 'info');
    return;
  }
  try {
    const blob = await supportBundle();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watchtower-support-${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Support bundle downloaded', 'success');
  } catch (err) {
    addToast(`Bundle download failed: ${err.message}`, 'error');
  }
}

/**
 * Report selector + Run Report + support bundle — lives in the sidebar rail.
 */
export function ReportControls({ compact = false }) {
  const { index, activeId, run } = reports.value;
  const [bundleLoading, setBundleLoading] = useState(false);
  const hasReports = Array.isArray(index) && index.length > 0;

  function openRunModal() {
    openModal('run-report');
  }

  async function handleBundle() {
    setBundleLoading(true);
    try {
      await downloadSupportBundle();
    } finally {
      setBundleLoading(false);
    }
  }

  function handleSelect(e) {
    selectReport(e.target.value);
  }

  return html`
    <div class=${`ui-report-controls${compact ? ' ui-report-controls--compact' : ''}`}>
      ${!compact && hasReports ? html`
        <label class="ui-report-controls__field">
          <span class="ui-report-controls__field-label">Active report</span>
          <select
            class="ui-report-controls__select"
            value=${activeId || 'latest'}
            onChange=${handleSelect}
            aria-label="Select report"
          >
            ${index.map((rep) => html`
              <option key=${rep.id} value=${rep.id}>${rep.label || rep.id}</option>
            `)}
          </select>
        </label>
      ` : null}

      <div class="ui-report-controls__actions" role="group" aria-label="Report actions">
        <${Button}
          kind="primary"
          size="sm"
          className="ui-report-controls__run"
          onClick=${openRunModal}
          loading=${run.running}
          title="Run Report"
          aria-label="Run Report"
        >
          ${compact
            ? html`<${Icon} name="play" size=${14} />`
            : 'Run Report'}
        </${Button}>

        <${Button}
          kind="neutral"
          size="sm"
          className="ui-report-controls__bundle"
          onClick=${handleBundle}
          loading=${bundleLoading}
          title="Download support bundle"
          aria-label="Download support bundle"
        >
          ${compact
            ? html`<${Icon} name="download" size=${14} />`
            : html`<${Icon} name="download" size=${14} /> Support`}
        </${Button}>
      </div>
    </div>
  `;
}

export default ReportControls;
