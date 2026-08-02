import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import NumberFlow from '@number-flow/react';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Calendar,
  Clock3,
  Database,
  Gauge,
  HardDrive,
  Layers,
  Power,
  Radar,
  Siren,
  Timer,
  TrendingDown,
  TrendingUp,
  Zap,
} from '@/ui/icons';
import { api } from '@/api/client';
import { navigate, type RouteState } from '@/app/router';
import { ChartStatFlow } from '@/components/charts/chart-stat-flow';
import {
  isSetupWizardPaused,
  resumeSetupWizard,
} from '@/features/wizard/persist';
import { useSessionStore } from '@/app/session-store';
import {
  FadeIn,
  GlareIcon,
  PageEnter,
  Stagger,
} from '@/ui/motion';
import {
  Button,
  EmptyState,
  ErrorState,
  HeroCard,
  LIST_CAP,
  QueueRow,
  SpecularCtaButton,
  StatusPill,
} from '@/ui/patterns';
import { AreaLineChart, WtDiskDualGauge, WtLinearDualGauge } from '@/ui/charts';
import { asArray, asRecord, bool, get, num, str, timeAgo } from '@/lib/utils';
import { formatInstantRange } from '@/lib/datetime';
import { useDashboardTimezone } from '@/app/timezone';
import { formatDuration, formatGb, formatPct } from '@/domain/formats';
import { acksMapFromResponse, isIssueAcked } from '@/features/issues/helpers';
import { filterLiveTakeaways } from '@/features/live/takeaways';
import { buildIdentityChips } from './identity';
import {
  attentionFromGradeReasons,
  gradeReasonTeasers,
  openTabLabel,
  resolveMissionStatus,
} from './mission-status';
import { parseDigestHistory, trendLabel, trendTone } from '@/features/insights/weekly-digest';
import { incidentStoryBlurb, incidentStoryTitle } from './incident-story-title';
import './overview.css';

const ATTENTION_CAP = LIST_CAP;
const SIGNAL_CAP = LIST_CAP;
const LAG_CAP = LIST_CAP;

const PLATE = 'wt-plate ov-plate ov-instrument';

function PlateHead({
  title,
  icon: Icon,
  actions,
  tone = 'accent',
}: {
  title: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  actions?: ReactNode;
  tone?: 'accent' | 'ok' | 'warn' | 'danger' | 'info';
}) {
  return (
    <div className="ov-plate__head">
      <div className="ov-plate__title">
        {Icon ? <GlareIcon icon={Icon} tone={tone} size={14} className="h-6 w-6 rounded-md" /> : null}
        <h3>{title}</h3>
      </div>
      {actions}
    </div>
  );
}

const DIM_COLORS = [
  'var(--wt-ch-heap)',
  'var(--wt-ch-disk)',
  'var(--wt-ch-tps)',
  'var(--wt-ch-mspt)',
  'var(--wt-ch-cpu)',
  'var(--wt-ch-players)',
];

const severityTone: Record<string, 'ok' | 'warn' | 'danger' | 'info' | 'neutral'> = {
  critical: 'danger',
  danger: 'danger',
  warning: 'warn',
  warn: 'warn',
  info: 'info',
  ok: 'ok',
  pass: 'ok',
  wait: 'danger',
  caution: 'warn',
  safe: 'ok',
};


function BootHeroValue({ value, format }: { value: number; format: (n: number) => string }) {
  return <>{format(value)}</>;
}

/** Trend chip for metrics where higher is worse (GC / heap). */
function HygieneTrend({
  current,
  prior,
  format = (n) => n.toFixed(1),
  suffix = '%',
}: {
  current: number;
  prior: number;
  format?: (n: number) => string;
  suffix?: string;
}) {
  const delta = current - prior;
  const flat = Math.abs(delta) < 0.05;
  const worse = delta > 0;
  const Icon = flat ? null : worse ? TrendingUp : TrendingDown;
  const tone = flat ? 'flat' : worse ? 'up' : 'down';
  const rel =
    prior > 0 ? Math.round((delta / prior) * 100) : delta > 0 ? 100 : delta < 0 ? -100 : 0;

  return (
    <span className={`ov-restart-metric__delta ov-restart-metric__delta--${tone}`}>
      {Icon ? <Icon size={12} className="ov-restart-metric__trend-icon" aria-hidden /> : null}
      <span>
        {format(prior)}
        {suffix}
        {!flat ? (
          <>
            {' '}
            → {worse ? '+' : ''}
            {rel}%
          </>
        ) : null}
      </span>
    </span>
  );
}

/** Advance sample uptime by wall-clock so the mission KPI ticks like a live clock. */
function useLiveUptimeSec(baseSec: number, polledAt?: string) {
  const anchor = useMemo(() => {
    const parsed = polledAt ? Date.parse(polledAt) : NaN;
    return {
      base: Math.max(0, Math.floor(baseSec)),
      wallMs: Number.isFinite(parsed) ? parsed : Date.now(),
    };
  }, [baseSec, polledAt]);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return Math.max(0, Math.floor(anchor.base + (nowMs - anchor.wallMs) / 1000));
}

function MissionUptimeClock({
  baseSec,
  polledAt,
}: {
  baseSec: number;
  polledAt?: string;
}) {
  const live = useLiveUptimeSec(baseSec, polledAt);
  const days = Math.floor(live / 86400);
  const hours = Math.floor((live % 86400) / 3600);
  const mins = Math.floor((live % 3600) / 60);
  const secs = live % 60;
  const tone = live >= 72 * 3600 ? 'warn' : 'info';
  // Multi-day uptime: drop seconds so the KPI tile stays compact.
  const longForm = days > 0;

  return (
    <div
      className={`ov-kpi ov-kpi--uptime${longForm ? ' ov-kpi--uptime-long' : ''} ov-kpi--${tone}`}
      title={formatDuration(live)}
    >
      <span className="ov-kpi__label">Uptime</span>
      <span className="ov-kpi__clock" aria-label={`Uptime ${formatDuration(live)}`}>
        {longForm ? (
          <>
            <NumberFlow value={days} isolate willChange format={{ maximumFractionDigits: 0 }} />
            <span className="ov-kpi__clock-unit">d</span>
            <NumberFlow value={hours} isolate willChange format={{ maximumFractionDigits: 0 }} />
            <span className="ov-kpi__clock-unit">h</span>
            <NumberFlow value={mins} isolate willChange format={{ maximumFractionDigits: 0 }} />
            <span className="ov-kpi__clock-unit ov-kpi__clock-unit--tail">m</span>
          </>
        ) : (
          <>
            <NumberFlow
              value={Math.floor(live / 3600)}
              isolate
              willChange
              format={{ maximumFractionDigits: 0 }}
            />
            <span className="ov-kpi__clock-unit">h</span>
            <NumberFlow value={mins} isolate willChange format={{ maximumFractionDigits: 0 }} />
            <span className="ov-kpi__clock-unit">m</span>
            <NumberFlow value={secs} isolate willChange format={{ maximumFractionDigits: 0 }} />
            <span className="ov-kpi__clock-unit ov-kpi__clock-unit--tail">s</span>
          </>
        )}
      </span>
    </div>
  );
}

/** Last N sample points for Overview hero sparklines (not Live dials). */
function sampleSeries(
  samples: Record<string, unknown>,
  key: string,
  take = 40,
  map?: (v: number) => number,
): number[] {
  const pts = asArray<Record<string, unknown>>(samples[key]);
  if (!pts.length) return [];
  const slice = pts.length > take ? pts.slice(pts.length - take) : pts;
  return slice.map((p) => {
    const v = num(p.v);
    return map ? map(v) : v;
  });
}

/**
 * Overview hero vital — NumberFlow (Bklit ChartStatFlow) + mini sparkline.
 * Intentionally not WtGauge dials (those live on Live).
 */
function VitalFlow({
  label,
  channel,
  value,
  series,
  formatOptions,
  suffix,
  tone = 'default',
}: {
  label: string;
  channel: 'tps' | 'mspt' | 'players' | 'heap' | 'cpu';
  value: number;
  series: number[];
  formatOptions?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  };
  suffix?: string;
  tone?: 'default' | 'ok' | 'warn' | 'danger';
}) {
  const toneClass =
    tone === 'ok'
      ? 'text-wt-ok'
      : tone === 'warn'
        ? 'text-wt-warn'
        : tone === 'danger'
          ? 'text-wt-danger'
          : '';

  return (
    <div className={`ov-vital ov-vital--${channel}`}>
      <div className="ov-vital__label">
        <span className="ov-vital__dot" aria-hidden />
        {label}
      </div>
      <div className={`ov-vital__flow ${toneClass}`}>
        <ChartStatFlow
          value={Number.isFinite(value) ? value : 0}
          label={label}
          labelClassName="sr-only"
          valueClassName="ov-vital__flow-value"
          formatOptions={formatOptions}
          suffix={suffix}
        />
      </div>
      {series.length > 1 ? (
        <div className="ov-vital__spark" aria-hidden>
          <AreaLineChart
            series={[series]}
            height={28}
            showGrid={false}
            colors={['var(--vital-ch, var(--wt-accent))']}
          />
        </div>
      ) : (
        <div className="ov-vital__spark ov-vital__spark--empty" aria-hidden />
      )}
    </div>
  );
}

function buildDimMeters(
  dims: Record<string, unknown>[],
  worldGb = 0,
): { label: string; gb: number; sharePct: number; color: string }[] {
  const rawTotal = dims.reduce((s, d) => s + num(d.gb), 0) || 1;
  const scale = worldGb > 0 && rawTotal > worldGb * 1.35 ? worldGb / rawTotal : 1;
  const total = Math.max(worldGb > 0 ? worldGb : rawTotal * scale, 0.1);
  return [...dims]
    .sort((a, b) => num(b.gb) - num(a.gb))
    .map((dim, i) => {
      const gb = num(dim.gb) * scale;
      return {
        label: str(dim.label, str(dim.id, `Dimension ${i + 1}`)),
        gb: Number(gb.toFixed(1)),
        sharePct: (gb / total) * 100,
        color: DIM_COLORS[i % DIM_COLORS.length]!,
      };
    });
}

function StoragePanel({
  diskPct,
  worldGb,
  dims,
  diskProj,
  diskJump,
  rssHint,
}: {
  diskPct: number;
  worldGb: number;
  dims: Record<string, unknown>[];
  diskProj: Record<string, unknown>;
  diskJump: Record<string, unknown>;
  rssHint: string;
}) {
  const meters = buildDimMeters(dims, worldGb);
  const showFooter =
    !!str(diskProj.message) ||
    !!str(diskJump.label, str(diskJump.message)) ||
    !!rssHint;

  return (
    <div className="ov-storage">
      <div className="ov-storage__layout">
        {diskPct > 0 ? (
          <div className="ov-storage__gauge" aria-label={`Disk ${formatPct(diskPct)}`}>
            <WtDiskDualGauge value={diskPct} size={200} />
          </div>
        ) : null}

        <div className="ov-storage__side">
          {worldGb > 0 ? (
            <div className="ov-storage__meta">
              <GlareIcon icon={Database} size={13} className="h-6 w-6" tone="info" />
              <div className="ov-storage__meta-copy">
                <span className="ov-storage__meta-label">World size</span>
                <span className="ov-storage__meta-value">{formatGb(worldGb)}</span>
              </div>
            </div>
          ) : null}

          {meters.length ? (
            <div className="ov-storage__legend">
              <div className="ov-storage__legend-title">By dimension</div>
              {meters.map((row) => (
                <div
                  key={row.label}
                  className="ov-storage-meter"
                  style={{ ['--ov-storage-fill' as string]: row.color }}
                  role="meter"
                  aria-label={`${row.label} storage`}
                  aria-valuenow={Math.round(row.sharePct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span
                    className="ov-storage-meter__fill"
                    style={{ width: `${Math.max(1.5, Math.min(100, row.sharePct))}%` }}
                  />
                  <span className="ov-storage-meter__label">{row.label}</span>
                  <span className="ov-storage-meter__value">
                    {formatGb(row.gb)} · {formatPct(row.sharePct)}
                  </span>
                </div>
              ))}
            </div>
          ) : !worldGb && diskPct <= 0 ? (
            <p className="text-sm text-wt-text-low">No storage samples yet.</p>
          ) : null}
        </div>
      </div>

      {showFooter ? (
        <div className="ov-storage__footer">
          {str(diskProj.message) ? (
            <div className="ov-storage__note">
              <Clock3 size={14} className="ov-storage__note-icon text-wt-text-low" />
              <span>{str(diskProj.message)}</span>
            </div>
          ) : null}
          {str(diskJump.label) || str(diskJump.message) ? (
            <div className="ov-storage__note text-wt-warn">
              <HardDrive size={14} className="ov-storage__note-icon" />
              <span>{str(diskJump.label, str(diskJump.message))}</span>
            </div>
          ) : null}
          {rssHint ? (
            <div className="ov-storage__note text-wt-warn">
              <AlertTriangle size={14} className="ov-storage__note-icon" />
              <span>{rssHint}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PregenCard({
  title,
  pregen,
}: {
  title: string;
  pregen: Record<string, unknown>;
}) {
  const last = asRecord(pregen.last);
  const pct = last.pct != null ? num(last.pct) : num(pregen.percent, num(pregen.progress_pct));
  const active = !!pregen.pregen_active || !!pregen.active;
  const paused = !!pregen.pregen_paused;
  if (pct <= 0 && !active && !last.chunks) return null;

  const dim = str(last.dimension, '—').replace(/^minecraft:/, '');
  const tone = paused ? 'accent' : active ? 'warn' : 'ok';

  // Recessed nest tile inside the jobs plate — no second outer chrome.
  return (
    <div className={`ov-pregen${active ? ' is-active' : ''}${paused ? ' is-paused' : ''}`}>
      <div className="ov-pregen__head">
        <div className="ov-pregen__titles min-w-0">
          <strong className="ov-pregen__title">{title}</strong>
          <div className="ov-pregen__dim">
            {dim}
            {pct > 0 ? <span className="ov-pregen__dim-pct"> · {pct.toFixed(1)}%</span> : null}
          </div>
        </div>
        <StatusPill tone={paused ? 'neutral' : active ? 'warn' : 'ok'}>
          {paused ? 'Paused' : active ? 'Active' : 'Recent'}
        </StatusPill>
      </div>

      <div className="ov-pregen__gauge">
        <WtLinearDualGauge value={pct} label={title} tone={tone} showLabel={false} />
      </div>

      <div className="ov-pregen__stats">
        {last.chunks != null ? (
          <div className="ov-pregen__stat">
            <span className="ov-pregen__stat-label">Chunks</span>
            <span className="ov-pregen__stat-value">
              {num(last.chunks).toLocaleString()}
              {last.total != null ? (
                <span className="text-wt-text-low"> / {num(last.total).toLocaleString()}</span>
              ) : null}
            </span>
          </div>
        ) : null}
        {(last.cps ?? last.rate ?? pregen.cps_avg) != null ? (
          <div className="ov-pregen__stat">
            <span className="ov-pregen__stat-label">Rate</span>
            <span className="ov-pregen__stat-value">
              {num(last.cps ?? last.rate ?? pregen.cps_avg).toFixed(1)} cps
            </span>
          </div>
        ) : null}
        {str(last.eta) ? (
          <div className="ov-pregen__stat">
            <span className="ov-pregen__stat-label">ETA</span>
            <span className="ov-pregen__stat-value">{str(last.eta)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PageView({ route: _route }: { route: RouteState }) {
  const metaQ = useQuery({ queryKey: ['overview-meta'], queryFn: api.overviewMeta });
  const opsQ = useQuery({ queryKey: ['ops-cache'], queryFn: api.opsCache });
  const digestQ = useQuery({ queryKey: ['weekly-digest'], queryFn: api.weeklyDigest });
  const acksQ = useQuery({ queryKey: ['issues-acks'], queryFn: api.issuesAcks });
  const liveQ = useQuery({ queryKey: ['live'], queryFn: api.live, refetchInterval: 15_000 });
  const factsQ = useQuery({ queryKey: ['facts'], queryFn: api.facts });
  const settingsQ = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const samplesQ = useQuery({
    queryKey: ['overview-samples', 30, 48],
    queryFn: () => api.samples(30, 48),
    refetchInterval: 15_000,
  });

  const [lagOpen, setLagOpen] = useState(true);
  const [storyOpen, setStoryOpen] = useState(false);
  const [instrumentsExpanded, setInstrumentsExpanded] = useState(false);
  const [digestDismissedId, setDigestDismissedId] = useState(
    () => (typeof localStorage !== 'undefined' ? localStorage.getItem('wt.digest.dismissed') : null) || '',
  );
  const wasIncidentLayout = useRef(false);
  const { resolvedZone } = useDashboardTimezone();

  // Sync collapse defaults when Overview enters incident (hooks must run before early returns).
  useEffect(() => {
    if (metaQ.isLoading || metaQ.isError) return;
    const meta = asRecord(metaQ.data);
    const scorecard = asRecord(meta.scorecard);
    const grade = str(scorecard.grade, str(meta.health_grade, 'ok')).toLowerCase();
    const health = asRecord(asRecord(factsQ.data).health);
    const ops = asRecord(opsQ.data);
    const openIssues = asArray<Record<string, unknown>>(ops.issues_live).some((row) => {
      const status = str(row.status, 'open').toLowerCase();
      return status === 'open';
    });
    const incident =
      openIssues ||
      grade === 'critical' ||
      grade === 'f' ||
      str(health.effective, str(health.status)).toLowerCase() === 'critical' ||
      num(asRecord(scorecard.crashes).unreviewed) > 0 ||
      attentionFromGradeReasons(scorecard.grade_reasons).length > 0;
    if (incident && !wasIncidentLayout.current) {
      setLagOpen(true);
      setStoryOpen(false);
    }
    wasIncidentLayout.current = incident;
  }, [metaQ.data, opsQ.data, factsQ.data, metaQ.isLoading, metaQ.isError]);

  const sparkSeries = useMemo(() => {
    const samples = asRecord(samplesQ.data);
    const live = asRecord(liveQ.data);
    const latest = asRecord(live.latest);
    const heap = asRecord(latest.heap_mb);
    const heapMax = num(heap.max);
    return {
      tps: sampleSeries(samples, 'tps'),
      mspt: sampleSeries(samples, 'mspt'),
      players: sampleSeries(samples, 'players'),
      heap: sampleSeries(samples, 'heap_mb', 40, (v) => (heapMax > 0 ? (v / heapMax) * 100 : v)),
      cpu: sampleSeries(samples, 'host_cpu'),
    };
  }, [samplesQ.data, liveQ.data]);

  if (metaQ.isLoading || opsQ.isLoading || liveQ.isLoading || factsQ.isLoading) {
    return (
      <PageEnter className="ov-stack">
        <div className="h-44 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        <div className="h-8 w-full animate-pulse rounded-[var(--radius-wt-sm)] bg-wt-bg2" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-56 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
          <div className="h-56 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        </div>
      </PageEnter>
    );
  }

  if (metaQ.isError) {
    return <ErrorState title="Couldn't load overview">{(metaQ.error as Error)?.message}</ErrorState>;
  }

  const meta = asRecord(metaQ.data);
  const ops = asRecord(opsQ.data);
  const live = asRecord(liveQ.data);
  const facts = asRecord(factsQ.data);
  const settings = asRecord(settingsQ.data);
  const optional = asRecord(facts.optional);
  const latest = asRecord(get(live, 'latest'));
  const scorecard = asRecord(meta.scorecard);
  const grade = str(scorecard.grade, str(meta.health_grade, 'ok'));
  const scorecardWord = str(scorecard.grade_word, '');
  const perf = asRecord(scorecard.performance);
  const crashes = asRecord(scorecard.crashes);
  const health = asRecord(facts.health);
  const system = asRecord(facts.system);

  const acks = acksMapFromResponse(acksQ.data);
  const signals = filterLiveTakeaways(
    asArray<Record<string, unknown>>(get(meta, 'right_now', 'signals')),
    acks,
    ops,
  );
  const liveIssues = asArray<Record<string, unknown>>(ops.issues_live).filter((row) => {
    const status = str(row.status, 'open').toLowerCase();
    if (status !== 'open') return false;
    const id = str(row.id, str(row.key));
    const key = id.startsWith('issue:') ? id : `issue:${id}`;
    if (isIssueAcked(acks, key) || isIssueAcked(acks, id)) return false;
    return true;
  });
  const lagBundle = asRecord(optional.lag_incidents);
  const lagIncidents = asArray<Record<string, unknown>>(
    lagBundle.entries ?? optional.lag_incidents ?? ops.lag_issues,
  );
  const stories = asArray<Record<string, unknown>>(
    Array.isArray(optional.incident_stories)
      ? optional.incident_stories
      : asRecord(optional.incident_stories).stories,
  );
  const latestStory = stories[0] ?? null;
  const digestRows = parseDigestHistory(digestQ.data ?? asRecord(ops.weekly_digest));
  const latestDigest = digestRows[0] ?? null;
  const hasDigest = Boolean(latestDigest) && digestDismissedId !== latestDigest!.id;

  const attentionItems: {
    id: string;
    label: string;
    detail: string;
    severity: string;
    tab: string;
    view?: string;
    issue?: string;
  }[] = [];
  for (const i of liveIssues) {
    attentionItems.push({
      id: str(i.id, str(i.key)),
      label: str(i.message, str(i.key)),
      detail: `${str(i.source, 'ops')} · last ${timeAgo(str(i.last_seen))}`,
      severity: str(i.severity, 'info'),
      tab: 'issues',
      issue: str(i.id, str(i.key)),
    });
  }
  const crashUnreviewed = num(crashes.unreviewed);
  if (crashUnreviewed > 0) {
    attentionItems.push({
      id: 'crashes-unreviewed',
      label: `${crashUnreviewed} unreviewed crash report${crashUnreviewed === 1 ? '' : 's'}`,
      detail: 'Open Crashes to triage fingerprints',
      severity: 'warning',
      tab: 'crashes',
    });
  }
  const backups = asRecord(ops.backups_live);
  if (asRecord(backups.last_backup).stale || str(asRecord(optional.last_backup).status) === 'unconfigured') {
    attentionItems.push({
      id: 'backup-attention',
      label: 'Backup tracking needs attention',
      detail: str(asRecord(optional.last_backup).detail, 'Check Backups setup'),
      severity: 'warning',
      tab: 'backups',
    });
  }
  // Scorecard grade can be degraded/critical with zero open issues.
  // Surface grade_reasons so Needs attention explains the pill.
  const existingAttentionIds = new Set(attentionItems.map((it) => it.id));
  const gradeAlreadyExplainedByCrashRow =
    existingAttentionIds.has('crashes-unreviewed');
  for (const row of attentionFromGradeReasons(scorecard.grade_reasons)) {
    if (row.id === 'grade:unreviewed_crashes' && gradeAlreadyExplainedByCrashRow) {
      continue; // avoid duplicate crash rows
    }
    if (existingAttentionIds.has(row.id)) continue;
    attentionItems.push({
      id: row.id,
      label: row.label,
      detail: row.detail,
      severity: row.severity,
      tab: row.tab,
    });
    existingAttentionIds.add(row.id);
  }
  const ramEnvelope = asRecord(live.ram_envelope);
  if (str(ramEnvelope.envelope) === 'critical' && !existingAttentionIds.has('ram-envelope-critical')) {
    attentionItems.push({
      id: 'ram-envelope-critical',
      label: 'Heap leaves too little room on this host',
      detail: 'Review RAM sizing — lower -Xmx or raise the plan before an external OOM kill',
      severity: 'danger',
      tab: 'insights',
      view: 'configs',
    });
    existingAttentionIds.add('ram-envelope-critical');
  }
  const seenAttention = new Set<string>();
  const attentionDeduped = attentionItems.filter((it) => {
    if (!it.label || seenAttention.has(it.label)) return false;
    seenAttention.add(it.label);
    return true;
  });

  const noReport = !meta.last_report_at && !facts.meta;
  const hasLive = Object.keys(latest).length > 0;

  if (noReport && !hasLive) {
    return (
      <PageEnter className="ov-stack">
        <div className="ov-firstrun-lead">
          <p className="ov-firstrun-lead__title">No report yet — start with Live vitals or the Issues queue.</p>
          <p className="ov-firstrun-lead__hint">
            Watching and Scanning are already updating. Open Live for TPS and heap, or Issues for continuous triage.
          </p>
        </div>
        <Stagger className="space-y-2" delayMs={50}>
          <QueueRow
            title="Open Live"
            detail="Watch TPS, tick lag, heap, and players stream in real time."
            action={
              <SpecularCtaButton kind="primary" onClick={() => navigate({ tab: 'live' })}>
                Go to Live
              </SpecularCtaButton>
            }
          />
          <QueueRow
            title="Open Issues"
            detail="Continuous scanning fills the fix queue even before a deep audit."
            action={<Button onClick={() => navigate({ tab: 'issues' })}>Go to Issues</Button>}
          />
          <QueueRow
            title="Support pack"
            detail="Build a redacted zip to share when something’s wrong."
            action={
              <Button onClick={() => window.dispatchEvent(new Event('wt:open-support'))}>
                Build support pack
              </Button>
            }
          />
        </Stagger>
      </PageEnter>
    );
  }

  const layoutMode =
    attentionDeduped.length > 0 ||
    grade.toLowerCase() === 'critical' ||
    grade.toLowerCase() === 'f' ||
    str(health.effective, str(health.status)) === 'critical'
      ? 'incident'
      : 'steady';

  const hasRightNow = signals.length > 0;
  const hasLag = lagIncidents.length > 0;
  const hasStory = !!latestStory;
  const nestSignalsUnderAttention =
    layoutMode === 'incident' && attentionDeduped.length > 0 && hasRightNow;
  const showTriage =
    (layoutMode === 'incident' && (attentionDeduped.length > 0 || hasRightNow || hasLag)) ||
    (layoutMode === 'steady' && (hasRightNow || hasStory || hasDigest));
  const showStandaloneSignals = hasRightNow && !nestSignalsUnderAttention;

  const { tone, letter, word: gradeWord } = resolveMissionStatus(grade, attentionDeduped.length);
  // Prefer backend grade_word when it matches the resolved tone; never keep "Degraded" on green.
  const displayWord =
    tone === 'ok'
      ? 'Healthy'
      : scorecardWord && scorecardWord.toLowerCase() !== 'healthy'
        ? scorecardWord
        : gradeWord;
  const reportStale = !!meta.stale || num(meta.age_hours) > 24;
  const headline = displayWord;
  const sub = str(perf.subtitle, str(health.label, 'No performance issues detected in the lookback window.'));

  const tps = num(latest.tps, 20);
  const mspt = num(latest.mspt);
  const cpu = num(latest.host_cpu_pct);
  const players = num(latest.players_online);
  const heap = asRecord(latest.heap_mb);
  const heapPct = num(heap.max) > 0 ? (num(heap.used) / num(heap.max)) * 100 : 0;

  const jvm = asRecord(optional.jvm_health);
  const safeRestart = asRecord(
    meta.safe_restart && typeof meta.safe_restart === 'object'
      ? meta.safe_restart
      : optional.safe_restart,
  );
  const restartHygiene = asRecord(meta.restart_hygiene);
  const modRestartNudge = asRecord(meta.mod_restart_nudge);
  const storage = asRecord(optional.storage);
  const diskProj = asRecord(optional.disk_projection);
  const diskJump = asRecord(meta.disk_jump_tldr);
  const chunky = asRecord(optional.chunky_pregen ?? live.chunky_pregen);
  const dh = asRecord(optional.dh_pregen ?? live.dh_pregen);
  const startup = asRecord(optional.startup_profile);
  const dims = asArray<Record<string, unknown>>(latest.by_dimension);
  const diskPct = num(latest.disk_use_pct, num(diskProj.disk_use_pct));
  const worldGb = num(latest.world_gb, num(storage.world_gb));
  const uptimeSec = num(latest.java_uptime_sec, num(system.uptime_sec));

  const perfTldr = asRecord(meta.performance_insights_tldr);
  const sparkTldr = asRecord(meta.spark_tldr);
  const hasInsight = !!(perfTldr.label || perfTldr.detail || str(perf.subtitle));
  const hasSpark = !!(sparkTldr.label || sparkTldr.mod_id);

  const sessionWord = players > 0 ? 'Players online' : 'Idle';

  const backupTracking = settings.backup_tracking_enabled !== false;
  const setupPaused = isSetupWizardPaused();
  const hasBackupDir = !!(str(settings.backup_dir) || str(settings.backup_dirs));
  const setupIncomplete =
    !hasBackupDir ||
    (backupTracking && str(asRecord(optional.last_backup).status) === 'unconfigured');

  const topAttention = attentionDeduped[0];
  const nextAction = setupPaused
    ? {
        kind: 'primary' as const,
        label: 'Resume setup',
        hint: 'Setup is unfinished — resume the guided wizard when you are ready.',
        onClick: () => {
          const mode = resumeSetupWizard();
          if (mode === 'resume') {
            useSessionStore.getState().setBootPhase('wizard');
          } else {
            window.location.search = '?setup=1';
            window.location.reload();
          }
        },
      }
    : setupIncomplete
    ? {
        kind: 'primary' as const,
        label: 'Open Backups',
        hint: 'Finish setup — backups tracking or directory still incomplete.',
        onClick: () => navigate({ tab: 'backups' }),
      }
    : topAttention
      ? {
          kind: 'primary' as const,
          label: `Open ${openTabLabel(topAttention.tab)}`,
          hint: topAttention.label,
          onClick: () =>
            navigate({
              tab: topAttention.tab,
              view:
                topAttention.view ??
                (topAttention.tab === 'issues' ? 'active' : undefined),
              issue: topAttention.issue ?? null,
            }),
        }
      : null;

  const gradeTeasers = gradeReasonTeasers(scorecard.grade_reasons, 2).filter(
    (line) => !nextAction || line !== nextAction.hint,
  );

  const identityChips = buildIdentityChips({ live, facts, settings, jvm });
  const metaBits = [sessionWord].filter(Boolean);
  const serverName = identityChips.find((c) => c.key === 'server')?.value || 'Server';
  const uptimePolledAt = str(latest.polled_at) || str(live.polled_at);

  const missionKpis: { label: string; value: string; unit?: string; tone?: string }[] = [];
  if (num(crashes.unreviewed)) {
    missionKpis.push({
      label: 'Unreviewed',
      value: String(num(crashes.unreviewed)),
      unit: num(crashes.unreviewed) === 1 ? 'crash' : 'crashes',
      tone: 'warn',
    });
  }
  if (num(perf.low_tps_minutes_24h)) {
    missionKpis.push({
      label: 'Low-TPS',
      value: String(num(perf.low_tps_minutes_24h)),
      unit: 'min · 24h',
      tone: 'warn',
    });
  }
  if (perf.mspt_p95_24h != null) {
    missionKpis.push({
      label: 'MSPT p95',
      value: num(perf.mspt_p95_24h).toFixed(1),
      unit: 'ms',
    });
  }
  if (reportStale) {
    missionKpis.push({ label: 'Scanning', value: 'Stale', unit: 'Sources', tone: 'warn' });
  }

  const gridClass = [
    'ov-wide-grid',
    layoutMode === 'incident' ? 'ov-wide-grid--incident' : 'ov-wide-grid--steady',
    !showTriage ? 'ov-wide-grid--solo' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const attentionShown = attentionDeduped.slice(0, ATTENTION_CAP);
  const attentionMore = Math.max(0, attentionDeduped.length - ATTENTION_CAP);
  const lagShown = lagIncidents.slice(0, LAG_CAP);
  const lagMore = Math.max(0, lagIncidents.length - LAG_CAP);
  const signalsShown = signals.slice(0, SIGNAL_CAP);
  const signalsMore = Math.max(0, signals.length - SIGNAL_CAP);

  const slowest = asArray<Record<string, unknown>>(startup.slowest)[0];
  const compare = asRecord(startup.compare_to_last_boot);
  const bootWarnings = asArray(startup.warnings).length;

  const renderStoryPlate = () =>
    hasStory ? (
      <article className={`${PLATE} ov-instrument--story`}>
        <PlateHead
          title="Incident story"
          icon={Layers}
          actions={
            <button
              type="button"
              className="ov-collapsible-toggle"
              aria-expanded={storyOpen}
              aria-controls="ov-incident-story-panel"
              onClick={() => setStoryOpen((v) => !v)}
            >
              {storyOpen ? 'Collapse' : 'Expand'}
            </button>
          }
        />
        {storyOpen ? (
          <div id="ov-incident-story-panel" className="ov-story">
            <div className="ov-story__hero">
              <div className="ov-story__headline">{incidentStoryTitle(latestStory!)}</div>
              <span className="ov-story__when">{timeAgo(str(latestStory!.started_at))}</span>
            </div>
            {incidentStoryBlurb(latestStory!) ? (
              <p className="ov-story__narrative">{incidentStoryBlurb(latestStory!)}</p>
            ) : null}
            <div className="ov-story__footer">
              <Button kind="ghost" onClick={() => navigate({ tab: 'activity' })}>
                Open Activity
              </Button>
            </div>
          </div>
        ) : null}
      </article>
    ) : null;

  const renderDigestPlate = () =>
    hasDigest ? (
      <article className={`${PLATE} ov-instrument--digest`}>
        <PlateHead
          title="Weekly digest"
          icon={Calendar}
          actions={
            <button
              type="button"
              className="ov-collapsible-toggle"
              onClick={() => {
                const id = latestDigest!.id;
                try {
                  localStorage.setItem('wt.digest.dismissed', id);
                } catch {
                  /* ignore */
                }
                setDigestDismissedId(id);
              }}
            >
              Dismiss
            </button>
          }
        />
        <div className="ov-digest">
          <div className="ov-digest__hero">
            <div className="ov-digest__headline">{latestDigest!.gradeWord}</div>
            <StatusPill tone={trendTone(latestDigest!.gradeTrend)}>
              {trendLabel(latestDigest!.gradeTrend)}
            </StatusPill>
            <span className="ov-digest__when">{timeAgo(latestDigest!.generatedAt)}</span>
          </div>
          <div className="ov-digest__stats" aria-label="Week highlights">
            <div className="ov-digest-stat">
              <span className="ov-digest-stat__label">Crashes</span>
              <span className="ov-digest-stat__value">
                {latestDigest!.crashCount}
                {latestDigest!.crashTopMod ? (
                  <span className="ov-digest-stat__hint"> · {latestDigest!.crashTopMod}</span>
                ) : null}
              </span>
            </div>
            <div className="ov-digest-stat">
              <span className="ov-digest-stat__label">Disk</span>
              <span className="ov-digest-stat__value">
                {latestDigest!.diskGrowthGb == null
                  ? '—'
                  : `${latestDigest!.diskGrowthGb >= 0 ? '+' : ''}${latestDigest!.diskGrowthGb.toFixed(1)} GB`}
              </span>
            </div>
            <div className="ov-digest-stat">
              <span className="ov-digest-stat__label">MSPT</span>
              <span className="ov-digest-stat__value">
                {latestDigest!.perfTrend === 'insufficient' || latestDigest!.msptDeltaPct == null
                  ? '—'
                  : `${latestDigest!.msptDeltaPct >= 0 ? '+' : ''}${latestDigest!.msptDeltaPct.toFixed(0)}%`}
              </span>
            </div>
          </div>
          {latestDigest!.topAction ? (
            <p className="ov-digest__next">
              <span className="ov-digest__next-label">Do this next</span>
              {latestDigest!.topAction.message}
            </p>
          ) : null}
          <div className="ov-digest__footer">
            <Button
              kind="ghost"
              onClick={() => navigate({ tab: 'insights', view: 'digest', panel: null })}
            >
              Open Digest
            </Button>
          </div>
        </div>
      </article>
    ) : null;

  return (
    <PageEnter className="ov-stack">
      <HeroCard
        className="ov-mission-glow"
        tone={tone}
        edgeSensitivity={28}
        glowRadius={28}
        coneSpread={22}
      >
        <div className={`ov-mission ov-mission--${tone}${reportStale ? ' is-stale' : ''}`}>
          <div className="ov-mission__top">
            <div className="ov-mission__status">
              <div
                className={`ov-grade ov-grade--${tone}`}
                aria-label={`Health grade ${letter}, ${displayWord}`}
              >
                <span className="ov-grade__letter" aria-hidden>
                  {letter}
                </span>
                {tone === 'ok' ? (
                  <span className="ov-grade__word font-semibold tracking-tight">{displayWord}</span>
                ) : (
                  <span className="ov-grade__word">{displayWord}</span>
                )}
              </div>

              <div className="ov-mission__verdict">
                <div className="ov-mission__eyebrow">
                  <span>Server status</span>
                  <span className="ov-mission__meta-sep" aria-hidden>
                    ·
                  </span>
                  <span>{serverName}</span>
                </div>
                {tone === 'ok' ? (
                  <h2 className="ov-mission__headline font-semibold tracking-tight">{headline}</h2>
                ) : (
                  <h2 className="ov-mission__headline">{headline}</h2>
                )}
                <p className="ov-mission__sub">{sub}</p>
                {gradeTeasers.length > 0 || tone !== 'ok' ? (
                  <div className="ov-grade-teaser">
                    {gradeTeasers.map((line) => (
                      <p key={line} className="ov-grade-teaser__line">
                        {line}
                      </p>
                    ))}
                    <button
                      type="button"
                      className="ov-grade-teaser__help"
                      onClick={() => navigate({ tab: 'docs', wiki: 'Dashboard-Overview' })}
                    >
                      How grading works
                    </button>
                  </div>
                ) : null}
                {identityChips.length ? (
                  <div className="ov-identity" role="list" aria-label="Server identity">
                    {identityChips.map((chip) => (
                      <div key={chip.key} className="ov-identity__chip" role="listitem">
                        <span className="ov-identity__label">{chip.label}</span>
                        <span className="ov-identity__value">{chip.value}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {metaBits.length ? (
                  <p className="ov-mission__meta-line">{metaBits.join(' · ')}</p>
                ) : null}
                {bool(modRestartNudge.active) ? (
                  <button
                    type="button"
                    className="ov-grade-teaser__help"
                    onClick={() => navigate({ tab: 'mods' })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}
                  >
                    <StatusPill tone="info">Restart needed</StatusPill>
                    <span>
                      {str(modRestartNudge.message, 'Mod jars changed — restart when ready')}
                    </span>
                  </button>
                ) : null}
              </div>
            </div>

            {missionKpis.length || uptimeSec > 0 ? (
              <aside className="ov-mission__kpis" aria-label="Mission attention signals">
                {uptimeSec > 0 ? (
                  <MissionUptimeClock baseSec={uptimeSec} polledAt={uptimePolledAt || undefined} />
                ) : null}
                {missionKpis.map((k) => (
                  <div key={k.label} className={`ov-kpi${k.tone ? ` ov-kpi--${k.tone}` : ''}`}>
                    <span className="ov-kpi__label">{k.label}</span>
                    <span className="ov-kpi__readout">
                      <span className="ov-kpi__value">{k.value}</span>
                      {k.unit ? <span className="ov-kpi__unit">{k.unit}</span> : null}
                    </span>
                  </div>
                ))}
              </aside>
            ) : null}
          </div>

          <div className="ov-mission__vitals" aria-label="Live vitals">
            <VitalFlow
              label="TPS"
              channel="tps"
              value={tps}
              series={sparkSeries.tps}
              formatOptions={{ minimumFractionDigits: 1, maximumFractionDigits: 2 }}
              tone={tps < 19 ? 'warn' : 'ok'}
            />
            <VitalFlow
              label="MSPT"
              channel="mspt"
              value={mspt}
              series={sparkSeries.mspt}
              formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 1 }}
              suffix=" ms"
              tone={mspt > 40 ? 'warn' : 'default'}
            />
            <VitalFlow
              label="Players"
              channel="players"
              value={players}
              series={sparkSeries.players}
              formatOptions={{ maximumFractionDigits: 0 }}
            />
            <VitalFlow
              label="Heap"
              channel="heap"
              value={heapPct}
              series={sparkSeries.heap}
              formatOptions={{ maximumFractionDigits: 0 }}
              suffix="%"
              tone={heapPct > 85 ? 'warn' : 'default'}
            />
            <VitalFlow
              label="CPU"
              channel="cpu"
              value={cpu}
              series={sparkSeries.cpu}
              formatOptions={{ maximumFractionDigits: 0 }}
              suffix="%"
              tone={cpu > 85 ? 'warn' : 'default'}
            />
          </div>
        </div>
      </HeroCard>

      {nextAction ? (
        <div className="ov-next">
          <div className="ov-next__copy">
            <ArrowRight size={16} className="text-wt-accent shrink-0" />
            <p className="ov-next__hint">{nextAction.hint}</p>
          </div>
          <SpecularCtaButton kind="primary" onClick={nextAction.onClick}>
            {nextAction.label}
            <ArrowRight size={13} />
          </SpecularCtaButton>
        </div>
      ) : null}

      {/* Wide grid */}
      <div className={gridClass}>
        {showTriage ? (
          <div className="ov-wide-grid__triage">
            {layoutMode === 'incident' && attentionDeduped.length ? (
              <article className="ov-plate ov-queue-plate">
                <PlateHead
                  title="Needs attention"
                  icon={Siren}
                  actions={<StatusPill tone="warn">{attentionDeduped.length}</StatusPill>}
                />
                <Stagger className="ov-queue-plate__list">
                  {attentionShown.map((item) => (
                    <QueueRow
                      key={item.id}
                      flush
                      title={item.label}
                      detail={item.detail}
                      action={
                        <div className="flex items-center gap-2">
                          <StatusPill tone={severityTone[item.severity] ?? 'neutral'}>
                            {item.severity}
                          </StatusPill>
                          <Button
                            kind="ghost"
                            onClick={() =>
                              navigate({
                                tab: item.tab,
                                view:
                                  item.view ??
                                  (item.tab === 'issues' ? 'active' : undefined),
                                issue: item.issue ?? null,
                              })
                            }
                          >
                            Open <ArrowRight size={13} className="ml-1" />
                          </Button>
                        </div>
                      }
                    />
                  ))}
                </Stagger>
                {attentionMore > 0 ? (
                  <Button className="mt-2" kind="ghost" onClick={() => navigate({ tab: 'issues', view: 'active' })}>
                    +{attentionMore} more on Issues
                  </Button>
                ) : null}
                {nestSignalsUnderAttention ? (
                  <div className="ov-queue-secondary">
                    <PlateHead title="Right now" icon={Radar} />
                    <Stagger className="ov-queue-plate__list">
                      {signalsShown.map((s, i) => (
                        <QueueRow
                          key={i}
                          flush
                          title={str(s.label)}
                          detail={str(s.detail)}
                          action={
                            <div className="flex items-center gap-2">
                              <StatusPill tone={severityTone[str(s.severity)] ?? 'neutral'}>
                                {str(s.severity, 'info')}
                              </StatusPill>
                              {str(s.tab) ? (
                                <Button kind="ghost" onClick={() => navigate({ tab: str(s.tab) })}>
                                  Open
                                </Button>
                              ) : null}
                            </div>
                          }
                        />
                      ))}
                    </Stagger>
                    {signalsMore > 0 ? (
                      <Button className="mt-2" kind="ghost" onClick={() => navigate({ tab: 'live' })}>
                        +{signalsMore} more on Live
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ) : null}

            {showStandaloneSignals ? (
              <article className="ov-plate ov-queue-plate">
                <PlateHead title="Right now" icon={Radar} />
                <Stagger className="ov-queue-plate__list">
                  {signalsShown.map((s, i) => (
                    <QueueRow
                      key={i}
                      flush
                      title={str(s.label)}
                      detail={str(s.detail)}
                      action={
                        <div className="flex items-center gap-2">
                          <StatusPill tone={severityTone[str(s.severity)] ?? 'neutral'}>
                            {str(s.severity, 'info')}
                          </StatusPill>
                          {str(s.tab) ? (
                            <Button kind="ghost" onClick={() => navigate({ tab: str(s.tab) })}>
                              Open
                            </Button>
                          ) : null}
                        </div>
                      }
                    />
                  ))}
                </Stagger>
                {signalsMore > 0 ? (
                  <Button className="mt-2" kind="ghost" onClick={() => navigate({ tab: 'live' })}>
                    +{signalsMore} more on Live
                  </Button>
                ) : null}
              </article>
            ) : null}

            {layoutMode !== 'incident' ? (
              <>
                {renderStoryPlate()}
                {renderDigestPlate()}
              </>
            ) : null}

            {layoutMode === 'incident' && hasLag ? (
              <article className="ov-plate ov-queue-plate">
                <PlateHead
                  title="Lag incidents"
                  icon={Timer}
                  actions={
                    <button
                      type="button"
                      className="ov-collapsible-toggle"
                      aria-expanded={lagOpen}
                      aria-controls="ov-lag-incidents-panel"
                      onClick={() => setLagOpen((v) => !v)}
                    >
                      {lagOpen ? 'Collapse' : 'Expand'}
                    </button>
                  }
                />
                {lagOpen ? (
                  <div id="ov-lag-incidents-panel">
                    <Stagger className="ov-queue-plate__list">
                      {lagShown.map((inc, i) => (
                        <QueueRow
                          key={i}
                          flush
                          title={str(inc.title, str(inc.id))}
                          detail={str(inc.narrative, timeAgo(str(inc.time)))}
                          action={
                            <Button
                              kind="ghost"
                              onClick={() => navigate({ tab: 'insights', view: 'patterns', panel: 'incidents' })}
                            >
                              Open
                            </Button>
                          }
                        />
                      ))}
                    </Stagger>
                    {lagMore > 0 ? (
                      <Button
                        className="mt-2"
                        kind="ghost"
                        onClick={() => navigate({ tab: 'insights', view: 'patterns', panel: 'incidents' })}
                      >
                        +{lagMore} more on Insights
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <p className="ov-queue-collapsed">
                    {lagIncidents.length} lag incident(s) hidden — expand to review.
                  </p>
                )}
              </article>
            ) : null}
          </div>
        ) : null}

        <div className="ov-wide-grid__metrics">
          {(() => {
            const instrumentNodes: ReactElement[] = [];

            if (hasInsight) {
              instrumentNodes.push(
                <FadeIn key="insight">
                  <article className={`${PLATE} ov-instrument--insight${reportStale ? ' is-stale' : ''}`}>
                    <PlateHead title="Performance insight" icon={Gauge} />
                    <div className="ov-insight-row">
                      <div className="ov-insight-text min-w-0">
                        <div className="ov-insight-label">
                          {str(perfTldr.label, str(perf.subtitle, 'Performance insights available'))}
                        </div>
                        {str(perfTldr.detail) ? (
                          <div className="ov-insight-detail">{str(perfTldr.detail)}</div>
                        ) : null}
                      </div>
                      <Button kind="ghost" onClick={() => navigate({ tab: 'insights' })}>
                        Open Insights
                      </Button>
                    </div>
                  </article>
                </FadeIn>,
              );
            }

            if (hasSpark) {
              instrumentNodes.push(
                <FadeIn key="spark">
                  <article className={`${PLATE} ov-instrument--insight`}>
                    <PlateHead title="Spark" icon={Zap} />
                    <div className="ov-insight-row">
                      <div className="ov-insight-text min-w-0">
                        <div className="ov-insight-label">{str(sparkTldr.label, 'Spark profile available')}</div>
                        {str(sparkTldr.mod_id) ? (
                          <div className="ov-insight-detail">
                            Top mod: {str(sparkTldr.mod_id)}
                            {sparkTldr.pct != null ? ` ~${Math.round(num(sparkTldr.pct))}%` : ''}
                          </div>
                        ) : null}
                      </div>
                      <Button
                        kind="ghost"
                        onClick={() =>
                          navigate({
                            tab: 'spark',
                            profile: str(sparkTldr.source_path) || undefined,
                          })
                        }
                      >
                        Open Spark
                      </Button>
                    </div>
                  </article>
                </FadeIn>,
              );
            }

            if (num(startup.total_sec) > 0 || str(startup.status)) {
              instrumentNodes.push(
                <FadeIn key="boot">
                  <article className={`${PLATE} ov-instrument--boot${reportStale ? ' is-stale' : ''}`}>
                    <PlateHead title="Boot profile" icon={Timer} />
                    <div className="ov-boot__heroes">
                      <div className="ov-boot__hero ov-boot__hero--primary">
                        <div className="ov-boot__hero-label">Last boot</div>
                        <div className="ov-boot__hero-value">
                          <BootHeroValue
                            value={num(startup.total_sec)}
                            format={(n) => `${n.toFixed(1)}s`}
                          />
                        </div>
                      </div>

                      <div
                        className={`ov-boot__hero${
                          str(compare.direction) === 'slower'
                            ? ' ov-boot__hero--warn'
                            : str(compare.direction) === 'faster'
                              ? ' ov-boot__hero--ok'
                              : ''
                        }`}
                      >
                        <div className="ov-boot__hero-label">vs last</div>
                        <div className="ov-boot__hero-value">
                          <BootHeroValue
                            value={Math.abs(num(compare.delta_sec))}
                            format={(n) => `${n.toFixed(1)}s`}
                          />
                        </div>
                        <div className="ov-boot__hero-meta">{str(compare.direction, 'same')}</div>
                      </div>

                      <div className="ov-boot__hero">
                        <div className="ov-boot__hero-label">Slowest</div>
                        <div className="ov-boot__hero-value">
                          {slowest ? (
                            <BootHeroValue value={num(slowest.sec)} format={(n) => `${n.toFixed(0)}s`} />
                          ) : (
                            '—'
                          )}
                        </div>
                        <div className="ov-boot__hero-meta" title={str(slowest?.phase)}>
                          {str(slowest?.phase, 'No phase')}
                        </div>
                      </div>

                      <div className={`ov-boot__hero${bootWarnings > 0 ? ' ov-boot__hero--warn' : ' ov-boot__hero--ok'}`}>
                        <div className="ov-boot__hero-label">Warnings</div>
                        <div className="ov-boot__hero-value">
                          <BootHeroValue value={bootWarnings} format={(n) => n.toFixed(0)} />
                        </div>
                        <div className="ov-boot__hero-meta">
                          {bootWarnings === 1 ? 'warning' : 'warnings'}
                        </div>
                      </div>
                    </div>

                    <div className="ov-boot__foot">
                      <StatusPill tone={str(startup.status) === 'ok' ? 'ok' : 'warn'}>
                        {str(startup.status, 'unknown')}
                      </StatusPill>
                      <Button kind="ghost" onClick={() => navigate({ tab: 'startup' })}>
                        Open Startup
                        <ArrowRight size={13} />
                      </Button>
                    </div>
                  </article>
                </FadeIn>,
              );
            }

            if (str(safeRestart.verdict) || bool(restartHygiene.active)) {
              const hygieneActive = bool(restartHygiene.active);
              const quiet = asRecord(restartHygiene.quiet_window);
              const hygieneSignals = asArray<Record<string, unknown>>(restartHygiene.signals);
              const quietLabel =
                str(quiet.next_start_at) && str(quiet.next_end_at)
                  ? formatInstantRange(str(quiet.next_start_at), str(quiet.next_end_at), resolvedZone)
                  : '';
              const gcSig = hygieneSignals.find((s) => str(s.id) === 'gc_rising');
              const heapSig = hygieneSignals.find((s) => {
                const id = str(s.id);
                return (
                  id === 'heap_high' ||
                  id === 'heap_rising' ||
                  id === 'heap_stable' ||
                  id === 'heap_pressure'
                );
              });
              const openReasonTab = (r: Record<string, unknown>) => {
                const tab = str(r.tab, 'overview');
                if (tab === 'insights') {
                  navigate({ tab: 'insights', view: 'storage' });
                  return;
                }
                if (tab === 'settings') {
                  navigate({
                    tab: 'settings',
                    panel: str(get(r, 'tab_params', 'panel')) || undefined,
                  });
                  return;
                }
                navigate({ tab });
              };
              instrumentNodes.push(
                <FadeIn key="restart">
                  <article className={`${PLATE} ov-instrument--restart ov-restart`}>
                    <PlateHead title="Restart" icon={Power} />

                    {str(safeRestart.verdict) ? (
                      <div className="ov-restart__hero">
                        <div className="ov-restart__titles">
                          <div className="ov-restart__title-row">
                            <div className="ov-restart__headline">{str(safeRestart.headline)}</div>
                            <StatusPill tone={severityTone[str(safeRestart.verdict)] ?? 'neutral'}>
                              {str(safeRestart.verdict)}
                            </StatusPill>
                          </div>
                          {str(safeRestart.summary) ? (
                            <p className="ov-restart__summary">{str(safeRestart.summary)}</p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {asArray<Record<string, unknown>>(safeRestart.reasons).length ? (
                      <ul className="ov-restart__reasons">
                        {asArray<Record<string, unknown>>(safeRestart.reasons)
                          .slice(0, 5)
                          .map((r, i) => (
                            <li key={i} className="ov-restart-reason">
                              <div className="ov-restart-reason__text">
                                <span className="ov-restart-reason__label">{str(r.label)}</span>
                                {str(r.detail) ? (
                                  <span className="ov-restart-reason__detail">{str(r.detail)}</span>
                                ) : null}
                              </div>
                              {str(r.tab) ? (
                                <button
                                  type="button"
                                  className="ov-restart-reason__link"
                                  onClick={() => openReasonTab(r)}
                                >
                                  Open
                                </button>
                              ) : null}
                            </li>
                          ))}
                      </ul>
                    ) : null}

                    {hygieneActive ? (
                      <section className="ov-restart-hygiene">
                        <div className="ov-restart-hygiene__head">
                          <span className="ov-restart-hygiene__eyebrow">Restart hygiene</span>
                          <StatusPill
                            tone={str(restartHygiene.severity) === 'warning' ? 'warn' : 'info'}
                          >
                            {str(restartHygiene.severity, 'info')}
                          </StatusPill>
                        </div>
                        <p className="ov-restart-hygiene__headline">
                          {str(restartHygiene.headline, 'Consider a maintenance restart')}
                        </p>

                        <div className="ov-restart-hygiene__metrics">
                          {num(restartHygiene.uptime_sec) > 0 ? (
                            <div
                              className={`ov-restart-metric ov-restart-metric--${
                                num(restartHygiene.uptime_sec) >= 72 * 3600 ? 'warn' : 'info'
                              }`}
                            >
                              <span className="ov-restart-metric__label">Uptime</span>
                              <span className="ov-restart-metric__value">
                                {formatDuration(num(restartHygiene.uptime_sec))}
                              </span>
                            </div>
                          ) : null}
                          {gcSig ? (
                            <div
                              className={`ov-restart-metric ov-restart-metric--${
                                num(gcSig.current) >= 10 ? 'danger' : 'warn'
                              }`}
                            >
                              <span className="ov-restart-metric__label">GC pause</span>
                              <span className="ov-restart-metric__value">
                                {num(gcSig.current).toFixed(1)}%
                              </span>
                              {gcSig.prior != null ? (
                                <HygieneTrend
                                  current={num(gcSig.current)}
                                  prior={num(gcSig.prior)}
                                />
                              ) : null}
                            </div>
                          ) : null}
                          {heapSig ? (
                            <div
                              className={`ov-restart-metric ov-restart-metric--${
                                num(heapSig.current) >= 90
                                  ? 'danger'
                                  : num(heapSig.current) >= 85 ||
                                      str(heapSig.id) === 'heap_pressure'
                                    ? 'warn'
                                    : 'neutral'
                              }`}
                            >
                              <span className="ov-restart-metric__label">Heap p95</span>
                              <span className="ov-restart-metric__value">
                                {num(heapSig.current).toFixed(0)}%
                              </span>
                              {heapSig.prior != null ? (
                                <HygieneTrend
                                  current={num(heapSig.current)}
                                  prior={num(heapSig.prior)}
                                  format={(n) => n.toFixed(0)}
                                />
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        {quietLabel ? (
                          <div className="ov-restart-quiet">
                            <div className="ov-restart-quiet__copy">
                              <span className="ov-restart-quiet__label">Next quiet window</span>
                              <span className="ov-restart-quiet__time">{quietLabel}</span>
                              <span className="ov-restart-quiet__meta">
                                {resolvedZone}
                                {num(quiet.avg_players) || num(quiet.avg_mspt)
                                  ? ` · ~${num(quiet.avg_players).toFixed(1)} players · MSPT ${num(quiet.avg_mspt).toFixed(0)}`
                                  : ''}
                              </span>
                            </div>
                            <Button
                              kind="ghost"
                              onClick={() =>
                                navigate({ tab: 'insights', view: 'patterns', panel: 'schedule' })
                              }
                            >
                              Schedule
                            </Button>
                          </div>
                        ) : (
                          <div className="ov-restart-hygiene__cta">
                            <Button
                              kind="ghost"
                              onClick={() =>
                                navigate({ tab: 'insights', view: 'patterns', panel: 'schedule' })
                              }
                            >
                              Open Schedule
                            </Button>
                          </div>
                        )}
                      </section>
                    ) : null}

                    <p className="ov-restart__hint">
                      Informational only — your panel or /stop still controls the restart.
                    </p>
                  </article>
                </FadeIn>,
              );
            }

            if (diskPct > 0 || worldGb > 0 || dims.length) {
              instrumentNodes.push(
                <FadeIn key="storage">
                  <article className={`${PLATE} ov-instrument--storage`}>
                    <PlateHead title="Storage" icon={HardDrive} />
                    <StoragePanel
                      diskPct={diskPct}
                      worldGb={worldGb}
                      dims={dims}
                      diskProj={diskProj}
                      diskJump={diskJump}
                      rssHint={
                        get(meta, 'rss_hint', 'show') ? str(get(meta, 'rss_hint', 'message')) : ''
                      }
                    />
                  </article>
                </FadeIn>,
              );
            }

            if (
              (Object.keys(chunky).length > 0 || Object.keys(dh).length > 0) &&
              (chunky.pregen_active || chunky.last || dh.pregen_active || dh.last)
            ) {
              instrumentNodes.push(
                <FadeIn key="pregen">
                  <article className={`${PLATE} ov-instrument--pregen`}>
                    <PlateHead title="World background jobs" icon={Boxes} />
                    <div className="ov-pregen-list">
                      <PregenCard title="Chunky" pregen={chunky} />
                      <PregenCard title="Distant Horizons" pregen={dh} />
                    </div>
                  </article>
                </FadeIn>,
              );
            }

            if (!instrumentNodes.length) {
              return (
                <>
                  <EmptyState title="Instruments quiet">Live vitals are in the mission band above.</EmptyState>
                  {layoutMode === 'incident' ? (
                    <div className="ov-history-stack space-y-3">
                      {renderStoryPlate()}
                      {renderDigestPlate()}
                    </div>
                  ) : null}
                </>
              );
            }

            const collapseSteady = layoutMode === 'steady' && !instrumentsExpanded && instrumentNodes.length > 1;
            const visible = collapseSteady ? instrumentNodes.slice(0, 1) : instrumentNodes;
            const hiddenCount = collapseSteady ? instrumentNodes.length - 1 : 0;

            // Pass siblings (not a Fragment) so Stagger can space each plate.
            return (
              <>
                <Stagger className="ov-secondary" delayMs={55}>
                  {visible}
                  {hiddenCount > 0 ? (
                    <Button
                      key="expand-instruments"
                      kind="ghost"
                      aria-expanded={instrumentsExpanded}
                      onClick={() => setInstrumentsExpanded(true)}
                    >
                      Show {hiddenCount} more instrument{hiddenCount === 1 ? '' : 's'}
                    </Button>
                  ) : null}
                  {layoutMode === 'steady' && instrumentsExpanded && instrumentNodes.length > 1 ? (
                    <Button
                      key="collapse-instruments"
                      kind="ghost"
                      aria-expanded={instrumentsExpanded}
                      onClick={() => setInstrumentsExpanded(false)}
                    >
                      Hide extra instruments
                    </Button>
                  ) : null}
                </Stagger>
                {layoutMode === 'incident' ? (
                  <div className="ov-history-stack space-y-3">
                    {renderStoryPlate()}
                    {renderDigestPlate()}
                  </div>
                ) : null}
              </>
            );
          })()}
        </div>
      </div>
    </PageEnter>
  );
}
