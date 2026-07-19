import { html, useState, useEffect } from '../../lib/preact.js';
import { modrinthScan, settings } from '../../state/stores.js';
import { navigate } from '../../app/router.js';
import { runModrinthScan, pollModrinthStatus } from '../../state/actions.js';
import { EmptyState, Section } from '../../ui/patterns/index.js';
import { Button, Badge } from '../../ui/primitives/index.js';
import { Spinner } from '../../ui/primitives/spinner.js';
import { Icon } from '../../ui/icons.js';
import { now } from '../../state/clock.js';

export const MODRINTH_SCAN_STAGES = [
  { id: 'prepare', label: 'Preparing scan' },
  { id: 'hash', label: 'Hashing jars' },
  { id: 'cache', label: 'Checking cache' },
  { id: 'version_files', label: 'Looking up version files' },
  { id: 'projects', label: 'Fetching projects' },
  { id: 'compat', label: 'Checking compatible updates' },
  { id: 'impact', label: 'Analyzing pack impact' },
  { id: 'persist', label: 'Saving results' },
  { id: 'done', label: 'Done' },
];

function stageIndex(stageId) {
  if (!stageId) return -1;
  return MODRINTH_SCAN_STAGES.findIndex((s) => s.id === stageId);
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

function formatEta(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const sec = Math.max(0, Math.round(seconds));
  if (sec < 60) return `~${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `~${m}m ${s}s` : `~${m}m`;
}

function formatWhen(iso) {
  if (!iso) return 'Never';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return iso;
  }
}

function pct(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `${Math.round(Number(n))}%`;
}

function ModrinthStageChecklist({ status }) {
  if (!status?.running && status?.success == null && !status?.last_run) return null;

  const activeId = status.stage || MODRINTH_SCAN_STAGES[0].id;
  const activeLabel = status.stage_label
    || MODRINTH_SCAN_STAGES.find((s) => s.id === activeId)?.label;
  const detail = status.stage_detail || null;
  const startedMs = status.last_run?.started_at
    ? Date.parse(status.last_run.started_at)
    : status.startedAt;
  const elapsed = status.running ? formatElapsed(startedMs, now.value) : null;
  const stepNum = Math.max(1, stageIndex(activeId) + 1);
  const progress = status.progress || {};
  const batch = status.batch || {};
  const done = Number(progress.done) || 0;
  const total = Number(progress.total) || 0;
  const pctDone = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const eta = formatEta(status.eta_seconds);
  const batchLabel = batch.count > 0
    ? `Batch ${batch.index || 0}/${batch.count}${batch.size ? ` (${batch.size} hashes)` : ''}`
    : null;

  return html`
    <div class="ui-report-stages feat-modrinth-stages" role="status" aria-live="polite">
      ${status.running ? html`
        <div class="ui-report-stages__meta">
          <span>Step ${stepNum} of ${MODRINTH_SCAN_STAGES.length}</span>
          ${elapsed ? html`<span class="ui-report-stages__elapsed">Elapsed ${elapsed}</span>` : null}
          ${eta ? html`<span class="ui-report-stages__elapsed">ETA ${eta}</span>` : null}
        </div>
      ` : null}
      <ol class="ui-report-stages__list">
        ${MODRINTH_SCAN_STAGES.map((stage) => {
          const st = stageStatus(stage.id, activeId, status.running, status.success);
          return html`
            <li
              key=${stage.id}
              class=${`ui-report-stages__item ui-report-stages__item--${st}`}
            >
              <span class="ui-report-stages__marker" aria-hidden="true">
                ${st === 'done'
                  ? html`<${Icon} name="check" size=${14} />`
                  : st === 'active'
                    ? html`<${Spinner} size=${14} />`
                    : html`<span class="ui-report-stages__dot"></span>`}
              </span>
              <span class="ui-report-stages__label">${stage.label}</span>
            </li>
          `;
        })}
      </ol>
      ${status.running ? html`
        <div class="feat-modrinth-progress">
          <div class="feat-modrinth-progress__bar" role="progressbar"
            aria-valuemin="0" aria-valuemax=${total || 100} aria-valuenow=${done}>
            <span style=${`width:${pctDone}%`}></span>
          </div>
          <p class="feat-modrinth-progress__meta">
            ${total > 0 ? html`<span>${done}/${total}</span>` : null}
            ${batchLabel ? html`<span>${batchLabel}</span>` : null}
          </p>
        </div>
        <div class="ui-report-stages__live">
          <p class="ui-report-stages__current">
            <${Spinner} size=${14} />
            <span>Currently: ${activeLabel}</span>
          </p>
          ${detail
            ? html`<p class="ui-report-stages__detail">${detail}</p>`
            : html`<p class="ui-report-stages__detail ui-report-stages__detail--muted">
                Hashing and Modrinth lookups can take a minute on large packs.
              </p>`}
        </div>
      ` : null}
    </div>
  `;
}

function Kpi({ label, value, hint }) {
  return html`
    <div class="feat-modrinth-kpi">
      <span class="feat-modrinth-kpi__value">${value}</span>
      <span class="feat-modrinth-kpi__label">${label}</span>
      ${hint ? html`<span class="feat-modrinth-kpi__hint">${hint}</span>` : null}
    </div>
  `;
}

/**
 * Mods → Modrinth dedicated scan tab.
 */
export function ModrinthTab({ hasReport }) {
  const status = modrinthScan.value?.status ?? {};
  const lookupOff = settings.value?.data?.modrinth_lookup === false
    || status.enabled === false;
  const [starting, setStarting] = useState(false);
  const stats = status.stats || {};
  const lastRun = status.last_run || {};
  const sideMix = stats.side_tag_mix || {};
  const topOutdated = Array.isArray(stats.top_outdated) ? stats.top_outdated : [];

  useEffect(() => {
    pollModrinthStatus();
  }, []);

  async function handleScan() {
    setStarting(true);
    try {
      await runModrinthScan();
    } finally {
      setStarting(false);
    }
  }

  if (lookupOff) {
    return html`<${EmptyState}
      title="Modrinth lookup is off"
      body="Enable Modrinth lookup in Settings → Monitoring, then run a scan from this tab. Watchtower only sends jar SHA-512 hashes — it never downloads jars."
      action=${html`<${Button} kind="neutral" size="sm" onClick=${() => navigate('settings', { panel: 'monitoring' })}>Open Settings</${Button}>`}
    />`;
  }

  if (!hasReport) {
    return html`<${EmptyState}
      title="No report yet"
      body="Run a full report first so Modrinth has a facts snapshot to enrich. After that, scan from this tab whenever you want fresh Modrinth data."
      action=${html`<${Button} kind="primary" size="sm" onClick=${() => navigate('overview')}>Go to Overview</${Button}>`}
    />`;
  }

  const scanned = !!(lastRun.finished_at || stats.matched != null && Number(stats.jars_considered) > 0);
  const coverage = stats.coverage_pct != null ? pct(stats.coverage_pct) : '—';
  const hitRate = stats.cache_hit_rate != null ? pct(stats.cache_hit_rate) : '—';

  return html`
    <div class="feat-modrinth">
      <div class="feat-modrinth__hero">
        <div class="feat-modrinth__intro">
          <h2 class="feat-modrinth__title">Modrinth scan</h2>
          <p class="feat-modrinth__desc">
            Hash installed jars and look them up on Modrinth (batched, rate-limited).
            Results patch the latest report so Overview, Updates, and Crashes stay in sync.
            Jars are never downloaded. Optional auto-scan after mod changes lives in Settings → Monitoring.
          </p>
        </div>
        <${Button}
          kind="primary"
          loading=${starting || status.running}
          disabled=${status.running || starting}
          onClick=${handleScan}
        >${status.running ? 'Scanning…' : 'Run Modrinth scan'}</${Button}>
      </div>

      <div class="feat-modrinth__kpis">
        <${Kpi} label="Coverage" value=${coverage} hint=${stats.matched != null ? `${stats.matched} matched` : null} />
        <${Kpi} label="Outdated" value=${stats.outdated ?? '—'} hint="Compatible updates" />
        <${Kpi} label="Cache hit rate" value=${hitRate} hint=${stats.cache_entries != null ? `${stats.cache_entries} entries` : null} />
        <${Kpi} label="Last scan" value=${scanned ? formatWhen(lastRun.finished_at) : 'Not yet'}
          hint=${lastRun.success === false ? 'Last run failed' : (lastRun.duration_ms ? `${Math.round(lastRun.duration_ms / 1000)}s` : null)} />
      </div>

      ${(status.running || status.success != null || lastRun.finished_at) ? html`
        <${Section} title="Progress">
          <${ModrinthStageChecklist} status=${{
            ...status,
            startedAt: modrinthScan.value?.startedAt,
          }} />
          ${!status.running && status.error ? html`
            <p class="feat-modrinth__error" role="alert">${status.error}</p>
          ` : null}
        </${Section}>
      ` : null}

      <div class="feat-modrinth__grid">
        <${Section} title="Ops">
          <ul class="feat-modrinth-stats">
            <li><span>Jars considered</span><strong>${stats.jars_considered ?? '—'}${stats.truncated ? ' (capped)' : ''}</strong></li>
            <li><span>API requests</span><strong>${stats.api_requests ?? '—'}</strong></li>
            <li><span>429 waits</span><strong>${stats.rate_limit_waits ?? '—'}</strong></li>
            <li><span>RPS setting</span><strong>${stats.rps ?? '—'}</strong></li>
            <li><span>Hash / project batches</span><strong>${stats.hash_batches ?? 0} / ${stats.project_batches ?? 0}</strong></li>
            <li><span>Jars per minute</span><strong>${stats.jars_per_minute ?? '—'}</strong></li>
          </ul>
        </${Section}>

        <${Section} title="Coverage detail">
          <ul class="feat-modrinth-stats">
            <li><span>Matched</span><strong>${stats.matched ?? '—'}</strong></li>
            <li><span>Unresolved</span><strong>${stats.unresolved ?? '—'}</strong></li>
            <li><span>Outdated</span><strong>${stats.outdated ?? '—'}</strong></li>
            <li><span>Bytes hashed</span><strong>${stats.bytes_hashed != null ? `${Math.round(stats.bytes_hashed / 1024 / 1024)} MB` : '—'}</strong></li>
            <li><span>Oldest cache age</span><strong>${stats.oldest_cache_age_seconds != null ? `${Math.round(stats.oldest_cache_age_seconds / 86400)}d` : '—'}</strong></li>
          </ul>
        </${Section}>

        <${Section} title="Side tags (Modrinth)">
          <div class="feat-modrinth-sides">
            <${Badge} tone="ok">Server required · ${sideMix.server_required ?? 0}</${Badge}>
            <${Badge} tone="danger">Client only · ${sideMix.client_only ?? 0}</${Badge}>
            <${Badge} tone="info">Both · ${sideMix.both ?? 0}</${Badge}>
            <${Badge} tone="neutral">Other · ${sideMix.other ?? 0}</${Badge}>
          </div>
        </${Section}>

        <${Section} title="Top outdated">
          ${topOutdated.length ? html`
            <ul class="feat-modrinth-outdated">
              ${topOutdated.map((row) => html`
                <li key=${row.mod_id}>
                  <button
                    type="button"
                    class="ui-link"
                    onClick=${() => navigate('mods', { view: 'updates', mod: row.mod_id })}
                  >${row.title || row.mod_id}</button>
                </li>
              `)}
            </ul>
          ` : html`<p class="ui-text-low">No outdated titles from the last scan.</p>`}
        </${Section}>
      </div>
    </div>
  `;
}

/** Compact Overview banner for Modrinth scan status. */
export function ModrinthOverviewBanner({ modrinthLookupEnabled }) {
  const status = modrinthScan.value?.status ?? {};
  const stats = status.stats || {};
  const lastRun = status.last_run || {};
  const running = !!status.running;

  useEffect(() => {
    pollModrinthStatus();
  }, []);

  if (modrinthLookupEnabled === false || status.enabled === false) {
    return html`
      <div
        class="feat-mods-banner feat-mods-banner--neutral feat-mods-banner--link"
        role="button"
        tabindex="0"
        onClick=${() => navigate('mods', { view: 'modrinth' })}
        onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('mods', { view: 'modrinth' }); } }}
      >
        <span class="feat-mods-banner__label">Modrinth</span>
        <span class="feat-mods-banner__text">Lookup is off — enable in Settings, then scan from Mods → Modrinth</span>
      </div>
    `;
  }

  if (running) {
    return html`
      <div
        class="feat-mods-banner feat-mods-banner--info feat-mods-banner--link"
        role="button"
        tabindex="0"
        onClick=${() => navigate('mods', { view: 'modrinth' })}
        onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('mods', { view: 'modrinth' }); } }}
      >
        <span class="feat-mods-banner__label">Modrinth</span>
        <span class="feat-mods-banner__text">Scan in progress${status.stage_label ? ` · ${status.stage_label}` : ''}…</span>
      </div>
    `;
  }

  const hasSuccess = lastRun.success === true || (status.success === true && lastRun.finished_at);
  if (!hasSuccess && !lastRun.finished_at) {
    return html`
      <div
        class="feat-mods-banner feat-mods-banner--warn feat-mods-banner--link"
        role="button"
        tabindex="0"
        onClick=${() => navigate('mods', { view: 'modrinth' })}
        onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('mods', { view: 'modrinth' }); } }}
      >
        <span class="feat-mods-banner__label">Modrinth</span>
        <span class="feat-mods-banner__text">Not scanned yet — run a scan to enrich mods</span>
      </div>
    `;
  }

  if (lastRun.success === false) {
    return html`
      <div
        class="feat-mods-banner feat-mods-banner--warn feat-mods-banner--link"
        role="button"
        tabindex="0"
        onClick=${() => navigate('mods', { view: 'modrinth' })}
        onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('mods', { view: 'modrinth' }); } }}
      >
        <span class="feat-mods-banner__label">Modrinth</span>
        <span class="feat-mods-banner__text">Last scan failed${status.error ? ` · ${status.error}` : ''}</span>
      </div>
    `;
  }

  const matched = stats.matched ?? 0;
  const outdated = stats.outdated ?? 0;
  const when = lastRun.finished_at ? formatWhen(lastRun.finished_at) : 'recently';

  return html`
    <div
      class="feat-mods-banner feat-mods-banner--ok feat-mods-banner--link"
      role="button"
      tabindex="0"
      onClick=${() => navigate('mods', { view: 'modrinth' })}
      onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('mods', { view: 'modrinth' }); } }}
    >
      <span class="feat-mods-banner__label">Modrinth</span>
      <span class="feat-mods-banner__text">Last scan ${when} · ${matched} matched · ${outdated} outdated</span>
    </div>
  `;
}
