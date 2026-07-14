/**
 * Overview — adaptive ops status page.
 * Trust strip → vitals counters → hero verdict → triage.
 */

import { html, useState } from '../../lib/preact.js';
import {
  Page, Section, MetricTile, ListRow, HealthGrade, Skeleton,
  StatusPillStrip, BeaconCard, UptimeClock, RadarDial,
} from '../../ui/patterns/index.js';
import { Button, Grid, Card, Badge, Progress } from '../../ui/primitives/index.js';
import { Icon } from '../../ui/icons.js';
import {
  live, reports, overviewMeta, opsCache, issuesPeek,
  performance, ui, noReportYet, acks, crashGroups, settings, auth, issueSuppressions,
} from '../../state/stores.js';
import { now } from '../../state/clock.js';
import { openModal, saveBackupExternal, addToast } from '../../state/actions.js';
import { navigate } from '../../app/router.js';
import { displayHealth, buildActionQueue } from '../../domain/health.js';
import { formatTps, formatPct, formatGb, formatMb, formatDuration } from '../../domain/formats.js';
import { isStaleReport } from '../../domain/freshness.js';
import { formatReportFreshness, overviewStatusPills, healthStatus } from '../../domain/labels.js';
import { buildWelcomeLead, buildStatusSummary } from '../../domain/overview-welcome.js';
import { get as persistGet } from '../../state/persist.js';
import { resumeSetupWizard } from '../wizard/view.js';

const ATTENTION_CAP = 3;

function backupsConfiguredFromSettings(data) {
  if (!data) return false;
  if (data.backup_tracking_enabled === false) return true;
  const dirs = String(data.backup_dirs || data.backup_dir || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (dirs.length) return true;
  if (data.backup_external_configured) return true;
  const mode = data.backup_tracking_mode;
  return !!(mode && mode !== 'off');
}

/** Light resume nudges after setup (baseline pending / backups / paused wizard). */
function setupResumeChip() {
  const wiz = persistGet('setupWizard', null);
  if (wiz == null) return null;

  if (wiz.completed !== true) {
    return {
      text: 'Setup is unfinished — resume the guided wizard when you are ready.',
      actionLabel: 'Resume setup',
      onClick: () => resumeSetupWizard(),
    };
  }

  if (wiz.baseline === 'pending') {
    return {
      text: 'Your optional 30-day baseline report is still running in the background.',
      actionLabel: 'Report status',
      onClick: () => openModal('run-report'),
    };
  }

  if (wiz.baseline === 'failed') {
    return {
      text: 'The optional 30-day baseline did not finish. You can run a report anytime.',
      actionLabel: 'Run Report',
      onClick: () => openModal('run-report'),
    };
  }

  if (!backupsConfiguredFromSettings(settings.value?.data)) {
    return {
      text: 'Backups are not configured yet — point WatchTower at a folder or panel heartbeat.',
      actionLabel: 'Open Backups',
      onClick: () => navigate('backups'),
    };
  }

  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tpsTone(v) {
  if (v == null) return 'neutral';
  return v < 10 ? 'danger' : v < 16 ? 'warn' : 'ok';
}

function msptTone(v) {
  if (v == null) return 'neutral';
  return v > 50 ? 'danger' : v > 25 ? 'warn' : 'ok';
}

function cpuTone(v) {
  if (v == null) return 'neutral';
  return v > 90 ? 'danger' : v > 70 ? 'warn' : 'ok';
}

function heapTone(used, max) {
  if (used == null || !max) return 'neutral';
  const pct = used / max;
  return pct > 0.9 ? 'danger' : pct > 0.75 ? 'warn' : 'ok';
}

function diskTone(pct) {
  if (pct == null) return 'neutral';
  return pct > 90 ? 'danger' : pct > 75 ? 'warn' : 'ok';
}

function severityIcon(sev, kind) {
  if (kind === 'crash') return 'bug';
  if (kind === 'backup') return 'archive';
  return sev === 'critical' ? 'zap' : 'alert-triangle';
}

/** Map displayHealth.effective → letter grade when meta grade is missing. */
function gradeFromHealth(effective) {
  if (effective === 'critical') return 'F';
  if (effective === 'warning') return 'C';
  if (effective === 'ok') return 'A';
  return '?';
}

function gradeHeadline(grade, attentionCount, isDown) {
  if (isDown) return 'Connection lost';
  if (attentionCount > 0) {
    return attentionCount === 1
      ? '1 item needs attention'
      : `${attentionCount} items need attention`;
  }
  if (grade === 'A' || grade === 'B') return 'Server looks healthy';
  if (grade === 'C' || grade === 'D') return 'Worth a closer look';
  if (grade === 'F') return 'Critical issues detected';
  return 'Control center';
}

function heroTone(grade, attentionCount, isDown) {
  if (isDown || attentionCount > 0 || grade === 'F') return 'danger';
  if (grade === 'C' || grade === 'D' || grade === '?') return 'warn';
  return 'ok';
}

function heroSubtext(layoutMode, attentionCount, isDown) {
  if (isDown) return 'Live metrics may be stale until the connection recovers.';
  if (attentionCount > 0) {
    return 'Fix the items below, then re-run a report to refresh the grade.';
  }
  if (layoutMode === 'steady') {
    return 'No active issues. Vitals look steady — open Live for charts or Insights for trends.';
  }
  return 'Vitals look steady. Use Live for real-time charts and Issues when something spikes.';
}

function pregenVisible(pregen) {
  if (!pregen) return false;
  if (pregen.pregen_active) return true;
  if (pregen.last && pregen.hours_since_last != null && pregen.hours_since_last < 24) return true;
  return false;
}

const DIM_BAR_GRADIENTS = [
  'linear-gradient(90deg, var(--ui-sky), color-mix(in srgb, var(--ui-sky) 55%, var(--ui-accent)))',
  'linear-gradient(90deg, var(--ui-accent), color-mix(in srgb, var(--ui-accent) 50%, #22d3ee))',
  'linear-gradient(90deg, var(--ui-ok), color-mix(in srgb, var(--ui-ok) 45%, var(--ui-sky)))',
  'linear-gradient(90deg, var(--ui-info), color-mix(in srgb, var(--ui-info) 50%, var(--ui-accent)))',
  'linear-gradient(90deg, var(--ui-warn), color-mix(in srgb, var(--ui-warn) 55%, var(--ui-accent)))',
];

function dimBarGradient(index) {
  return DIM_BAR_GRADIENTS[index % DIM_BAR_GRADIENTS.length];
}

function formatDimLabel(dim) {
  if (!dim) return '—';
  if (dim.label) {
    const label = dim.label;
    const slash = label.indexOf(' / ');
    if (slash > 0) {
      const left = label.slice(0, slash);
      const right = label.slice(slash + 3);
      if (left.toLowerCase() === right.toLowerCase()) {
        const name = left.replace(/_/g, ' ');
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
    }
    return label;
  }
  const id = String(dim.id ?? dim.dimension ?? '');
  const bare = id.replace(/^mod:/, '').replace(/^minecraft:/, '');
  if (bare.includes('/')) {
    const parts = bare.split('/');
    if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
      const name = parts[0].replace(/_/g, ' ');
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return bare.replace(/\//g, ' · ');
  }
  return bare || '—';
}

function formatPregenDim(dim) {
  if (!dim) return 'Overworld';
  return String(dim).replace(/^minecraft:/, '');
}

function resolveOverviewHostname(envelope, facts, settingsData) {
  return envelope?.hostname
    || facts?.meta?.hostname
    || settingsData?.hostname
    || null;
}

function WelcomeBand({ lead, hostLine, panelLabel, summary }) {
  return html`
    <div class="ov-welcome" data-tour="overview-welcome">
      <div class="ov-welcome__copy">
        <h2 class="ov-welcome__lead">${lead}</h2>
        ${hostLine && html`
          <p class="ov-welcome__host">
            <span class="ov-welcome__host-name">${hostLine}</span>
            ${panelLabel ? html`<span class="ov-welcome__panel">${panelLabel}</span>` : null}
          </p>
        `}
        ${summary && html`<p class="ov-welcome__summary">${summary}</p>`}
      </div>
    </div>
  `;
}

function DisableBackupAlerts() {
  const [saving, setSaving] = useState(false);

  async function handleDisable() {
    setSaving(true);
    try {
      await saveBackupExternal({ trackingEnabled: false, trackingMode: 'off' });
      addToast('Backup tracking off — alerts and Issues for backups are silenced', 'info');
    } catch (err) {
      addToast(err?.message ?? 'Could not disable backup tracking', 'error');
    } finally {
      setSaving(false);
    }
  }

  return html`
    <div class="ov-backup-disable">
      <p class="ov-backup-disable__text">
        Don't use backups on this server? Turn off tracking to silence backup alerts.
      </p>
      <div class="ov-backup-disable__action">
        <${Button} kind="neutral" size="sm" loading=${saving} disabled=${saving} onClick=${handleDisable}>
          Disable backup alerts
        </${Button}>
      </div>
    </div>
  `;
}

function PregenJobCard({ title, pregen, radarKind = 'circle' }) {
  if (!pregenVisible(pregen)) return null;
  const last = pregen.last ?? {};
  const pct = last.pct != null ? Number(last.pct) : null;
  const active = !!pregen.pregen_active;
  const paused = !!pregen.pregen_paused;

  return html`
    <div class="ov-pregen">
      <div class="ov-pregen__layout">
        ${pct != null ? html`
          <${RadarDial} pct=${pct} kind=${radarKind} size=${72} />
        ` : null}
        <div class="ov-pregen__body">
          <div class="ov-pregen__head">
            <strong class="ov-pregen__title">${title}</strong>
            <${Badge} tone=${paused ? 'neutral' : active ? 'warn' : 'neutral'}>
              ${paused ? 'Paused' : active ? 'Active' : 'Recent'}
            </${Badge}>
          </div>
          <div class="ov-pregen__dim">
            ${formatPregenDim(last.dimension)}
            ${pct != null ? html`<span class="ov-pregen__pct"> — ${pct.toFixed(1)}%</span>` : null}
          </div>
          ${pct != null ? html`<${Progress} value=${pct} max=${100} tone=${active ? 'warn' : null} />` : null}
          <div class="ov-pregen__stats">
            ${last.chunks != null ? html`
              <div class="ov-pregen__stat">
                <span class="ov-pregen__stat-label">Chunks</span>
                <span class="ov-pregen__stat-value">
                  ${Number(last.chunks).toLocaleString()}
                  ${last.total != null ? html`<span class="ov-pregen__stat-sub"> / ${Number(last.total).toLocaleString()}</span>` : null}
                </span>
              </div>
            ` : null}
            ${(last.cps ?? last.rate ?? pregen.cps_avg) != null ? html`
              <div class="ov-pregen__stat">
                <span class="ov-pregen__stat-label">Rate</span>
                <span class="ov-pregen__stat-value">${Number(last.cps ?? last.rate ?? pregen.cps_avg).toFixed(1)} <span class="ov-pregen__stat-unit">cps</span></span>
              </div>
            ` : null}
            ${last.eta ? html`
              <div class="ov-pregen__stat">
                <span class="ov-pregen__stat-label">ETA</span>
                <span class="ov-pregen__stat-value">${last.eta}</span>
              </div>
            ` : null}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PageView() {
  const liveVal       = live.value;
  const latest        = liveVal?.latest ?? null;
  const envelope      = liveVal?.envelope ?? null;
  const reportsVal    = reports.value;
  const facts         = reportsVal?.facts ?? null;
  const acksVal       = acks.value;
  const acksMap       = acksVal?.crashes ?? {};
  const opsCacheVal   = opsCache.value;
  const opsCacheData  = opsCacheVal?.data ?? null;
  const ovMeta        = overviewMeta.value;
  const ovData        = ovMeta?.data ?? null;
  const perfVal       = performance.value;
  const uiVal         = ui.value;
  const noReport      = noReportYet.value;
  const nowMs         = now.value;
  const isDown        = uiVal.connectionDown;
  const lagIssues     = issuesPeek.value?.data?.lag_issues ?? [];

  const health = facts ? displayHealth(facts, acksMap, opsCacheData, {
    backupTrackingEnabled: settings.value?.data?.backup_tracking_enabled !== false,
  }) : null;
  const queue  = facts
    ? buildActionQueue(facts, acksMap, opsCacheData, crashGroups.value, acksVal?.issues ?? {}, {
      backupTrackingEnabled: settings.value?.data?.backup_tracking_enabled !== false,
      issueSuppressions: issueSuppressions.value?.data
        ?? facts?.optional?.active_suppressions
        ?? null,
    })
    : { now: [], soon: [], historical: [], reviewed: [] };

  const scorecard   = ovData?.scorecard ?? null;
  const rightNow    = opsCacheData?.right_now ?? null;
  const perfTldr    = ovData?.performance_insights_tldr ?? null;
  const rssHint     = ovData?.rss_hint ?? null;
  const diskJump    = ovData?.disk_jump_tldr ?? null;
  const reportMeta  = facts?.meta ?? null;
  const stale       = reportMeta ? isStaleReport(reportMeta, nowMs) : false;

  const username = auth.value?.session?.username ?? null;
  const hostname = resolveOverviewHostname(envelope, facts, settings.value?.data);
  const panelLabel = settings.value?.data?.panel_display_name
    || reportMeta?.panel_display_name
    || null;
  const javaRunning = facts?.health?.java_running
    ?? facts?.flags?.java_running
    ?? (latest != null ? true : null);
  const attentionCount = (queue.now?.length ?? 0) + (queue.soon?.length ?? 0);
  const welcomeLead = buildWelcomeLead({
    username,
    hostname,
    firstRun: !!(noReport && !latest),
  });
  const statusSummary = buildStatusSummary({
    javaRunning,
    isDown,
    players: latest?.players_online ?? facts?.minecraft?.players_online_now,
    tps: latest?.tps,
    mspt: latest?.mspt,
    healthLabel: health?.label || healthStatus(health?.effective),
    healthEffective: health?.effective ?? 'ok',
    attentionCount,
    crashHint: ovData?.crash_tldr?.label ?? null,
    lagHint: ovData?.lag_tldr?.label ?? null,
  });

  const diskPct   = latest?.disk_use_pct ?? null;
  const heapUsed  = latest?.heap_mb?.used ?? null;
  const heapMax   = latest?.heap_mb?.max ?? null;
  const memAvGb   = latest?.mem_available_gb ?? null;
  const worldGb   = latest?.world_gb ?? null;
  const uptimeSec = latest?.java_uptime_sec ?? null;
  const byDimension = latest?.by_dimension
    ?? envelope?.storage?.by_dimension
    ?? [];
  const chunkyPregen = envelope?.chunky_pregen ?? facts?.optional?.chunky_pregen ?? null;
  const dhPregen     = envelope?.dh_pregen ?? facts?.optional?.dh_pregen ?? null;
  const startupProfile = facts?.optional?.startup_profile ?? null;

  const grade = ovData?.health_grade ?? (health ? gradeFromHealth(health.effective) : '?');

  const attentionItems = [...(queue.now ?? []), ...(queue.soon ?? [])];
  const attentionMore  = Math.max(0, attentionItems.length - ATTENTION_CAP);

  const layoutMode =
    isDown
    || attentionItems.length > 0
    || grade === 'F'
    || health?.effective === 'critical'
      ? 'incident'
      : 'steady';

  // Always show available vitals — do not gate Host CPU on warn thresholds (flickers as load oscillates).
  const showCpu  = latest?.host_cpu_pct != null;
  const showRam  = memAvGb != null;
  const showDisk = diskPct != null;

  const hasInsight = !!(perfTldr?.label || perfTldr?.detail || perfVal?.insights?.length);
  const hasRightNow = !!(rightNow?.signals?.length);
  const hasLag = lagIssues.length > 0;
  const showTriage =
    (layoutMode === 'incident' && (attentionItems.length > 0 || hasRightNow || hasLag))
    || (layoutMode === 'steady' && hasRightNow);

  const headline = gradeHeadline(grade, attentionItems.length, isDown);
  const heroClass = `ov-hero ov-hero--${heroTone(grade, attentionItems.length, isDown)}`;

  function startTour() {
    import('../../app/tour.js').then((m) => m.startTour());
  }

  // ── No-report / first-run gate ─────────────────────────────────────────────
  if (noReport && !latest) {
    return html`
      <${Page} title="Overview" subtitle=${welcomeLead.hostLine || 'Your server control center'}>
        <${WelcomeBand}
          lead=${welcomeLead.lead}
          hostLine=${hostname}
          panelLabel=${panelLabel}
          summary="Run a report to build your health grade and issue queue — or open Live to watch vitals stream in."
        />
        <div class="ov-firstrun" data-tour="overview">
          <div class="ov-firstrun__card">
            <span class="ov-firstrun__icon"><${Icon} name="file-text" size=${22} /></span>
            <strong>Run your first report</strong>
            <p>Builds the health grade, issue queue, and crash summaries.</p>
            <${Button} kind="accent" onClick=${() => openModal('run-report')}>Run Report</${Button}>
          </div>
          <div class="ov-firstrun__card">
            <span class="ov-firstrun__icon"><${Icon} name="activity" size=${22} /></span>
            <strong>Open Live</strong>
            <p>Watch TPS, MSPT, heap, and players stream in real time.</p>
            <${Button} kind="neutral" onClick=${() => navigate('live')}>Go to Live</${Button}>
          </div>
          <div class="ov-firstrun__card">
            <span class="ov-firstrun__icon"><${Icon} name="map" size=${22} /></span>
            <strong>Take the tour</strong>
            <p>A short walkthrough of every panel and what it’s for.</p>
            <${Button} kind="neutral" onClick=${startTour}>Start tour</${Button}>
          </div>
        </div>
      </${Page}>
    `;
  }

  const subtitleText = hostname
    ? `${hostname}${stale ? ' — report stale' : ''}`
    : 'Server health at a glance';

  const freshnessLabel = reportMeta
    ? formatReportFreshness(reportMeta)
    : (latest ? 'Live only — no report yet' : 'Waiting for data');

  const vitalsRow = latest ? html`
    <div class="ov-vitals-row" data-tour="overview-vitals">
      <${MetricTile}
        className="ov-vital ov-vital--tps"
        label="TPS"
        value=${latest.tps ?? 0}
        format=${formatTps}
        tone=${tpsTone(latest.tps)}
        size="sm"
        padding="12"
      />
      <${MetricTile}
        className="ov-vital ov-vital--mspt"
        label="MSPT"
        value=${latest.mspt ?? 0}
        format=${(v) => Number(v).toFixed(1)}
        unit="ms"
        tone=${msptTone(latest.mspt)}
        size="sm"
        padding="12"
      />
      <${MetricTile}
        className="ov-vital ov-vital--heap"
        label="Heap"
        value=${heapUsed ?? 0}
        format=${(v) => formatMb(v)}
        tone=${heapTone(heapUsed, heapMax)}
        caption=${heapMax != null ? `Max ${formatMb(heapMax)}` : null}
        size="sm"
        padding="12"
      />
      <${MetricTile}
        className="ov-vital ov-vital--players"
        label="Players"
        value=${latest.players_online ?? 0}
        format=${(v) => String(Math.round(v))}
        caption=${(latest.players_online ?? 0) > 0 ? 'Online' : 'Idle'}
        size="sm"
        padding="12"
      />
      ${showCpu ? html`
        <${MetricTile}
          className="ov-vital ov-vital--cpu"
          label="CPU"
          value=${latest.host_cpu_pct ?? 0}
          format=${formatPct}
          tone=${cpuTone(latest.host_cpu_pct)}
          size="sm"
          padding="12"
        />
      ` : null}
      ${showRam ? html`
        <${MetricTile}
          className="ov-vital ov-vital--ram"
          label="RAM free"
          value=${memAvGb}
          format=${formatGb}
          size="sm"
          padding="12"
        />
      ` : null}
      ${showDisk ? html`
        <${MetricTile}
          className="ov-vital ov-vital--disk"
          label="Disk"
          value=${diskPct}
          format=${formatPct}
          tone=${diskTone(diskPct)}
          size="sm"
          padding="12"
        />
      ` : null}
    </div>
  ` : html`
    <div class="ov-vitals-row ov-vitals-row--loading">
      ${[1, 2, 3, 4, 5, 6].map((i) => html`
        <${Skeleton} key=${i} height=${72} className="ov-vital-skeleton" />
      `)}
    </div>
  `;

  const insightSection = hasInsight ? html`
    <${Section} title="Performance insight">
      <${Card} tone="accent">
        <div class="ov-insight-row">
          <div class="ov-insight-text">
            <div class="ui-text-hi ov-insight-label">
              ${perfTldr?.label ?? perfVal?.insights?.[0]?.title ?? 'Performance insights available'}
            </div>
            ${perfTldr?.detail ? html`
              <div class="ui-text-low ov-insight-detail">${perfTldr.detail}</div>
            ` : null}
          </div>
          <${Button}
            kind="neutral"
            size="sm"
            onClick=${() => navigate('insights')}
          >
            Open Insights
          </${Button}>
        </div>
      </${Card}>
    </${Section}>
  ` : null;

  const storageSection = (worldGb != null || latest?.java_rss_gb != null || byDimension.length || diskPct != null) ? (() => {
    const backupTrackingOn = settings.value?.data?.backup_tracking_enabled !== false;
    const hasBackupAttention = attentionItems.some((item) => item.kind === 'backup');
    const showDisableBackup = backupTrackingOn && (
      hasBackupAttention
      || facts?.optional?.last_backup?.status === 'unconfigured'
      || facts?.optional?.last_backup?.stale
    );
    const dimTotalGb = byDimension.reduce((sum, d) => sum + (d.gb ?? 0), 0);

    return html`
    <${Section} title="Storage">
      <div class="ov-storage">
        <${Grid} min="140px" gap="12">
          ${worldGb != null ? html`
            <${MetricTile}
              label="World size"
              value=${worldGb}
              format=${(v) => formatGb(v)}
            />
          ` : null}
          ${diskPct != null ? html`
            <${MetricTile}
              label="Disk used"
              value=${diskPct}
              format=${(v) => formatPct(v)}
              tone=${diskTone(diskPct)}
            />
          ` : null}
          ${latest?.java_rss_gb != null ? html`
            <${MetricTile}
              label="Java RSS"
              value=${latest.java_rss_gb}
              format=${(v) => formatGb(v)}
            />
          ` : null}
        </${Grid}>

        ${byDimension.length ? html`
          <details class="ov-storage__dims" open>
            <summary>By dimension</summary>
            <div class="ov-dim-list">
              ${[...byDimension]
                .slice()
                .sort((a, b) => (b.gb ?? 0) - (a.gb ?? 0))
                .map((dim, i) => {
                  const sharePct = dimTotalGb > 0
                    ? Math.round(((dim.gb ?? 0) / dimTotalGb) * 100)
                    : 0;
                  const barPct = sharePct > 0 ? Math.max(sharePct, 6) : 0;
                  return html`
                    <div class="ov-dim-row" key=${dim.id ?? dim.path ?? dim.label}>
                      <div class="ov-dim-row__head">
                        <span class="ov-dim-row__label">${formatDimLabel(dim)}</span>
                        <span class="ov-dim-row__gb">${formatGb(dim.gb ?? 0)}</span>
                      </div>
                      <div class="ov-dim-row__track" aria-hidden="true">
                        <div
                          class="ov-dim-row__fill"
                          style=${{
                            width: `${barPct}%`,
                            background: dimBarGradient(i),
                          }}
                        ></div>
                      </div>
                    </div>
                  `;
                })}
            </div>
          </details>
        ` : null}

        ${showDisableBackup ? html`<${DisableBackupAlerts} />` : null}

        ${diskJump?.active && diskJump?.label ? html`
          <p class="ov-storage__note ov-storage__note--warn">${diskJump.label}</p>
        ` : null}
        ${rssHint?.show && rssHint?.message ? html`
          <p class="ov-storage__note">${rssHint.message}</p>
        ` : null}
      </div>
    </${Section}>
  `;
  })() : null;

  const pregenSection = (pregenVisible(chunkyPregen) || pregenVisible(dhPregen)) ? html`
    <${Section} title="World background jobs">
      <div class="ov-pregen-list">
        <${PregenJobCard} title="Chunky pregen" pregen=${chunkyPregen} radarKind="circle" />
        <${PregenJobCard} title="Distant Horizons pregen" pregen=${dhPregen} radarKind="square" />
      </div>
    </${Section}>
  ` : null;

  const bootSection = startupProfile ? (() => {
    const total = startupProfile.total_sec;
    const slow = startupProfile.slowest?.[0];
    const fromPhase = slow
      ? startupProfile.phases?.find((p) => p.id === slow.phase)?.label
      : null;
    const slowFallback = slow?.phase != null
      ? String(slow.phase).replace(/_/g, ' ')
      : '';
    const slowLabel = fromPhase || slowFallback || '—';
    const warnCount = startupProfile.warnings?.length ?? 0;
    const cmp = startupProfile.compare_to_last_boot;
    let deltaLabel = '—';
    if (cmp?.delta_sec != null) {
      const abs = Math.abs(Number(cmp.delta_sec));
      const mag = abs >= 100 ? `${Math.round(abs)}s` : `${abs.toFixed(1)}s`;
      const dir = (cmp.direction ?? '').toLowerCase();
      if (dir === 'faster') deltaLabel = `−${mag} faster`;
      else if (dir === 'slower') deltaLabel = `+${mag} slower`;
      else if (dir === 'same') deltaLabel = 'same';
      else deltaLabel = Number(cmp.delta_sec) >= 0 ? `+${mag}` : `−${mag}`;
    }
    const totalLabel = total == null ? '—' : (Number(total) >= 100 ? `${Math.round(total)}s` : `${Number(total).toFixed(1)}s`);
    return html`
      <${Section} title="Boot profile">
        <${Card} tone="accent">
          <div class="ov-insight-row">
            <div class="ov-insight-text ov-boot">
              <div class="ui-text-hi ov-insight-label">${totalLabel} boot</div>
              <div class="ui-text-low ov-insight-detail ov-boot__meta">
                <span>Slowest: ${slowLabel}${slow?.sec != null ? ` (${Number(slow.sec).toFixed(1)}s)` : ''}</span>
                <span>${warnCount} warning${warnCount === 1 ? '' : 's'}</span>
                <span>vs last: ${deltaLabel}</span>
              </div>
            </div>
            <${Button}
              kind="neutral"
              size="sm"
              onClick=${() => navigate('startup')}
            >
              Open Startup
            </${Button}>
          </div>
        </${Card}>
      </${Section}>
    `;
  })() : null;

  const triageColumn = showTriage ? html`
    <div class="ov-wide-grid__triage">
      ${layoutMode === 'incident' && attentionItems.length > 0 ? html`
        <${Section}
          title="Needs attention"
          badge=${html`<${Badge} tone="danger">${attentionItems.length}</${Badge}>`}
        >
          <div class="feat-list">
            ${attentionItems.slice(0, ATTENTION_CAP).map((item) => html`
              <${ListRow}
                key=${item.key}
                tone=${item.severity === 'critical' ? 'danger' : item.severity === 'warning' ? 'warn' : 'neutral'}
                icon=${html`<${Icon} name=${severityIcon(item.severity, item.kind)} size=${16} />`}
                title=${item.title}
                meta=${item.summary ?? null}
                actions=${item.primaryAction ? html`
                  <${Button}
                    kind="neutral"
                    size="sm"
                    onClick=${() => navigate(item.primaryAction.tab)}
                  >
                    ${item.primaryAction.label}
                  </${Button}>
                ` : null}
              />
            `)}
          </div>
          ${attentionMore > 0 ? html`
            <div class="ov-attention-more">
              <${Button} kind="neutral" size="sm" onClick=${() => navigate('issues')}>
                +${attentionMore} more on Issues
              </${Button}>
            </div>
          ` : null}
          ${settings.value?.data?.backup_tracking_enabled !== false
            && attentionItems.some((item) => item.kind === 'backup')
            ? html`<${DisableBackupAlerts} />`
            : null}
        </${Section}>
      ` : null}

      ${hasRightNow ? html`
        <${Section} title="Right now">
          <div class="feat-list">
            ${rightNow.signals.map((sig, i) => html`
              <${ListRow}
                key=${sig.type + String(i)}
                tone=${sig.severity === 'warning' ? 'warn' : sig.severity === 'critical' ? 'danger' : 'neutral'}
                icon=${html`<${Icon}
                  name=${sig.severity === 'critical' ? 'zap' : sig.severity === 'warning' ? 'alert-triangle' : 'info'}
                  size=${14}
                />`}
                title=${sig.label}
                meta=${sig.detail ?? null}
                actions=${sig.tab ? html`
                  <${Button}
                    kind="neutral"
                    size="sm"
                    onClick=${() => navigate(sig.tab)}
                  >
                    View
                  </${Button}>
                ` : null}
              />
            `)}
          </div>
        </${Section}>
      ` : null}

      ${hasLag && layoutMode === 'incident' ? html`
        <${Section}
          title="Lag incidents"
          badge=${html`<${Badge} tone="warn">${lagIssues.length}</${Badge}>`}
          collapsible=${true}
          defaultOpen=${false}
        >
          <div class="feat-list">
            ${lagIssues.map((lag) => html`
              <${ListRow}
                key=${lag.id}
                tone="warn"
                icon=${html`<${Icon} name="zap" size=${14} />`}
                title=${lag.title}
                meta=${lag.primary_suspect ?? lag.narrative ?? null}
                actions=${html`
                  <${Button}
                    kind="neutral"
                    size="sm"
                    onClick=${() => navigate('issues')}
                  >
                    View
                  </${Button}>
                `}
              />
            `)}
          </div>
        </${Section}>
      ` : null}
    </div>
  ` : null;

  const statusPills = overviewStatusPills({
    facts,
    live: latest,
    opsCache: opsCacheData,
    overviewMeta: ovData,
    backupTrackingEnabled: settings.value?.data?.backup_tracking_enabled !== false,
  });

  const globalTone = health?.effective === 'critical' || grade === 'F'
    ? 'danger'
    : health?.effective === 'warning' || grade === 'C' || grade === 'D'
      ? 'warn'
      : 'ok';
  const sessionTone = isDown
    ? 'danger'
    : (latest?.tps != null && latest.tps < 16) || (latest?.mspt != null && latest.mspt > 40)
      ? 'warn'
      : 'ok';
  const globalWord = health?.label
    ?? (grade === 'A' || grade === 'B' ? 'Healthy' : grade === '?' ? 'Unknown' : 'Degraded');
  const sessionWord = isDown
    ? 'Offline'
    : (latest?.players_online ?? 0) > 0
      ? 'Players online'
      : 'Idle';

  return html`
    <${Page}
      title="Overview"
      subtitle=${subtitleText}
    >
      <div data-tour="overview" class="ui-page__stack">

      <${WelcomeBand}
        lead=${welcomeLead.lead}
        hostLine=${welcomeLead.hostLine || hostname}
        panelLabel=${panelLabel}
        summary=${statusSummary}
      />

      ${(() => {
        const chip = setupResumeChip();
        if (!chip) return null;
        return html`
          <div class="ov-setup-chip" role="status">
            <span class="ov-setup-chip__icon"><${Icon} name="map" size=${16} /></span>
            <span class="ov-setup-chip__text">${chip.text}</span>
            <${Button} kind="neutral" size="sm" onClick=${chip.onClick}>${chip.actionLabel}</${Button}>
          </div>
        `;
      })()}

      ${vitalsRow}

      <div class="ov-status-strip">
        <div class="ov-status-strip__item">
          <span class=${`ov-status-strip__dot ${isDown ? 'ov-status-strip__dot--down' : stale ? 'ov-status-strip__dot--warn' : ''}`}></span>
          <span class="ov-status-strip__value">${isDown ? 'Connection lost' : 'Connected'}</span>
        </div>
        <div class="ov-status-strip__item">
          Report <span class="ov-status-strip__value">${freshnessLabel}</span>
        </div>
        <div class="ov-status-strip__item">
          Players <span class="ov-status-strip__value">${latest?.players_online ?? '—'}</span>
        </div>
        ${uptimeSec != null ? html`
          <div class="ov-status-strip__item">
            Uptime <span class="ov-status-strip__value">${formatDuration(uptimeSec)}</span>
          </div>
        ` : null}
      </div>

      <${StatusPillStrip} pills=${statusPills} className="ov-status-pills" />

      <div class="ov-health-trio">
        <${BeaconCard}
          label="Global health"
          hint="Trust scorecard · full report window"
          word=${globalWord}
          tone=${globalTone}
        />
        <${BeaconCard}
          label="Session health"
          hint="Right now"
          word=${sessionWord}
          tone=${sessionTone}
        />
        <${BeaconCard} label="Uptime" hint="Java process" tone="neutral">
          <${UptimeClock} seconds=${uptimeSec} />
        </${BeaconCard}>
      </div>

      <div class=${heroClass}>
        <div class="ov-hero__grade">
          <${HealthGrade}
            grade=${grade}
            label=${health?.label ?? '—'}
            size=${88}
          />
          <div class="ov-grade-legend">
            <p class="ov-grade-legend__scale">
              <span class="ov-grade-legend__item ov-grade-legend__item--a">A Healthy</span>
              <span class="ov-grade-legend__sep">·</span>
              <span class="ov-grade-legend__item ov-grade-legend__item--c">C Warning</span>
              <span class="ov-grade-legend__sep">·</span>
              <span class="ov-grade-legend__item ov-grade-legend__item--f">F Critical</span>
            </p>
            <p class="ov-grade-legend__hint">Grade reflects open Issues by severity in your report window.</p>
          </div>
        </div>
        <div class="ov-hero__body">
          <h2 class="ov-hero__headline">${headline}</h2>
          <p class="ov-hero__sub">
            ${heroSubtext(layoutMode, attentionItems.length, isDown)}
          </p>
          <div class="ov-hero__kpis">
            ${scorecard?.crashes?.unreviewed ? html`
              <div class="ov-kpi">
                <span class="ov-kpi__label">Unreviewed</span>
                <span class="ov-kpi__value">${scorecard.crashes.unreviewed} crash${scorecard.crashes.unreviewed === 1 ? '' : 'es'}</span>
              </div>
            ` : null}
            ${scorecard?.performance?.subtitle ? html`
              <div class="ov-kpi">
                <span class="ov-kpi__label">Performance</span>
                <span class="ov-kpi__value">${scorecard.performance.subtitle}</span>
              </div>
            ` : null}
            ${stale ? html`
              <div class="ov-kpi">
                <span class="ov-kpi__label">Report</span>
                <span class="ov-kpi__value">Stale</span>
              </div>
            ` : null}
            ${!facts ? html`
              <div class="ov-kpi">
                <span class="ov-kpi__label">Next step</span>
                <span class="ov-kpi__value">Run a report</span>
              </div>
            ` : null}
          </div>
          ${scorecard?.crashes?.latest_label ? html`
            <p class="ov-verdict-latest-crash">
              <${Icon} name="bug" size=${12} />
              ${scorecard.crashes.latest_label}
            </p>
          ` : null}
        </div>
      </div>

      ${!facts && latest ? html`
        <div class="ov-firstrun">
          <div class="ov-firstrun__card">
            <span class="ov-firstrun__icon"><${Icon} name="file-text" size=${20} /></span>
            <strong>Live is flowing — run a report</strong>
            <p>Live metrics are here. A report unlocks the health grade, issues queue, and crash analysis.</p>
            <${Button} kind="accent" size="sm" onClick=${() => openModal('run-report')}>Run Report</${Button}>
          </div>
        </div>
      ` : null}

      <div class=${`ov-wide-grid ov-wide-grid--${layoutMode}${showTriage ? '' : ' ov-wide-grid--solo'}`}>
        ${triageColumn}
        <div class="ov-wide-grid__metrics">
          <div class="ov-secondary">
            ${insightSection}
            ${storageSection}
            ${pregenSection}
            ${bootSection}
          </div>
        </div>
      </div>

      </div>
    </${Page}>
  `;
}
