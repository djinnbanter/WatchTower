import { type ComponentType } from 'react';
import BorderGlow from '@/components/border-glow/BorderGlow';
import { navigate } from '@/app/router';
import { api, resolveDemoAsset } from '@/api/client';
import { isStaticDemo } from '@/app/runtime';
import { ChartFrame, WtBarChart } from '@/ui/charts';
import { FadeIn, HeroWatermark, Stagger } from '@/ui/motion';
import { Button, EmptyState, QueueRow, Section } from '@/ui/patterns';
import {
  Activity,
  Clock,
  Download,
  Gauge as GaugeIcon,
  TrendingDown,
  Users,
} from '@/ui/icons';
import { asArray, num, str } from '@/lib/utils';
import { formatGb, formatMs, formatTps } from '@/domain/formats';
import { PanelShell } from '../shared';

type KpiTone = 'accent' | 'ok' | 'warn' | 'danger' | 'info';
type KpiIcon = ComponentType<{ size?: number; className?: string }>;

type BandKpi = {
  id: string;
  /** Short question-style label. */
  label: string;
  /** Big answer — usually a player range like "5–7 online". */
  headline: string;
  /** One plain sentence of why it matters. */
  hint: string;
  icon: KpiIcon;
  tone: KpiTone;
};

function cell(v: unknown, fallback = '—') {
  if (v == null || v === '') return fallback;
  return String(v);
}

function bandHeadline(band: string) {
  const b = band.trim();
  if (!b || b === '0') return '0 online';
  if (/online/i.test(b) || /player/i.test(b)) return b;
  return `${b} online`;
}

function kpiToneClass(tone: KpiTone) {
  if (tone === 'ok') return 'in-kpi-card--ok';
  if (tone === 'warn') return 'in-kpi-card--warn';
  if (tone === 'danger') return 'in-kpi-card--danger';
  if (tone === 'info') return 'in-kpi-card--info';
  return 'in-kpi-card--accent';
}

function kpiBorderGlowProps(tone: KpiTone) {
  if (tone === 'danger') {
    return {
      glowColor: '0 84 60',
      glowIntensity: 1.2,
      colors: ['#f87171', '#fb7185', '#fbbf24'] as string[],
      fillOpacity: 0.48,
    };
  }
  if (tone === 'warn') {
    return {
      glowColor: '38 92 55',
      glowIntensity: 1.15,
      colors: ['#fbbf24', '#fb923c', '#f472b6'] as string[],
      fillOpacity: 0.44,
    };
  }
  if (tone === 'ok') {
    return {
      glowColor: '160 72 42',
      glowIntensity: 1.1,
      colors: ['#34d399', '#22d3ee', '#60a5fa'] as string[],
      fillOpacity: 0.4,
    };
  }
  if (tone === 'info') {
    return {
      glowColor: '210 78 48',
      glowIntensity: 1.1,
      colors: ['#60a5fa', '#38bdf8', '#818cf8'] as string[],
      fillOpacity: 0.4,
    };
  }
  return {
    glowColor: '265 70 48',
    glowIntensity: 1.1,
    colors: ['#a78bfa', '#818cf8', '#38bdf8'] as string[],
    fillOpacity: 0.4,
  };
}

function msptTone(v: number): KpiTone {
  if (v < 40) return 'ok';
  if (v < 50) return 'warn';
  return 'danger';
}

function tpsTone(v: number): KpiTone {
  if (v >= 19.5) return 'ok';
  if (v >= 18) return 'warn';
  return 'danger';
}

function BandKpiCard({ spec }: { spec: BandKpi }) {
  return (
    <BorderGlow
      className={`in-kpi-glow ${kpiToneClass(spec.tone)}`}
      backgroundColor="var(--wt-bg1)"
      borderRadius={4}
      edgeSensitivity={20}
      glowRadius={40}
      coneSpread={28}
      animated
      {...kpiBorderGlowProps(spec.tone)}
    >
      <div className="in-kpi-card">
        <HeroWatermark icon={spec.icon} tone={spec.tone} size="card" />
        <div className="in-kpi-card__top">
          <span className="in-kpi-card__label">{spec.label}</span>
        </div>
        <div className="in-kpi-card__value">
          <div className="in-kpi-card__flow in-kpi-card__headline">{spec.headline}</div>
        </div>
        <div className="in-kpi-card__hint">{spec.hint}</div>
      </div>
    </BorderGlow>
  );
}

function buildBandKpis(bins: Record<string, unknown>[]): BandKpi[] {
  if (!bins.length) return [];

  const peak = bins.reduce((best, b) => (num(b.mspt_avg) > num(best.mspt_avg) ? b : best), bins[0]!);
  const mostTime = bins.reduce((best, b) => (num(b.minutes) > num(best.minutes) ? b : best), bins[0]!);
  const weakest = bins.reduce((best, b) => (num(b.tps_avg) < num(best.tps_avg) ? b : best), bins[0]!);
  const totalMinutes = bins.reduce((s, b) => s + num(b.minutes), 0) || 1;
  const share = (num(mostTime.minutes) / totalMinutes) * 100;
  const peakMspt = num(peak.mspt_avg);
  const weakTps = num(weakest.tps_avg);

  return [
    {
      id: 'peak-mspt',
      label: 'Lag is worst with',
      headline: bandHeadline(str(peak.players_band)),
      icon: GaugeIcon,
      tone: msptTone(peakMspt),
      hint: `Avg tick time ${formatMs(peakMspt)} — highest of any player count.`,
    },
    {
      id: 'most-time',
      label: 'Server usually has',
      headline: bandHeadline(str(mostTime.players_band)),
      icon: Clock,
      tone: 'info',
      hint: `${share.toFixed(0)}% of this window (${num(mostTime.minutes)} min) sat in this range.`,
    },
    {
      id: 'weak-tps',
      label: 'Tick rate dips with',
      headline: bandHeadline(str(weakest.players_band)),
      icon: TrendingDown,
      tone: tpsTone(weakTps),
      hint: `Avg ${formatTps(weakTps)} TPS — lowest of any player count.`,
    },
  ];
}

export function PatternsLoad({
  dash,
  windowKey,
}: {
  dash: Record<string, unknown>;
  windowKey: string;
}) {
  const daily = asArray<Record<string, unknown>>(dash.daily_series);
  const bins = asArray<Record<string, unknown>>(dash.player_bins);

  const withPressure = daily.filter(
    (d) => d.heap_pressure_pct_avg != null || d.gc_pause_pct_avg != null,
  );
  let loadTakeaway: { tone: 'warn' | 'danger' | 'info'; title: string; meta: string } | null =
    null;
  if (withPressure.length) {
    const avgHeap =
      withPressure.reduce((s, d) => s + num(d.heap_pressure_pct_avg), 0) / withPressure.length;
    const avgGc =
      withPressure.reduce((s, d) => s + num(d.gc_pause_pct_avg), 0) / withPressure.length;
    if (avgHeap >= 90) {
      loadTakeaway = {
        tone: 'danger',
        title: 'Heap pressure is high across daily rollups',
        meta: `Avg heap pressure ~${avgHeap.toFixed(0)}% — check Configs → RAM sizing.`,
      };
    } else if (avgGc >= 8) {
      loadTakeaway = {
        tone: 'warn',
        title: 'GC pause share is elevated',
        meta: `Avg GC pause ~${avgGc.toFixed(1)}% of wall — review JVM flags on Configs.`,
      };
    } else if (avgHeap >= 75) {
      loadTakeaway = {
        tone: 'info',
        title: 'Heap pressure worth watching',
        meta: `Avg heap pressure ~${avgHeap.toFixed(0)}% — open Configs for sizing advice.`,
      };
    }
  }

  if (!daily.length && !bins.length) {
    return (
      <EmptyState title="No load tables yet">
        Daily breakdown and player-count bins appear once enough rollup history exists.
      </EmptyState>
    );
  }

  const msptRows = bins.map((b) => ({
    name: str(b.players_band, '?'),
    value: num(b.mspt_avg),
  }));
  const tpsRows = bins.map((b) => ({
    name: str(b.players_band, '?'),
    value: num(b.tps_avg),
  }));
  const bandKpis = buildBandKpis(bins);
  const bandScale = num(dash.players_band_scale);
  const showHeapPressure = daily.some((d) => d.heap_pressure_pct_avg != null);
  const showGcPause = daily.some((d) => d.gc_pause_pct_avg != null);

  function exportCsv() {
    void (async () => {
      const path = api.performanceExportCsvUrl(windowKey);
      try {
        const href = isStaticDemo() ? await resolveDemoAsset(path) : path;
        window.open(href, '_blank', 'noopener,noreferrer');
      } catch {
        // Static demo miss — still try the path (no-op without a live API).
        if (!isStaticDemo()) window.open(path, '_blank', 'noopener,noreferrer');
      }
    })();
  }

  return (
    <PanelShell>
      {loadTakeaway ? (
        <FadeIn>
          <QueueRow
            title={loadTakeaway.title}
            detail={loadTakeaway.meta}
            action={
              <Button
                kind="ghost"
                onClick={() => navigate({ tab: 'insights', view: 'configs', panel: null })}
              >
                Open Configs
              </Button>
            }
          />
        </FadeIn>
      ) : null}

      {bandKpis.length ? (
        <FadeIn>
          <Stagger className="in-kpi-grid in-load-kpi-grid" delayMs={45}>
            {bandKpis.map((spec) => (
              <BandKpiCard key={spec.id} spec={spec} />
            ))}
          </Stagger>
        </FadeIn>
      ) : null}

      {bins.length ? (
        <FadeIn>
          <Section
            title="Load by player count"
            icon={Users}
            hint={
              bandScale > 0
                ? `Bands scale to peak concurrent (${bandScale}) in this window — how tick time and TPS change as the server fills up.`
                : 'How tick time and tick rate scale as concurrent players rise.'
            }
          >
            <div className="in-load-scaling">
              <ChartFrame title="MSPT by player band" layer="watching" empty={!msptRows.length}>
                <WtBarChart
                  data={msptRows}
                  dataKey="value"
                  xDataKey="name"
                  color="var(--wt-ch-mspt)"
                />
              </ChartFrame>
              <ChartFrame title="TPS by player band" layer="watching" empty={!tpsRows.length}>
                <WtBarChart
                  data={tpsRows}
                  dataKey="value"
                  xDataKey="name"
                  color="var(--wt-ch-tps)"
                />
              </ChartFrame>
            </div>
          </Section>
        </FadeIn>
      ) : null}

      {daily.length ? (
        <FadeIn>
          <Section
            title="Daily breakdown"
            icon={Activity}
            hint="Day-by-day inspector for this window. Overview owns the trend charts."
            actions={
              <Button kind="default" onClick={exportCsv}>
                <Download size={13} className="mr-1.5" /> Export CSV
              </Button>
            }
          >
            <div className="in-table-scroll">
              <table className="in-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>MSPT avg</th>
                    <th>MSPT p95</th>
                    <th>TPS avg</th>
                    <th>Peak players</th>
                    <th>Heap avg</th>
                    <th>CPU avg</th>
                    {showHeapPressure ? <th>Heap pressure</th> : null}
                    {showGcPause ? <th>GC pause %</th> : null}
                    <th>Low-TPS min</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((d) => (
                    <tr key={str(d.date)}>
                      <td>{str(d.date)}</td>
                      <td>{formatMs(num(d.mspt_avg))}</td>
                      <td>{formatMs(num(d.mspt_p95))}</td>
                      <td>{formatTps(num(d.tps_avg))}</td>
                      <td>{cell(d.players_peak)}</td>
                      <td>{d.heap_avg != null ? formatGb(num(d.heap_avg)) : '—'}</td>
                      <td>
                        {d.cpu_avg != null ? `${num(d.cpu_avg).toFixed(0)}%` : '—'}
                      </td>
                      {showHeapPressure ? (
                        <td>
                          {d.heap_pressure_pct_avg != null
                            ? `${num(d.heap_pressure_pct_avg).toFixed(0)}%`
                            : '—'}
                        </td>
                      ) : null}
                      {showGcPause ? (
                        <td>
                          {d.gc_pause_pct_avg != null
                            ? `${num(d.gc_pause_pct_avg).toFixed(1)}%`
                            : '—'}
                        </td>
                      ) : null}
                      <td>{cell(d.low_tps_minutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </FadeIn>
      ) : null}
    </PanelShell>
  );
}
