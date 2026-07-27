import { html, useEffect, useRef, useLayoutEffect, useState } from '../../lib/preact.js';
import { uPlot } from '../../lib/uplot.js';
import { chartPalette, resolveColor, getSkin } from '../../theme/theme.js';
import { Motion } from '../../motion/reduced.js';
import { DUR } from '../../motion/tokens.js';

/**
 * Stable identity for series config (avoid destroy on every parent render).
 */
function seriesKeyOf(series = []) {
  return series.map((s) => {
    const ymin = s.ymin ?? '';
    const ymax = s.ymax ?? '';
    return `${s.key}:${s.scale || s.key}:${s.label || ''}:${ymin}:${ymax}:${s.fill !== false}`;
  }).join('|');
}

function pointCount(data) {
  return data?.t?.length ?? 0;
}

function dataMaxForKey(d, key) {
  const arr = d?.[key];
  if (!Array.isArray(arr)) return 0;
  let max = 0;
  for (const v of arr) {
    if (v != null && Number.isFinite(v) && v > max) max = v;
  }
  return max;
}

function resolveYRange(s, d) {
  const ymin = s.ymin != null ? s.ymin : 0;
  let ymax = s.ymax;
  if (ymax == null) {
    const peak = dataMaxForKey(d, s.key);
    ymax = Math.max(peak * 1.15, s.yminFloor ?? 1);
  }
  if (ymax <= ymin) ymax = ymin + 1;
  return [ymin, ymax];
}

function formatAxisValue(v, s) {
  if (v == null || !Number.isFinite(v)) return '';
  if (s?.unit === '' && (s.key === 'players' || s.key === 'tps')) {
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }
  if (s?.unit === '%' || s?.key === 'host_cpu' || s?.key === 'disk_use_pct') {
    return `${Math.round(v)}`;
  }
  if (s?.unit === '°' || s?.key === 'thermal_package' || s?.key === 'thermal_ambient') {
    return `${Math.round(v)}°`;
  }
  if (Math.abs(v) >= 100) return String(Math.round(v));
  return Number(v).toFixed(1);
}

/**
 * TimeSeries — uPlot wrapper.
 * series: [{key, label, color?, unit?, scale?, ymin?, ymax?, fill?}]
 * data: { t: number[] (unix seconds), [key]: number[] }
 * xMin/xMax: optional fixed unix-second domain (e.g. selected Live window)
 *
 * Y scales default to [0, ymax] (fixed or data-capped) — never auto-zoom.
 * Hover updates legend via DOM (no React setState).
 * legendPlacement: 'inline' (below/over plot) | 'header' (ChartFrame header slot)
 *
 * Plot host is created imperatively (not in the VNode tree). Root kickRender()
 * reconciles empty JSX divs and would otherwise strip uPlot's canvas children,
 * leaving charts blank until a full page reload.
 */
export function TimeSeries({
  series = [],
  data,
  height = 160,
  thresholds,
  dual = false,
  onHoverChange,
  xMin = null,
  xMax = null,
  reveal = true,
  legendPlacement = 'inline',
}) {
  const wrapRef = useRef(null);
  const hostRef = useRef(null);
  const emptyRef = useRef(null);
  const legendRef = useRef(null);
  const headerLegendRef = useRef(null);
  const plotRef = useRef(null);
  const seriesRef = useRef(series);
  const dataRef = useRef(data);
  const legendPlacementRef = useRef(legendPlacement);
  const hoveringRef = useRef(false);
  const pendingDataRef = useRef(null);
  const hasRevealedRef = useRef(false);
  const [revealActive, setRevealActive] = useState(false);
  const sk = seriesKeyOf(series);
  const n = pointCount(data);
  const hasData = n >= 2;
  const xKey = xMin != null && xMax != null ? `${xMin}:${xMax}` : '';
  const legendInHeader = legendPlacement === 'header';

  seriesRef.current = series;
  dataRef.current = data;
  legendPlacementRef.current = legendPlacement;

  function resolveLegendEl() {
    if (legendPlacementRef.current === 'header') {
      if (!headerLegendRef.current || !headerLegendRef.current.isConnected) {
        const frame = wrapRef.current?.closest('.ui-chart-frame');
        headerLegendRef.current = frame?.querySelector('.ui-chart-frame__legend') ?? null;
      }
      if (headerLegendRef.current) return headerLegendRef.current;
    }
    return legendRef.current;
  }

  function ensureHost() {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    let host = hostRef.current;
    if (!host || !host.isConnected) {
      host = document.createElement('div');
      host.className = 'ui-timeseries__plot';
      hostRef.current = host;
    }
    host.style.height = `${height}px`;
    // Keep plot host before the inline legend; never put it in the VNode tree.
    const legend = legendRef.current;
    if (host.parentNode !== wrap) {
      if (legend && legend.parentNode === wrap) {
        wrap.insertBefore(host, legend);
      } else {
        wrap.appendChild(host);
      }
    }
    if (emptyRef.current?.parentNode) {
      emptyRef.current.remove();
    }
    return host;
  }

  function showEmpty(message) {
    destroyPlot();
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (hostRef.current?.parentNode) {
      hostRef.current.remove();
    }
    let empty = emptyRef.current;
    if (!empty) {
      empty = document.createElement('div');
      empty.className = 'ui-timeseries__empty';
      emptyRef.current = empty;
    }
    empty.style.height = `${height}px`;
    empty.textContent = message;
    const legend = legendRef.current;
    if (empty.parentNode !== wrap) {
      if (legend && legend.parentNode === wrap) {
        wrap.insertBefore(empty, legend);
      } else {
        wrap.appendChild(empty);
      }
    }
  }

  function buildUPlotData(ser, d) {
    if (!d?.t?.length) return null;
    return [d.t, ...ser.map((s) => d[s.key] ?? new Array(d.t.length).fill(null))];
  }

  function writeLegend(items) {
    const el = resolveLegendEl();
    if (!el) return;
    if (!items?.length) {
      // Show last-sample values as idle legend
      const ser = seriesRef.current;
      const d = dataRef.current;
      if (!d?.t?.length) {
        el.innerHTML = '';
        return;
      }
      const last = d.t.length - 1;
      items = ser.map((s) => ({
        key: s.key,
        label: s.label,
        color: resolveColor(s.color, chartPalette(), s.key),
        value: d[s.key]?.[last],
        unit: s.unit || '',
      }));
    }
    el.innerHTML = items
      .map((item) => {
        const val =
          item.value != null && Number.isFinite(Number(item.value))
            ? `${Number(item.value).toFixed(2)}${item.unit || ''}`
            : '—';
        return `<div class="ui-timeseries__legend-item">` +
          `<span class="ui-timeseries__legend-dot" style="background:${item.color}"></span>` +
          `<span>${item.label}</span>` +
          `<span class="ui-timeseries__legend-value">${val}</span>` +
          `</div>`;
      })
      .join('');
  }

  function buildOpts(palette, containerWidth, ser, d) {
    const grid = palette['ch-grid'] || 'rgba(255,255,255,0.06)';
    const textLow = palette['text-low'] || '#5F6B78';
    const compact = getSkin() === 'sass';
    const xAxisSize = compact ? 22 : 50;
    const yAxisSize = compact ? 40 : 48;
    const tickSpace = compact ? 40 : 48;

    const axes = [
      {
        stroke: textLow,
        grid: { stroke: grid, width: 1 },
        ticks: { show: true, stroke: grid, width: 1 },
        space: tickSpace,
        size: xAxisSize,
        gap: compact ? 1 : 5,
        values: (_u, vals) =>
          vals.map((v) => {
            if (v == null) return '';
            const dt = new Date(v * 1000);
            return `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
          }),
      },
    ];

    const scaleMeta = new Map();
    const scalesAdded = new Set();
    const ySeries = ser.map((s) => {
      const scale = s.scale || s.key;
      const stroke = resolveColor(s.color, palette, s.key);
      if (!scalesAdded.has(scale)) {
        scalesAdded.add(scale);
        scaleMeta.set(scale, s);
        axes.push({
          scale,
          stroke: textLow,
          grid: { show: true, stroke: grid, width: 1 },
          ticks: { show: true, stroke: grid, width: 1 },
          size: yAxisSize,
          gap: compact ? 4 : 5,
          values: (_u, vals) => vals.map((v) => formatAxisValue(v, s)),
        });
      }
      const fillOn = s.fill !== false;
      return {
        label: s.label,
        stroke,
        width: compact ? 2 : 2.25,
        fill: fillOn ? stroke : undefined,
        fillTo: fillOn ? 0 : undefined,
        scale,
        points: { show: false },
        spanGaps: true,
        alpha: 1,
      };
    });

    const scales = {
      x: xMin != null && xMax != null && Number.isFinite(xMin) && Number.isFinite(xMax) && xMax > xMin
        ? { time: true, auto: false, range: () => [xMin, xMax] }
        : { time: true },
    };
    scalesAdded.forEach((k) => {
      const s = scaleMeta.get(k);
      const [ymin, ymax] = resolveYRange(s || { key: k }, d);
      scales[k] = {
        auto: false,
        range: () => [ymin, ymax],
      };
    });

    const bands = Array.isArray(thresholds) ? thresholds : null;

    return {
      width: containerWidth,
      height,
      padding: compact ? [10, 4, 0, 2] : undefined,
      cursor: {
        drag: { x: false, y: false, setScale: false },
        focus: { prox: 24 },
        points: {
          size: 7,
          width: 2,
        },
      },
      select: { show: false },
      legend: { show: false },
      axes,
      scales,
      series: [
        { label: 'Time' },
        ...ySeries.map((ys) => {
          if (!ys.fill) return ys;
          const fill = hexToRgba(ys.stroke, compact ? 0.12 : 0.14);
          return { ...ys, fill };
        }),
      ],
      hooks: {
        setCursor: [
          (u) => {
            const idx = u.cursor.idx;
            const serNow = seriesRef.current;
            const paletteNow = chartPalette();
            if (idx == null) {
              hoveringRef.current = false;
              onHoverChange?.(false);
              if (pendingDataRef.current && plotRef.current) {
                try {
                  plotRef.current.setData(pendingDataRef.current, true);
                } catch { /* ignore */ }
                pendingDataRef.current = null;
              }
              writeLegend(null);
              return;
            }
            hoveringRef.current = true;
            onHoverChange?.(true);
            writeLegend(
              serNow.map((s, i) => ({
                key: s.key,
                label: s.label,
                color: resolveColor(s.color, paletteNow, s.key),
                value: u.data[i + 1]?.[idx],
                unit: s.unit || '',
              }))
            );
          },
        ],
        draw: bands
          ? [
              (u) => {
                const ctx = u.ctx;
                const { left, top, width: w, height: h } = u.bbox;
                ctx.save();
                for (const band of bands) {
                  if (band.value == null || !band.scale) continue;
                  const y = u.valToPos(band.value, band.scale, true);
                  if (y < top || y > top + h) continue;
                  ctx.strokeStyle = resolveColor(band.color || 'warn', chartPalette());
                  ctx.globalAlpha = 0.55;
                  ctx.lineWidth = 1.25;
                  ctx.setLineDash([5, 4]);
                  ctx.beginPath();
                  ctx.moveTo(left, y);
                  ctx.lineTo(left + w, y);
                  ctx.stroke();
                }
                ctx.restore();
              },
            ]
          : undefined,
      },
    };
  }

  function hexToRgba(hex, alpha) {
    if (!hex || typeof hex !== 'string') return `rgba(76,158,234,${alpha})`;
    const h = hex.replace('#', '');
    if (h.length === 3) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    if (h.length >= 6) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    return hex;
  }

  function measurePlotWidth() {
    const el = hostRef.current;
    if (!el) return 0;
    return Math.max(0, Math.floor(el.clientWidth || 0));
  }

  function applyPlotSize(plot = plotRef.current) {
    if (!plot) return;
    const width = measurePlotWidth();
    if (width < 32) return;
    try {
      plot.setSize({ width, height });
    } catch { /* ignore */ }
  }

  function destroyPlot() {
    if (plotRef.current) {
      try {
        plotRef.current.destroy();
      } catch { /* ignore */ }
      plotRef.current = null;
    }
  }

  function plotIsLive() {
    const plot = plotRef.current;
    const host = hostRef.current;
    if (!plot || !host?.isConnected) return false;
    try {
      return host.contains(plot.root) || host.contains(plot.over);
    } catch {
      return host.childNodes.length > 0;
    }
  }

  function createPlot() {
    if (!hasData) return;
    const host = ensureHost();
    if (!host) return;
    const ser = seriesRef.current;
    const d = dataRef.current;
    const palette = chartPalette();
    const width = measurePlotWidth() || wrapRef.current?.clientWidth || 300;
    const opts = buildOpts(palette, Math.max(width, 32), ser, d);
    const udata = buildUPlotData(ser, d);
    if (!udata) return;

    destroyPlot();
    host.innerHTML = '';
    try {
      plotRef.current = new uPlot(opts, udata, host);
      writeLegend(null);
      requestAnimationFrame(() => applyPlotSize(plotRef.current));
    } catch (e) {
      console.warn('TimeSeries: uPlot init failed', e);
    }
  }

  // Init / re-init only when series shape, height, window domain, or data presence changes
  useEffect(() => {
    if (!hasData) {
      showEmpty(n === 1 ? 'Waiting for live samples…' : 'No data');
      return undefined;
    }
    createPlot();
    return () => {
      destroyPlot();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sk, height, hasData, dual, xKey]);

  // Data updates — setData only; buffer while hovering; recreate if VDOM wipe orphaned the plot
  useEffect(() => {
    if (!hasData) return;
    const ser = seriesRef.current;
    const udata = buildUPlotData(ser, data);
    if (!udata) return;

    if (!plotIsLive()) {
      createPlot();
      return;
    }

    if (hoveringRef.current) {
      pendingDataRef.current = udata;
      return;
    }

    try {
      plotRef.current.setData(udata, true);
      writeLegend(null);
    } catch {
      createPlot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, hasData]);

  // Theme / skin changes — rebuild with new resolved colors
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (!hasData) return;
      createPlot();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-skin'] });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sk, hasData, height, xKey]);

  // Resize — observe wrap (host may be width 0 until layout); recreate if needed
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el || !hasData) return undefined;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!plotIsLive()) {
          createPlot();
          return;
        }
        applyPlotSize();
      });
    });
    ro.observe(el);
    if (hostRef.current) ro.observe(hostRef.current);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, hasData, sk]);

  // Unmount: remove imperative nodes; clear header legend slot if we owned it
  useEffect(() => () => {
    destroyPlot();
    hostRef.current?.remove();
    hostRef.current = null;
    emptyRef.current?.remove();
    emptyRef.current = null;
    if (headerLegendRef.current) {
      headerLegendRef.current.innerHTML = '';
      headerLegendRef.current = null;
    }
  }, []);

  // One-shot clip reveal on first non-empty series — never again on live updates
  useEffect(() => {
    if (!reveal || !Motion.enabled || !hasData || hasRevealedRef.current) return undefined;
    hasRevealedRef.current = true;
    setRevealActive(true);
    const t = setTimeout(() => setRevealActive(false), DUR[5] + 40);
    return () => clearTimeout(t);
  }, [reveal, hasData]);

  const revealClass = revealActive ? 'ui-timeseries--reveal' : '';
  const legendClass = legendInHeader ? 'ui-timeseries--legend-header' : '';
  const legendReserve = legendInHeader ? 0 : (getSkin() === 'sass' ? 10 : 36);

  return html`
    <div
      ref=${wrapRef}
      class=${`ui-timeseries ${revealClass} ${legendClass}`.trim()}
      role="img"
      aria-label=${`Time series: ${series.map((s) => s.label).join(', ')}`}
      style=${{ minHeight: `${height + legendReserve}px` }}
    >
      ${!legendInHeader ? html`<div class="ui-timeseries__legend" ref=${legendRef}></div>` : null}
    </div>
  `;
}

export default TimeSeries;
