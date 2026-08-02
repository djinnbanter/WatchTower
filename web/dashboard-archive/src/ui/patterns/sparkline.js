import { html, useMemo, useRef, useState, useLayoutEffect } from '../../lib/preact.js';

function toValues(series) {
  if (!series?.length) return [];
  return (typeof series[0] === 'object'
    ? series.map((p) => p?.v)
    : series
  ).filter((v) => v != null && !Number.isNaN(Number(v))).map(Number);
}

/**
 * Sparkline({ series, tone, fill, width, height, ymin, ymax })
 * Fluid SVG spark — fills container width unless `width` is set.
 * series: number[] | {t, v}[]
 */
export function Sparkline({
  series = [],
  tone = 'accent',
  fill = true,
  width,
  height = 40,
  ymin,
  ymax,
}) {
  const wrapRef = useRef(null);
  const [measuredW, setMeasuredW] = useState(width || 160);

  useLayoutEffect(() => {
    if (width != null) {
      setMeasuredW(width);
      return undefined;
    }
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => {
      const next = Math.max(48, Math.floor(el.clientWidth || 0));
      setMeasuredW((prev) => (prev === next ? prev : next));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [width]);

  const w = width ?? measuredW;

  const { linePoints, fillPath, empty } = useMemo(() => {
    const values = toValues(series);
    if (values.length < 2) {
      return { linePoints: '', fillPath: null, empty: true };
    }

    let min = ymin != null ? ymin : Math.min(...values);
    let max = ymax != null ? ymax : Math.max(...values);
    if (min === max) {
      min -= Math.abs(min) * 0.05 + 0.5;
      max += Math.abs(max) * 0.05 + 0.5;
    }

    // Pad domain so lines aren't glued to the clip edge (also avoids
    // near-max series painting a solid filled rectangle).
    const rawRange = max - min || 1;
    const pad = rawRange * 0.12;
    min -= pad;
    max += pad;

    const range = max - min || 1;
    const padX = 2;
    const padY = 4;
    const plotW = w - padX * 2;
    const plotH = height - padY * 2;

    const points = values.map((v, i) => {
      const x = padX + (i / Math.max(values.length - 1, 1)) * plotW;
      const y = padY + plotH - ((v - min) / range) * plotH;
      return [x, y];
    });

    const line = points.map(([x, y]) => `${x},${y}`).join(' ');

    // Skip area fill when the series sits near the top of the domain —
    // a full-height wash reads as a broken solid bar (classic TPS@20).
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const fillRatio = (avg - min) / range;
    const useFill = fill && fillRatio < 0.82;

    const area = useFill
      ? `M${points[0][0]},${height - padY} ` +
        points.map(([x, y]) => `L${x},${y}`).join(' ') +
        ` L${points[points.length - 1][0]},${height - padY} Z`
      : null;

    return { linePoints: line, fillPath: area, empty: false };
  }, [series, w, height, fill, ymin, ymax]);

  return html`
    <span
      ref=${wrapRef}
      class="ui-sparkline"
      aria-hidden="true"
      style=${{
        display: 'block',
        width: width != null ? `${width}px` : '100%',
        height: `${height}px`,
      }}
    >
      ${!empty && html`
        <svg width="100%" height=${height} viewBox=${`0 0 ${w} ${height}`} preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          ${fillPath && html`
            <path d=${fillPath} class=${`ui-sparkline__fill ui-sparkline__fill--${tone}`} />
          `}
          <polyline
            points=${linePoints}
            class=${`ui-sparkline__line ui-sparkline__line--${tone}`}
            vector-effect="non-scaling-stroke"
          />
        </svg>
      `}
    </span>
  `;
}

export default Sparkline;
