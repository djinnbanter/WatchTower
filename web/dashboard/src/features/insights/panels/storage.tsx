import { useMemo, type ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { curveLinear } from '@visx/curve';
import BorderGlow from '@/components/border-glow/BorderGlow';
import { LineChart, Line } from '@/components/charts/line-chart';
import { LineSeriesTerminalMarker } from '@/components/charts/line-series-terminal-marker';
import { Grid } from '@/components/charts/grid';
import { XAxis } from '@/components/charts/x-axis';
import { YAxis } from '@/components/charts/y-axis';
import { ChartTooltip } from '@/components/charts/tooltip';
import { navigate } from '@/app/router';
import { api } from '@/api/client';
import { toBklitRows, type BklitRow } from '@/ui/charts/adapters';
import { WtGauge } from '@/ui/charts/wt-gauges';
import { FadeIn, GlareIcon, HeroWatermark } from '@/ui/motion';
import { Button, EmptyState, MetricReadout, StatusPill } from '@/ui/patterns';
import { AlertTriangle, Boxes, Database, FileText, FolderOpen, HardDrive } from '@/ui/icons';
import { asArray, asRecord, bool, num, str } from '@/lib/utils';
import { formatGb, formatPct } from '@/domain/formats';
import { PanelShell } from '../shared';
import { StorageTreemap } from './storage-treemap';
import { buildStorageTreemapTree } from './storage-treemap-tree';

type CatTone = 'accent' | 'info' | 'warn' | 'neutral' | 'ok';
type GlareTone = 'accent' | 'ok' | 'warn' | 'danger' | 'info';

function runwayBorderProps(filling: boolean) {
  // glowColor is HSL "H S L" (spaces), matching other BorderGlow hosts — not RGB.
  if (!filling) {
    return {
      glowColor: '205 72 55',
      glowIntensity: 0.5,
      colors: ['#7dd3fc', '#38bdf8', '#93c5fd'],
      fillOpacity: 0.18,
      backgroundColor: 'var(--wt-bg1)',
    };
  }
  return {
    glowColor: '36 90 58',
    glowIntensity: 0.5,
    colors: ['#fcd34d', '#fb923c', '#fde68a'],
    fillOpacity: 0.16,
    backgroundColor: 'var(--wt-bg1)',
  };
}

function toneCssVar(tone: CatTone): string {
  if (tone === 'info') return 'var(--wt-ch-heap, var(--wt-info, var(--wt-accent)))';
  if (tone === 'warn') return 'var(--wt-warn)';
  if (tone === 'neutral') return 'var(--wt-text-low)';
  if (tone === 'ok') return 'var(--wt-ok)';
  return 'var(--wt-accent)';
}

function projVerdictTone(verdict: string): 'ok' | 'warn' | 'neutral' | 'info' {
  if (verdict === 'filling') return 'warn';
  if (verdict === 'stable') return 'ok';
  if (verdict === 'insufficient') return 'neutral';
  return 'info';
}

type VolumeRelation = 'same' | 'separate' | 'mixed' | 'unknown';

function volumeRelationOf(source: Record<string, unknown>): VolumeRelation {
  const raw = str(source.volume_relation).toLowerCase();
  if (raw === 'same' || raw === 'separate' || raw === 'mixed' || raw === 'unknown') return raw;
  if (source.same_volume === true) return 'same';
  if (source.same_volume === false) return 'separate';
  return 'unknown';
}

/** Weak path fallback when backend has not emitted volume_relation yet. */
function inferVolumeRelation(serverDir: string, backupDirs: string[]): VolumeRelation {
  if (!serverDir || !backupDirs.length) return 'unknown';
  const server = serverDir.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  let same = 0;
  let separate = 0;
  for (const raw of backupDirs) {
    const dir = raw.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
    if (!dir) continue;
    const winServer = /^[a-z]:/.exec(server)?.[0];
    const winDir = /^[a-z]:/.exec(dir)?.[0];
    if (winServer && winDir) {
      if (winServer === winDir) same++;
      else separate++;
      continue;
    }
    // Same folder tree or sibling under a short shared root is inconclusive — only
    // treat nested paths as same; otherwise unknown (needs FileStore).
    if (dir === server || dir.startsWith(server + '/') || server.startsWith(dir + '/')) {
      same++;
    } else {
      // Don't claim separate from path alone on Unix — mounts can share a prefix.
      return 'unknown';
    }
  }
  if (same > 0 && separate === 0) return 'same';
  if (separate > 0 && same === 0) return 'separate';
  if (same > 0 && separate > 0) return 'mixed';
  return 'unknown';
}

function backupVolumeHint(relation: VolumeRelation, totalGb: number): string {
  const size = formatGb(totalGb);
  switch (relation) {
    case 'same':
      return 'Same volume as the server — backups count against this disk.';
    case 'separate':
      return `Backups ${size} are on a different volume from the server folder.`;
    case 'mixed':
      return 'Some backup folders share this volume; others don’t — shares include backups when mixed.';
    default:
      return `Backups ${size} are tracked separately from the server-folder breakdown.`;
  }
}

/**
 * Canonical disk use % for the Storage hero.
 * Prefer live instrument → jump snapshot → projection (documented order).
 */
function canonicalDiskPct(livePct: number, jumpPct: number, projPct: number): number {
  if (Number.isFinite(livePct) && livePct > 0) return livePct;
  if (Number.isFinite(jumpPct) && jumpPct > 0) return jumpPct;
  if (Number.isFinite(projPct) && projPct > 0) return projPct;
  return 0;
}

function decimateRows(rows: BklitRow[], maxPoints: number): BklitRow[] {
  if (rows.length <= maxPoints) return rows;
  const out: BklitRow[] = [];
  const last = rows.length - 1;
  for (let i = 0; i < maxPoints; i++) {
    const idx = i === maxPoints - 1 ? last : Math.round((i * last) / (maxPoints - 1));
    const row = rows[idx];
    if (row && out[out.length - 1] !== row) out.push(row);
  }
  return out;
}

function buildDiskHistory(
  samples: Record<string, unknown>,
  livePct: number,
  windowMs: number,
): BklitRow[] {
  // Prefer a real time window — dense 1s fixtures make a point-count `take`
  // collapse to only a few hours of solid history.
  const rows = toBklitRows(samples, ['disk_use_pct'], {
    windowMs: Math.max(windowMs, 60 * 60_000),
    take: 50_000,
  });
  const withDisk = decimateRows(
    rows.filter((r) => typeof r.disk_use_pct === 'number' && Number(r.disk_use_pct) > 0),
    720,
  );
  if (!withDisk.length && livePct > 0) {
    const now = new Date();
    return [
      { date: new Date(now.getTime() - Math.min(windowMs, 6 * 3600_000)), disk_use_pct: Math.max(1, livePct - 2) },
      { date: now, disk_use_pct: livePct },
    ];
  }
  if (withDisk.length && livePct > 0) {
    const last = withDisk[withDisk.length - 1]!;
    const lastT = last.date instanceof Date ? last.date.getTime() : Date.parse(String(last.date));
    if (Number.isFinite(lastT) && Date.now() - lastT > 90_000) {
      return [...withDisk, { date: new Date(), disk_use_pct: livePct }];
    }
  }
  return withDisk;
}

/** Densify the forecast tail so ChartTooltip can snap along the dashed segment. */
function densifyForecastTail(
  anchorDate: Date,
  anchorVal: number,
  displayDays: number,
  endVal: number,
  steps = 48,
): BklitRow[] {
  if (!(displayDays > 0) || steps < 1) return [];
  const t0 = anchorDate.getTime();
  const out: BklitRow[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    out.push({
      date: new Date(t0 + displayDays * 86_400_000 * t),
      disk_use_pct: anchorVal + (endVal - anchorVal) * t,
    });
  }
  return out;
}

function DiskFillProjectionChart({
  history,
  filling,
  daysUntilFull,
  diskPct,
  historyDays = 7,
  loading,
}: {
  history: BklitRow[];
  filling: boolean;
  daysUntilFull: number;
  diskPct: number;
  historyDays?: number;
  loading?: boolean;
}) {
  const forecast = useMemo(() => {
    if (!history.length || !filling) {
      return {
        chartData: history,
        dashFromIndex: undefined as number | undefined,
        displayDays: 0,
        truncated: false,
        endVal: 0,
      };
    }
    const last = history[history.length - 1]!;
    const anchorDate =
      last.date instanceof Date ? last.date : new Date(String(last.date));
    if (Number.isNaN(anchorDate.getTime())) {
      return {
        chartData: history,
        dashFromIndex: undefined as number | undefined,
        displayDays: 0,
        truncated: false,
        endVal: 0,
      };
    }
    const anchorVal = num(last.disk_use_pct, diskPct);
    if (!(anchorVal > 0)) {
      return {
        chartData: history,
        dashFromIndex: undefined as number | undefined,
        displayDays: 0,
        truncated: false,
        endVal: 0,
      };
    }

    // Cap how far we draw the forecast so multi-year runways don't crush the
    // solid history into a 1px sliver (and left edge-fade wiping it out).
    const rawDays =
      Number.isFinite(daysUntilFull) && daysUntilFull > 0 ? daysUntilFull : 30;
    const maxDisplayDays = Math.max(historyDays * 4, 60);
    const displayDays = Math.min(rawDays, maxDisplayDays);
    const truncated = displayDays + 0.5 < rawDays;
    const endVal = truncated
      ? anchorVal + (100 - anchorVal) * (displayDays / rawDays)
      : 100;
    const tail = densifyForecastTail(anchorDate, anchorVal, displayDays, endVal);
    return {
      chartData: [...history, ...tail],
      dashFromIndex: history.length - 1,
      displayDays,
      truncated,
      endVal,
    };
  }, [history, filling, daysUntilFull, diskPct, historyDays]);

  if (loading && !history.length) {
    return (
      <div className="in-storage-proj">
        <div className="in-storage-proj-chart in-storage-proj-chart--empty">
          <div className="h-full w-full animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2/80" />
        </div>
      </div>
    );
  }

  if (!history.length) {
    return (
      <div className="in-storage-proj">
        <div className="in-storage-proj-chart in-storage-proj-chart--empty">
          <p className="text-sm text-wt-text-low">Disk history will appear once live samples arrive.</p>
        </div>
      </div>
    );
  }

  const caption = (() => {
    if (!filling) return `Last ${historyDays} days of disk use — not projecting a fill`;
    if (!(daysUntilFull > 0)) return `Solid = last ${historyDays} days · dashed = path toward full`;
    if (forecast.truncated) {
      return `Solid = last ${historyDays} days · dashed = next ~${Math.round(forecast.displayDays)} days of growth (full in ~${daysUntilFull.toFixed(0)} days)`;
    }
    return `Solid = last ${historyDays} days · dashed = projected to full in ~${daysUntilFull.toFixed(1)} days`;
  })();

  return (
    <div className="in-storage-proj">
      <div className="in-storage-proj-chart">
        <LineChart
          data={forecast.chartData as Record<string, unknown>[]}
          status="ready"
          aspectRatio="21 / 9"
          className="h-full w-full"
          animationDuration={700}
        >
          <Grid horizontal />
          <Line
            dataKey="disk_use_pct"
            stroke="var(--wt-accent)"
            strokeWidth={2}
            curve={curveLinear}
            fadeEdges={false}
            dashFromIndex={forecast.dashFromIndex}
            dashArray="1,4"
          />
          {forecast.dashFromIndex == null ? (
            <LineSeriesTerminalMarker dataKey="disk_use_pct" stroke="var(--wt-accent)" />
          ) : null}
          <XAxis tickMode="domain" />
          <YAxis />
          <ChartTooltip />
        </LineChart>
      </div>
      <p className="in-storage-proj-caption">{caption}</p>
    </div>
  );
}

function formatShareSize(row: Record<string, unknown>): string {
  const gb = num(row.gb, NaN);
  const mb = num(row.mb, NaN);
  if (Number.isFinite(mb) && (!Number.isFinite(gb) || gb < 0.1)) {
    return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
  }
  if (Number.isFinite(gb) && gb < 0.1) {
    return `${(gb * 1024).toFixed(0)} MB`;
  }
  return formatGb(gb);
}

function shareRowsOf(
  rows: Record<string, unknown>[],
): { key: string; label: string; path: string; gb: number; sizeLabel: string }[] {
  return rows
    .map((row) => {
      const gb = num(row.gb, num(row.mb, 0) / 1024);
      return {
        key: str(row.id, str(row.path, str(row.label))),
        label: str(row.label, str(row.id, str(row.path))).replace(/^minecraft:/, ''),
        path: str(row.path, '—'),
        gb,
        sizeLabel: formatShareSize(row),
      };
    })
    .filter((r) => r.gb > 0)
    .sort((a, b) => b.gb - a.gb);
}

const MAX_BACKUP_TREEMAP_ENTRIES = 24;

/** Per-archive rows for Space map drill-down (ops inventory, else facts). */
function backupTreemapRowsOf(
  backupsLive: Record<string, unknown>,
  optional: Record<string, unknown>,
): { key: string; label: string; path: string; gb: number }[] {
  const liveList = asArray<Record<string, unknown>>(backupsLive.inventory);
  const factsList = asArray<Record<string, unknown>>(optional.backup_inventory);
  const raw = liveList.length ? liveList : factsList;
  const rows = raw
    .map((f) => {
      const file = str(f.file, str(f.filename)).trim();
      if (!file) return null;
      let gb = num(f.size_gb, NaN);
      if (!Number.isFinite(gb) || gb <= 0) {
        const mb = num(f.size_mb, NaN);
        if (Number.isFinite(mb) && mb > 0) gb = mb / 1024;
      }
      if (!(gb > 0)) return null;
      const path = str(f.path).trim() || file;
      return {
        key: `bak:${path}`,
        label: file,
        path,
        gb,
      };
    })
    .filter((r): r is { key: string; label: string; path: string; gb: number } => r != null)
    .sort((a, b) => b.gb - a.gb);

  if (rows.length <= MAX_BACKUP_TREEMAP_ENTRIES) return rows;
  const head = rows.slice(0, MAX_BACKUP_TREEMAP_ENTRIES);
  const restGb = rows.slice(MAX_BACKUP_TREEMAP_ENTRIES).reduce((s, r) => s + r.gb, 0);
  if (restGb > 0) {
    head.push({
      key: 'bak:rest',
      label: 'Other archives',
      path: 'backups',
      gb: restGb,
    });
  }
  return head;
}

function StorageShareCard({
  title,
  subtitle,
  icon: Icon,
  iconTone = 'accent',
  rows,
  emptyTitle,
  emptyBody,
  nameHeader = 'Name',
}: {
  title: string;
  subtitle: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  iconTone?: GlareTone;
  rows: { key: string; label: string; path: string; gb: number; sizeLabel: string }[];
  emptyTitle: string;
  emptyBody: string;
  nameHeader?: string;
}) {
  const sum = rows.reduce((s, r) => s + r.gb, 0) || 0.01;
  return (
    <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 in-storage-plate p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <GlareIcon icon={Icon} tone={iconTone} size={14} className="h-6 w-6 rounded-md" />
            <h3 className="text-sm font-semibold">{title}</h3>
          </div>
          <p className="mt-0.5 text-xs text-wt-text-low">{subtitle}</p>
        </div>
      </div>
      {rows.length ? (
        <div className="in-table-scroll">
          <table className="in-table">
            <thead>
              <tr>
                <th>{nameHeader}</th>
                <th>Path</th>
                <th>Size</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const share = (row.gb / sum) * 100;
                return (
                  <tr key={row.key}>
                    <td className="font-medium text-wt-text">{row.label}</td>
                    <td className="font-mono text-xs text-wt-text-low">{row.path}</td>
                    <td className="font-mono">{row.sizeLabel}</td>
                    <td>
                      <div className="in-storage-share">
                        <span className="font-mono text-xs">{formatPct(share)}</span>
                        <div className="in-storage-bar in-storage-bar--thin">
                          <span style={{ width: `${Math.max(2, share)}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={emptyTitle}>{emptyBody}</EmptyState>
      )}
    </div>
  );
}

export function StoragePanel({
  live,
  dash,
  facts,
  ops,
  windowKey = '7d',
}: {
  live: Record<string, unknown>;
  dash: Record<string, unknown>;
  facts: Record<string, unknown>;
  ops: Record<string, unknown>;
  windowKey?: '7d' | '30d';
}) {
  const optional = asRecord(facts.optional);
  const meta = asRecord(facts.meta);
  const liveLatest = asRecord(live.latest);
  const diskJump = asRecord(ops.disk_jump);
  const storage = asRecord(optional.storage);
  const proj = (() => {
    const fromDash = asRecord(dash.disk_projection);
    if (Object.keys(fromDash).length) return fromDash;
    return asRecord(optional.disk_projection);
  })();

  const insights = asArray<Record<string, unknown>>(dash.insights);
  const diskIoLag = insights.find((i) => str(i.id) === 'disk_io_lag_align');

  const dimsLive = asArray<Record<string, unknown>>(liveLatest.by_dimension);
  const dimsFacts = asArray<Record<string, unknown>>(storage.by_dimension);
  const dims = dimsLive.length ? dimsLive : dimsFacts;
  const logsRows = shareRowsOf(asArray<Record<string, unknown>>(storage.by_logs));
  const otherRows = shareRowsOf(asArray<Record<string, unknown>>(storage.by_other));
  const modsLive = asArray<Record<string, unknown>>(liveLatest.by_mods);
  const modsFacts = asArray<Record<string, unknown>>(storage.by_mods);
  const modsRows = shareRowsOf(modsLive.length ? modsLive : modsFacts);

  const worldGb = num(storage.world_gb, num(liveLatest.world_gb, NaN));
  const modsGb = num(storage.mods_gb, NaN);
  const logsGb = (() => {
    if (storage.logs_gb != null) return num(storage.logs_gb);
    if (storage.logs_mb != null) return num(storage.logs_mb) / 1024;
    return NaN;
  })();
  const totalGb = num(storage.total_gb, num(storage.server_dir_gb, NaN));
  const deltaMb24h = num(storage.delta_mb_24h, NaN);

  const categories: { id: string; label: string; gb: number; tone: CatTone }[] = [];
  if (Number.isFinite(worldGb)) categories.push({ id: 'world', label: 'World', gb: worldGb, tone: 'accent' });
  if (Number.isFinite(modsGb)) categories.push({ id: 'mods', label: 'Mods', gb: modsGb, tone: 'info' });
  if (Number.isFinite(logsGb)) categories.push({ id: 'logs', label: 'Logs', gb: logsGb, tone: 'warn' });
  if (Number.isFinite(totalGb)) {
    const accounted = categories.reduce((s, c) => s + c.gb, 0);
    const other = Math.max(0, totalGb - accounted);
    if (other >= 0.05) categories.push({ id: 'other', label: 'Other', gb: other, tone: 'neutral' });
  }

  const dimsSorted = shareRowsOf(dims);

  const livePct = num(liveLatest.disk_use_pct, NaN);
  const jumpPct = num(diskJump.disk_use_pct, NaN);
  const projPct = num(proj.disk_use_pct, NaN);
  const diskPct = canonicalDiskPct(livePct, jumpPct, projPct);

  const verdict = str(proj.verdict);
  const filling = verdict === 'filling';
  const hasProj = Object.keys(proj).length > 0;
  const jumpActive = diskJump.active === true;
  const daysUntilFull = num(proj.days_until_full, NaN);
  // Follow Insights window (7d / 30d) for solid history before the dashed forecast.
  const chartHistoryHours = windowKey === '30d' ? 30 * 24 : 7 * 24;
  const chartHistoryMs = chartHistoryHours * 3600_000;

  const samplesQ = useQuery({
    queryKey: ['samples', 'storage-disk', chartHistoryHours],
    queryFn: () => api.samples(chartHistoryHours * 60, 10_000),
    staleTime: 60_000,
  });
  const diskHistory = useMemo(
    () => buildDiskHistory(asRecord(samplesQ.data), diskPct, chartHistoryMs),
    [samplesQ.data, diskPct, chartHistoryMs],
  );

  // Backups
  const backupsLive = asRecord(ops.backups_live);
  const inventory = asRecord(backupsLive.inventory_summary);
  const lastOps = asRecord(backupsLive.last_backup);
  const lastFacts = asRecord(optional.last_backup);
  const backupExternal = asRecord(optional.backup_external);
  const trackingExplicitOff = meta.backup_tracking_enabled === false;
  const hasBackupSignal =
    Object.keys(backupsLive).length > 0 ||
    Object.keys(lastFacts).length > 0 ||
    bool(backupExternal.configured);
  const showBackupsCard = !trackingExplicitOff && (hasBackupSignal || meta.backup_tracking_enabled === true);

  const backupTotalGb = num(inventory.total_gb, NaN);
  const volumeRelation = (() => {
    const fromOps = volumeRelationOf(lastOps);
    if (fromOps !== 'unknown') return fromOps;
    const fromFacts = volumeRelationOf(lastFacts);
    if (fromFacts !== 'unknown') return fromFacts;
    const dirs = [
      ...asArray<string>(lastFacts.search_dirs).map(String),
      str(lastOps.dir, str(lastFacts.dir)),
    ].filter(Boolean);
    return inferVolumeRelation(str(meta.server_dir), dirs);
  })();

  const includeBackupsInShare =
    Number.isFinite(backupTotalGb) &&
    (volumeRelation === 'same' || volumeRelation === 'mixed');
  const backupRows = useMemo(
    () => backupTreemapRowsOf(backupsLive, optional),
    [backupsLive, optional],
  );
  const spaceRows: { id: string; label: string; gb: number; tone: CatTone }[] = [...categories];
  if (Number.isFinite(backupTotalGb)) {
    spaceRows.push({ id: 'backups', label: 'Backups', gb: backupTotalGb, tone: 'ok' });
  }
  const spaceBarMax = Math.max(...spaceRows.map((c) => c.gb), 0.01);
  const spaceShareSum = includeBackupsInShare
    ? spaceRows.reduce((s, c) => s + c.gb, 0) || spaceBarMax
    : categories.reduce((s, c) => s + c.gb, 0) || spaceBarMax;

  // Show Backups on the map whenever we have a total (same as meters). Drill uses archive inventory.
  const includeBackupsOnMap = Number.isFinite(backupTotalGb) && backupTotalGb > 0;

  const treemapTree = useMemo(
    () =>
      buildStorageTreemapTree({
        totalGb,
        worldGb,
        modsGb,
        logsGb,
        otherGb: categories.find((c) => c.id === 'other')?.gb ?? NaN,
        dims: dimsSorted,
        mods: modsRows,
        logs: logsRows,
        otherRows,
        backups: backupRows,
        backupsGb: backupTotalGb,
        includeBackups: includeBackupsOnMap,
      }),
    [
      totalGb,
      worldGb,
      modsGb,
      logsGb,
      categories,
      dimsSorted,
      modsRows,
      logsRows,
      otherRows,
      backupRows,
      backupTotalGb,
      includeBackupsOnMap,
    ],
  );

  const hasAny =
    jumpActive ||
    categories.length > 0 ||
    dimsSorted.length > 0 ||
    logsRows.length > 0 ||
    otherRows.length > 0 ||
    Number.isFinite(worldGb) ||
    Number.isFinite(modsGb) ||
    diskPct > 0 ||
    hasProj ||
    showBackupsCard;

  if (!hasAny) {
    return (
      <PanelShell>
        <EmptyState title="No disk data">
          Storage metrics come from live samples and Scanning. Wait for the next scan if this is empty.
        </EmptyState>
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      <FadeIn>
        <BorderGlow
          className={`in-kpi-glow in-storage-hero ${filling ? 'in-kpi-card--warn' : 'in-kpi-card--info'}`}
          borderRadius={4}
          edgeSensitivity={28}
          glowRadius={16}
          coneSpread={18}
          {...runwayBorderProps(filling)}
        >
          <div className="in-storage-hero__body wt-hero-shell">
            <HeroWatermark
              icon={HardDrive}
              tone={filling ? 'warn' : 'info'}
              size="card"
            />
            <div className="relative z-[1] mb-2 flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">Disk runway</h3>
              {hasProj ? (
                <StatusPill tone={projVerdictTone(verdict)}>{verdict || 'unknown'}</StatusPill>
              ) : (
                <StatusPill tone="neutral">No projection yet</StatusPill>
              )}
              {diskPct > 0 ? (
                <StatusPill tone={diskPct >= 85 ? 'warn' : 'neutral'}>
                  {formatPct(diskPct)} used
                </StatusPill>
              ) : null}
            </div>

            {hasProj ? (
              <>
                <p className="text-sm text-wt-text-mid">
                  {str(
                    proj.message,
                    filling
                      ? 'Disk is filling at the current growth rate.'
                      : 'Disk free space looks stable at current growth.',
                  )}
                </p>
                {str(proj.driver_hint) ? (
                  <p className="mt-1 text-xs text-wt-text-low">{str(proj.driver_hint)}</p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-wt-text-mid">
                Fill projection needs more rollup history. Category and dimension sizes still show below when
                available.
              </p>
            )}

            <DiskFillProjectionChart
              history={diskHistory}
              filling={filling}
              daysUntilFull={daysUntilFull}
              diskPct={diskPct}
              historyDays={windowKey === '30d' ? 30 : 7}
              loading={samplesQ.isLoading}
            />

            {hasProj ? (
              <div className="in-storage-proj-stats grid grid-cols-2 gap-2 sm:grid-cols-4">
                {proj.disk_free_gb != null ? (
                  <div className="in-storage-stat">
                    <MetricReadout
                      label="Free"
                      value={num(proj.disk_free_gb)}
                      format={(n) => formatGb(n)}
                      size="sm"
                    />
                  </div>
                ) : null}
                {proj.days_until_full != null ? (
                  <div className="in-storage-stat">
                    <MetricReadout
                      label="Days to full"
                      value={num(proj.days_until_full)}
                      format={(n) => (n > 0 ? n.toFixed(1) : '—')}
                      size="sm"
                      tone={filling ? 'warn' : 'default'}
                    />
                  </div>
                ) : null}
                {proj.fill_rate_gb_per_day != null ? (
                  <div className="in-storage-stat">
                    <MetricReadout
                      label="GB / day"
                      value={num(proj.fill_rate_gb_per_day)}
                      format={(n) => n.toFixed(2)}
                      size="sm"
                    />
                  </div>
                ) : null}
                {str(proj.confidence) ? (
                  <div className="in-storage-stat">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wt-text-low">
                      Confidence
                    </div>
                    <div className="mt-1 text-sm font-semibold">{str(proj.confidence)}</div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {(jumpActive || diskIoLag) && (
              <div className="in-storage-notes mt-3">
                {jumpActive ? (
                  <div className="in-storage-jump">
                    <AlertTriangle size={14} className="shrink-0 text-wt-warn" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-wt-warn">Disk use jumped</div>
                      <div className="text-xs text-wt-text-mid">
                        {str(
                          diskJump.message,
                          str(diskJump.label, 'Disk use jumped since last check'),
                        )}
                        {diskJump.delta_pct != null
                          ? ` · ${num(diskJump.delta_pct) >= 0 ? '+' : ''}${formatPct(num(diskJump.delta_pct))}`
                          : ''}
                        {diskJump.baseline_disk_use_pct != null && diskJump.disk_use_pct != null
                          ? ` (${formatPct(num(diskJump.baseline_disk_use_pct))} → ${formatPct(num(diskJump.disk_use_pct))})`
                          : ''}
                      </div>
                    </div>
                  </div>
                ) : null}
                {diskIoLag ? (
                  <div className="in-storage-jump">
                    <AlertTriangle size={14} className="shrink-0 text-wt-warn" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-wt-warn">
                        {str(diskIoLag.title, 'Lag aligned with slow disk writes')}
                      </div>
                      <div className="text-xs text-wt-text-mid">
                        {str(
                          diskIoLag.summary,
                          str(
                            diskIoLag.detail,
                            'High MSPT minutes often coincide with elevated disk write activity.',
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <div className="mt-4">
              <Button kind="default" onClick={() => navigate({ tab: 'live', view: null, panel: null })}>
                Open Live Host & storage
              </Button>
            </div>
          </div>
        </BorderGlow>
      </FadeIn>

      {(categories.length || diskPct > 0) && (
        <FadeIn>
          <div
            className={
              categories.length && diskPct > 0
                ? 'in-storage-split in-storage-split--wide-space'
                : 'in-storage-split in-storage-split--single'
            }
          >
            {categories.length ? (
              <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 in-storage-plate p-5">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <GlareIcon icon={Database} tone="accent" size={14} className="h-6 w-6 rounded-md" />
                      <h3 className="text-sm font-semibold">Server space</h3>
                    </div>
                    <p className="mt-0.5 text-xs text-wt-text-low">
                      {Number.isFinite(deltaMb24h)
                        ? `Server directory · 24h ${deltaMb24h >= 0 ? '+' : ''}${deltaMb24h.toFixed(0)} MB`
                        : 'World, mods, and logs in the server folder'}
                    </p>
                  </div>
                  {Number.isFinite(totalGb) ? (
                    <StatusPill tone="neutral">{formatGb(totalGb)} total</StatusPill>
                  ) : null}
                </div>
                <div className="in-storage-legend">
                  {spaceRows.map((c) => {
                    const showShare =
                      c.id !== 'backups' || includeBackupsInShare;
                    const sharePct = showShare
                      ? (c.gb / spaceShareSum) * 100
                      : (c.gb / spaceBarMax) * 100;
                    return (
                      <div
                        key={c.id}
                        className="in-storage-meter"
                        style={{ ['--in-storage-fill' as string]: toneCssVar(c.tone) }}
                        role="meter"
                        aria-label={`${c.label} storage`}
                        aria-valuenow={Math.round(sharePct)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <span
                          className="in-storage-meter__fill"
                          style={{ width: `${Math.max(1.5, Math.min(100, sharePct))}%` }}
                        />
                        <span className="in-storage-meter__label">{c.label}</span>
                        <span className="in-storage-meter__value">
                          {formatGb(c.gb)}
                          {showShare ? ` · ${formatPct(sharePct)}` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {Number.isFinite(backupTotalGb) ? (
                  <p className="mt-3 text-xs text-wt-text-low">
                    {backupVolumeHint(volumeRelation, backupTotalGb)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {diskPct > 0 ? (
              <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 in-storage-plate p-5">
                <div className="in-storage-disk-gauge">
                  <div className="w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <GlareIcon icon={HardDrive} tone="accent" size={14} className="h-6 w-6 rounded-md" />
                      <h3 className="text-sm font-semibold">Disk used</h3>
                      {diskPct >= 85 ? (
                        <StatusPill tone="warn">High</StatusPill>
                      ) : diskPct >= 65 ? (
                        <StatusPill tone="info">Filling</StatusPill>
                      ) : (
                        <StatusPill tone="ok">OK</StatusPill>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-wt-text-low">
                      {proj.disk_free_gb != null
                        ? `${formatGb(num(proj.disk_free_gb))} free on this volume`
                        : 'Share of the volume currently in use'}
                    </p>
                  </div>
                  <div
                    className="in-storage-disk-gauge__dial"
                    aria-label={`Disk ${formatPct(diskPct)} used`}
                  >
                    <WtGauge
                      value={diskPct}
                      max={100}
                      label="Used"
                      suffix="%"
                      centerValue={Number(diskPct.toFixed(0))}
                      size={168}
                    />
                  </div>
                  {filling && Number.isFinite(daysUntilFull) && daysUntilFull > 0 ? (
                    <p className="in-storage-disk-gauge__meta">
                      ~{daysUntilFull.toFixed(1)} days to full at current growth
                    </p>
                  ) : null}
                  {showBackupsCard ? (
                    <Button
                      kind="default"
                      onClick={() => navigate({ tab: 'backups', view: null, panel: null })}
                    >
                      Open Backups
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </FadeIn>
      )}

      {treemapTree ? (
        <FadeIn>
          <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 in-storage-plate in-storage-treemap-card p-5">
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <GlareIcon icon={HardDrive} tone="accent" size={14} className="h-6 w-6 rounded-md" />
                <h3 className="text-sm font-semibold">Space map</h3>
              </div>
              <p className="mt-0.5 text-xs text-wt-text-low">
                WinDirStat-style view of the same breakdown as the meters and tables — click a tile
                to zoom.
              </p>
            </div>
            <StorageTreemap tree={treemapTree} />
          </div>
        </FadeIn>
      ) : null}

      <FadeIn>
        <StorageShareCard
          title="World by dimension"
          subtitle={
            dimsSorted.length
              ? `${dimsSorted.length} dimension${dimsSorted.length === 1 ? '' : 's'} scanned`
              : 'Appears once live samples or a report scan the world folders.'
          }
          icon={HardDrive}
          rows={dimsSorted}
          nameHeader="Dimension"
          emptyTitle="No dimension sizes yet"
          emptyBody="Live sampling or a world scan will list Overworld, Nether, End, and modded dims here."
        />
      </FadeIn>

      {(logsRows.length > 0 || otherRows.length > 0) && (
        <FadeIn>
          <div
            className={`in-storage-split${logsRows.length && otherRows.length ? '' : ' in-storage-split--single'}`}
          >
            {logsRows.length ? (
              <StorageShareCard
                title="Logs"
                subtitle={`${logsRows.length} group${logsRows.length === 1 ? '' : 's'} in the logs folder`}
                icon={FileText}
                iconTone="warn"
                rows={logsRows}
                nameHeader="File"
                emptyTitle="No log sizes yet"
                emptyBody="A report scan will break down latest.log, archives, and other log files."
              />
            ) : null}
            {otherRows.length ? (
              <StorageShareCard
                title="Other"
                subtitle={`${otherRows.length} folder${otherRows.length === 1 ? '' : 's'} outside world, mods, and logs`}
                icon={FolderOpen}
                iconTone="accent"
                rows={otherRows}
                nameHeader="Folder"
                emptyTitle="No other folders sized yet"
                emptyBody="Top-level folders such as config, libraries, and crash-reports will appear after a scan."
              />
            ) : null}
          </div>
        </FadeIn>
      )}

      {Number.isFinite(modsGb) ? (
        <FadeIn>
          <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 in-storage-plate in-storage-mods-link p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <GlareIcon icon={Boxes} tone="info" size={14} className="h-6 w-6 rounded-md" />
                  <h3 className="text-sm font-semibold">Mods</h3>
                  <StatusPill tone="info">{formatGb(modsGb)}</StatusPill>
                </div>
                <p className="mt-0.5 text-xs text-wt-text-low">
                  Click Mods on the space map for jar sizes — inventory and updates live on the Mods
                  page.
                </p>
              </div>
              <Button kind="default" onClick={() => navigate({ tab: 'mods', view: 'overview', panel: null })}>
                Open Mods
              </Button>
            </div>
          </div>
        </FadeIn>
      ) : null}
    </PanelShell>
  );
}
