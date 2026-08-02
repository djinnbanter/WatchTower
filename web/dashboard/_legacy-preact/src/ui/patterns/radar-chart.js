import { html, useMemo } from '../../lib/preact.js';
import { resolveColor, chartPalette } from '../../theme/theme.js';

/**
 * RadarChart — SVG spider/radar chart (multi-axis; distinct from RadarDial).
 * axes: [{ label, value, max? }]
 */
export function RadarChart({
  axes = [],
  size = 200,
  color,
  className = '',
}) {
  const stroke = resolveColor(color || 'accent', chartPalette());
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.38;
  const n = Math.max(axes.length, 3);

  const { gridPaths, dataPath, labels } = useMemo(() => {
    const angleStep = (Math.PI * 2) / n;
    const start = -Math.PI / 2;

    const pointAt = (i, radius) => {
      const a = start + i * angleStep;
      return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius };
    };

    const rings = [0.33, 0.66, 1].map((frac) => {
      const pts = Array.from({ length: n }, (_, i) => pointAt(i, maxR * frac));
      return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';
    });

    const dataPts = axes.map((ax, i) => {
      const max = ax.max ?? 100;
      const frac = Math.min(1, Math.max(0, (Number(ax.value) || 0) / (max || 1)));
      return pointAt(i, maxR * frac);
    });

    const data = dataPts.length
      ? dataPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'
      : '';

    const lbls = axes.map((ax, i) => {
      const p = pointAt(i, maxR + 14);
      return { x: p.x, y: p.y, text: ax.label };
    });

    return { gridPaths: rings, dataPath: data, labels: lbls };
  }, [axes, n, cx, cy, maxR]);

  return html`
    <div class=${`ui-radar-chart ${className}`.trim()} role="img" aria-label="Radar chart">
      <svg width=${size} height=${size} viewBox=${`0 0 ${size} ${size}`}>
        ${gridPaths.map((d, i) => html`
          <path key=${i} class="ui-radar-chart__grid" d=${d} />
        `)}
        ${dataPath && html`
          <path class="ui-radar-chart__area" d=${dataPath} style=${{ stroke, fill: `color-mix(in srgb, ${stroke} 22%, transparent)` }} />
        `}
        ${labels.map((l, i) => html`
          <text key=${i} class="ui-radar-chart__label" x=${l.x} y=${l.y}>${l.text}</text>
        `)}
      </svg>
    </div>
  `;
}

export default RadarChart;
