/** Canvas gauges and radars — theme-aware */
const Viz = {
  cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  },

  hexToRgba(hex, alpha) {
    hex = (hex || '#3b82f6').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  },

  barHtml(label, value, max, unit, warnAt, barId) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    const cls = warnAt != null && value >= warnAt ? 'bar-fill warn' : 'bar-fill';
    const display = typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : value;
    const idAttr = barId ? ` id="${barId}"` : '';
    return `
      <div class="metric-bar-wrap"${idAttr}>
        <div class="metric-bar-head"><span class="label-text">${label}</span><span class="metric-bar-val value-text">${display}${unit ? ` ${unit}` : ''}</span></div>
        <div class="metric-bar"><div class="${cls}" style="width:${pct}%"></div></div>
      </div>`;
  },

  drawTpsArc(canvasId, tps) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) / 2 - 8;
    const ok = this.cssVar('--status-green') || '#10b981';
    const warn = this.cssVar('--status-yellow') || '#fbbf24';
    const track = this.cssVar('--surface-border') || '#334155';
    const color = tps >= 19.5 ? ok : tps >= 18 ? warn : this.cssVar('--status-red') || '#f87171';
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 10;
    ctx.strokeStyle = track;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0.75 * Math.PI, 2.25 * Math.PI);
    ctx.stroke();
    const frac = Math.min(1, Math.max(0, tps / 20));
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0.75 * Math.PI, 0.75 * Math.PI + frac * 1.5 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = this.cssVar('--text-main') || '#fff';
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tps.toFixed(2), cx, cy - 4);
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = this.cssVar('--text-label') || '#94a3b8';
    ctx.fillText('TPS', cx, cy + 16);
  },

  drawDhRadar(canvasId, pct) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const isLight = document.documentElement.dataset.theme === 'light';
    const grid = isLight ? '#cbd5e1' : '#27272a';
    const bg = isLight ? '#f1f5f9' : '#09090b';
    const color = this.cssVar('--status-blue') || '#3b82f6';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    ctx.rect(cx - 20, cy - 20, 40, 40);
    ctx.rect(cx - 40, cy - 40, 80, 80);
    ctx.stroke();
    ctx.strokeStyle = '#4b5563';
    ctx.strokeRect(cx - 60, cy - 60, 120, 120);
    const px = 60 * (Math.min(100, pct) / 100);
    if (px > 0) {
      ctx.fillStyle = this.hexToRgba(color, isLight ? 0.25 : 0.15);
      ctx.fillRect(cx - px, cy - px, px * 2, px * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - px, cy - px, px * 2, px * 2);
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
  },

  drawChunkyRadar(canvasId, pct) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const isLight = document.documentElement.dataset.theme === 'light';
    const grid = isLight ? '#cbd5e1' : '#27272a';
    const bg = isLight ? '#f1f5f9' : '#09090b';
    const color = this.cssVar('--status-yellow') || '#ffc107';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    for (const rad of [20, 40]) {
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 60, 0, Math.PI * 2);
    ctx.stroke();
    const ratio = Math.min(1, pct / 100);
    const activeR = 60 * Math.sqrt(ratio);
    if (activeR > 0) {
      ctx.fillStyle = this.hexToRgba(color, isLight ? 0.25 : 0.15);
      ctx.beginPath();
      ctx.arc(cx, cy, activeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
  },

  drawThermalArc(canvasId, tempC, maxC) {
    this.drawTempDial(canvasId, tempC, { maxC: maxC || 100, label: 'CPU', warnAt: 70, critAt: 85, kind: 'cpu' });
  },

  tempDialColor(tempC, warnAt, critAt) {
    const ok = this.cssVar('--status-green') || '#10b981';
    const warn = this.cssVar('--status-yellow') || '#fbbf24';
    const crit = this.cssVar('--status-red') || '#f87171';
    if (tempC >= critAt) return crit;
    if (tempC >= warnAt) return warn;
    return ok;
  },

  drawTempDial(canvasId, tempC, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || tempC == null || Number.isNaN(tempC)) return;
    const {
      maxC = 100,
      label = 'CPU',
      warnAt = 70,
      critAt = 85,
      kind = 'cpu',
      readout = 'canvas',
    } = options;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const baseSize = 180;
    const wrap = canvas.closest('.wt-thermal-dial');
    const measured = wrap?.clientWidth > 0 ? Math.round(wrap.clientWidth) : baseSize;
    const size = Math.max(120, Math.min(baseSize, measured));
    const scale = size / baseSize;
    if (canvas.width !== size * dpr) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const w = size;
    const h = size;
    const cx = w / 2;
    const cy = h / 2 + 8 * scale;
    const r = 62 * scale;
    const start = 0.78 * Math.PI;
    const sweep = 1.44 * Math.PI;
    const end = start + sweep;
    const track = this.cssVar('--surface-border') || '#334155';
    const text = this.cssVar('--text-main') || '#fff';
    const muted = this.cssVar('--text-label') || '#94a3b8';
    const color = this.tempDialColor(tempC, warnAt, critAt);
    const frac = Math.min(1, Math.max(0, tempC / maxC));

    ctx.clearRect(0, 0, w, h);

    // tick marks
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = track;
    for (let i = 0; i <= 8; i += 1) {
      const t = start + (sweep * i) / 8;
      const inner = r - (i % 4 === 0 ? 10 : 6);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(t) * inner, cy + Math.sin(t) * inner);
      ctx.lineTo(cx + Math.cos(t) * (r + 4), cy + Math.sin(t) * (r + 4));
      ctx.stroke();
    }

    // track arc
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.strokeStyle = track;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, end);
    ctx.stroke();

    // glow arc
    ctx.save();
    ctx.shadowColor = this.hexToRgba(color, 0.55);
    ctx.shadowBlur = kind === 'ambient' ? 10 : 14;
    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    if (frac > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, start + sweep * frac);
      ctx.stroke();
    }
    ctx.restore();

    // value arc (crisp)
    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    if (frac > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, start + sweep * frac);
      ctx.stroke();
    }

    // needle dot
    if (frac > 0) {
      const nt = start + sweep * frac;
      const nx = cx + Math.cos(nt) * r;
      const ny = cy + Math.sin(nt) * r;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(nx, ny, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this.cssVar('--surface') || '#0a0a0a';
      ctx.beginPath();
      ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (readout !== 'html') {
      ctx.fillStyle = text;
      ctx.font = '800 34px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(tempC)}°`, cx, cy - 10);
      ctx.font = '600 11px Inter, sans-serif';
      ctx.fillStyle = muted;
      ctx.fillText(label, cx, cy + 18);
      ctx.font = '700 9px Inter, sans-serif';
      ctx.fillStyle = color;
      const band = tempC >= critAt ? 'HOT' : tempC >= warnAt ? 'WARM' : 'COOL';
      ctx.fillText(band, cx, cy + 32);
    }
  },

  refreshTempDials() {
    document.querySelectorAll('[data-viz-temp-dial]').forEach((el) => {
      const temp = parseFloat(el.dataset.temp || '0');
      const kind = el.dataset.kind || 'cpu';
      const readout = el.dataset.dialReadout === 'html' ? 'html' : 'canvas';
      if (kind === 'ambient') {
        this.drawTempDial(el.id, temp, { maxC: 55, label: 'Ambient', warnAt: 32, critAt: 40, kind: 'ambient', readout });
      } else {
        this.drawTempDial(el.id, temp, { maxC: 100, label: 'CPU', warnAt: 70, critAt: 85, kind: 'cpu', readout });
      }
    });
  },

  refreshAll() {
    document.querySelectorAll('[data-viz-tps]').forEach((el) => {
      this.drawTpsArc(el.id, parseFloat(el.dataset.value || '20'));
    });
    document.querySelectorAll('[data-viz-dh]').forEach((el) => {
      this.drawDhRadar(el.id, parseFloat(el.dataset.pct || '0'));
    });
    document.querySelectorAll('[data-viz-chunky]').forEach((el) => {
      this.drawChunkyRadar(el.id, parseFloat(el.dataset.pct || '0'));
    });
    document.querySelectorAll('[data-viz-thermal]').forEach((el) => {
      this.drawThermalArc(el.id, parseFloat(el.dataset.temp || '0'), 100);
    });
    this.refreshTempDials();
  },
};
