import BorderGlow from '@/components/border-glow/BorderGlow';
import { ChartStatFlow } from '@/components/charts/chart-stat-flow';
import { ChartFrame, Heatmap, WtBarChart } from '@/ui/charts';
import { FadeIn, HeroWatermark, Stagger } from '@/ui/motion';
import { EmptyState, Section } from '@/ui/patterns';
import { Activity, Clock, Moon, Users, Zap } from '@/ui/icons';
import { useDashboardTimezone } from '@/app/timezone';
import { localizeHourOfWeekCells, localizeHourRows } from '@/lib/datetime';
import { asArray, get, num, str } from '@/lib/utils';
import { PanelShell } from '../shared';

function buildHourlyAverages(hourOfWeek: Record<string, unknown>[]) {
  const mspt = Array.from({ length: 24 }, () => 0);
  const tps = Array.from({ length: 24 }, () => 0);
  const players = Array.from({ length: 24 }, () => 0);
  const msptW = Array.from({ length: 24 }, () => 0);
  const tpsW = Array.from({ length: 24 }, () => 0);
  const playerW = Array.from({ length: 24 }, () => 0);

  for (const cell of hourOfWeek) {
    const h = num(cell.hour_utc, -1);
    if (h < 0 || h > 23) continue;
    const w = Math.max(1, num(cell.sample_minutes, 1));
    if (cell.avg_mspt != null) {
      mspt[h]! += num(cell.avg_mspt) * w;
      msptW[h]! += w;
    }
    if (cell.avg_tps != null) {
      tps[h]! += num(cell.avg_tps) * w;
      tpsW[h]! += w;
    }
    if (cell.avg_players != null) {
      players[h]! += num(cell.avg_players) * w;
      playerW[h]! += w;
    }
  }

  const toRows = (values: number[], weights: number[]) =>
    Array.from({ length: 24 }, (_, h) => ({
      name: String(h).padStart(2, '0'),
      value: weights[h]! > 0 ? values[h]! / weights[h]! : 0,
    }));

  return {
    mspt: toRows(mspt, msptW),
    tps: toRows(tps, tpsW),
    players: toRows(players, playerW),
  };
}

function hourClock(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

function PeakHoursCard({
  variant,
  hours,
  zoneLabel,
}: {
  variant: 'busy' | 'quiet';
  hours: Record<string, unknown>[];
  zoneLabel: string;
}) {
  const busy = variant === 'busy';
  const top = hours[0];
  const maxPlayers = Math.max(1, ...hours.map((h) => num(h.avg_players)));
  const toneVars = busy
    ? {
        glowColor: '38 92 55',
        glowIntensity: 1.15,
        colors: ['#fbbf24', '#fb923c', '#f472b6'] as string[],
        fillOpacity: 0.44,
      }
    : {
        glowColor: '210 78 48',
        glowIntensity: 1.1,
        colors: ['#38bdf8', '#60a5fa', '#818cf8'] as string[],
        fillOpacity: 0.4,
      };

  return (
    <BorderGlow
      className={`in-kpi-glow in-peak-glow in-kpi-card--${variant}`}
      backgroundColor="var(--wt-bg1)"
      borderRadius={6}
      edgeSensitivity={20}
      glowRadius={44}
      coneSpread={30}
      animated
      {...toneVars}
    >
      <div className={`in-peak-card in-peak-card--${variant}`}>
        <HeroWatermark icon={busy ? Zap : Moon} tone={busy ? 'warn' : 'info'} size="card" />
        <div className="in-peak-card__head">
          <div className="in-peak-card__title-wrap">
            <div>
              <p className="in-peak-card__eyebrow">{busy ? 'Busiest hours' : 'Quietest hours'}</p>
              <p className="in-peak-card__sub">
                {busy
                  ? `Peak concurrent load windows (${zoneLabel})`
                  : `Lowest concurrent load windows (${zoneLabel})`}
              </p>
            </div>
          </div>
          <span className="in-peak-card__badge">{busy ? 'Peak' : 'Off-peak'}</span>
        </div>

        {top ? (
          <div className="in-peak-card__hero">
            <div>
              <div className="in-peak-card__hero-time">{hourClock(num(top.hour_utc))}</div>
              <div className="in-peak-card__hero-meta">
                {str(top.label)} · MSPT {num(top.avg_mspt).toFixed(1)}
              </div>
            </div>
            <div className="in-peak-card__hero-stat">
              <div className="in-peak-card__hero-stat-label">Avg players</div>
              <ChartStatFlow
                value={num(top.avg_players)}
                label="Average players"
                labelClassName="sr-only"
                valueClassName="in-peak-card__hero-stat-value"
                formatOptions={{ maximumFractionDigits: 1, minimumFractionDigits: 1 }}
              />
            </div>
          </div>
        ) : (
          <EmptyState title={busy ? 'No busy hours' : 'No quiet hours'} />
        )}

        {hours.length ? (
          <ol className="in-peak-card__list">
            {hours.map((h, i) => {
              const players = num(h.avg_players);
              const width = Math.max(8, (players / maxPlayers) * 100);
              return (
                <li key={`${variant}-${num(h.hour_utc)}-${i}`} className="in-peak-row">
                  <span className="in-peak-row__rank">{i + 1}</span>
                  <div className="in-peak-row__main">
                    <div className="in-peak-row__label">
                      <span>{hourClock(num(h.hour_utc))}</span>
                      <span className="in-peak-row__players">{players.toFixed(1)}</span>
                    </div>
                    <div className="in-peak-row__bar" aria-hidden>
                      <span style={{ width: `${width}%` }} />
                    </div>
                  </div>
                  <span className="in-peak-row__mspt">{num(h.avg_mspt).toFixed(1)} ms</span>
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
    </BorderGlow>
  );
}

export function PatternsSchedule({ dash }: { dash: Record<string, unknown> }) {
  const { resolvedZone } = useDashboardTimezone();
  const howUtc = asArray<Record<string, unknown>>(dash.hour_of_week);
  const busyUtc = asArray<Record<string, unknown>>(get(dash, 'busy_quiet', 'busy_hours'));
  const quietUtc = asArray<Record<string, unknown>>(get(dash, 'busy_quiet', 'quiet_hours'));

  const how = localizeHourOfWeekCells(howUtc, resolvedZone);
  const busy = localizeHourRows(busyUtc, resolvedZone);
  const quiet = localizeHourRows(quietUtc, resolvedZone);

  if (!how.length) {
    return (
      <EmptyState title="No schedule data">
        Wait for enough live samples to build hour-of-week heatmaps.
      </EmptyState>
    );
  }

  const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hourLabels = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
  const msptGrid = dowLabels.map(() => Array.from({ length: 24 }, () => 0));
  const tpsGrid = dowLabels.map(() => Array.from({ length: 24 }, () => 20));
  const playersGrid = dowLabels.map(() => Array.from({ length: 24 }, () => 0));

  for (const row of how) {
    const dow = num(row.dow);
    const hour = num(row.hour_utc);
    if (!msptGrid[dow]) continue;
    msptGrid[dow]![hour] = num(row.avg_mspt);
    tpsGrid[dow]![hour] = num(row.avg_tps, 20);
    playersGrid[dow]![hour] = num(row.avg_players);
  }

  const hourly = buildHourlyAverages(how);

  return (
    <PanelShell>
      <FadeIn>
        <Stagger className="in-schedule-peaks" delayMs={55}>
          <PeakHoursCard variant="busy" hours={busy} zoneLabel={resolvedZone} />
          <PeakHoursCard variant="quiet" hours={quiet} zoneLabel={resolvedZone} />
        </Stagger>
      </FadeIn>

      <FadeIn>
        <Section
          title="MSPT heatmap"
          icon={Activity}
          hint={`Day × hour (${resolvedZone}). Cool = smooth, red = tick lag.`}
        >
          <ChartFrame title="MSPT — day × hour" empty={!how.length}>
            <Heatmap
              values={msptGrid}
              rows={dowLabels}
              cols={hourLabels}
              scale="mspt"
              legendLow="Smooth"
              legendHigh="Laggy"
              formatValue={(v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1))}
            />
          </ChartFrame>
        </Section>
      </FadeIn>

      <FadeIn>
        <Section
          title="TPS heatmap"
          icon={Activity}
          hint={`Day × hour (${resolvedZone}). Green = full rate, red = dropped ticks.`}
        >
          <ChartFrame title="TPS — day × hour" empty={!how.length}>
            <Heatmap
              values={tpsGrid}
              rows={dowLabels}
              cols={hourLabels}
              scale="tps"
              invert
              legendLow="20 TPS"
              legendHigh="Dropped"
              formatValue={(v) => v.toFixed(1)}
            />
          </ChartFrame>
        </Section>
      </FadeIn>

      <FadeIn>
        <Section
          title="Players heatmap"
          icon={Users}
          hint={`Day × hour (${resolvedZone}). Blue intensity = busier (not a health grade).`}
        >
          <ChartFrame title="Players — day × hour" empty={!how.length}>
            <Heatmap
              values={playersGrid}
              rows={dowLabels}
              cols={hourLabels}
              scale="players"
              legendLow="Quiet"
              legendHigh="Busy"
              formatValue={(v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1))}
            />
          </ChartFrame>
        </Section>
      </FadeIn>

      <FadeIn>
        <Section
          title={`Hourly averages (${resolvedZone})`}
          icon={Clock}
          hint={`Hour-of-day averages across the window. Hover a bar for that ${resolvedZone} hour.`}
        >
          <div className="grid gap-4 xl:grid-cols-3">
            <ChartFrame title="MSPT by hour" layer="watching">
              <WtBarChart
                data={hourly.mspt}
                dataKey="value"
                xDataKey="name"
                color="var(--wt-ch-mspt)"
                className="h-52"
              />
            </ChartFrame>
            <ChartFrame title="TPS by hour" layer="watching">
              <WtBarChart
                data={hourly.tps}
                dataKey="value"
                xDataKey="name"
                color="var(--wt-ch-tps)"
                className="h-52"
              />
            </ChartFrame>
            <ChartFrame title="Players by hour" layer="watching">
              <WtBarChart
                data={hourly.players}
                dataKey="value"
                xDataKey="name"
                color="var(--wt-ch-cpu)"
                className="h-52"
              />
            </ChartFrame>
          </div>
        </Section>
      </FadeIn>
    </PanelShell>
  );
}
