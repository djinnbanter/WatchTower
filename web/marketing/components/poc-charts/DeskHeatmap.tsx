import { ResponsiveHeatMap } from '@nivo/heatmap';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export type DeskHeatCell = { x: string; y: number };

export type DeskHeatSerie = {
  id: string;
  data: DeskHeatCell[];
};

const HOURS = ['00', '04', '08', '12', '16', '20'] as const;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Evening-weighted MSPT schedule fixture (ms). */
export function demoScheduleHeatmap(): DeskHeatSerie[] {
  return DAYS.map((day, di) => ({
    id: day,
    data: HOURS.map((hour, hi) => {
      const weekend = di >= 5 ? 0.72 : 1;
      const evening = hi === 4 || hi === 5 ? 1.35 : hi === 3 ? 1.1 : 0.85;
      const base = 28 + ((di * 5 + hi * 9) % 17);
      const mspt = Math.round(base * weekend * evening);
      return { x: hour, y: mspt };
    }),
  }));
}

function useDeskHeatColors(): [string, string] {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () =>
      setDark(
        root.getAttribute('data-theme') === 'dark' || root.classList.contains('dark'),
      );
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => obs.disconnect();
  }, []);

  // Cool endpoints — steel → hazard (nivo sequential interpolates).
  return dark ? ['#1e3a5f', '#e61919'] : ['#bfdbfe', '#dc2626'];
}

function useNivoTheme() {
  const [fg, setFg] = useState('#a3a3a3');
  const [bg, setBg] = useState('#121212');
  const [line, setLine] = useState('#3f3f46');

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      const styles = getComputedStyle(root);
      setFg(styles.getPropertyValue('--wt-text-mid').trim() || '#a3a3a3');
      setBg(styles.getPropertyValue('--wt-bg1').trim() || '#121212');
      setLine(styles.getPropertyValue('--wt-line').trim() || '#3f3f46');
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => obs.disconnect();
  }, []);

  return useMemo(
    () => ({
      background: 'transparent',
      textColor: fg,
      fontFamily: 'var(--font-mono, ui-monospace, monospace)',
      fontSize: 11,
      axis: {
        domain: { line: { stroke: line, strokeWidth: 1 } },
        ticks: {
          line: { stroke: line, strokeWidth: 1 },
          text: { fill: fg, fontSize: 10, fontFamily: 'var(--font-mono, monospace)' },
        },
        legend: {
          text: { fill: fg, fontSize: 11, fontFamily: 'var(--font-mono, monospace)' },
        },
      },
      grid: {
        line: { stroke: line, strokeWidth: 1 },
      },
      tooltip: {
        container: {
          background: bg,
          color: fg,
          fontSize: 12,
          fontFamily: 'var(--font-mono, monospace)',
          borderRadius: 0,
          border: `1px solid ${line}`,
          boxShadow: 'none',
          padding: '8px 10px',
        },
      },
      labels: {
        text: { fontSize: 10, fontFamily: 'var(--font-mono, monospace)' },
      },
    }),
    [bg, fg, line],
  );
}

/** Schedule / intensity heatmap — @nivo/heatmap, desk-themed. */
export function DeskHeatmap({
  data,
  unit = 'ms',
  className,
  height = 280,
}: {
  data?: DeskHeatSerie[];
  unit?: string;
  className?: string;
  height?: number;
}) {
  const series = data ?? demoScheduleHeatmap();
  const colors = useDeskHeatColors();
  const theme = useNivoTheme();

  return (
    <div className={cn('w-full', className)} style={{ height }} role="img" aria-label="Schedule heatmap">
      <ResponsiveHeatMap
        data={series}
        margin={{ top: 28, right: 72, bottom: 48, left: 48 }}
        valueFormat={(v) => `${v}${unit}`}
        axisTop={{
          tickSize: 0,
          tickPadding: 8,
          legend: 'Hour (UTC)',
          legendPosition: 'middle',
          legendOffset: -22,
        }}
        axisRight={null}
        axisBottom={{
          tickSize: 0,
          tickPadding: 8,
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 8,
          legend: 'Day',
          legendPosition: 'middle',
          legendOffset: -40,
        }}
        colors={{
          type: 'sequential',
          colors,
        }}
        emptyColor="var(--muted)"
        borderWidth={1}
        borderColor="var(--border)"
        enableLabels
        labelTextColor={{
          from: 'color',
          modifiers: [['brighter', 2.2]],
        }}
        hoverTarget="cell"
        inactiveOpacity={0.35}
        animate={false}
        theme={theme}
        legends={[
          {
            anchor: 'bottom',
            translateX: 0,
            translateY: 36,
            length: 240,
            thickness: 8,
            direction: 'row',
            tickPosition: 'after',
            tickSize: 0,
            tickSpacing: 8,
            tickOverlap: false,
            tickFormat: (v) => `${v}${unit}`,
            title: `MSPT · ${unit}`,
            titleAlign: 'start',
            titleOffset: 4,
          },
        ]}
        tooltip={({ cell }) => (
          <div className="border border-border bg-card px-2.5 py-2 font-mono text-xs text-foreground shadow-none">
            <p className="m-0 wt-meta text-muted-foreground">
              {cell.serieId} · {cell.data.x}:00
            </p>
            <p className="mt-1 m-0 text-sm tabular-nums">
              {cell.formattedValue}
              <span className="text-muted-foreground"> MSPT</span>
            </p>
          </div>
        )}
      />
    </div>
  );
}
