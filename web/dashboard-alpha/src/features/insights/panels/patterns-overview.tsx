import { type ComponentType } from 'react';
import BorderGlow from '@/components/border-glow/BorderGlow';
import { ChartStatFlow } from '@/components/charts/chart-stat-flow';
import { navigate } from '@/app/router';
import { ChartFrame, WtAreaChart, dailyToBklitRows } from '@/ui/charts';
import { FadeIn, GlareIcon, Stagger } from '@/ui/motion';
import { Button, EmptyState, QueueRow, Section, StatusPill } from '@/ui/patterns';
import {
  Activity,
  AlertTriangle,
  Clock,
  Gauge as GaugeIcon,
  Layers,
  Radio,
  TrendingUp,
  Users,
  Zap,
} from '@/ui/icons';
import { asArray, asRecord, get, num, str } from '@/lib/utils';
import {
  DeltaBadge,
  PanelShell,
  formatCompareLabel,
  invertDeltaKey,
  severityTone,
} from '../shared';

type KpiTone = 'accent' | 'ok' | 'warn' | 'danger' | 'info';
type KpiIcon = ComponentType<{ size?: number; className?: string }>;

type KpiSpec = {
  id: string;
  label: string;
  value: number;
  icon: KpiIcon;
  tone: KpiTone;
  suffix?: string;
  digits?: number;
  hint?: string;
};

function kpiToneClass(tone: KpiTone) {
  if (tone === 'ok') return 'in-kpi-card--ok';
  if (tone === 'warn') return 'in-kpi-card--warn';
  if (tone === 'danger') return 'in-kpi-card--danger';
  if (tone === 'info') return 'in-kpi-card--info';
  return 'in-kpi-card--accent';
}

/** Live status / dials BorderGlow palette — moderate, readable on hover. */
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

function tpsTone(v: number): KpiTone {
  if (v >= 19.5) return 'ok';
  if (v >= 18) return 'warn';
  return 'danger';
}

function msptTone(v: number): KpiTone {
  if (v < 40) return 'ok';
  if (v < 50) return 'warn';
  return 'danger';
}

function countTone(v: number, warnAt = 1, dangerAt = 10): KpiTone {
  if (v >= dangerAt) return 'danger';
  if (v >= warnAt) return 'warn';
  return 'ok';
}

function KpiCard({ spec }: { spec: KpiSpec }) {
  return (
    <BorderGlow
      className={`in-kpi-glow ${kpiToneClass(spec.tone)}`}
      backgroundColor="var(--wt-bg1)"
      borderRadius={14}
      edgeSensitivity={20}
      glowRadius={40}
      coneSpread={28}
      animated
      {...kpiBorderGlowProps(spec.tone)}
    >
      <div className="in-kpi-card">
        <div className="in-kpi-card__top">
          <GlareIcon icon={spec.icon} tone={spec.tone} size={15} className="h-9 w-9 rounded-xl" />
          <span className="in-kpi-card__label">{spec.label}</span>
        </div>
        <div className="in-kpi-card__value">
          <ChartStatFlow
            value={Number.isFinite(spec.value) ? spec.value : 0}
            label={spec.label}
            labelClassName="sr-only"
            valueClassName="in-kpi-card__flow"
            formatOptions={{
              maximumFractionDigits: spec.digits ?? 0,
              minimumFractionDigits: spec.digits ?? 0,
            }}
            suffix={spec.suffix}
          />
        </div>
        {spec.hint ? <div className="in-kpi-card__hint">{spec.hint}</div> : null}
      </div>
    </BorderGlow>
  );
}

export function PatternsOverview({
  dash,
  windowKey,
}: {
  dash: Record<string, unknown>;
  windowKey: string;
}) {
  const summary = asRecord(dash.summary_extended);
  const daily = asArray<Record<string, unknown>>(dash.daily_series);
  const compare = asRecord(get(dash, 'period_compare', 'deltas'));
  const insights = asArray<Record<string, unknown>>(dash.insights);
  const relatedCount = num(dash.related_event_count, asArray(dash.related_events).length);
  const rows = dailyToBklitRows(daily, ['tps_avg', 'mspt_avg', 'heap_avg', 'cpu_avg']);

  const tpsAvg = num(summary.tps_avg);
  const msptP95 = num(summary.mspt_p95);
  const lowTpsMin = num(summary.low_tps_minutes);
  const sticky = num(summary.sticky_episode_count);
  const outliers = num(summary.outlier_count);

  const kpis: KpiSpec[] = [
    {
      id: 'sample',
      label: 'Sample minutes',
      value: num(summary.sample_minutes),
      icon: Clock,
      tone: 'info',
      hint: 'Coverage in this window',
    },
    {
      id: 'tps',
      label: 'Avg TPS',
      value: tpsAvg,
      icon: Activity,
      tone: tpsTone(tpsAvg),
      digits: 1,
      hint: tpsAvg >= 19.5 ? 'Holding target' : 'Below 20 TPS average',
    },
    {
      id: 'mspt',
      label: 'MSPT p95',
      value: msptP95,
      icon: GaugeIcon,
      tone: msptTone(msptP95),
      digits: 1,
      suffix: ' ms',
      hint: msptP95 < 40 ? 'Tick budget healthy' : 'Elevated tick lag',
    },
    {
      id: 'low-tps',
      label: 'Low-TPS min',
      value: lowTpsMin,
      icon: AlertTriangle,
      tone: countTone(lowTpsMin, 1, 60),
      hint: lowTpsMin === 0 ? 'No low-TPS minutes' : 'Minutes under TPS floor',
    },
    {
      id: 'players',
      label: 'Peak players',
      value: num(summary.players_peak),
      icon: Users,
      tone: 'accent',
      hint: 'Highest concurrent count',
    },
    {
      id: 'sticky',
      label: 'Sticky episodes',
      value: sticky,
      icon: Layers,
      tone: countTone(sticky, 1, 3),
      hint: sticky === 0 ? 'No sticky lag runs' : 'Sustained lag clusters',
    },
    {
      id: 'outlier',
      label: 'Outlier minutes',
      value: outliers,
      icon: Zap,
      tone: countTone(outliers, 1, 5),
      hint: outliers === 0 ? 'No outliers flagged' : 'Spike minutes flagged',
    },
    {
      id: 'events',
      label: 'Related events',
      value: relatedCount,
      icon: Radio,
      tone: relatedCount > 0 ? 'info' : 'ok',
      hint: relatedCount > 0 ? 'Linked ops events' : 'No linked events',
    },
  ];

  return (
    <PanelShell>
      <Stagger className="in-kpi-grid" delayMs={45}>
        {kpis.map((m) => (
          <KpiCard key={m.id} spec={m} />
        ))}
      </Stagger>

      <FadeIn>
        <Section
          title={windowKey === '30d' ? 'Month over month' : 'Week over week'}
          icon={TrendingUp}
          hint={`Current ${windowKey} compared to the previous ${windowKey}.`}
          actions={
            <div className="in-compare-legend" aria-hidden>
              <span className="in-compare-legend__item">
                <span className="in-compare-legend__swatch in-compare-legend__swatch--prior" />
                Prior
              </span>
              <span className="in-compare-legend__item">
                <span className="in-compare-legend__swatch in-compare-legend__swatch--now" />
                Now
              </span>
            </div>
          }
        >
          {Object.keys(compare).length ? (
            <div className="in-compare-grid">
              {Object.entries(compare).map(([key, v]) => {
                const row = asRecord(v);
                const current = num(row.current);
                const prior = num(row.prior);
                const delta = num(row.delta);
                const scale = Math.max(current, prior, 0.001);
                const priorPct = prior <= 0 ? 0 : Math.round((prior / scale) * 100);
                const currentPct = current <= 0 ? 0 : Math.round((current / scale) * 100);
                const worse = invertDeltaKey(key) ? delta > 0 : delta < 0;
                const better = invertDeltaKey(key) ? delta < 0 : delta > 0;
                const trend = delta === 0 ? 'flat' : worse ? 'worse' : better ? 'better' : 'flat';

                return (
                  <div
                    key={key}
                    className={`relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 in-compare-card in-compare-card--${trend}`}
                  >
                    <div className="in-compare-card__top">
                      <span className="in-compare-card__label">{formatCompareLabel(key)}</span>
                      <DeltaBadge delta={delta} invert={invertDeltaKey(key)} />
                    </div>
                    <div className="in-compare-card__bars" role="img" aria-label={`Prior ${prior}, now ${current}`}>
                      <div className="in-compare-card__bar-row">
                        <span className="in-compare-card__bar-label">Prior</span>
                        <div className="in-compare-card__bar-track">
                          <span
                            className="in-compare-card__bar in-compare-card__bar--prior"
                            style={{ width: `${priorPct}%` }}
                          />
                        </div>
                        <span className="in-compare-card__bar-value">{prior.toFixed(1)}</span>
                      </div>
                      <div className="in-compare-card__bar-row">
                        <span className="in-compare-card__bar-label">Now</span>
                        <div className="in-compare-card__bar-track">
                          <span
                            className="in-compare-card__bar in-compare-card__bar--now"
                            style={{ width: `${currentPct}%` }}
                          />
                        </div>
                        <span className="in-compare-card__bar-value">{current.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No period compare yet" />
          )}
        </Section>
      </FadeIn>

      <FadeIn>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartFrame title="TPS — daily average" layer="watching" empty={!rows.length}>
            <WtAreaChart
              animationDuration={0}
              yDomainTweenDuration={0}
              data={rows}
              series={[{ dataKey: 'tps_avg', color: 'var(--wt-ch-tps)' }]}
            />
          </ChartFrame>
          <ChartFrame title="MSPT — daily average" layer="watching" empty={!rows.length}>
            <WtAreaChart
              animationDuration={0}
              yDomainTweenDuration={0}
              data={rows}
              series={[{ dataKey: 'mspt_avg', color: 'var(--wt-ch-mspt)' }]}
            />
          </ChartFrame>
        </div>
      </FadeIn>

      {rows.some((r) => num(r.heap_avg) > 0 || num(r.cpu_avg) > 0) ? (
        <FadeIn>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartFrame title="Heap — daily average (GB)" layer="watching" empty={!rows.length}>
              <WtAreaChart
                animationDuration={0}
                yDomainTweenDuration={0}
                data={rows}
                series={[{ dataKey: 'heap_avg', color: 'var(--wt-ch-heap)' }]}
              />
            </ChartFrame>
            <ChartFrame title="CPU — daily average (%)" layer="watching" empty={!rows.length}>
              <WtAreaChart
                animationDuration={0}
                yDomainTweenDuration={0}
                data={rows}
                series={[{ dataKey: 'cpu_avg', color: 'var(--wt-ch-cpu)' }]}
              />
            </ChartFrame>
          </div>
        </FadeIn>
      ) : null}

      <FadeIn>
        <Section title="Takeaways" icon={Zap} hint="Auto-generated observations for this window.">
          {insights.length ? (
            <Stagger className="grid gap-2.5">
              {insights.map((ins, i) => (
                <QueueRow
                  key={str(ins.id, String(i))}
                  title={str(ins.title)}
                  detail={str(ins.detail, str(ins.summary))}
                  action={
                    <div className="flex items-center gap-2">
                      <StatusPill tone={severityTone[str(ins.severity)] ?? 'neutral'}>
                        {str(ins.severity, 'info')}
                      </StatusPill>
                      <Button
                        kind="ghost"
                        onClick={() =>
                          navigate({
                            tab: str(ins.tab, 'insights'),
                            view: str(ins.view) || null,
                            panel: str(ins.panel) || null,
                          })
                        }
                      >
                        View
                      </Button>
                    </div>
                  }
                />
              ))}
            </Stagger>
          ) : (
            <EmptyState title="No takeaways yet">
              Need more sampled minutes in this window before Insights can summarize patterns.
            </EmptyState>
          )}
        </Section>
      </FadeIn>
    </PanelShell>
  );
}
