import type { ComponentType } from 'react';
import { Button, EmptyState, HeroCard, Section, StatusPill, useCappedList } from '@/ui/patterns';
import { PieChart } from '@/ui/charts';
import { WtGauge } from '@/ui/charts/wt-gauges';
import { Activity, AlertTriangle, ArrowUpRight, HardDrive, Map, Network, Package, Users, Zap } from '@/ui/icons';
import { navigate } from '@/app/router';
import { entityTypeLabel, worldDimensionLabel } from '@/features/spark/model';
import { asArray, asRecord, num, str } from '@/lib/utils';
import { PanelShell, severityTone } from '../shared';

type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';
type WindowKey = '7d' | '30d';

type CompareSlice = {
  quiet: number;
  busy: number;
  peak: number;
  ready: boolean;
};

/** UI-only keep-loaded flag: (vanilla + mod) ≥ 8 and ≥ 5% of loaded. Spawn excluded. */
const FORCED_FLAG_MIN = 8;
const FORCED_FLAG_SHARE = 0.05;

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString();
}

function forceKeptSharePct(vanilla: number, mod: number, loaded: number): number {
  if (!(loaded > 0)) return 0;
  return ((vanilla + mod) / loaded) * 100;
}

function isForceKeptFlagged(vanilla: number, mod: number, loaded: number): boolean {
  const kept = vanilla + mod;
  return kept >= FORCED_FLAG_MIN && loaded > 0 && kept / loaded >= FORCED_FLAG_SHARE;
}

function dimPressureScore(d: Record<string, unknown>): number {
  const entities = num(d.entities);
  const baseline = asRecord(d.baseline);
  const entitiesP95 = num(baseline.entities_p95);
  if (entitiesP95 > 0) return entities / entitiesP95;
  return entities;
}

function dimLabel(d: Record<string, unknown>): string {
  const label = str(d.label);
  if (label) return label;
  return worldDimensionLabel(str(d.id, 'unknown'));
}

/** Pie segments for a dimension's entity mix — prefers named top types, falls back to the item/living/other split. */
function dimPieSegments(
  d: Record<string, unknown>,
): Array<{ label: string; value: number; color?: string }> {
  const entities = num(d.entities);
  if (entities <= 0) return [];
  const topTypes = asArray<Record<string, unknown>>(d.top_types)
    .map((t) => ({ label: entityTypeLabel(str(t.type)), value: num(t.count) }))
    .filter((t) => t.value > 0)
    .sort((a, b) => b.value - a.value);

  if (topTypes.length) {
    const shown = topTypes.slice(0, 5);
    const shownSum = shown.reduce((s, t) => s + t.value, 0);
    const other = Math.max(0, entities - shownSum);
    const segments: Array<{ label: string; value: number; color?: string }> = [...shown];
    if (other > 0) segments.push({ label: 'Other', value: other, color: 'var(--wt-text-low)' });
    return segments;
  }

  const items = num(d.items);
  const living = num(d.living);
  const other = Math.max(0, entities - items - living);
  const segments: Array<{ label: string; value: number; color?: string }> = [];
  if (items > 0) segments.push({ label: 'Items', value: items, color: 'var(--wt-warn)' });
  if (living > 0) segments.push({ label: 'Living', value: living, color: 'var(--wt-accent)' });
  if (other > 0) segments.push({ label: 'Other', value: other, color: 'var(--wt-text-low)' });
  return segments;
}

function classifierIcon(kind: string): ComponentType<{ size?: number; className?: string }> {
  if (kind === 'item_storm') return Package;
  if (kind === 'mob_spike') return Users;
  if (kind === 'pregen_outrunning_disk' || kind === 'chunk_save_backlog') return HardDrive;
  if (kind === 'heavy_chunk_generation') return Zap;
  return AlertTriangle;
}

function isChunkWriteKind(kind: string): boolean {
  return (
    kind === 'pregen_outrunning_disk' ||
    kind === 'chunk_save_backlog' ||
    kind === 'heavy_chunk_generation'
  );
}

function statusCopy(classifiers: number, learning: boolean): { tone: Tone; headline: string } {
  if (learning && classifiers === 0) {
    return { tone: 'info', headline: 'Still learning your quiet hours' };
  }
  if (classifiers === 0) {
    return { tone: 'ok', headline: 'All dimensions look normal' };
  }
  if (classifiers === 1) {
    return { tone: 'warn', headline: '1 dimension needs a look' };
  }
  return { tone: 'warn', headline: `${classifiers} dimensions need a look` };
}

function readCompare(dash: Record<string, unknown> | undefined): CompareSlice {
  const cmp = asRecord(dash?.world_pressure_compare);
  const quiet = asRecord(cmp.quiet);
  const busy = asRecord(cmp.busy);
  const peak = asRecord(cmp.peak);
  const quietVal = num(quiet.entities_p95);
  const busyVal = num(busy.entities_p95);
  const peakVal = num(peak.entities_max);
  const samples = num(quiet.sample_minutes) || num(busy.sample_minutes);
  const ready = samples > 0 || peakVal > 0;
  return { quiet: quietVal, busy: busyVal, peak: peakVal, ready };
}

/** Now vs quiet-hours p95 vs busy-hours p95 vs window peak. */
function CompareBars({
  label,
  now,
  quiet,
  busy,
  peak,
  windowKey,
  ready,
  tone = 'warn',
  note,
}: {
  label: string;
  now: number;
  quiet: number;
  busy: number;
  peak: number;
  windowKey: WindowKey;
  ready: boolean;
  tone?: Tone;
  note?: string;
}) {
  if (!ready) {
    return (
      <p className="in-world-compare__empty">
        Need more rollup minutes with entity counts before baseline comparisons appear.
      </p>
    );
  }
  if (!(now > 0) && !(quiet > 0) && !(busy > 0) && !(peak > 0)) return null;
  const max = Math.max(now, quiet, busy, peak, 1);
  const nowTone: Tone = busy > 0 && now > busy ? tone : tone === 'warn' || tone === 'danger' ? tone : 'info';

  return (
    <div className="in-world-compare">
      {note ? <p className="in-world-compare__note">{note}</p> : null}
      <div className="in-world-compare__row">
        <div className="in-world-compare__meta">
          <span>{label} now</span>
          <code>{fmtInt(now)}</code>
        </div>
        <div className="in-world-compare__track">
          <span
            className={`in-world-compare__fill in-world-compare__fill--${nowTone}`}
            style={{ width: `${Math.max(3, (now / max) * 100)}%` }}
          />
        </div>
      </div>
      {quiet > 0 ? (
        <div className="in-world-compare__row">
          <div className="in-world-compare__meta">
            <span>Quiet hours (p95)</span>
            <code>{fmtInt(quiet)}</code>
          </div>
          <div className="in-world-compare__track">
            <span
              className="in-world-compare__fill in-world-compare__fill--ok"
              style={{ width: `${Math.max(3, (quiet / max) * 100)}%` }}
            />
          </div>
        </div>
      ) : null}
      {busy > 0 ? (
        <div className="in-world-compare__row">
          <div className="in-world-compare__meta">
            <span>Busy hours (p95)</span>
            <code>{fmtInt(busy)}</code>
          </div>
          <div className="in-world-compare__track">
            <span
              className="in-world-compare__fill in-world-compare__fill--info"
              style={{ width: `${Math.max(3, (busy / max) * 100)}%` }}
            />
          </div>
        </div>
      ) : null}
      {peak > 0 ? (
        <div className="in-world-compare__row">
          <div className="in-world-compare__meta">
            <span>{windowKey} peak</span>
            <code>{fmtInt(peak)}</code>
          </div>
          <div className="in-world-compare__track">
            <span
              className="in-world-compare__fill in-world-compare__fill--neutral"
              style={{ width: `${Math.max(3, (peak / max) * 100)}%` }}
            />
          </div>
        </div>
      ) : null}
      <p className="in-world-compare__caption">
        Quiet / Busy = p95 during Schedule&apos;s typically quiet / busy hours · Peak = highest minute in last{' '}
        {windowKey}
      </p>
    </div>
  );
}

function ChunkLoadBar({
  loaded,
  spawn,
  vanilla,
  mod,
}: {
  loaded: number;
  spawn: number;
  vanilla: number;
  mod: number;
}) {
  if (!(loaded > 0)) return null;
  const rawSum = spawn + vanilla + mod;
  // Overlap / estimate can exceed loaded — normalize segment widths to fit the track.
  const scale = rawSum > loaded && rawSum > 0 ? loaded / rawSum : 1;
  const sW = (spawn * scale) / loaded;
  const vW = (vanilla * scale) / loaded;
  const mW = (mod * scale) / loaded;
  const flagged = isForceKeptFlagged(vanilla, mod, loaded);
  const keptPct = forceKeptSharePct(vanilla, mod, loaded);

  return (
    <div className="in-world-forced">
      <div className="in-world-forced__meta">
        <span>
          Loaded {fmtInt(loaded)} · Spawn {fmtInt(spawn)} · /forceload {fmtInt(vanilla)} · Mod loaders{' '}
          {fmtInt(mod)}
        </span>
        {flagged ? (
          <span className="in-world-forced__kept-pill">{keptPct.toFixed(keptPct >= 10 ? 0 : 1)}% force-kept</span>
        ) : null}
      </div>
      <div className="in-world-forced__track in-world-forced__track--stack" aria-hidden>
        {spawn > 0 ? (
          <span className="in-world-forced__seg in-world-forced__seg--spawn" style={{ width: `${sW * 100}%` }} />
        ) : null}
        {vanilla > 0 ? (
          <span className="in-world-forced__seg in-world-forced__seg--vanilla" style={{ width: `${vW * 100}%` }} />
        ) : null}
        {mod > 0 ? (
          <span
            className={`in-world-forced__seg in-world-forced__seg--mod${flagged ? ' is-flagged' : ''}`}
            style={{ width: `${mW * 100}%` }}
          />
        ) : null}
      </div>
      <div className="in-world-forced__legend" aria-hidden>
        <span className="in-world-forced__legend-item">
          <i className="in-world-forced__dot in-world-forced__dot--spawn" /> Spawn
        </span>
        <span className="in-world-forced__legend-item">
          <i className="in-world-forced__dot in-world-forced__dot--vanilla" /> /forceload
        </span>
        <span className="in-world-forced__legend-item">
          <i className={`in-world-forced__dot in-world-forced__dot--mod${flagged ? ' is-flagged' : ''}`} /> Mod loaders
        </span>
      </div>
      <p className="in-world-forced__caption">
        Spawn is estimated from spawnChunkRadius. Mod loaders = NeoForge force-load tickets (not every custom
        ticket).
        {rawSum > loaded ? ' Counts can overlap, so the bar is scaled to loaded.' : null}
      </p>
    </div>
  );
}

function ChunkWriteEvidence({
  kind,
  evidence,
  meters,
}: {
  kind: string;
  evidence: Record<string, unknown>;
  meters: Record<string, unknown>;
}) {
  const writeAwait = num(evidence.write_await_ms, num(meters.write_await_ms, NaN));
  const writeWarn = num(evidence.write_warn_ms, num(meters.write_warn_ms, 50));
  const writeMbS = num(evidence.write_mb_s, num(meters.write_mb_s, NaN));
  const pregenActive = evidence.pregen_active != null ? Boolean(evidence.pregen_active) : Boolean(meters.pregen_active);
  const pregenLabel = str(evidence.pregen_label, str(meters.pregen_label, 'Pregen'));
  const pregenRate = str(evidence.pregen_rate, str(meters.pregen_rate));
  const growth = num(evidence.chunk_growth, NaN);
  const loaded = num(evidence.loaded_chunks, NaN);
  const players = num(evidence.players, NaN);
  const growthHot = num(evidence.growth_hot_chunks, num(meters.growth_hot_chunks, 48));

  const showLatency = kind === 'pregen_outrunning_disk' || kind === 'chunk_save_backlog';
  const showGrowth = kind === 'heavy_chunk_generation';
  const criticalMs = writeWarn > 0 ? writeWarn * 3 : 150;
  const pressurePct = Number.isFinite(writeAwait) && criticalMs > 0
    ? Math.min(100, (writeAwait / criticalMs) * 100)
    : 0;
  const pressureTone: Tone =
    Number.isFinite(writeAwait) && writeAwait >= criticalMs
      ? 'danger'
      : Number.isFinite(writeAwait) && writeAwait >= writeWarn
        ? 'warn'
        : 'ok';
  const ratio =
    Number.isFinite(writeAwait) && writeWarn > 0 ? writeAwait / writeWarn : NaN;
  const growthPct =
    Number.isFinite(growth) && growthHot > 0 ? Math.min(100, (growth / (growthHot * 2)) * 100) : 0;

  const rows: { label: string; value: string }[] = [];
  if (showLatency) {
    rows.push({
      label: 'Write latency',
      value: Number.isFinite(writeAwait)
        ? `${Math.round(writeAwait)}ms (warn ${Math.round(writeWarn)}ms)`
        : '—',
    });
    if (Number.isFinite(writeMbS) && writeMbS > 0) {
      rows.push({ label: 'Write throughput', value: `${writeMbS.toFixed(1)} MB/s` });
    }
  }
  if (kind === 'pregen_outrunning_disk') {
    rows.push({
      label: 'Pregen',
      value: pregenActive
        ? `Active (${pregenLabel})${pregenRate ? ` · ${pregenRate}` : ''}`
        : 'Idle',
    });
  }
  if (showGrowth) {
    rows.push({
      label: 'Chunk growth',
      value: Number.isFinite(growth) ? `+${fmtInt(growth)} since last scan` : '—',
    });
    if (Number.isFinite(loaded)) {
      rows.push({ label: 'Loaded chunks', value: fmtInt(loaded) });
    }
    if (Number.isFinite(players)) {
      rows.push({ label: 'Players online', value: fmtInt(players) });
    }
  }

  return (
    <div className="in-world-compare">
      {showLatency && Number.isFinite(writeAwait) ? (
        <div className="in-world-pressure">
          <div className="in-world-pressure__top">
            <span className="in-world-pressure__label">Disk write pressure</span>
            <code className={`in-world-pressure__ratio in-world-pressure__ratio--${pressureTone}`}>
              {Number.isFinite(ratio) ? `${ratio.toFixed(1)}× warn` : '—'}
            </code>
          </div>
          <div className="in-world-pressure__track" aria-hidden>
            <span
              className={`in-world-pressure__fill in-world-pressure__fill--${pressureTone}`}
              style={{ width: `${Math.max(4, pressurePct)}%` }}
            />
            <span
              className="in-world-pressure__mark"
              style={{ left: `${Math.min(96, (writeWarn / criticalMs) * 100)}%` }}
              title={`Warn ${Math.round(writeWarn)}ms`}
            />
          </div>
          <p className="in-world-pressure__caption">
            Latency vs warn (mark) and critical (~3× warn). WatchTower cannot read JVM save-queue depth — this is
            the disk-pressure signal.
          </p>
        </div>
      ) : null}
      {showGrowth && Number.isFinite(growth) ? (
        <div className="in-world-pressure">
          <div className="in-world-pressure__top">
            <span className="in-world-pressure__label">Chunk growth pressure</span>
            <code>{`+${fmtInt(growth)} / hot ≥${fmtInt(growthHot)}`}</code>
          </div>
          <div className="in-world-pressure__track" aria-hidden>
            <span
              className={`in-world-pressure__fill in-world-pressure__fill--${growth >= growthHot ? 'warn' : 'ok'}`}
              style={{ width: `${Math.max(4, growthPct)}%` }}
            />
            <span
              className="in-world-pressure__mark"
              style={{ left: `${Math.min(96, (growthHot / (growthHot * 2)) * 100)}%` }}
              title={`Hot threshold +${fmtInt(growthHot)}`}
            />
          </div>
        </div>
      ) : null}
      {rows.map((row) => (
        <div key={row.label} className="in-world-compare__row">
          <div className="in-world-compare__meta">
            <span>{row.label}</span>
            <code>{row.value}</code>
          </div>
        </div>
      ))}
      <p className="in-world-compare__caption">
        Write / pregen pressure — not an entity-load comparison. Open Issues for the fix steps.
      </p>
    </div>
  );
}

function AlertCard({
  c,
  compare,
  windowKey,
  meters,
}: {
  c: Record<string, unknown>;
  compare: CompareSlice;
  windowKey: WindowKey;
  meters: Record<string, unknown>;
}) {
  const kind = str(c.kind);
  const sev = str(c.severity, 'warning');
  const tone = severityTone[sev] ?? 'warn';
  const Icon = classifierIcon(kind);
  const evidence = asRecord(c.evidence);
  const chunkWrite = isChunkWriteKind(kind);
  const nowVal = num(evidence.entities);
  const items = num(evidence.items);
  const itemShareNote =
    kind === 'item_storm' && items > 0 && nowVal > 0
      ? `${fmtInt(items)} dropped items are included in the ${fmtInt(nowVal)} total entities below — bars compare total load vs quiet/busy/peak.`
      : undefined;

  return (
    <div className="in-world-card in-world-card--alert">
      <div className="in-world-card__head">
        <span className={`in-world-card__icon in-world-card__icon--${tone}`} aria-hidden>
          <Icon size={16} />
        </span>
        <div className="in-world-card__head-main">
          <div className="in-world-card__title">{str(c.headline)}</div>
          <p className="in-world-card__detail">{str(c.detail)}</p>
        </div>
        <StatusPill tone={tone} className="in-world-card__pill">
          {sev}
        </StatusPill>
      </div>
      {chunkWrite ? (
        <ChunkWriteEvidence kind={kind} evidence={evidence} meters={meters} />
      ) : (
        <CompareBars
          label="Total entities"
          now={nowVal}
          quiet={compare.quiet}
          busy={compare.busy}
          peak={compare.peak}
          windowKey={windowKey}
          ready={compare.ready}
          tone={tone === 'neutral' ? 'warn' : tone}
          note={itemShareNote}
        />
      )}
      <div className="in-world-card__foot">
        <Button type="button" size="sm" onClick={() => navigate({ tab: 'issues' })}>
          Open Issues for fix steps
        </Button>
        {!chunkWrite ? (
          <button
            type="button"
            className="in-world-card__link"
            onClick={() => navigate({ tab: 'spark', view: 'world' })}
          >
            Spark World
            <ArrowUpRight size={13} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DimCard({
  d,
  compare,
  windowKey,
}: {
  d: Record<string, unknown>;
  compare: CompareSlice;
  windowKey: WindowKey;
}) {
  const entities = num(d.entities);
  const loaded = num(d.loaded_chunks);
  const vanilla = num(d.forced_chunks);
  const spawn = num(d.spawn_chunks);
  const mod = num(d.mod_forced_chunks);
  const players = num(d.players);
  const baseline = asRecord(d.baseline);
  const entitiesP95 = num(baseline.entities_p95);
  const entityRatio = entitiesP95 > 0 ? entities / entitiesP95 : 0;
  const forceFlagged = isForceKeptFlagged(vanilla, mod, loaded);
  const pressureFlagged = entityRatio >= 1.5;
  const tone: Tone = forceFlagged || pressureFlagged ? 'warn' : 'neutral';
  const label = dimLabel(d);
  const segments = dimPieSegments(d);
  const keptPct = forceKeptSharePct(vanilla, mod, loaded);

  return (
    <div className={`in-world-card in-world-card--dim${forceFlagged ? ' in-world-card--forced-flag' : ''}`}>
      <div className="in-world-card__head">
        <span className={`in-world-card__icon in-world-card__icon--${tone}`} aria-hidden>
          <Map size={16} />
        </span>
        <div className="in-world-card__head-main">
          <div className="in-world-card__title">Dimension · {label}</div>
          <div className="in-world-card__badges">
            {players === 0 ? <StatusPill tone="warn">0 players</StatusPill> : null}
            {forceFlagged ? (
              <StatusPill tone="warn">
                {keptPct.toFixed(keptPct >= 10 ? 0 : 1)}% kept by /forceload + mod loaders
              </StatusPill>
            ) : null}
          </div>
        </div>
      </div>
      <div className="in-world-card__stats">
        <div className="in-world-card__stat">
          <span className="in-world-card__stat-label">Entities</span>
          <span className="in-world-card__stat-value">{fmtInt(entities)}</span>
        </div>
        <div className="in-world-card__stat">
          <span className="in-world-card__stat-label">Loaded chunks</span>
          <span className="in-world-card__stat-value">{fmtInt(loaded)}</span>
        </div>
      </div>
      <ChunkLoadBar loaded={loaded} spawn={spawn} vanilla={vanilla} mod={mod} />
      <CompareBars
        label="Entities"
        now={entities}
        quiet={compare.quiet}
        busy={compare.busy}
        peak={compare.peak}
        windowKey={windowKey}
        ready={compare.ready}
        tone={pressureFlagged ? 'warn' : 'info'}
      />
      <div className="in-world-card__mix">
        <div className="in-world-card__mix-pie">
          {segments.length ? (
            <PieChart segments={segments} size={96} dense />
          ) : (
            <p className="in-world-dim-detail__empty">No entity breakdown yet.</p>
          )}
        </div>
        <div className="in-world-card__mix-gauge" aria-label={`${fmtInt(players)} players`}>
          <WtGauge
            value={players}
            max={Math.max(players, 8)}
            label="Players"
            suffix=""
            centerValue={players}
            tone={players === 0 ? 'warn' : 'accent'}
            size={152}
          />
        </div>
      </div>
    </div>
  );
}

export function WorldPanel({
  ops,
  dash,
  windowKey = '7d',
}: {
  ops: Record<string, unknown>;
  dash?: Record<string, unknown>;
  windowKey?: WindowKey;
}) {
  const wp = asRecord(ops.world_pressure);
  const dims = asArray<Record<string, unknown>>(wp.dimensions);
  const classifiers = asArray<Record<string, unknown>>(wp.classifiers).filter(
    (c) => str(c.kind) !== 'unattended_chunk_pressure',
  );
  const learning = Boolean(wp.learning);
  const correlated = Boolean(wp.correlated_with_mspt);
  const hasBlock = Object.keys(wp).length > 0;
  const meters = asRecord(wp.meters);
  const writeAwait = num(meters.write_await_ms, NaN);
  const writeWarn = num(meters.write_warn_ms, 50);
  const hasWriteAwait = Number.isFinite(writeAwait);
  const writeHot = hasWriteAwait && writeAwait >= writeWarn;
  const pregenActive = Boolean(meters.pregen_active);
  const pregenLabel = str(meters.pregen_label, 'Pregen');
  const pregenRate = str(meters.pregen_rate);
  const growthLabel = str(meters.chunk_growth_label, 'Steady');
  const hasMeters = Object.keys(meters).length > 0;
  const entitiesCompare = readCompare(dash);
  const compareReady = entitiesCompare.ready;

  const sortedDims = [...dims].sort((a, b) => dimPressureScore(b) - dimPressureScore(a));
  const dimList = useCappedList(sortedDims, 4);

  if (!hasBlock) {
    return (
      <PanelShell>
        <EmptyState title="World pressure not available yet">
          Enable WORLD_PRESSURE_ENABLED in watchtower.conf, then wait about a minute for the per-dimension census.
        </EmptyState>
      </PanelShell>
    );
  }

  const totalEntities = dims.reduce((s, d) => s + num(d.entities), 0);
  const totalChunks = dims.reduce((s, d) => s + num(d.loaded_chunks), 0);
  const totalForceKept = dims.reduce(
    (s, d) => s + num(d.forced_chunks) + num(d.mod_forced_chunks),
    0,
  );
  const status = statusCopy(classifiers.length, learning);
  const alertHint = `Bars: live now vs quiet-hours p95 vs busy-hours p95 vs peak minute in the selected ${windowKey} window.`;
  const dimHint =
    'Per dimension: spawn / /forceload / mod loader share of loaded chunks, entity pressure vs quiet/busy/peak, entity mix, and player count.';

  return (
    <PanelShell>
      <HeroCard
        tone={status.tone === 'neutral' ? 'info' : status.tone}
        className={`in-world-glow in-world-glow--${status.tone} rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg2/40 p-5`}
        borderRadius={4}
        glowIntensity={0.55}
      >
        <div className="in-world-hero">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wt-text-low">
            World pressure
          </div>
          <p className={`in-world-status in-world-status--${status.tone}`}>{status.headline}</p>
          <p className="in-world-caption">
            Entities and chunks loaded right now, per dimension — compared with quiet hours, busy hours, and the peak
            minute in this Insights window.
          </p>
          {compareReady ? (
            <p className="in-world-provenance">
              Comparisons use the Insights window ({windowKey}) — same busy hours as Schedule.
            </p>
          ) : null}
          <div className="in-world-metrics">
            <div className="in-world-metric">
              <span className="in-world-metric__label">
                <Activity size={12} aria-hidden /> Entities
              </span>
              <span className="in-world-metric__value">{fmtInt(totalEntities)}</span>
            </div>
            <div className="in-world-metric">
              <span className="in-world-metric__label">
                <Network size={12} aria-hidden /> Loaded chunks
              </span>
              <span className="in-world-metric__value">{fmtInt(totalChunks)}</span>
            </div>
            {totalForceKept > 0 ? (
              <div className="in-world-metric">
                <span className="in-world-metric__label">
                  <Map size={12} aria-hidden /> Force-kept
                </span>
                <span className="in-world-metric__value">{fmtInt(totalForceKept)}</span>
              </div>
            ) : null}
            <div className={`in-world-metric in-world-metric--${correlated ? 'warn' : 'ok'}`}>
              <span className="in-world-metric__label">
                <AlertTriangle size={12} aria-hidden /> Tick impact
              </span>
              <span className="in-world-metric__value">
                {correlated ? 'Entities slow ticks' : 'No measurable impact'}
              </span>
            </div>
            {hasMeters ? (
              <>
                <div className={`in-world-metric in-world-metric--${writeHot ? 'warn' : 'ok'}`}>
                  <span className="in-world-metric__label">
                    <HardDrive size={12} aria-hidden /> Write latency
                  </span>
                  <span className="in-world-metric__value">
                    {hasWriteAwait ? `${Math.round(writeAwait)}ms` : '—'}
                  </span>
                </div>
                <div className={`in-world-metric in-world-metric--${pregenActive ? 'warn' : 'ok'}`}>
                  <span className="in-world-metric__label">
                    <Zap size={12} aria-hidden /> Pregen
                  </span>
                  <span className="in-world-metric__value">
                    {pregenActive
                      ? `Active (${pregenLabel})${pregenRate ? ` ${pregenRate}` : ''}`
                      : 'Idle'}
                  </span>
                </div>
                <div className="in-world-metric">
                  <span className="in-world-metric__label">
                    <Map size={12} aria-hidden /> Chunk growth
                  </span>
                  <span className="in-world-metric__value">{growthLabel}</span>
                </div>
              </>
            ) : null}
          </div>
          {learning ? (
            <div className="in-world-learn">
              Still learning quiet hours — absolute storms still raise Issues; baseline comparisons wait for
              more rollup minutes.
            </div>
          ) : null}
        </div>
      </HeroCard>

      {classifiers.length ? (
        <Section title="Needs attention" hint={alertHint}>
          <div className="in-world-grid">
            {classifiers.map((c, i) => (
              <AlertCard
                key={`${str(c.kind)}-${str(c.dimension)}-${i}`}
                c={c}
                compare={entitiesCompare}
                windowKey={windowKey}
                meters={meters}
              />
            ))}
          </div>
        </Section>
      ) : (
        <EmptyState title="No sustained pressure right now">
          Item storms, mob spikes, and save/pregen disk pressure show up here after they hold for a few scans.
        </EmptyState>
      )}

      {dims.length ? (
        <Section title="By dimension" hint={dimHint}>
          <div className="in-world-grid">
            {dimList.shown.map((d) => (
              <DimCard key={str(d.id)} d={d} compare={entitiesCompare} windowKey={windowKey} />
            ))}
          </div>
          {dimList.more > 0 ? (
            <Button type="button" size="sm" kind="ghost" onClick={dimList.expand}>
              +{dimList.more} more
            </Button>
          ) : null}
          {dimList.expanded && dimList.total > 4 ? (
            <Button type="button" size="sm" kind="ghost" onClick={dimList.collapse}>
              Show less
            </Button>
          ) : null}
        </Section>
      ) : null}
    </PanelShell>
  );
}
