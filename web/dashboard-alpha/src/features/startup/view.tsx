import { useMemo, type ComponentType, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import BorderGlow from '@/components/border-glow/BorderGlow';
import { ChartFrame, WtBarChart } from '@/ui/charts';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Rocket,
  Settings2,
  XCircle,
} from '@/ui/icons';
import { api } from '@/api/client';
import { navigate, type RouteState } from '@/app/router';
import { FadeIn, GlareIcon, PageEnter } from '@/ui/motion';
import { EmptyState, ErrorState, MetricReadout, StatusPill } from '@/ui/patterns';
import { asArray, asRecord, num, str, timeAgo } from '@/lib/utils';
import './startup.css';

type IconCmp = ComponentType<{ size?: number; className?: string }>;
const RocketIcon = Rocket as IconCmp;
const SettingsIcon = Settings2 as IconCmp;
const WarnIcon = AlertTriangle as IconCmp;
const ErrIcon = XCircle as IconCmp;

const POLL_MS = 5_000;

type Phase = { id: string; label: string; sec: number | null };
type Slowest = { phase: string; sec: number | null };
type Warning = {
  id: string;
  title: string;
  detail: string;
  sample: string | null;
  link: 'logs' | 'mods' | 'configs';
  mod_id: string | null;
  /** Legacy grouped count — only when sample rows are missing. */
  count: number | null;
};
type BootError = {
  mod_id: string;
  kind: string;
  blocking: boolean;
  title: string;
  detail: string;
};
type Compare = { direction: string; delta_sec: number | null };
type Audit = {
  status: string;
  path: string;
  detail: string;
  properties: { key: string; verdict: string; title: string }[];
  jvm: Record<string, unknown> | null;
  summary: { fine: number; consider: number; missing: number };
};

type BootHistoryPhase = { id: string; label: string; sec: number };
type BootHistoryEntry = {
  done_at: string | null;
  total_sec: number;
  status: string;
  phases: BootHistoryPhase[];
};

type BootProfile = {
  total_sec: number | null;
  vanilla_done_sec: number | null;
  wall_clock_sec: number | null;
  modernfix_sec: number | null;
  total_source: string;
  done_at: string | null;
  status: string;
  phases: Phase[];
  slowest: Slowest[];
  warnings: Warning[];
  warning_event_count: number;
  errors: BootError[];
  compare: Compare | null;
  boot_history: BootHistoryEntry[];
};

function sanePhaseSec(sec: unknown, totalSec: number | null): number | null {
  const n = Number(sec);
  if (!Number.isFinite(n) || n < 0) return null;
  if (totalSec != null && Number.isFinite(totalSec) && totalSec > 0 && n > totalSec * 2) {
    return null;
  }
  return n;
}

function formatSec(sec: number | null | undefined) {
  if (sec == null || !Number.isFinite(sec)) return '—';
  if (sec >= 100) return `${Math.round(sec)}s`;
  if (sec >= 10) return `${sec.toFixed(1)}s`;
  return `${sec.toFixed(2)}s`;
}

function formatDoneAt(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function statusTone(status: string): 'ok' | 'warn' | 'danger' | 'neutral' {
  const s = status.toLowerCase();
  if (s === 'ok' || s === 'healthy') return 'ok';
  if (s === 'failed' || s === 'error') return 'danger';
  if (s === 'warnings' || s === 'warning') return 'warn';
  return 'neutral';
}

function statusWord(status: string) {
  const s = status.toLowerCase();
  if (s === 'ok' || s === 'healthy') return 'Clean boot';
  if (s === 'failed' || s === 'error') return 'Failed';
  if (s === 'warnings' || s === 'warning') return 'Warnings';
  if (s === 'unknown' || !s) return 'Incomplete profile';
  return status.replace(/_/g, ' ');
}

function formatDelta(cmp: Compare | null): { label: string; tone: 'ok' | 'warn' | 'neutral' } | null {
  if (!cmp || cmp.delta_sec == null || !Number.isFinite(cmp.delta_sec)) return null;
  const abs = Math.abs(cmp.delta_sec);
  const mag = abs >= 100 ? `${Math.round(abs)}s` : `${abs.toFixed(1)}s`;
  const dir = cmp.direction.toLowerCase();
  if (dir === 'faster') return { label: `${mag} faster`, tone: 'ok' };
  if (dir === 'slower') return { label: `${mag} slower`, tone: 'warn' };
  if (dir === 'same') return { label: 'Same as last', tone: 'ok' };
  if (cmp.delta_sec > 0) return { label: `+${mag}`, tone: 'warn' };
  if (cmp.delta_sec < 0) return { label: `−${mag}`, tone: 'ok' };
  return { label: mag, tone: 'neutral' };
}

function humanId(id: string) {
  if (!id) return '—';
  return id.replace(/_/g, ' ');
}

const WARNING_CATALOG: Record<
  string,
  { title: string; detail: string; link: Warning['link'] }
> = {
  recipe_parse: {
    title: 'Recipe parse failure',
    detail: 'A recipe failed to load during boot — often a datapack or mod recipe JSON issue.',
    link: 'mods',
  },
  recipe_missing: {
    title: 'Recipe parse failure',
    detail: 'A recipe failed to load during boot — often a datapack or mod recipe JSON issue.',
    link: 'mods',
  },
  registry_missing: {
    title: 'Missing registry entry',
    detail:
      'Something referenced an item, block, or entity that is not registered (missing mod or bad datapack).',
    link: 'mods',
  },
  loot_parse: {
    title: 'Loot table parse failure',
    detail: 'A loot table or datapack element could not be parsed while the world was loading.',
    link: 'logs',
  },
  postprocessing_spam: {
    title: 'World post-processing spam',
    detail: 'The server repeatedly tried to mark chunks for post-processing — usually noisy, rarely fatal.',
    link: 'logs',
  },
  client_on_server: {
    title: 'Client class on dedicated server',
    detail: 'A jar tried to load client-only Minecraft classes on the dedicated server.',
    link: 'mods',
  },
};

function warningMeta(id: string) {
  return (
    WARNING_CATALOG[id] ?? {
      title: humanId(id),
      detail: 'A known noisy pattern matched during the boot window.',
      link: 'logs' as const,
    }
  );
}

function errorTitle(kind: string) {
  switch (kind) {
    case 'mod_corrupt':
      return 'Corrupt or unreadable jar';
    case 'mod_runtime':
      return 'Runtime mod failure';
    case 'mod_load_failed':
      return 'Mod failed to load';
    case 'mod_load_dependency':
      return 'Missing dependency';
    case 'mod_load_script':
      return 'Script load failure';
    case 'loot_parse':
      return 'Loot parse failure';
    case 'recipe_missing_item':
    case 'recipe_format':
    case 'recipe_compat':
      return 'Recipe issue';
    default:
      return humanId(kind) || 'Mod load issue';
  }
}

function errorDetail(kind: string, blocking: boolean) {
  const base = (() => {
    switch (kind) {
      case 'mod_corrupt':
        return 'This jar looked corrupt or unreadable during boot.';
      case 'mod_runtime':
        return 'The mod threw errors while initializing or running at startup.';
      case 'mod_load_failed':
        return 'NeoForge reported this mod failed to load.';
      case 'mod_load_dependency':
        return 'A required dependency was missing or incompatible.';
      case 'mod_load_script':
        return 'A KubeJS/script pack failed while loading.';
      default:
        return 'Watchtower classified a serious boot-time mod error from the log.';
    }
  })();
  return blocking
    ? `${base} Marked blocking because the server may not have reached Done! cleanly.`
    : `${base} Non-blocking — the server still reached Done!.`;
}

function normalizeWarning(w: Record<string, unknown>): Warning {
  const id = str(w.id, 'warning');
  const meta = warningMeta(id);
  const hasSample = w.sample != null && str(w.sample).length > 0;
  return {
    id,
    title: str(w.title, meta.title),
    detail: str(w.detail, meta.detail),
    sample: hasSample ? str(w.sample) : null,
    link: (str(w.link, meta.link) as Warning['link']) || meta.link,
    mod_id: w.mod_id == null || !str(w.mod_id) ? null : str(w.mod_id),
    count: hasSample ? null : w.count == null ? 1 : num(w.count, 1),
  };
}

/** Expand legacy grouped `{id,count}` rows into individual display rows (no aggregation UI). */
function expandWarnings(raw: unknown): Warning[] {
  const rows = asArray<Record<string, unknown>>(raw).map(normalizeWarning);
  const hasSamples = rows.some((r) => r.sample);
  if (hasSamples) return rows.filter((r) => r.sample || !r.count);

  const expanded: Warning[] = [];
  for (const row of rows) {
    const n = Math.min(Math.max(row.count ?? 1, 1), 12);
    for (let i = 0; i < n; i++) {
      expanded.push({
        ...row,
        count: null,
        sample: null,
        detail:
          (row.count ?? 1) > 1 && i === 0
            ? `${row.detail} Seen ${row.count}× during this boot (showing first ${n}).`
            : row.detail,
      });
    }
  }
  return expanded;
}

function normalizeError(e: Record<string, unknown>): BootError {
  const kind = str(e.kind);
  const blocking = e.blocking === true;
  return {
    mod_id: str(e.mod_id, 'unknown'),
    kind,
    blocking,
    title: str(e.title, errorTitle(kind)),
    detail: str(e.detail, errorDetail(kind, blocking)),
  };
}

function phaseLabel(phases: Phase[], phaseId: string) {
  const hit = phases.find((p) => p.id === phaseId);
  return hit?.label ?? humanId(phaseId);
}

function maxPhaseSec(phases: Phase[], totalSec: number | null) {
  const vals = phases.map((p) => sanePhaseSec(p.sec, totalSec)).filter((n): n is number => n != null);
  return Math.max(...vals, 0.01);
}

function slowRankMap(slowest: Slowest[]) {
  const map = new Map<string, number>();
  slowest.forEach((s, i) => {
    if (s.phase && !map.has(s.phase)) map.set(s.phase, i + 1);
  });
  return map;
}

function normalizeProfile(raw: unknown): BootProfile | null {
  const p = asRecord(raw);
  if (!Object.keys(p).length) return null;
  const total = p.total_sec == null ? null : num(p.total_sec);
  const wallClock = p.wall_clock_sec == null ? null : num(p.wall_clock_sec);
  const vanillaDone = p.vanilla_done_sec == null ? null : num(p.vanilla_done_sec);
  const modernFix = p.modernfix_sec == null ? null : num(p.modernfix_sec);
  const totalSource = str(p.total_source, 'unknown');
  // Phase bars end at Done — don't scale against ModernFix post-Done tail.
  const phaseBudget =
    wallClock != null && wallClock > 0
      ? wallClock
      : vanillaDone != null && vanillaDone > 0
        ? vanillaDone
        : total;
  const phases = asArray<Record<string, unknown>>(p.phases).map((ph) => ({
    id: str(ph.id, str(ph.label)),
    label: str(ph.label, humanId(str(ph.id))),
    sec: sanePhaseSec(ph.sec, phaseBudget),
  }));
  const slowest = asArray<Record<string, unknown>>(p.slowest).map((s) => ({
    phase: str(s.phase),
    sec: sanePhaseSec(s.sec, phaseBudget),
  }));
  const warnings = expandWarnings(p.warnings);
  const errors = asArray<Record<string, unknown>>(p.errors).map(normalizeError);
  const warning_event_count = Math.max(
    num(p.warning_event_count, 0),
    warnings.length,
  );
  const cmp = asRecord(p.compare_to_last_boot);
  const compare =
    Object.keys(cmp).length === 0
      ? null
      : {
          direction: str(cmp.direction, 'same'),
          delta_sec: cmp.delta_sec == null ? null : num(cmp.delta_sec),
        };

  let boot_history = asArray<Record<string, unknown>>(p.boot_history)
    .map((h) => {
      const total = num(h.total_sec, NaN);
      if (!Number.isFinite(total) || total < 0) return null;
      const phases = asArray<Record<string, unknown>>(h.phases)
        .map((ph) => {
          const sec = num(ph.sec, NaN);
          if (!Number.isFinite(sec) || sec < 0) return null;
          const id = str(ph.id, str(ph.label, 'phase'));
          return {
            id,
            label: str(ph.label, humanId(id)),
            sec: Math.round(sec * 10) / 10,
          };
        })
        .filter((ph): ph is BootHistoryPhase => ph != null);
      return {
        done_at: h.done_at == null ? null : str(h.done_at),
        total_sec: Math.round(total * 10) / 10,
        status: str(h.status, 'unknown'),
        phases,
      };
    })
    .filter((h): h is BootHistoryEntry => h != null);

  // Fallback: previous + current from compare when history is missing.
  if (boot_history.length === 0 && total != null) {
    const currentPhases = phases
      .filter((ph) => ph.sec != null)
      .map((ph) => ({ id: ph.id, label: ph.label, sec: ph.sec as number }));
    const rows: BootHistoryEntry[] = [];
    if (compare?.delta_sec != null && Number.isFinite(compare.delta_sec)) {
      const prev = Math.round((total - compare.delta_sec) * 10) / 10;
      if (Number.isFinite(prev) && prev >= 0) {
        rows.push({ done_at: null, total_sec: prev, status: 'unknown', phases: [] });
      }
    }
    rows.push({
      done_at: p.done_at == null ? null : str(p.done_at),
      total_sec: total,
      status: str(p.status, 'unknown'),
      phases: currentPhases,
    });
    boot_history = rows;
  } else if (boot_history.length > 0) {
    // Ensure latest entry has current phases when history lacked them.
    const last = boot_history[boot_history.length - 1]!;
    if ((!last.phases || last.phases.length === 0) && phases.some((ph) => ph.sec != null)) {
      last.phases = phases
        .filter((ph) => ph.sec != null)
        .map((ph) => ({ id: ph.id, label: ph.label, sec: ph.sec as number }));
    }
  }

  return {
    total_sec: total,
    vanilla_done_sec: vanillaDone,
    wall_clock_sec: wallClock,
    modernfix_sec: modernFix,
    total_source: totalSource,
    done_at: p.done_at == null ? null : str(p.done_at),
    status: str(p.status, 'unknown'),
    phases,
    slowest,
    warnings,
    warning_event_count,
    errors,
    compare,
    boot_history,
  };
}

function normalizeAudit(raw: unknown): Audit | null {
  const a = asRecord(raw);
  if (!Object.keys(a).length) return null;
  const summary = asRecord(a.summary);
  const properties = asArray<Record<string, unknown>>(a.properties).map((row) => ({
    key: str(row.key),
    verdict: str(row.verdict),
    title: str(row.title, str(row.key)),
  }));
  const considerFromRows = properties.filter((r) => r.verdict.startsWith('consider_')).length;
  const missingFromRows = properties.filter((r) => r.verdict === 'missing').length;
  return {
    status: str(a.status, 'unknown'),
    path: str(a.path, 'server.properties'),
    detail: str(a.detail),
    properties,
    jvm: a.jvm && typeof a.jvm === 'object' ? asRecord(a.jvm) : null,
    summary: {
      fine: num(summary.fine, Math.max(0, properties.length - considerFromRows - missingFromRows)),
      consider: num(summary.consider, considerFromRows),
      missing: num(summary.missing, missingFromRows),
    },
  };
}

function auditHasRecommendations(audit: Audit) {
  if (audit.summary.consider > 0 || audit.summary.missing > 0) return true;
  if (audit.properties.some((r) => r.verdict.startsWith('consider_') || r.verdict === 'missing')) {
    return true;
  }
  const jvmVerdict = str(audit.jvm?.verdict).toLowerCase();
  if (!jvmVerdict) return false;
  return !(
    jvmVerdict === 'ok' ||
    jvmVerdict === 'fine' ||
    jvmVerdict === 'healthy' ||
    jvmVerdict === 'complete' ||
    jvmVerdict === 'good'
  );
}

function ConfigAuditCta({ audit }: { audit: Audit | null }) {
  if (!audit || audit.status === 'disabled') return null;
  if (audit.status === 'unavailable' && !audit.properties.length) return null;
  if (!auditHasRecommendations(audit)) return null;

  const consider = audit.summary.consider;
  const missing = audit.summary.missing;
  const jvmAdvice = str(audit.jvm?.advice);
  const jvmProfile = str(audit.jvm?.flags_profile);
  const topConsiders = audit.properties
    .filter((r) => r.verdict.startsWith('consider_') || r.verdict === 'missing')
    .slice(0, 2)
    .map((r) => r.title);

  const bits: string[] = [];
  if (consider > 0) bits.push(`${consider} setting${consider === 1 ? '' : 's'} to review`);
  if (missing > 0) bits.push(`${missing} missing`);
  const jvmVerdict = str(audit.jvm?.verdict).toLowerCase();
  const jvmNeedsWork =
    !!jvmVerdict &&
    !(
      jvmVerdict === 'ok' ||
      jvmVerdict === 'fine' ||
      jvmVerdict === 'healthy' ||
      jvmVerdict === 'complete' ||
      jvmVerdict === 'good'
    );
  if (jvmNeedsWork) bits.push(jvmAdvice || 'JVM flags need attention');
  const lede = bits.join(' · ') || 'Launch config has recommendations';

  return (
    <button
      type="button"
      className="su-audit-cta"
      onClick={() => navigate({ tab: 'insights', view: 'configs' })}
    >
      <div className="su-audit-cta__icon">
        <GlareIcon icon={SettingsIcon} tone="warn" size={15} className="h-8 w-8 rounded-xl" />
      </div>
      <div className="su-audit-cta__copy">
        <div className="su-audit-cta__title">
          Launch & config recommendations
          <StatusPill tone="warn">{consider + missing > 0 ? consider + missing : 'Review'}</StatusPill>
        </div>
        <p className="su-audit-cta__lede">
          {lede}
          {topConsiders.length ? ` — ${topConsiders.join(', ')}` : ''}
          {jvmProfile ? ` · ${jvmProfile}` : ''}
        </p>
      </div>
      <span className="su-audit-cta__action">
        Open Insights → Configs
        <ChevronRight size={14} />
      </span>
    </button>
  );
}

const PHASE_CHART_COLORS = [
  'var(--wt-info, var(--wt-accent))',
  'color-mix(in srgb, var(--wt-ok) 75%, var(--wt-accent))',
  'color-mix(in srgb, var(--wt-warn) 70%, var(--wt-accent))',
  'color-mix(in srgb, #a78bfa 80%, var(--wt-accent))',
  'color-mix(in srgb, #f472b6 70%, var(--wt-accent))',
  'color-mix(in srgb, var(--wt-text-mid) 55%, var(--wt-accent))',
];

function phaseChartKey(id: string) {
  return `phase_${id.replace(/[^a-zA-Z0-9_:-]/g, '_')}`;
}

function bootHistoryChartModel(history: BootHistoryEntry[]): {
  rows: Record<string, unknown>[];
  series: { dataKey: string; color: string; label: string }[];
  stacked: boolean;
} {
  const phaseOrder: { id: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const h of history) {
    for (const ph of h.phases) {
      if (seen.has(ph.id)) continue;
      seen.add(ph.id);
      phaseOrder.push({ id: ph.id, label: ph.label });
    }
  }

  const stacked = phaseOrder.length > 0;
  const series = stacked
    ? phaseOrder.map((ph, i) => ({
        dataKey: phaseChartKey(ph.id),
        color: PHASE_CHART_COLORS[i % PHASE_CHART_COLORS.length]!,
        label: ph.label,
      }))
    : [{ dataKey: 'total_sec', color: 'var(--wt-info, var(--wt-accent))', label: 'Total' }];

  const rows = history.map((h, i) => {
    let name: string;
    if (h.done_at) {
      const d = new Date(h.done_at);
      name = Number.isNaN(d.getTime())
        ? `Boot ${i + 1}`
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } else if (i === history.length - 1) {
      name = 'Latest';
    } else if (i === history.length - 2) {
      name = 'Prior';
    } else {
      name = `Boot ${i + 1}`;
    }
    const base = name;
    const dupCount = history
      .slice(0, i)
      .filter((x) => {
        if (!x.done_at || !h.done_at) return false;
        const a = new Date(x.done_at);
        const b = new Date(h.done_at);
        return (
          !Number.isNaN(a.getTime()) &&
          !Number.isNaN(b.getTime()) &&
          a.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) === base
        );
      }).length;
    if (dupCount > 0 && h.done_at) {
      const d = new Date(h.done_at);
      name = Number.isNaN(d.getTime())
        ? `${base}·${dupCount + 1}`
        : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    const row: Record<string, unknown> = {
      name,
      total_sec: h.total_sec,
      status: h.status,
    };

    if (stacked) {
      const byId = new Map(h.phases.map((ph) => [ph.id, ph.sec]));
      let assigned = 0;
      for (const ph of phaseOrder) {
        const sec = byId.get(ph.id) ?? 0;
        row[phaseChartKey(ph.id)] = sec;
        assigned += sec;
      }
      // If this boot has no phase breakdown, park the whole total in the first segment.
      if (h.phases.length === 0 && phaseOrder.length > 0) {
        row[phaseChartKey(phaseOrder[0]!.id)] = h.total_sec;
      } else if (h.total_sec > assigned + 0.05 && phaseOrder.length > 0) {
        const lastKey = phaseChartKey(phaseOrder[phaseOrder.length - 1]!.id);
        row[lastKey] = num(row[lastKey], 0) + Math.round((h.total_sec - assigned) * 10) / 10;
      }
    }

    return row;
  });

  return { rows, series, stacked };
}

function heroGlowProps(tone: 'ok' | 'warn' | 'danger' | 'neutral') {
  if (tone === 'ok') {
    return {
      glowColor: '160 72 48',
      glowIntensity: 0.5,
      colors: ['#34d399', '#22d3ee', '#60a5fa'],
      fillOpacity: 0.16,
      backgroundColor: 'var(--wt-bg1)',
    };
  }
  if (tone === 'warn') {
    return {
      glowColor: '38 85 55',
      glowIntensity: 0.48,
      colors: ['#fbbf24', '#f59e0b', '#38bdf8'],
      fillOpacity: 0.14,
      backgroundColor: 'var(--wt-bg1)',
    };
  }
  if (tone === 'danger') {
    return {
      glowColor: '0 72 55',
      glowIntensity: 0.5,
      colors: ['#f87171', '#fb7185', '#fbbf24'],
      fillOpacity: 0.14,
      backgroundColor: 'var(--wt-bg1)',
    };
  }
  return {
    glowColor: '210 40 55',
    glowIntensity: 0.4,
    colors: ['#94a3b8', '#64748b', '#38bdf8'],
    fillOpacity: 0.12,
    backgroundColor: 'var(--wt-bg1)',
  };
}

function VitalTile({
  label,
  value,
  format,
  tone,
  text,
}: {
  label: string;
  value?: number | null;
  format?: (n: number) => string;
  tone?: 'default' | 'ok' | 'warn' | 'danger';
  text?: string | null;
}) {
  if (text != null) {
    return (
      <div className="su-vital">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wt-text-low">{label}</div>
        <div
          className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
            tone === 'ok'
              ? 'text-wt-ok'
              : tone === 'warn'
                ? 'text-wt-warn'
                : tone === 'danger'
                  ? 'text-wt-danger'
                  : 'text-wt-text'
          }`}
        >
          {text}
        </div>
      </div>
    );
  }
  if (value == null || !Number.isFinite(value)) {
    return (
      <div className="su-vital">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wt-text-low">{label}</div>
        <div className="mt-1 font-mono text-lg font-semibold text-wt-text-low">—</div>
      </div>
    );
  }
  return (
    <div className="su-vital">
      <MetricReadout label={label} value={value} format={format} size="sm" tone={tone} />
    </div>
  );
}

function IssueOverviewCard({
  kind,
  title,
  count,
  hint,
  previews,
  onOpen,
}: {
  kind: 'warn' | 'danger';
  title: string;
  count: number;
  hint: string;
  previews: string[];
  onOpen: () => void;
}) {
  const Icon = kind === 'warn' ? WarnIcon : ErrIcon;
  return (
    <button
      type="button"
      className={`su-issue-overview su-issue-overview--${kind}`}
      onClick={onOpen}
      aria-label={`Open Issues for ${count} ${title.toLowerCase()}`}
    >
      <div className="su-issue-overview__top">
        <GlareIcon
          icon={Icon}
          tone={kind === 'warn' ? 'warn' : 'danger'}
          size={15}
          className="h-8 w-8 rounded-xl"
        />
        <div className="su-issue-overview__copy">
          <div className="su-issue-overview__title">
            <h3>{title}</h3>
            <StatusPill tone={kind === 'warn' ? 'warn' : 'danger'}>{count}</StatusPill>
          </div>
          <p className="su-issue-overview__hint">{hint}</p>
        </div>
      </div>
      {previews.length ? (
        <ul className="su-issue-overview__previews">
          {previews.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
      <span className="su-issue-overview__cta">
        Open Issues
        <ChevronRight size={14} />
      </span>
    </button>
  );
}

function Plate({
  title,
  hint,
  icon,
  trailing,
  children,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="su-plate">
      <div className="su-plate__head">
        <div>
          <div className="su-plate__title">
            {icon}
            <h3>{title}</h3>
          </div>
          {hint ? <p className="su-plate__hint">{hint}</p> : null}
        </div>
        {trailing}
      </div>
      <div className="su-plate__body">{children}</div>
    </div>
  );
}

export function PageView({ route: _route }: { route: RouteState }) {
  const opsQ = useQuery({
    queryKey: ['ops-cache'],
    queryFn: api.opsCache,
    refetchInterval: POLL_MS,
  });
  const factsQ = useQuery({ queryKey: ['facts'], queryFn: api.facts });
  const auditQ = useQuery({
    queryKey: ['config-audit'],
    queryFn: api.configAudit,
    staleTime: 60_000,
    retry: 1,
  });
  const updateQ = useQuery({ queryKey: ['update-check'], queryFn: api.updateCheck });

  const profile = useMemo(() => {
    const opsProfile = normalizeProfile(asRecord(opsQ.data).startup_profile);
    if (opsProfile) return opsProfile;
    const facts = asRecord(factsQ.data);
    return normalizeProfile(asRecord(facts.optional).startup_profile);
  }, [opsQ.data, factsQ.data]);

  const audit = useMemo(() => {
    const fromApi = normalizeAudit(auditQ.data);
    if (fromApi) return fromApi;
    const facts = asRecord(factsQ.data);
    return normalizeAudit(asRecord(facts.optional).config_launch_audit);
  }, [auditQ.data, factsQ.data]);

  const cleanShutdown = asRecord(asRecord(factsQ.data).minecraft).clean_shutdown_seen === true;
  const update = asRecord(updateQ.data);

  const loading = opsQ.isLoading && factsQ.isLoading && !profile;
  const error = opsQ.isError && factsQ.isError && !profile;

  if (loading) {
    return (
      <PageEnter className="su-stack">
        <div className="h-40 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-40 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
          <div className="h-40 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        </div>
        <div className="h-16 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        <div className="h-56 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        <div className="h-52 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
      </PageEnter>
    );
  }

  if (error) {
    return (
      <ErrorState title="Couldn't load startup data">
        {(opsQ.error as Error)?.message || (factsQ.error as Error)?.message}
      </ErrorState>
    );
  }

  const tone = profile ? statusTone(profile.status) : 'neutral';
  const delta = profile ? formatDelta(profile.compare) : null;
  const ranks = profile ? slowRankMap(profile.slowest) : new Map<string, number>();
  const phaseMax = profile
    ? maxPhaseSec(profile.phases, profile.wall_clock_sec ?? profile.vanilla_done_sec ?? profile.total_sec)
    : 1;
  const blocking = profile?.errors.filter((e) => e.blocking).length ?? 0;
  const doneLabel = profile ? formatDoneAt(profile.done_at) : null;
  const slowest0 = profile?.slowest[0];
  const phaseBudget = profile
    ? profile.wall_clock_sec ?? profile.vanilla_done_sec ?? profile.total_sec
    : null;
  const slowestSec = slowest0 ? sanePhaseSec(slowest0.sec, phaseBudget) : null;
  const slowestLabel =
    slowest0 && slowestSec != null && profile
      ? `${phaseLabel(profile.phases, slowest0.phase)} · ${formatSec(slowestSec)}`
      : null;
  const bootChart = profile ? bootHistoryChartModel(profile.boot_history) : null;
  const bootChartRows = bootChart?.rows ?? [];
  const bootChartAvg =
    bootChartRows.length > 0
      ? Math.round(
          (bootChartRows.reduce((s, r) => s + num(r.total_sec), 0) / bootChartRows.length) * 10,
        ) / 10
      : null;

  const auditCard = <ConfigAuditCta audit={audit} />;

  if (!profile) {
    return (
      <PageEnter className="su-stack">
        <FadeIn>
          <EmptyState title="No boot profile yet">
            Waiting for a boot profile — after the server reaches Done!, Watchtower captures phases
            automatically via Scanning.
          </EmptyState>
        </FadeIn>
        <FadeIn>{auditCard}</FadeIn>
      </PageEnter>
    );
  }

  const hasBootIssues = profile.warnings.length > 0 || profile.errors.length > 0;

  const phasesPlate = (
    <FadeIn>
      <Plate
        title="Boot phases"
        hint="Share of this boot with ranked slowest markers."
        icon={<GlareIcon icon={RocketIcon} tone="info" size={15} className="h-8 w-8 rounded-xl" />}
      >
        {profile.phases.length ? (
          <div className="su-phases" role="list">
            {profile.phases.map((p) => {
              const sec = sanePhaseSec(p.sec, profile.total_sec);
              const pct = sec != null ? Math.min(100, (sec / phaseMax) * 100) : 0;
              const shareRaw =
                sec != null && phaseBudget != null && phaseBudget > 0
                  ? Math.round((sec / phaseBudget) * 100)
                  : null;
              const share = shareRaw != null ? Math.max(0, Math.min(100, shareRaw)) : null;
              const rank = ranks.get(p.id);
              const isSlow = rank === 1;
              return (
                <div
                  key={p.id || p.label}
                  className={`su-phase${isSlow ? ' su-phase--slow' : ''}${rank ? ' su-phase--ranked' : ''}`}
                  role="listitem"
                >
                  <div className="su-phase__meta">
                    <div className="su-phase__title">
                      {rank ? (
                        <span className="su-phase__rank" title={`#${rank} slowest`}>
                          {rank}
                        </span>
                      ) : null}
                      <span className="su-phase__label">{p.label}</span>
                    </div>
                    <div className="su-phase__nums">
                      {share != null ? <span className="su-phase__share">{share}%</span> : null}
                      <span className="su-phase__sec">{formatSec(sec)}</span>
                    </div>
                  </div>
                  <div className="su-phase__bar" aria-hidden>
                    <span style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No phases">
            Boot phase markers were not found in the log for this report.
          </EmptyState>
        )}
      </Plate>
    </FadeIn>
  );

  const warningPreviews: string[] = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const w of profile.warnings) {
      const label = w.mod_id ? `${w.title} · ${w.mod_id}` : w.title;
      if (seen.has(label)) continue;
      seen.add(label);
      out.push(label);
      if (out.length >= 3) break;
    }
    return out;
  })();

  const errorPreviews = profile.errors.slice(0, 3).map((e) => `${e.mod_id} — ${e.title}`);

  const issuesSplit = hasBootIssues ? (
    <div className="su-split">
      {profile.warnings.length ? (
        <FadeIn className="su-split__col">
          <IssueOverviewCard
            kind="warn"
            title="Warnings"
            count={profile.warning_event_count || profile.warnings.length}
            hint={
              profile.warning_event_count > profile.warnings.length
                ? `${profile.warnings.length} samples from ${profile.warning_event_count} boot-log events`
                : 'Noisy patterns matched during the last boot'
            }
            previews={warningPreviews}
            onOpen={() =>
              navigate({ tab: 'issues', view: 'active', panel: 'boot-warn', issue: null })
            }
          />
        </FadeIn>
      ) : null}
      {profile.errors.length ? (
        <FadeIn className="su-split__col">
          <IssueOverviewCard
            kind="danger"
            title="Errors"
            count={profile.errors.length}
            hint={
              blocking
                ? `${blocking} blocking of ${profile.errors.length}`
                : 'Mod errors during boot (server still reached Done!)'
            }
            previews={errorPreviews}
            onOpen={() =>
              navigate({ tab: 'issues', view: 'active', panel: 'boot-error', issue: null })
            }
          />
        </FadeIn>
      ) : null}
    </div>
  ) : null;

  const historyChart =
    bootChart && bootChartRows.length >= 2 ? (
      <FadeIn>
        <ChartFrame
          title="Boot times"
          layer="scanning"
          className="su-boot-chart"
          actions={
            bootChartAvg != null ? (
              <StatusPill tone="info">{formatSec(bootChartAvg)} avg</StatusPill>
            ) : null
          }
        >
          {bootChart.stacked ? (
            <div className="su-boot-chart__legend" aria-hidden>
              {bootChart.series.map((s) => (
                <span key={s.dataKey} className="su-boot-chart__legend-item">
                  <span className="su-boot-chart__swatch" style={{ background: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>
          ) : null}
          <WtBarChart
            data={bootChartRows}
            series={bootChart.series}
            stacked={bootChart.stacked}
            xDataKey="name"
            className="h-52"
          />
          <p className="su-boot-chart__caption">
            {bootChart.stacked
              ? 'Stacked boot phases across recent startups (seconds). Latest is the current profile.'
              : 'Total boot duration across recent startups (seconds). Latest is the current profile.'}
          </p>
        </ChartFrame>
      </FadeIn>
    ) : null;

  return (
    <PageEnter className="su-stack">
      <FadeIn>
        <BorderGlow
          className="su-hero"
          borderRadius={14}
          edgeSensitivity={28}
          glowRadius={16}
          coneSpread={18}
          animated
          {...heroGlowProps(tone)}
        >
          <div className="su-hero__body">
            <div className="su-hero__head">
              <div>
                <div className="su-hero__title">
                  <GlareIcon
                    icon={RocketIcon}
                    tone={
                      tone === 'ok'
                        ? 'ok'
                        : tone === 'warn'
                          ? 'warn'
                          : tone === 'danger'
                            ? 'danger'
                            : 'info'
                    }
                  />
                  <h2>Last boot</h2>
                  <StatusPill tone={tone === 'neutral' ? 'neutral' : tone}>
                    {statusWord(profile.status)}
                  </StatusPill>
                  {cleanShutdown ? (
                    <StatusPill tone="ok">
                      <CheckCircle2 size={12} className="mr-1 inline" />
                      Clean shutdown
                    </StatusPill>
                  ) : (
                    <StatusPill tone="danger">
                      <XCircle size={12} className="mr-1 inline" />
                      Unclean shutdown
                    </StatusPill>
                  )}
                  {update.update_available ? (
                    <StatusPill tone="info">Update available</StatusPill>
                  ) : null}
                </div>
                <p className="su-hero__hint">
                  {doneLabel
                    ? `Finished ${doneLabel}`
                    : profile.done_at
                      ? `Done ${timeAgo(profile.done_at)}`
                      : 'Boot timeline from Scanning'}
                  {slowestLabel ? ` · Slowest: ${slowestLabel}` : ''}
                  {profile.total_source === 'modernfix'
                    ? ' · Full load (ModernFix)'
                    : profile.total_source === 'wall_clock'
                      ? ' · JVM → Done'
                      : ''}
                  {profile.vanilla_done_sec != null
                  && profile.total_sec != null
                  && profile.vanilla_done_sec + 1 < profile.total_sec
                    ? ` · Vanilla Done ${formatSec(profile.vanilla_done_sec)}`
                    : ''}
                </p>
              </div>
              <div className="su-hero__total" aria-label="Total boot time">
                {formatSec(profile.total_sec)}
              </div>
            </div>

            <div className="su-vitals">
              <VitalTile
                label="vs last boot"
                text={delta?.label ?? '—'}
                tone={delta?.tone === 'ok' ? 'ok' : delta?.tone === 'warn' ? 'warn' : 'default'}
              />
              <VitalTile
                label="Warnings"
                value={profile.warning_event_count}
                format={(n) => String(Math.round(n))}
                tone={profile.warning_event_count ? 'warn' : 'default'}
              />
              <VitalTile
                label="Errors"
                text={
                  blocking
                    ? `${profile.errors.length} (${blocking} blocking)`
                    : String(profile.errors.length)
                }
                tone={profile.errors.length ? 'danger' : 'default'}
              />
              <VitalTile
                label="Slowest"
                text={
                  slowest0 && slowestSec != null
                    ? `${formatSec(slowestSec)}`
                    : '—'
                }
                tone={slowestSec != null && phaseBudget != null && slowestSec >= phaseBudget * 0.35 ? 'warn' : 'default'}
              />
            </div>
          </div>
        </BorderGlow>
      </FadeIn>

      {/* Actionable first: issues + config recommendations */}
      {issuesSplit}
      <FadeIn>{auditCard}</FadeIn>

      {/* Then explain this boot */}
      {phasesPlate}

      {/* Trend last */}
      {historyChart}
    </PageEnter>
  );
}
