import { html, useRef } from '../../lib/preact.js';
import { getTheme } from '../../theme/theme.js';
import { usePointerGlow } from '../../motion/pointer-glow.js';
import {
  Button,
  Badge,
  Segmented,
  Card,
} from '../../ui/primitives/index.js';
import {
  Page,
  Section,
  MetricReadout,
  Skeleton,
  EmptyState,
  ErrorState,
  StaggerList,
  ChartFrame,
  TimeSeries,
  Sparkline,
  Heatmap,
  Timeline,
  Gauge,
  RadarDial,
  BarMeter,
  HourBars,
  RingChart,
  SunburstChart,
  CompareBars,
  RadarChart,
} from '../../ui/patterns/index.js';

const DEMO_SEG = [
  { value: 'a', label: 'One' },
  { value: 'b', label: 'Two' },
  { value: 'c', label: 'Three' },
];

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i));

function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function demoChart() {
  return {
    t: Array.from({ length: 48 }, (_, i) => Date.now() / 1000 - (48 - i) * 60),
    tps: Array.from({ length: 48 }, (_, i) => 18.5 + Math.sin(i / 6) * 1.2),
    mspt: Array.from({ length: 48 }, (_, i) => 22 + Math.cos(i / 5) * 8),
  };
}

function demoHeatmap() {
  const rng = seededRng(3);
  return Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => rng())
  );
}

function demoHours() {
  const rng = seededRng(5);
  return Array.from({ length: 24 }, () => 10 + rng() * 40);
}

function heatColor(v) {
  const t = Math.min(1, Math.max(0, Number(v) || 0));
  return `color-mix(in srgb, var(--ui-ch-mspt) ${Math.round(t * 100)}%, var(--ui-bg3))`;
}

function GlowCard({ children, className = '', style }) {
  const ref = useRef(null);
  usePointerGlow(ref);
  return html`
    <div ref=${ref} class=${`ui-spotlight ui-glare ${className}`.trim()} style=${style}>
      <${Card} className="ui-lab-card">${children}</${Card}>
    </div>
  `;
}

export function PageView() {
  const theme = getTheme();
  const chart = demoChart();

  return html`
    <${Page}
      route="lab"
      title="Visual Lab"
      subtitle=${`Every primitive & chart in the alpha kit · theme: ${theme}`}
    >
      <div class="feat-lab">
        <div class="ui-lab-grid">
          <${Section} title="Primitives" hint="Buttons, badges, segmented controls, metrics">
            <${Card} className="ui-lab-card">
              <div class="ui-lab-row">
                <${Button}>Default</${Button}>
                <${Button} kind="primary">Primary</${Button}>
                <${Button} kind="ghost">Ghost</${Button}>
                <${Button} size="sm">Small</${Button}>
              </div>
              <div class="ui-lab-row" style="margin-top:12px">
                <${Badge}>Neutral</${Badge}>
                <${Badge} tone="ok">OK</${Badge}>
                <${Badge} tone="warn">Warn</${Badge}>
                <${Badge} tone="danger">Danger</${Badge}>
                <${Badge} tone="info">Alpha</${Badge}>
              </div>
              <div class="ui-lab-row" style="margin-top:12px">
                <${Segmented} options=${DEMO_SEG} value="b" onChange=${() => {}} />
              </div>
              <div class="ui-lab-row" style="margin-top:16px;align-items:stretch">
                <${Card} style="flex:1;min-width:140px">
                  <${MetricReadout} label="Metric" value=${19.8} format=${(v) => v.toFixed(1)} unit=" TPS" delta=${0.4} />
                </${Card}>
                <${GlowCard} style="flex:1;min-width:140px">
                  <${MetricReadout} label="Glare card" value=${42} unit="%" size="sm" />
                </${GlowCard}>
              </div>
            </${Card}>
          </${Section}>

          <div class="ui-lab-chart-grid">
            <${Section} title="Line / area">
              <${ChartFrame} title="TPS & MSPT" layer="demo">
                <${TimeSeries}
                  series=${[
                    { key: 'tps', label: 'TPS', color: 'ch-tps', fill: true },
                    { key: 'mspt', label: 'MSPT', color: 'ch-mspt' },
                  ]}
                  data=${chart}
                  height=${160}
                />
              </${ChartFrame}>
            </${Section}>
            <${Section} title="Sparklines">
              <${Card} className="ui-lab-card">
                <${Sparkline} series=${chart.tps} tone="accent" />
                <div style="margin-top:12px">
                  <${Sparkline} series=${chart.mspt} tone="warn" fill=${false} height=${48} />
                </div>
              </${Card}>
            </${Section}>
          </div>

          <div class="ui-lab-chart-grid">
            <${Section} title="Gauges & rings">
              <${Card} className="ui-lab-card">
                <div class="ui-lab-row" style="justify-content:center">
                  <${Gauge} value=${68} max=${100} label="Thermal" unit="°C" warnAt=${70} critAt=${85} />
                  <${RingChart} value=${72} label="Heap" sublabel="pressure" color="warn" size=${110} />
                </div>
                <p class="ui-section__hint" style="margin-top:12px;text-align:center">
                  RadarDial (instrument) vs RadarChart (multi-axis spider)
                </p>
                <div class="ui-lab-row" style="justify-content:center;margin-top:8px">
                  <${RadarDial} pct=${62} />
                </div>
              </${Card}>
            </${Section}>
            <${Section} title="Radar chart">
              <${Card} className="ui-lab-card" style="display:grid;place-items:center">
                <${RadarChart}
                  axes=${[
                    { label: 'TPS', value: 88 },
                    { label: 'MSPT', value: 62 },
                    { label: 'CPU', value: 70 },
                    { label: 'Heap', value: 55 },
                    { label: 'Disk', value: 80 },
                  ]}
                />
              </${Card}>
            </${Section}>
          </div>

          <div class="ui-lab-chart-grid">
            <${Section} title="Heatmap & hour bars">
              <${Card} className="ui-lab-card">
                <${Heatmap}
                  idPrefix="lab-hm"
                  rows=${DOW}
                  cols=${HOURS}
                  values=${demoHeatmap()}
                  colorScale=${heatColor}
                />
                <div style="margin-top:16px">
                  <${HourBars} hours=${demoHours()} title="Demo UTC bars" tone="accent" />
                </div>
              </${Card}>
            </${Section}>
            <${Section} title="Bar meter & compare">
              <${Card} className="ui-lab-card">
                <${BarMeter} label="Overworld" value=${82} valueLabel="8.2 GB" tone="accent" />
                <div style="margin-top:10px">
                  <${BarMeter} label="Nether" value=${14} valueLabel="1.4 GB" tone="warn" />
                </div>
                <div style="margin-top:10px">
                  <${BarMeter} label="End" value=${6} valueLabel="0.6 GB" />
                </div>
                <div style="margin-top:16px">
                  <${CompareBars}
                    rows=${[
                      { label: 'TPS avg', current: 19.2, previous: 18.8 },
                      { label: 'MSPT p95', current: 54, previous: 48 },
                    ]}
                  />
                </div>
              </${Card}>
            </${Section}>
          </div>

          <div class="ui-lab-chart-grid">
            <${Section} title="Sunburst & timeline">
              <${Card} className="ui-lab-card">
                <div class="ui-lab-row" style="align-items:flex-start">
                  <${SunburstChart}
                    size=${180}
                    segments=${[
                      { label: 'World', value: 10, children: [{ label: 'region', value: 7 }, { label: 'entities', value: 3 }] },
                      { label: 'Mods', value: 2 },
                    ]}
                  />
                  <div style="flex:1">
                    <${Timeline}
                      items=${[
                        { id: '1', time: new Date().toISOString(), title: 'Backup started', tone: 'warn' },
                        { id: '2', time: new Date(Date.now() - 3600000).toISOString(), title: 'Lag spike cleared', tone: 'ok' },
                        { id: '3', time: new Date(Date.now() - 7200000).toISOString(), title: 'Player peak', detail: '8 concurrent' },
                      ]}
                    />
                  </div>
                </div>
              </${Card}>
            </${Section}>
            <${Section} title="States">
              <${Card} className="ui-lab-card">
                <${Skeleton} height=${40} />
                <${Skeleton} height=${80} style="margin-top:8px" />
                <${EmptyState} title="Empty state" style="margin-top:12px">Waiting for samples.</${EmptyState}>
                <${ErrorState} title="Error state" style="margin-top:12px">Fixture fetch failed.</${ErrorState}>
              </${Card}>
            </${Section}>
          </div>

          <${Section} title="Motion" hint="Stagger list + pointer-glow cards">
            <${GlowCard} className="ui-lab-card">
              <${StaggerList} resetKey="lab-demo">
                ${['Alpha card one', 'Alpha card two', 'Alpha card three'].map((t) => html`
                  <${Card} key=${t} style="margin-bottom:8px">
                    <p class="ui-section__hint" style="margin:0">${t} — hover for spotlight</p>
                  </${Card}>
                `)}
              </${StaggerList}>
              <p class="ui-section__hint" style="margin-top:12px">
                Light/dark tokens live on <code>html[data-theme]</code>. Toggle from the shell rail.
                Marketing surfaces can use <span class="ui-gradient-text">gradient text</span> or
                <span class="ui-shiny-text">shiny text</span>.
              </p>
            </${GlowCard}>
          </${Section}>
        </div>
      </div>
    </${Page}>
  `;
}
