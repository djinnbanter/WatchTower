import { html, useMemo, useState } from '../../lib/preact.js';
import { resolveColor, chartPalette } from '../../theme/theme.js';
import { formatGb } from '../../domain/formats.js';

/**
 * SunburstChart — 2-level storage donut breakdown.
 * segments: [{ label, value, color?, children?: [{ label, value, color? }] }]
 */
export function SunburstChart({
  segments = [],
  size = 200,
  centerLabel,
  centerValue,
  format = formatGb,
  className = '',
}) {
  const [hover, setHover] = useState(null);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.46;
  const midR = size * 0.32;
  const innerR = size * 0.2;

  const { arcs, total } = useMemo(() => {
    const palette = chartPalette();
    const colors = ['ch-disk', 'ch-heap', 'ch-cpu', 'ch-players', 'ch-rx', 'ch-tx'];
    let totalVal = 0;
    for (const s of segments) totalVal += Number(s.value) || 0;

    const result = [];
    let angle = -Math.PI / 2;

    segments.forEach((seg, si) => {
      const segVal = Number(seg.value) || 0;
      if (segVal <= 0) return;
      const segSweep = (segVal / totalVal) * Math.PI * 2;
      const segColor = resolveColor(seg.color || colors[si % colors.length], palette);

      result.push({
        d: describeArc(cx, cy, midR, outerR, angle, angle + segSweep),
        fill: segColor,
        label: seg.label,
        value: segVal,
        key: `o-${si}`,
      });

      const children = seg.children || [];
      const childTotal = children.reduce((s, c) => s + (Number(c.value) || 0), 0) || segVal;
      let childAngle = angle;

      children.forEach((child, ci) => {
        const cv = Number(child.value) || 0;
        if (cv <= 0) return;
        const childSweep = (cv / childTotal) * segSweep;
        result.push({
          d: describeArc(cx, cy, innerR, midR - 2, childAngle, childAngle + childSweep),
          fill: resolveColor(child.color || segColor, palette),
          label: `${seg.label} · ${child.label}`,
          value: cv,
          key: `i-${si}-${ci}`,
        });
        childAngle += childSweep;
      });

      angle += segSweep;
    });

    return { arcs: result, total: totalVal };
  }, [segments, cx, cy, outerR, midR, innerR]);

  const active = hover != null ? arcs.find((a) => a.key === hover) : null;
  const center = centerValue ?? (active ? active.value : total);

  return html`
    <div class=${`ui-sunburst ${className}`.trim()} role="img" aria-label="Storage breakdown">
      <svg width=${size} height=${size} viewBox=${`0 0 ${size} ${size}`}>
        ${arcs.map((a) => html`
          <path
            key=${a.key}
            d=${a.d}
            fill=${a.fill}
            opacity=${hover == null || hover === a.key ? 1 : 0.45}
            onMouseEnter=${() => setHover(a.key)}
            onMouseLeave=${() => setHover(null)}
          >
            <title>${a.label}: ${format(a.value)}</title>
          </path>
        `)}
      </svg>
      <div class="ui-sunburst__center">
        <div class="ui-sunburst__num">${format(center)}</div>
        <div class="ui-sunburst__sub">${active?.label || centerLabel || 'Total'}</div>
      </div>
    </div>
  `;
}

function polar(cx, cy, r, angle) {
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}

function describeArc(cx, cy, r0, r1, a0, a1) {
  const p0 = polar(cx, cy, r1, a0);
  const p1 = polar(cx, cy, r1, a1);
  const q0 = polar(cx, cy, r0, a1);
  const q1 = polar(cx, cy, r0, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return [
    `M ${p0.x} ${p0.y}`,
    `A ${r1} ${r1} 0 ${large} 1 ${p1.x} ${p1.y}`,
    `L ${q0.x} ${q0.y}`,
    `A ${r0} ${r0} 0 ${large} 0 ${q1.x} ${q1.y}`,
    'Z',
  ].join(' ');
}

export default SunburstChart;
