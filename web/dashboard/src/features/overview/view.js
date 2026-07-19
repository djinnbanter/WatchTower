/**
 * Overview — Live-inspired mission control.
 * Mission band → trust chips → triage | instrument cards.
 */

import { html, useState, useEffect, useRef } from '../../lib/preact.js';
import {
  Page, Section, MetricTile, ListRow, HealthGrade, Skeleton,
  Gauge, RadarDial,
} from '../../ui/patterns/index.js';
import { Button, Badge, Progress } from '../../ui/primitives/index.js';
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
import { overviewStatusPills, healthStatus } from '../../domain/labels.js';
import { buildWelcomeLead } from '../../domain/overview-welcome.js';
import { get as persistGet } from '../../state/persist.js';
import { resumeSetupWizard } from '../wizard/view.js';

const ATTENTION_CAP = 3;
const LAG_CAP = 3;

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

function diskTone(pct) {
  if (pct == null) return 'neutral';
  return pct > 90 ? 'danger' : pct > 75 ? 'warn' : 'ok';
}

function severityIcon(sev, kind) {
  if (kind === 'crash') return 'bug';
  if (kind === 'backup') return 'archive';
  return sev === 'critical' ? 'zap' : 'alert-triangle';
}

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

function missionTone(grade, attentionCount, isDown) {
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

function gradeWord(grade, healthLabel) {
  if (healthLabel) return healthLabel;
  if (grade === 'A' || grade === 'B') return 'Healthy';
  if (grade === 'C' || grade === 'D') return 'Warning';
  if (grade === 'F') return 'Critical';
  return 'Unknown';
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

function fmtVital(v, format) {
  if (v == null) return '—';
  return format ? format(v) : String(v);
}

// ── Server spec (loader / MC version) ──────────────────────────────────────────

const LOADER_LABELS = {
  neoforge: 'NeoForge',
  forge: 'Forge',
  fabric: 'Fabric',
  quilt: 'Quilt',
  paper: 'Paper',
  purpur: 'Purpur',
  spigot: 'Spigot',
  bukkit: 'Bukkit',
  vanilla: 'Vanilla',
};

function modList(facts) {
  const mods = facts?.optional?.mods;
  return Array.isArray(mods) ? mods : [];
}

/** loaderInfo(facts) -> { label, version } | null */
function loaderInfo(facts) {
  const raw = String(facts?.meta?.loader ?? '').toLowerCase();
  // Prefer the authoritative spark platform block when present.
  const platform = facts?.optional?.startup_profile?.platform
    ?? facts?.optional?.spark?.platform
    ?? null;
  const label = LOADER_LABELS[raw] || platform?.loader || (raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : null);
  if (!label) return null;

  let version = platform?.loader_version ?? null;
  if (!version) {
    const entry = modList(facts).find((m) => String(m.id ?? m.mod_id ?? '').toLowerCase() === raw);
    version = entry?.version ?? null;
  }
  return { label, version };
}

/** deriveMcVersion(facts) -> "1.21.1" | null */
function deriveMcVersion(facts) {
  // 1) Authoritative spark platform block.
  const platform = facts?.optional?.startup_profile?.platform
    ?? facts?.optional?.spark?.platform
    ?? null;
  if (platform?.minecraft) return String(platform.minecraft);

  // 2) Explicit minecraft mod entry.
  const mcEntry = modList(facts).find((m) => String(m.id ?? m.mod_id ?? '').toLowerCase() === 'minecraft');
  if (mcEntry?.version && /^\d+\.\d+/.test(String(mcEntry.version))) return String(mcEntry.version);

  // 3) Parse a +mc<x.y.z> / -<1.21.x> suffix from any mod version string.
  for (const m of modList(facts)) {
    const v = String(m.version ?? '');
    const mc = v.match(/[+-]mc(\d+\.\d+(?:\.\d+)?)/i) || v.match(/[+-](1\.\d+(?:\.\d+)?)/);
    if (mc) return mc[1];
  }

  // 4) Fall back to mapping NeoForge major (21.1.x -> 1.21.1).
  const loader = loaderInfo(facts);
  if (loader?.version) {
    const nf = String(loader.version).match(/^(\d+)\.(\d+)\.(\d+)/);
    if (nf) return `1.${nf[1]}.${nf[2]}`;
  }
  return null;
}

// ── Count-up hook ──────────────────────────────────────────────────────────────

function prefersReducedMotion() {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** rAF tween toward `value`; snaps when reduced-motion. Returns display number. */
function useCountUp(value, { duration = 420 } = {}) {
  const [display, setDisplay] = useState(value ?? null);
  const fromRef = useRef(value ?? 0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (value == null) {
      setDisplay(null);
      return undefined;
    }
    const from = Number(fromRef.current ?? value) || 0;
    const to = Number(value);
    if (prefersReducedMotion() || from === to || !Number.isFinite(from)) {
      fromRef.current = to;
      setDisplay(to);
      return undefined;
    }
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setDisplay(to);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return display;
}

// ── Local UI pieces ───────────────────────────────────────────────────────────

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

function VitalLive({
  label, raw, format, unit, tone = 'neutral', channel,
  caption, online,
}) {
  const animated = useCountUp(online ? raw : null);
  const display = animated == null ? '—' : fmtVital(animated, format);

  return html`
    <div
      class=${`ov-vital-live ov-vital-live--${tone}${channel ? ` ov-vital-live--${channel}` : ''}${online ? ' is-online' : ''}`}
    >
      <div class="ov-vital-live__head">
        <span class="ov-vital-live__label">${label}</span>
        ${online ? html`<span class="ov-vital-live__pulse" aria-hidden="true"></span>` : null}
      </div>
      <div class="ov-vital-live__figure">
        <span class="ov-vital-live__value">${display}</span>
        ${unit && animated != null ? html`<span class="ov-vital-live__unit">${unit}</span>` : null}
      </div>
      ${caption ? html`<span class="ov-vital-live__caption">${caption}</span>` : null}
    </div>
  `;
}

function MissionBand({
  grade,
  gradeLabel,
  tone,
  greeting,
  headline,
  sub,
  kpis,
  latestCrash,
  latest,
  showCpu,
}) {
  const online = latest != null;
  const tps = latest?.tps;
  const mspt = latest?.mspt;
  const players = latest?.players_online;
  const cpu = latest?.host_cpu_pct;
  const heapUsed = latest?.heap_mb?.used ?? null;
  const heapMax = latest?.heap_mb?.max ?? null;

  return html`
    <div class=${`ov-mission ov-mission--${tone}`} data-tour="overview">
      <div class="ov-mission__grade">
        <div class=${`ov-beacon ov-beacon--${tone}`}>
          <span class="ov-beacon__halo" aria-hidden="true"></span>
          <${HealthGrade}
            grade=${grade}
            label=${gradeLabel}
            size=${96}
          />
        </div>
        <span class="ov-mission__grade-word">${gradeLabel}</span>
      </div>

      <div class="ov-mission__verdict">
        ${greeting ? html`<p class="ov-mission__greeting">${greeting}</p>` : null}
        <h2 class="ov-mission__headline">${headline}</h2>
        <p class="ov-mission__sub">${sub}</p>
        ${kpis?.length ? html`
          <div class="ov-mission__kpis">
            ${kpis.map((k) => html`
              <div class=${`ov-kpi ov-kpi--${k.tone || 'neutral'}`} key=${k.label}>
                <span class="ov-kpi__label">${k.label}</span>
                <span class="ov-kpi__value">${k.value}</span>
              </div>
            `)}
          </div>
        ` : null}
        ${latestCrash ? html`
          <p class="ov-verdict-latest-crash">
            <${Icon} name="bug" size=${12} />
            ${latestCrash}
          </p>
        ` : null}
      </div>

      <div class=${`ov-mission__vitals${online ? ' ov-mission__vitals--live' : ''}`} aria-label="Live vitals">
        ${online ? html`
          <${VitalLive}
            label="TPS"
            raw=${tps}
            format=${(v) => formatTps(v)}
            tone=${tpsTone(tps)}
            channel="tps"
            online=${true}
          />
          <${VitalLive}
            label="MSPT"
            raw=${mspt}
            format=${(v) => Number(v).toFixed(1)}
            unit="ms"
            tone=${msptTone(mspt)}
            channel="mspt"
            online=${true}
          />
          <${VitalLive}
            label="Players"
            raw=${players}
            format=${(v) => String(Math.round(v))}
            tone="neutral"
            channel="players"
            online=${true}
          />
          <${VitalLive}
            label="Heap"
            raw=${heapUsed}
            format=${(v) => formatMb(v)}
            tone="neutral"
            channel="heap"
            caption=${heapMax != null ? `Max ${formatMb(heapMax)}` : null}
            online=${true}
          />
          ${showCpu ? html`
            <${VitalLive}
              label="CPU"
              raw=${cpu}
              format=${(v) => formatPct(v)}
              tone=${cpuTone(cpu)}
              channel="cpu"
              online=${true}
            />
          ` : null}
        ` : html`
          <div class="ov-mission__vitals-empty">
            ${[1, 2, 3].map((i) => html`<${Skeleton} key=${i} height=${64} className="ov-mission__vital-skel" />`)}
          </div>
        `}
      </div>
    </div>
  `;
}

function TrustChips({ uptimeSec, sessionWord, sessionTone, pills, facts, latest }) {
  const chips = [];

  const mc = deriveMcVersion(facts);
  const loader = loaderInfo(facts);
  const javaRaw = latest?.java_version ?? facts?.system?.java_version ?? null;

  if (mc) chips.push({ key: 'mc', label: 'Minecraft', value: mc, tone: 'info' });
  if (loader) {
    chips.push({
      key: 'loader',
      label: loader.label,
      value: loader.version || loader.label,
      tone: 'info',
    });
  }
  if (javaRaw) chips.push({ key: 'java', label: 'Java', value: String(javaRaw), tone: 'info' });

  if (uptimeSec != null) {
    chips.push({ key: 'uptime', label: 'Uptime', value: formatDuration(uptimeSec), tone: 'info' });
  }
  if (sessionWord) {
    chips.push({ key: 'session', label: 'Session', value: sessionWord, tone: sessionTone || 'neutral' });
  }
  for (const p of pills || []) {
    // Java / hosting already covered by identity chips above — skip duplicates.
    const label = String(p.label || '').toLowerCase();
    if (label === 'java' || label === 'hosting' || label === 'environment') continue;
    chips.push({
      key: p.label,
      label: p.label,
      value: p.value,
      tone: p.tone || 'neutral',
    });
  }
  if (!chips.length) return null;

  return html`
    <div class="ov-trust" role="list" aria-label="Server status">
      ${chips.map((c) => html`
        <div
          class=${`ov-trust__chip ov-trust__chip--${c.tone || 'neutral'}`}
          role="listitem"
          key=${c.key}
        >
          <span class="ov-trust__dot" aria-hidden="true"></span>
          <span class="ov-trust__label">${c.label}</span>
          <span class="ov-trust__value">${c.value}</span>
        </div>
      `)}
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
    <div class=${`ov-instrument ov-instrument--pregen ov-pregen${active ? ' is-active' : ''}`}>
      <div class="ov-pregen__layout">
        ${pct != null ? html`
          <div class="ov-instrument__dial">
            <${RadarDial} pct=${pct} kind=${radarKind} size=${88} />
          </div>
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
  const welcomeLead = buildWelcomeLead({
    username,
    hostname,
    firstRun: !!(noReport && !latest),
  });

  const diskPct   = latest?.disk_use_pct ?? null;
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
  const gradeLabel = gradeWord(grade, health?.label ?? healthStatus(health?.effective));

  const attentionItems = [...(queue.now ?? []), ...(queue.soon ?? [])];
  const attentionMore  = Math.max(0, attentionItems.length - ATTENTION_CAP);
  const hasBackupAttention = attentionItems.some((item) => item.kind === 'backup');

  const layoutMode =
    isDown
    || attentionItems.length > 0
    || grade === 'F'
    || health?.effective === 'critical'
      ? 'incident'
      : 'steady';

  const showCpu = latest?.host_cpu_pct != null;
  const hasInsight = !!(perfTldr?.label || perfTldr?.detail || perfVal?.insights?.length);
  const hasRightNow = !!(rightNow?.signals?.length);
  const hasLag = lagIssues.length > 0;
  const showTriage =
    (layoutMode === 'incident' && (attentionItems.length > 0 || hasRightNow || hasLag))
    || (layoutMode === 'steady' && hasRightNow);

  const headline = gradeHeadline(grade, attentionItems.length, isDown);
  const tone = missionTone(grade, attentionItems.length, isDown);

  function startTour() {
    import('../../app/tour.js').then((m) => m.startTour());
  }

  // ── No-report / first-run gate ─────────────────────────────────────────────
  if (noReport && !latest) {
    return html`
      <${Page} title="Overview" subtitle=${welcomeLead.hostLine || 'Your server control center'}>
        <div class="ui-page__stack" data-tour="overview">
          <p class="ov-mission__greeting ov-mission__greeting--solo">${welcomeLead.lead}</p>
          <p class="ov-firstrun-lead">Run a report to build your health grade and issue queue — or open Live to watch vitals stream in.</p>
          <div class="ov-firstrun">
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
        </div>
      </${Page}>
    `;
  }

  const subtitleText = hostname || 'Server health at a glance';

  const missionKpis = [];
  if (scorecard?.crashes?.unreviewed) {
    missionKpis.push({
      label: 'Unreviewed',
      value: `${scorecard.crashes.unreviewed} crash${scorecard.crashes.unreviewed === 1 ? '' : 'es'}`,
    });
  }
  if (scorecard?.crashes?.unreviewed) {
    missionKpis[missionKpis.length - 1].tone = 'warn';
  }
  if (scorecard?.performance?.subtitle) {
    missionKpis.push({ label: 'Performance', value: scorecard.performance.subtitle });
  }
  if (stale) missionKpis.push({ label: 'Report', value: 'Stale', tone: 'warn' });
  if (!facts) missionKpis.push({ label: 'Next step', value: 'Run a report', tone: 'accent' });

  const sessionWord = isDown
    ? 'Offline'
    : (latest?.players_online ?? 0) > 0
      ? 'Players online'
      : 'Idle';
  const sessionTone = isDown ? 'danger' : (latest?.players_online ?? 0) > 0 ? 'ok' : 'neutral';

  const statusPills = overviewStatusPills({
    facts,
    live: latest,
    opsCache: opsCacheData,
    overviewMeta: ovData,
    backupTrackingEnabled: settings.value?.data?.backup_tracking_enabled !== false,
  });

  const insightSection = hasInsight ? html`
    <${Section} title="Performance insight">
      <div class="ov-instrument ov-instrument--insight">
        <div class="ov-insight-row">
          <div class="ov-insight-text">
            <div class="ov-insight-label">
              ${perfTldr?.label ?? perfVal?.insights?.[0]?.title ?? 'Performance insights available'}
            </div>
            ${perfTldr?.detail ? html`
              <div class="ov-insight-detail">${perfTldr.detail}</div>
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
      </div>
    </${Section}>
  ` : null;

  const storageSection = (worldGb != null || latest?.java_rss_gb != null || byDimension.length || diskPct != null) ? (() => {
    const backupTrackingOn = settings.value?.data?.backup_tracking_enabled !== false;
    const showDisableBackup = backupTrackingOn
      && !hasBackupAttention
      && (
        facts?.optional?.last_backup?.status === 'unconfigured'
        || facts?.optional?.last_backup?.stale
      );
    const dimTotalGb = byDimension.reduce((sum, d) => sum + (d.gb ?? 0), 0);

    return html`
    <${Section} title="Storage">
      <div class="ov-instrument ov-instrument--storage ov-storage">
        <div class="ov-storage__hero">
          ${diskPct != null ? html`
            <div class="ov-instrument__dial">
              <${Gauge}
                value=${diskPct}
                max=${100}
                label="Disk used"
                unit="%"
                warnAt=${75}
                critAt=${90}
                size=${160}
                hero=${true}
                tone=${diskTone(diskPct)}
              />
            </div>
          ` : null}
          <div class="ov-storage__side">
            ${worldGb != null ? html`
              <${MetricTile}
                label="World size"
                value=${worldGb}
                format=${(v) => formatGb(v)}
                size="sm"
                padding="12"
              />
            ` : null}
            ${latest?.java_rss_gb != null ? html`
              <${MetricTile}
                label="Java RSS"
                value=${latest.java_rss_gb}
                format=${(v) => formatGb(v)}
                size="sm"
                padding="12"
              />
            ` : null}
            ${memAvGb != null ? html`
              <${MetricTile}
                label="RAM free"
                value=${memAvGb}
                format=${(v) => formatGb(v)}
                size="sm"
                padding="12"
              />
            ` : null}
          </div>
        </div>

        ${byDimension.length ? html`
          <div class="ov-storage__well">
            <p class="ov-storage__well-label">By dimension</p>
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
          </div>
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
    const totalLabel = total == null
      ? '—'
      : (Number(total) >= 100 ? `${Math.round(total)}` : `${Number(total).toFixed(1)}`);
    return html`
      <${Section} title="Boot profile">
        <div class="ov-instrument ov-instrument--boot ov-boot">
          <div class="ov-boot__heroes">
            <div class="ov-boot__hero ov-boot__hero--primary">
              <span class="ov-boot__hero-label">Boot time</span>
              <span class="ov-boot__hero-value">${totalLabel}</span>
              <span class="ov-boot__hero-unit">sec</span>
            </div>
            <div class="ov-boot__hero">
              <span class="ov-boot__hero-label">Slowest</span>
              <span class="ov-boot__hero-value ov-boot__hero-value--sm">${slowLabel}</span>
              ${slow?.sec != null ? html`
                <span class="ov-boot__hero-unit">${Number(slow.sec).toFixed(1)}s</span>
              ` : null}
            </div>
            <div class="ov-boot__hero">
              <span class="ov-boot__hero-label">Warnings</span>
              <span class="ov-boot__hero-value">${warnCount}</span>
            </div>
            <div class="ov-boot__hero">
              <span class="ov-boot__hero-label">Vs last</span>
              <span class="ov-boot__hero-value ov-boot__hero-value--sm">${deltaLabel}</span>
            </div>
          </div>
          <div class="ov-boot__action">
            <${Button}
              kind="neutral"
              size="sm"
              onClick=${() => navigate('startup')}
            >
              Open Startup
            </${Button}>
          </div>
        </div>
      </${Section}>
    `;
  })() : null;

  const lagMore = Math.max(0, lagIssues.length - LAG_CAP);

  const triageColumn = showTriage ? html`
    <div class="ov-wide-grid__triage">
      ${layoutMode === 'incident' && attentionItems.length > 0 ? html`
        <${Section}
          title="Needs attention"
          badge=${html`<${Badge} tone="danger">${attentionItems.length}</${Badge}>`}
        >
          <div class="ov-queue">
            ${attentionItems.slice(0, ATTENTION_CAP).map((item) => html`
              <${ListRow}
                key=${item.key}
                tone=${item.severity === 'critical' ? 'danger' : item.severity === 'warning' ? 'warn' : 'neutral'}
                icon=${html`<${Icon} name=${severityIcon(item.severity, item.kind)} size=${16} />`}
                title=${item.title}
                meta=${item.summary ?? null}
                actions=${html`
                  <${Button}
                    kind="neutral"
                    size="sm"
                    onClick=${() => navigate(
                      item.kind === 'crash' ? 'crashes'
                        : item.kind === 'backup' ? 'backups'
                        : 'issues',
                      item.kind === 'crash' || item.kind === 'backup'
                        ? undefined
                        : { view: 'active', issue: item.key },
                    )}
                  >
                    ${item.primaryAction?.label || 'Open Issues'}
                  </${Button}>
                `}
              />
            `)}
          </div>
          ${attentionMore > 0 ? html`
            <div class="ov-attention-more">
              <${Button} kind="neutral" size="sm" onClick=${() => navigate('issues', { view: 'active' })}>
                +${attentionMore} more on Issues
              </${Button}>
            </div>
          ` : null}
          ${settings.value?.data?.backup_tracking_enabled !== false && hasBackupAttention
            ? html`<${DisableBackupAlerts} />`
            : null}
        </${Section}>
      ` : null}

      ${hasRightNow ? html`
        <${Section} title="Right now">
          <div class="ov-queue">
            ${rightNow.signals.map((sig, i) => html`
              <${ListRow}
                key=${sig.type + String(i)}
                tone=${sig.severity === 'warning' ? 'warn' : sig.severity === 'critical' ? 'danger' : 'info'}
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
          <div class="ov-queue">
            ${lagIssues.slice(0, LAG_CAP).map((lag) => html`
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
          ${lagMore > 0 ? html`
            <div class="ov-attention-more">
              <${Button} kind="neutral" size="sm" onClick=${() => navigate('issues')}>
                +${lagMore} more on Issues
              </${Button}>
            </div>
          ` : null}
        </${Section}>
      ` : null}
    </div>
  ` : null;

  const setupChip = setupResumeChip();

  return html`
    <${Page}
      title="Overview"
      subtitle=${subtitleText}
    >
      <div data-tour="overview" class="ui-page__stack">

      <${MissionBand}
        grade=${grade}
        gradeLabel=${gradeLabel}
        tone=${tone}
        greeting=${welcomeLead.lead}
        headline=${headline}
        sub=${heroSubtext(layoutMode, attentionItems.length, isDown)}
        kpis=${missionKpis}
        latestCrash=${scorecard?.crashes?.latest_label ?? null}
        latest=${latest}
        showCpu=${showCpu}
      />

      ${setupChip ? html`
        <div class="ov-setup-chip" role="status">
          <span class="ov-setup-chip__icon"><${Icon} name="map" size=${16} /></span>
          <span class="ov-setup-chip__text">${setupChip.text}</span>
          <${Button} kind="neutral" size="sm" onClick=${setupChip.onClick}>${setupChip.actionLabel}</${Button}>
        </div>
      ` : null}

      <${TrustChips}
        uptimeSec=${uptimeSec}
        sessionWord=${sessionWord}
        sessionTone=${sessionTone}
        pills=${statusPills}
        facts=${facts}
        latest=${latest}
      />

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
