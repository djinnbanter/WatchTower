/** Metric charts — time-based sparklines, stable downsampling, crosshair, live dot */
const CHART_MINUTES_KEY = 'watchtower-chart-minutes';
const CHART_HOURS_KEY = 'watchtower-chart-hours';

const ChartWindow = {
  options: [
    { label: '1 min', value: 1 },
    { label: '10 min', value: 10 },
    { label: '30 min', value: 30 },
    { label: '1 hour', value: 60 },
    { label: '6 hours', value: 360 },
    { label: '12 hours', value: 720 },
    { label: '24 hours', value: 1440 },
    { label: '7 days', value: 10080 },
    { label: '30 days', value: 43200 },
    { label: '90 days', value: 129600 },
  ],

  maxMinutes(retentionHours = 2160) {
    return Math.max(1, (retentionHours || 2160) * 60);
  },

  get(retentionHours = 2160) {
    const maxMin = ChartWindow.maxMinutes(retentionHours);
    const savedMin = localStorage.getItem(CHART_MINUTES_KEY);
    if (savedMin != null) {
      const m = parseInt(savedMin, 10);
      if (Number.isFinite(m)) {
        return Math.min(Math.max(1, m), maxMin);
      }
    }
    const legacyHours = localStorage.getItem(CHART_HOURS_KEY);
    if (legacyHours != null) {
      const h = parseInt(legacyHours, 10);
      if (Number.isFinite(h)) {
        const migrated = h * 60;
        localStorage.setItem(CHART_MINUTES_KEY, String(migrated));
        localStorage.removeItem(CHART_HOURS_KEY);
        return Math.min(Math.max(1, migrated), maxMin);
      }
    }
    return Math.min(1440, maxMin);
  },

  set(minutes) {
    localStorage.setItem(CHART_MINUTES_KEY, String(minutes));
  },

  selectHtml(id, retentionHours = 2160) {
    const maxMin = ChartWindow.maxMinutes(retentionHours);
    const cur = ChartWindow.get(retentionHours);
    const opts = ChartWindow.options
      .filter((o) => o.value <= maxMin)
      .map((o) => `<option value="${o.value}"${o.value === cur ? ' selected' : ''}>${o.label}</option>`)
      .join('');
    return `<label class="chart-hours-wrap">${id ? `<span>${id}</span>` : 'Chart range'}
      <select id="chart-hours-select" aria-label="Chart time range">${opts}</select></label>`;
  },

  vitalsCompactOptions: [
    { label: '1 hour', value: 60 },
    { label: '6 hours', value: 360 },
    { label: '24 hours', value: 1440 },
  ],

  /** @deprecated use vitalsCompactOptions */
  get vitalsOptions() {
    return ChartWindow.vitalsCompactOptions;
  },

  snapToAllowed(minutes, rangeOptions, retentionHours = 2160) {
    const maxMin = ChartWindow.maxMinutes(retentionHours);
    const allowed = rangeOptions.map((o) => o.value).filter((v) => v <= maxMin);
    if (!allowed.length) return Math.min(1440, maxMin);
    const m = Math.min(Math.max(1, minutes), maxMin);
    if (allowed.includes(m)) return m;
    let best = allowed[0];
    for (const v of allowed) {
      if (Math.abs(v - m) < Math.abs(best - m)) best = v;
    }
    return best;
  },

  snapVitals(minutes, retentionHours = 2160) {
    return ChartWindow.snapToAllowed(minutes, ChartWindow.vitalsCompactOptions, retentionHours);
  },

  getVitals(retentionHours = 2160) {
    return ChartWindow.snapVitals(ChartWindow.get(retentionHours), retentionHours);
  },

  vitalsSelectHtml(label, retentionHours = 2160, { preset = 'compact' } = {}) {
    const maxMin = ChartWindow.maxMinutes(retentionHours);
    const rangeOptions = preset === 'full' ? ChartWindow.options : ChartWindow.vitalsCompactOptions;
    const cur = preset === 'full'
      ? ChartWindow.snapToAllowed(ChartWindow.get(retentionHours), rangeOptions, retentionHours)
      : ChartWindow.getVitals(retentionHours);
    const opts = rangeOptions
      .filter((o) => o.value <= maxMin)
      .map((o) => `<option value="${o.value}"${o.value === cur ? ' selected' : ''}>${o.label}</option>`)
      .join('');
    const presetAttr = preset === 'full' ? ' data-vitals-preset="full"' : '';
    return `<label class="chart-hours-wrap wt-vitals-range">${label ? `<span>${label}</span>` : 'Vitals range'}
      <select id="vitals-range-select"${presetAttr} aria-label="Vitals chart time range">${opts}</select></label>`;
  },
};

const ChartHours = ChartWindow;

/** Parse ISO timestamp to epoch ms; returns NaN on failure. */
function parseTimeMs(iso) {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : NaN;
}

/** Adaptive axis tick label for lookback window. */
function formatAxisTime(ms, windowMs) {
  try {
    const d = new Date(ms);
    if (windowMs <= 60 * 60 * 1000) {
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    if (windowMs <= 24 * 60 * 60 * 1000) {
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    if (windowMs <= 7 * 24 * 60 * 60 * 1000) {
      return d.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

/**
 * Stable time-bucket downsampling — bucket boundaries are absolute wall-clock time
 * so adding tail points does not reshape historical segments.
 */
function downsampleByTimeBuckets(points, windowStartMs, windowEndMs, maxPoints) {
  if (!points?.length) return [];
  if (points.length <= maxPoints) return points;
  const span = Math.max(1, windowEndMs - windowStartMs);
  const bucketWidth = span / maxPoints;
  const buckets = new Map();

  for (const p of points) {
    const ms = typeof p.t === 'number' ? p.t : parseTimeMs(p.t);
    if (!Number.isFinite(ms) || ms < windowStartMs || ms > windowEndMs) continue;
    const idx = Math.min(maxPoints - 1, Math.floor((ms - windowStartMs) / bucketWidth));
    buckets.set(idx, { ...p, t: typeof p.t === 'string' ? p.t : new Date(ms).toISOString() });
  }
  const out = [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  const last = points[points.length - 1];
  const lastMs = parseTimeMs(last.t);
  if (!out.length) return [last];
  if (parseTimeMs(out[out.length - 1].t) !== lastMs) out.push(last);
  return out;
}

function seriesMinMax(dataPoints) {
  let min = Infinity;
  let max = -Infinity;
  for (const p of dataPoints) {
    const v = p.y ?? p.v;
    if (typeof v !== 'number' || Number.isNaN(v)) continue;
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  if (!Number.isFinite(min)) return null;
  return { min, max };
}

/** Nearest chart index by horizontal pointer position (linear time x-axis). */
function nearestIndexByPixelX(chart, evt) {
  const xScale = chart.scales?.x;
  const data = chart.data.datasets[0]?.data;
  if (!xScale || !data?.length) return null;
  const rect = chart.canvas.getBoundingClientRect();
  const xPixel = evt.clientX - rect.left;
  const xValue = xScale.getValueForPixel(xPixel);
  if (!Number.isFinite(xValue)) return null;
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < data.length; i++) {
    const pt = data[i];
    if (pt == null || pt.x == null) continue;
    const dist = Math.abs(pt.x - xValue);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function chartDataPoint(chart, datasetIdx, index) {
  return chart.data.datasets[datasetIdx]?.data?.[index] ?? null;
}

function chartPointValue(chart, datasetIdx, index) {
  const raw = chartDataPoint(chart, datasetIdx, index);
  if (raw != null && typeof raw.y === 'number') return raw.y;
  const el = chart.getDatasetMeta(datasetIdx)?.data?.[index];
  return el?.parsed?.y ?? null;
}

function chartPointTimeMs(chart, datasetIdx, index) {
  const raw = chartDataPoint(chart, datasetIdx, index);
  if (raw?.tIso) return parseTimeMs(raw.tIso);
  if (typeof raw?.x === 'number') return raw.x;
  const el = chart.getDatasetMeta(datasetIdx)?.data?.[index];
  return el?.parsed?.x ?? NaN;
}

function healthDotColor(metric, value, colors) {
  if (typeof value !== 'number' || Number.isNaN(value)) return colors.accent;
  if (metric === 'tps') {
    if (value >= 19.5) return colors.green;
    if (value >= 15) return colors.yellow;
    return colors.red;
  }
  if (metric === 'mspt') {
    if (value <= 50) return colors.green;
    if (value <= 100) return colors.yellow;
    return colors.red;
  }
  if (metric === 'cpu' || metric === 'disk') {
    if (value <= 70) return colors.green;
    if (value <= 90) return colors.yellow;
    return colors.red;
  }
  return colors.accent;
}

const crosshairPlugin = {
  id: 'watchtowerCrosshair',
  afterDraw(chart) {
    if (chart.$staticChart || chart.$hoverIndex == null || chart.$hoverIndex < 0) return;
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const idx = chart.$hoverIndex;
    const meta0 = chart.getDatasetMeta(0);
    const pt = meta0?.data?.[idx];
    if (!pt) return;

    ctx.save();

    const colors = SparklineManager.colors();
    const lineColor = chart.data.datasets[0].borderColor || colors.accent;

    // Live charts: coloured vertical crosshair at the hovered time.
    if (chart.$rich) {
      ctx.strokeStyle = SparklineManager.hexAlpha(lineColor, 0.9);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(pt.x, chartArea.top);
      ctx.lineTo(pt.x, chartArea.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = SparklineManager.hexAlpha(colors.text, 0.22);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pt.x, chartArea.top);
      ctx.lineTo(pt.x, chartArea.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const drawDot = (point, color) => {
      if (!point) return;
      ctx.fillStyle = color;
      ctx.strokeStyle = SparklineManager.hexAlpha('#ffffff', 0.92);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, chart.$rich ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };

    drawDot(pt, chart.data.datasets[0].borderColor);
    if (chart.$dual) {
      const pt1 = chart.getDatasetMeta(1)?.data?.[idx];
      drawDot(pt1, chart.data.datasets[1].borderColor);
    }
    ctx.restore();
  },
};

const liveDotPlugin = {
  id: 'watchtowerLiveDot',
  afterDatasetsDraw(chart) {
    if (chart.$staticChart) return;
    const meta = chart.getDatasetMeta(0);
    const pts = meta?.data;
    if (!pts?.length) return;
    const last = pts[pts.length - 1];
    if (!last || last.skip) return;
    const { ctx } = chart;
    const color = chart.$liveDotColor || chart.data.datasets[0].borderColor || '#3b82f6';
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
};

const guidesPlugin = {
  id: 'watchtowerGuides',
  afterDraw(chart) {
    const guides = chart.$guides;
    if (!guides?.length) return;
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales?.y) return;
    ctx.save();
    for (const g of guides) {
      const y = scales.y.getPixelForValue(g.value);
      if (y < chartArea.top || y > chartArea.bottom) continue;
      ctx.strokeStyle = SparklineManager.hexAlpha(g.color, 0.4);
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  },
};

const markerPlugin = {
  id: 'watchtowerMarker',
  afterDraw(chart) {
    const markerMs = chart.$markerAtMs;
    if (!markerMs || !chart.scales?.x) return;
    const { ctx, chartArea } = chart;
    const x = chart.scales.x.getPixelForValue(markerMs);
    if (x < chartArea.left || x > chartArea.right) return;
    ctx.save();
    ctx.strokeStyle = SparklineManager.hexAlpha('#f59e0b', 0.85);
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  },
};

const hoverTooltipPlugin = {
  id: 'watchtowerHoverTooltip',
  afterDraw(chart) {
    if (!chart.$rich || chart.$staticChart || chart.$hoverIndex == null || chart.$hoverIndex < 0) return;
    const idx = chart.$hoverIndex;
    const meta = SparklineManager.meta[chart.canvas.id];
    if (!meta) return;
    const ptEl = chart.getDatasetMeta(0)?.data?.[idx];
    if (!ptEl) return;

    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const colors = SparklineManager.colors();
    const windowMs = chart.$windowMs || 3600000;
    const timeMs = chartPointTimeMs(chart, 0, idx);
    let when = '—';
    try {
      when = Number.isFinite(timeMs) ? formatAxisTime(timeMs, windowMs) : '—';
    } catch {
      when = '—';
    }

    const fmtVal = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : String(v ?? '—'));
    const rows = [];
    if (meta.dual) {
      const rxY = chartPointValue(chart, 0, idx);
      const txY = chartPointValue(chart, 1, idx);
      rows.push({
        label: meta.rxLabel || 'RX',
        value: `${fmtVal(rxY)} ${meta.rxUnit || ''}`.trim(),
        color: chart.data.datasets[0].borderColor,
      });
      rows.push({
        label: meta.txLabel || 'TX',
        value: `${fmtVal(txY)} ${meta.txUnit || ''}`.trim(),
        color: chart.data.datasets[1].borderColor,
      });
    } else {
      const yVal = chartPointValue(chart, 0, idx);
      rows.push({
        label: null,
        value: `${fmtVal(yVal)}${meta.unit ? ` ${meta.unit}` : ''}`,
        color: chart.data.datasets[0].borderColor,
      });
    }

    const padX = 10;
    const padY = 8;
    const rowH = 16;
    const titleH = 14;
    ctx.font = '600 11px ui-monospace, monospace';
    const titleW = ctx.measureText(when).width;
    ctx.font = '600 12px ui-monospace, monospace';
    let bodyW = 0;
    for (const row of rows) {
      const text = row.label ? `${row.label}: ${row.value}` : row.value;
      bodyW = Math.max(bodyW, ctx.measureText(text).width);
    }
    const boxW = Math.max(titleW, bodyW) + padX * 2;
    const boxH = padY * 2 + titleH + 4 + rows.length * rowH;

    let boxX = ptEl.x + 12;
    let boxY = ptEl.y - boxH - 10;
    if (boxX + boxW > chartArea.right) boxX = ptEl.x - boxW - 12;
    if (boxX < chartArea.left) boxX = chartArea.left + 4;
    if (boxY < chartArea.top) boxY = ptEl.y + 12;
    if (boxY + boxH > chartArea.bottom) boxY = Math.max(chartArea.top + 4, chartArea.bottom - boxH - 4);

    const surface = SparklineManager.cssVar('--wt-surface-1') || '#1a1a1a';
    const border = SparklineManager.cssVar('--wt-border') || '#333';

    ctx.save();
    ctx.fillStyle = SparklineManager.hexAlpha(surface, 0.96);
    ctx.strokeStyle = SparklineManager.hexAlpha(border, 0.9);
    ctx.lineWidth = 1;
    const r = 8;
    ctx.beginPath();
    ctx.moveTo(boxX + r, boxY);
    ctx.lineTo(boxX + boxW - r, boxY);
    ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + r);
    ctx.lineTo(boxX + boxW, boxY + boxH - r);
    ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH);
    ctx.lineTo(boxX + r, boxY + boxH);
    ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r);
    ctx.lineTo(boxX, boxY + r);
    ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colors.text;
    ctx.font = '600 11px ui-monospace, monospace';
    ctx.fillText(when, boxX + padX, boxY + padY + 10);

    let y = boxY + padY + titleH + 8;
    ctx.font = '600 12px ui-monospace, monospace';
    for (const row of rows) {
      if (row.label) {
        ctx.fillStyle = colors.text;
        ctx.fillText(`${row.label}:`, boxX + padX, y);
        const labelW = ctx.measureText(`${row.label}: `).width;
        ctx.fillStyle = row.color;
        ctx.fillText(row.value, boxX + padX + labelW, y);
      } else {
        ctx.fillStyle = row.color;
        ctx.fillText(row.value, boxX + padX, y);
      }
      y += rowH;
    }
    ctx.restore();
  },
};

const SparklineManager = {
  charts: {},
  meta: {},
  pendingRetry: {},
  lazyPending: {},
  lazyObserver: null,
  resizeObserver: null,
  themeObserver: null,
  coarsePointer: false,

  initLazyObserver() {
    if (this.lazyObserver || typeof IntersectionObserver === 'undefined') return;
    this.lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const canvas = entry.target.querySelector('canvas');
        const canvasId = canvas?.id;
        const pending = canvasId ? this.lazyPending[canvasId] : null;
        if (!pending) return;
        this.create(canvasId, pending.opts);
        delete this.lazyPending[canvasId];
        this.lazyObserver.unobserve(entry.target);
      });
    }, { rootMargin: '120px 0px' });
  },

  shouldLazyInit() {
    return !!document.querySelector('.wt-tab-mods, .wt-tab-spark, .wt-tab-performance, .wt-tab-insights');
  },

  initObservers() {
    if (this.resizeObserver) return;
    this.coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    let resizeTimer = null;
    this.resizeObserver = new ResizeObserver((entries) => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        for (const entry of entries) {
          const canvas = entry.target.querySelector('canvas');
          const chart = canvas?.id ? this.charts[canvas.id] : null;
          if (!chart) continue;
          const w = Math.round(entry.contentRect.width);
          if (w <= 0) continue;
          if (chart.$lastObservedWidth != null && Math.abs(chart.$lastObservedWidth - w) < 2) continue;
          chart.$lastObservedWidth = w;
          chart.resize();
        }
      }, 100);
    });
    document.querySelectorAll('.wt-chart-wrap, .sparkline-canvas-wrap').forEach((el) => {
      this.resizeObserver.observe(el);
    });
    if (!this.themeObserver) {
      this.themeObserver = new MutationObserver(() => this.refreshTheme());
      this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
  },

  observeWrap(canvasId) {
    const canvas = document.getElementById(canvasId);
    const wrap = canvas?.parentElement;
    if (wrap && this.resizeObserver) this.resizeObserver.observe(wrap);
  },

  cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  },

  colors() {
    return {
      text: this.cssVar('--wt-text-tertiary') || this.cssVar('--text-muted') || '#94a3b8',
      grid: this.cssVar('--wt-chart-grid') || this.cssVar('--chart-grid') || '#334155',
      accent: this.cssVar('--wt-info') || this.cssVar('--status-blue') || '#3b82f6',
      green: this.cssVar('--wt-healthy') || this.cssVar('--status-green') || '#22c55e',
      yellow: this.cssVar('--wt-warning') || this.cssVar('--status-yellow') || '#fbbf24',
      red: this.cssVar('--wt-danger') || this.cssVar('--status-red') || '#f87171',
    };
  },

  reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  maxChartPoints(canvasId) {
    const canvas = document.getElementById(canvasId);
    const wrap = canvas?.parentElement;
    const w = wrap?.clientWidth || canvas?.clientWidth || 320;
    return Math.min(500, Math.max(80, Math.floor(w / 2)));
  },

  makeGradient(chart, color) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return SparklineManager.hexAlpha(color, 0.12);
    const topAlpha = chart.$rich ? 0.28 : 0.18;
    const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    g.addColorStop(0, SparklineManager.hexAlpha(color, topAlpha));
    g.addColorStop(1, SparklineManager.hexAlpha(color, 0));
    return g;
  },

  formatReadout(iso, value, unit) {
    let when = '—';
    try {
      when = new Date(iso).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      when = iso || '—';
    }
    const v = typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(2)) : value;
    return `${when} — ${v}${unit ? ` ${unit}` : ''}`;
  },

  formatReadoutWithStats(iso, value, unit, stats) {
    const base = this.formatReadout(iso, value, unit);
    if (!stats || stats.min == null || stats.max == null) return base;
    const fmt = (n) => (Number.isInteger(n) ? n : n.toFixed(2));
    return `${base} · L: ${fmt(stats.min)} H: ${fmt(stats.max)}`;
  },

  setReadout(canvasId, text, pulse) {
    const el = document.getElementById(`${canvasId}-readout`);
    if (!el) return;
    el.textContent = text || '—';
    if (pulse && !this.reducedMotion()) {
      el.classList.remove('readout-pulse');
      void el.offsetWidth;
      el.classList.add('readout-pulse');
    }
  },

  setLoading(canvasId, loading) {
    const canvas = document.getElementById(canvasId);
    const wrap = canvas?.parentElement;
    if (wrap) wrap.classList.toggle('is-loading', !!loading);
  },

  guidesForMetric(metricKey, yMax, heapMax) {
    const colors = this.colors();
    if (metricKey === 'tps') return [{ value: 20, color: colors.green }];
    if (metricKey === 'mspt') return [{ value: 50, color: colors.yellow }];
    if (metricKey === 'heap_mb' && heapMax) return [{ value: heapMax * 0.8, color: colors.yellow }];
    return [];
  },

  isRichChart(canvasId) {
    return typeof canvasId === 'string' && canvasId.startsWith('lv-');
  },

  chartGridColor(colors, axis = 'y') {
    const alpha = axis === 'y' ? 0.38 : 0.28;
    return SparklineManager.hexAlpha(colors.grid, alpha);
  },

  baseOptions(colors, yConfig, windowMs, { rich = false } = {}) {
    const yScale = rich
      ? {
        display: true,
        position: 'right',
        grid: {
          display: true,
          color: this.chartGridColor(colors, 'y'),
          drawBorder: false,
          tickLength: 0,
        },
        ticks: {
          display: true,
          color: colors.text,
          maxTicksLimit: 5,
          padding: 6,
          font: { size: 11, family: 'ui-monospace, monospace' },
          callback: (value) => {
            const n = Number(value);
            if (!Number.isFinite(n)) return value;
            if (Number.isInteger(n)) return String(n);
            return n.toFixed(1);
          },
        },
        border: { display: false },
      }
      : { display: false };
    if (yConfig?.min != null) yScale.min = yConfig.min;
    if (yConfig?.max != null) yScale.max = yConfig.max;
    if (yConfig?.grace != null) yScale.grace = yConfig.grace;

    const xScale = rich
      ? {
        type: 'linear',
        display: true,
        grid: {
          display: true,
          color: this.chartGridColor(colors, 'x'),
          drawBorder: false,
          tickLength: 0,
        },
        ticks: {
          display: true,
          color: colors.text,
          maxTicksLimit: 4,
          maxRotation: 0,
          autoSkip: true,
          padding: 6,
          font: { size: 11, family: 'system-ui, sans-serif' },
          callback: (value) => formatAxisTime(value, windowMs),
        },
        border: { display: false },
      }
      : {
        type: 'linear',
        display: false,
        grid: { display: false },
        ticks: { display: false },
      };

    return {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      animation: false,
      parsing: false,
      layout: {
        padding: rich
          ? { top: 10, bottom: 2, left: 4, right: 2 }
          : { top: 10, bottom: 0, left: 0, right: 0 },
      },
      interaction: {
        mode: 'nearest',
        intersect: false,
        axis: 'x',
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        watchtowerCrosshair: {},
        watchtowerLiveDot: {},
        watchtowerGuides: {},
        watchtowerHoverTooltip: {},
      },
      scales: {
        x: xScale,
        y: yScale,
      },
      elements: {
        point: {
          radius: 0,
          hoverRadius: rich ? 0 : 4,
          hitRadius: this.coarsePointer ? 24 : 16,
        },
        line: {
          borderWidth: rich ? 2.5 : 2.5,
          tension: rich ? 0.22 : 0.15,
          borderCapStyle: 'round',
          spanGaps: true,
        },
      },
    };
  },

  formatDualReadout(meta, iso, rx, tx) {
    const fmt = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(2)) : v);
    const rxLbl = meta.rxLabel || 'RX';
    const txLbl = meta.txLabel || 'TX';
    if (meta.pairedReadout) {
      return `${this.formatReadout(iso, rx, meta.rxUnit)} · ${fmt(tx)} ${meta.txUnit}`;
    }
    if (rxLbl !== 'RX' || txLbl !== 'TX') {
      let when = '—';
      try {
        when = new Date(iso).toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      } catch {
        when = iso || '—';
      }
      return `${when} — ${rxLbl} ${fmt(rx)} ${meta.rxUnit || ''} · ${txLbl} ${fmt(tx)} ${meta.txUnit || ''}`;
    }
    return `${this.formatReadout(iso, rx, meta.rxUnit)} · ↑ ${fmt(tx)} ${meta.txUnit}`;
  },

  redrawHover(chart) {
    if (!chart || chart.$hoverRaf) return;
    chart.$hoverRaf = requestAnimationFrame(() => {
      chart.$hoverRaf = null;
      chart.draw();
    });
  },

  bindPointer(chart) {
    const canvas = chart.canvas;
    if (!canvas || canvas.dataset.pointerBound === '1') return;
    canvas.dataset.pointerBound = '1';
    const updateHover = (evt) => {
      const idx = nearestIndexByPixelX(chart, evt);
      chart.$hoverIndex = idx;
      this.redrawHover(chart);
      const meta = SparklineManager.meta[chart.canvas.id];
      if (!meta) return;
      if (idx != null && idx >= 0) {
        if (meta.dual) {
          const rxPt = chart.data.datasets[0].data[idx];
          const txPt = chart.data.datasets[1].data[idx];
          const iso = rxPt?.tIso || new Date(rxPt?.x).toISOString();
          SparklineManager.setReadout(
            chart.canvas.id,
            SparklineManager.formatDualReadout(meta, iso, rxPt?.y, txPt?.y),
          );
        } else {
          const pt = chart.data.datasets[0].data[idx];
          const iso = pt?.tIso || new Date(pt?.x).toISOString();
          SparklineManager.setReadout(chart.canvas.id, SparklineManager.formatReadout(iso, pt?.y, meta.unit));
        }
      } else if (meta.dual && meta.lastIso != null) {
        SparklineManager.setReadout(
          chart.canvas.id,
          SparklineManager.formatDualReadout(meta, meta.lastIso, meta.lastRx, meta.lastTx),
        );
      } else if (meta.lastIso != null) {
        SparklineManager.setReadout(
          chart.canvas.id,
          SparklineManager.formatReadoutWithStats(meta.lastIso, meta.lastVal, meta.unit, meta.stats),
        );
      }
    };
    canvas.addEventListener('pointermove', updateHover);
    canvas.addEventListener('pointerdown', updateHover);
    canvas.addEventListener('pointerleave', () => {
      chart.$hoverIndex = null;
      this.redrawHover(chart);
      const meta = SparklineManager.meta[chart.canvas.id];
      if (meta?.dual && meta.lastIso != null) {
        SparklineManager.setReadout(
          chart.canvas.id,
          SparklineManager.formatDualReadout(meta, meta.lastIso, meta.lastRx, meta.lastTx),
        );
      } else if (meta?.lastIso != null) {
        SparklineManager.setReadout(
          chart.canvas.id,
          SparklineManager.formatReadoutWithStats(meta.lastIso, meta.lastVal, meta.unit, meta.stats),
        );
      }
    });
  },

  create(canvasId, { color, yMax = 100, yMin = 0, yGrace, fill = true, unit = '', metricKey, staticChart = false, windowMinutes = 60 } = {}) {
    if (!window.Chart) {
      this.setReadout(canvasId, 'Chart library failed to load');
      return null;
    }
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    this.destroy(canvasId);
    this.initObservers();
    const colors = this.colors();
    const lineColor = color || colors.accent;
    const windowMs = windowMinutes * 60 * 1000;
    const rich = this.isRichChart(canvasId);
    const yConfig = { min: yMin };
    if (yGrace != null) yConfig.grace = yGrace;
    else if (yMax != null) yConfig.max = yMax;

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          data: [],
          borderColor: lineColor,
          backgroundColor: 'transparent',
          fill,
          showLine: true,
          clip: false,
        }],
      },
      options: {
        ...this.baseOptions(colors, yConfig, windowMs, { rich }),
      },
      plugins: [crosshairPlugin, liveDotPlugin, guidesPlugin, markerPlugin, hoverTooltipPlugin],
    });
    chart.$hoverIndex = null;
    chart.$staticChart = staticChart;
    chart.$rich = rich;
    chart.$windowMs = windowMs;
    const wrap = canvas.parentElement;
    if (wrap?.classList.contains('chart-wrap') && !this.reducedMotion()) {
      wrap.classList.remove('chart-wrap--ready');
      requestAnimationFrame(() => wrap.classList.add('chart-wrap--ready'));
    }
    chart.$windowMinutes = windowMinutes;
    chart.$metricKey = metricKey;
    chart.$lineColor = lineColor;
    chart.$guides = staticChart ? [] : this.guidesForMetric(metricKey, yMax, yMax);
    this.charts[canvasId] = chart;
    this.meta[canvasId] = { unit, lastIso: null, lastVal: null, stats: null, metricKey, yMax };
    delete this.pendingRetry[canvasId];
    this.bindPointer(chart);
    this.observeWrap(canvasId);
    return chart;
  },

  hexAlpha(hex, alpha) {
    hex = (hex || '#3b82f6').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  },

  pointsToXY(points, windowStartMs, windowEndMs, maxPts) {
    const normalized = (points || [])
      .map((p) => {
        const ms = parseTimeMs(p.t);
        return Number.isFinite(ms) ? { t: p.t, v: p.v, ms } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.ms - b.ms);
    const ds = downsampleByTimeBuckets(
      normalized.map((p) => ({ t: p.t, v: p.v })),
      windowStartMs,
      windowEndMs,
      maxPts,
    );
    return ds.map((p) => {
      const ms = parseTimeMs(p.t);
      return { x: ms, y: p.v, tIso: typeof p.t === 'string' ? p.t : new Date(ms).toISOString() };
    });
  },

  update(canvasId, points, { yMax, yMin, yGrace, color, unit, pulseReadout, windowMinutes, metricKey, markerAt } = {}) {
    const chart = this.charts[canvasId];
    if (!chart) return;
    const meta = this.meta[canvasId] || { unit: '' };
    if (unit != null) meta.unit = unit;
    if (metricKey != null) meta.metricKey = metricKey;
    if (windowMinutes != null) chart.$windowMinutes = windowMinutes;
    if (markerAt != null) {
      const ms = parseTimeMs(markerAt);
      chart.$markerAtMs = Number.isFinite(ms) ? ms : null;
    }

    const winMin = chart.$windowMinutes || windowMinutes || ChartWindow.get();
    const windowMs = winMin * 60 * 1000;
    const windowEndMs = Date.now();
    const windowStartMs = windowEndMs - windowMs;

    chart.options.scales.x.min = windowStartMs;
    chart.options.scales.x.max = windowEndMs;

    if (!points?.length) {
      chart.data.datasets[0].data = [];
      this.setReadout(canvasId, 'No data in this range');
      this.setLoading(canvasId, false);
      chart.update('none');
      return;
    }

    if (points.length < 2) {
      this.setReadout(canvasId, 'Collecting samples…');
    }

    const maxPts = this.maxChartPoints(canvasId);
    const xy = this.pointsToXY(points, windowStartMs, windowEndMs, maxPts);
    const lineColor = color || chart.$lineColor || this.colors().accent;
    chart.data.datasets[0].data = xy;
    chart.data.datasets[0].borderColor = lineColor;
    chart.data.datasets[0].backgroundColor = chart.data.datasets[0].fill
      ? this.makeGradient(chart, lineColor)
      : 'transparent';

    const yScale = chart.options.scales.y;
    if (yGrace != null) {
      yScale.grace = yGrace;
      delete yScale.max;
      delete yScale.min;
    } else {
      if (yMin != null) yScale.min = yMin;
      if (yMax != null) {
        yScale.max = yMax;
        meta.yMax = yMax;
        chart.$guides = this.guidesForMetric(meta.metricKey, yMax, yMax);
      }
    }

    const stats = seriesMinMax(xy);
    meta.stats = stats;
    const last = points[points.length - 1];
    meta.lastIso = last.t;
    meta.lastVal = last.v;
    chart.$liveDotColor = healthDotColor(meta.metricKey, last.v, this.colors());
    this.meta[canvasId] = meta;
    this.setReadout(
      canvasId,
      this.formatReadoutWithStats(last.t, last.v, meta.unit, stats),
      pulseReadout,
    );
    this.setLoading(canvasId, false);
    if (chart.canvas.parentElement?.clientWidth > 0) chart.resize();
    chart.update('none');
  },

  updateFromApiSeries(canvasId, seriesArr, opts) {
    const points = (seriesArr || []).map((p) => ({ t: p.t, v: p.v }));
    this.update(canvasId, points, opts);
  },

  ensure(canvasId, opts) {
    if (!this.charts[canvasId]) {
      const canvas = document.getElementById(canvasId);
      const wrap = canvas?.closest('.wt-chart-wrap');
      if (wrap && this.shouldLazyInit() && !wrap.dataset.chartReady) {
        this.lazyPending[canvasId] = { opts };
        this.initLazyObserver();
        this.lazyObserver.observe(wrap);
        this.setReadout(canvasId, 'Scroll into view to load chart');
        return null;
      }
      const chart = this.create(canvasId, opts);
      if (wrap) wrap.dataset.chartReady = '1';
      if (!chart && !this.pendingRetry[canvasId]) {
        this.pendingRetry[canvasId] = true;
        this.setReadout(canvasId, 'Chart library failed to load');
        requestAnimationFrame(() => {
          delete this.pendingRetry[canvasId];
          if (!this.charts[canvasId] && document.getElementById(canvasId)) {
            this.create(canvasId, opts);
          }
        });
      }
    } else if (opts) {
      const m = this.meta[canvasId] || {};
      if (opts.unit != null) m.unit = opts.unit;
      if (opts.metricKey != null) m.metricKey = opts.metricKey;
      if (opts.windowMinutes != null) this.charts[canvasId].$windowMinutes = opts.windowMinutes;
      this.meta[canvasId] = m;
    }
    return this.charts[canvasId];
  },

  destroy(canvasId) {
    const c = this.charts[canvasId];
    if (c) {
      c.destroy();
      delete this.charts[canvasId];
    }
    delete this.meta[canvasId];
    delete this.pendingRetry[canvasId];
  },

  ensureDual(canvasId, {
    rxColor,
    txColor,
    yMax = 100,
    yGrace,
    rxUnit = 'Mbps',
    txUnit = 'Mbps',
    rxLabel = 'RX',
    txLabel = 'TX',
    pairedReadout = false,
    windowMinutes = 60,
  } = {}) {
    if (!window.Chart) return null;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const colors = this.colors();
    const rx = rxColor || colors.green;
    const tx = txColor || colors.accent;
    if (!this.charts[canvasId]) {
      this.initObservers();
      const windowMs = windowMinutes * 60 * 1000;
      const rich = this.isRichChart(canvasId);
      const yConfig = yGrace != null ? { grace: yGrace } : { min: 0, max: yMax };
      const ctx = canvas.getContext('2d');
      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          datasets: [
            { label: rxLabel, data: [], borderColor: rx, backgroundColor: 'transparent', fill: true },
            { label: txLabel, data: [], borderColor: tx, backgroundColor: 'transparent', fill: true },
          ],
        },
        options: {
          ...this.baseOptions(colors, yConfig, windowMs, { rich }),
          plugins: {
            ...this.baseOptions(colors, yConfig, windowMs, { rich }).plugins,
            legend: {
              display: rich,
              position: 'top',
              align: 'end',
              labels: {
                color: colors.text,
                boxWidth: 8,
                boxHeight: 8,
                usePointStyle: true,
                pointStyle: 'circle',
                padding: 12,
                font: { size: 11, weight: '600' },
              },
            },
          },
        },
        plugins: [crosshairPlugin, liveDotPlugin, hoverTooltipPlugin],
      });
      chart.$hoverIndex = null;
      chart.$windowMinutes = windowMinutes;
      chart.$windowMs = windowMs;
      chart.$rich = rich;
      chart.$dual = true;
      this.charts[canvasId] = chart;
      this.meta[canvasId] = {
        dual: true,
        rxUnit,
        txUnit,
        rxLabel,
        txLabel,
        pairedReadout,
        lastIso: null,
        lastRx: null,
        lastTx: null,
      };
      this.bindPointer(chart);
      this.observeWrap(canvasId);
      const wrap = canvas.parentElement;
      if (wrap?.classList.contains('chart-wrap') && !this.reducedMotion()) {
        wrap.classList.remove('chart-wrap--ready');
        requestAnimationFrame(() => wrap.classList.add('chart-wrap--ready'));
      }
    } else {
      const chart = this.charts[canvasId];
      chart.data.datasets[0].label = rxLabel;
      chart.data.datasets[1].label = txLabel;
      const meta = this.meta[canvasId] || {};
      meta.rxUnit = rxUnit;
      meta.txUnit = txUnit;
      meta.rxLabel = rxLabel;
      meta.txLabel = txLabel;
      meta.pairedReadout = pairedReadout;
      this.meta[canvasId] = meta;
    }
    return this.charts[canvasId];
  },

  updateDual(canvasId, points, { yMax, yGrace, pulseReadout, windowMinutes } = {}) {
    const chart = this.charts[canvasId];
    if (!chart || !points?.length) return;
    const meta = this.meta[canvasId] || { rxUnit: 'Mbps', txUnit: 'Mbps' };
    const winMin = windowMinutes || chart.$windowMinutes || ChartWindow.get();
    const windowMs = winMin * 60 * 1000;
    const windowEndMs = Date.now();
    const windowStartMs = windowEndMs - windowMs;
    chart.options.scales.x.min = windowStartMs;
    chart.options.scales.x.max = windowEndMs;

    const maxPts = this.maxChartPoints(canvasId);
    const ds = downsampleByTimeBuckets(
      points.map((p) => ({ t: p.t, v: p.rx })),
      windowStartMs,
      windowEndMs,
      maxPts,
    );
    const rxData = ds.map((p) => {
      const ms = parseTimeMs(p.t);
      const orig = points.find((x) => parseTimeMs(x.t) === ms) || p;
      return { x: ms, y: orig.rx ?? p.v, tIso: p.t };
    });
    const txData = ds.map((p) => {
      const ms = parseTimeMs(p.t);
      const orig = points.find((x) => parseTimeMs(x.t) === ms) || p;
      return { x: ms, y: orig.tx ?? 0, tIso: p.t };
    });
    chart.data.datasets[0].data = rxData;
    chart.data.datasets[1].data = txData;
    const colors = this.colors();
    chart.data.datasets[0].backgroundColor = this.makeGradient(chart, colors.green);
    chart.data.datasets[1].backgroundColor = this.makeGradient(chart, colors.accent);

    if (yGrace != null) {
      chart.options.scales.y.grace = yGrace;
      delete chart.options.scales.y.max;
    } else if (yMax != null) {
      chart.options.scales.y.max = yMax;
    }

    const last = points[points.length - 1];
    meta.lastIso = last.t;
    meta.lastRx = last.rx;
    meta.lastTx = last.tx;
    this.meta[canvasId] = meta;
    this.setReadout(canvasId, this.formatDualReadout(meta, last.t, last.rx, last.tx), pulseReadout);
    this.setLoading(canvasId, false);
    if (chart.canvas.parentElement?.clientWidth > 0) chart.resize();
    chart.update('none');
  },

  refreshTheme() {
    const colors = this.colors();
    for (const [id, chart] of Object.entries(this.charts)) {
      if (chart.options.scales.x?.grid) {
        chart.options.scales.x.grid.color = this.chartGridColor(colors, 'x');
      }
      if (chart.options.scales.x?.ticks) chart.options.scales.x.ticks.color = colors.text;
      if (chart.options.scales.y?.grid) {
        chart.options.scales.y.grid.color = this.chartGridColor(colors, 'y');
      }
      if (chart.options.scales.y?.ticks) chart.options.scales.y.ticks.color = colors.text;
      if (chart.$dual) {
        chart.data.datasets.forEach((ds) => {
          if (ds.fill) ds.backgroundColor = this.makeGradient(chart, ds.borderColor);
        });
      } else {
        const lineColor = chart.$lineColor || colors.accent;
        chart.data.datasets.forEach((ds) => {
          ds.borderColor = lineColor;
          if (ds.fill) ds.backgroundColor = this.makeGradient(chart, lineColor);
        });
      }
      chart.update('none');
    }
  },

  destroyAll() {
    Object.keys(this.charts).forEach((id) => this.destroy(id));
  },

  destroyExcept(keepIds) {
    const keep = new Set(keepIds || []);
    Object.keys(this.charts).forEach((id) => {
      if (!keep.has(id)) this.destroy(id);
    });
  },

  chartIdsForTab(tab) {
    if (tab === 'overview') {
      return ['ov-tps-chart', 'ov-cpu-chart', 'ov-mem-chart', 'ov-players-chart'];
    }
    if (tab === 'live') {
      return ['lv-tps', 'lv-mspt', 'lv-heap', 'lv-players', 'lv-cpu', 'lv-mem', 'lv-bandwidth'];
    }
    return [];
  },

  resizeTab(tab) {
    this.chartIdsForTab(tab).forEach((id) => {
      const chart = this.charts[id];
      if (!chart) return;
      if (chart.canvas.parentElement?.clientWidth > 0) chart.resize();
      chart.update('none');
    });
  },

  bindHoursSelect(onChange) {
    const sel = document.getElementById('chart-hours-select');
    if (!sel || sel.dataset.bound === '1') return;
    sel.dataset.bound = '1';
    sel.addEventListener('change', () => {
      ChartWindow.set(parseInt(sel.value, 10));
      if (onChange) onChange();
    });
  },

  bindVitalsSelect(onChange) {
    const sel = document.getElementById('vitals-range-select');
    if (!sel || sel.dataset.bound === '1') return;
    sel.dataset.bound = '1';
    sel.addEventListener('change', () => {
      const minutes = parseInt(sel.value, 10);
      ChartWindow.set(minutes);
      const label = ChartWindow.options.find((o) => o.value === minutes)?.label || `${minutes} min`;
      document.querySelectorAll('#vitals-range-select').forEach((other) => {
        if (other === sel) return;
        if (![...other.options].some((o) => o.value === String(minutes))) {
          other.add(new Option(label, String(minutes)));
        }
        other.value = String(minutes);
      });
      if (onChange) onChange();
    });
  },
};

window.SparklineManager = SparklineManager;
window.ChartWindow = ChartWindow;
window.downsampleByTimeBuckets = downsampleByTimeBuckets;
window.parseChartTimeMs = parseTimeMs;

function apiSeriesToPoints(key, samples) {
  return (samples[key] || []).map((p) => ({ t: p.t, v: p.v }));
}
