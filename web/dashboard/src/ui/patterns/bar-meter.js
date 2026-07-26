import { html, useState, useRef, useEffect, useLayoutEffect, render } from '../../lib/preact.js';
import { Motion } from '../../motion/reduced.js';

/**
 * BarMeter — horizontal fill bar with optional label/value.
 * Grows from 0 on first paint, then CSS-transitions on updates.
 * BarMeter({ value, max=100, label, valueLabel, tone, compact })
 */
export function BarMeter({
  value = 0,
  max = 100,
  label,
  valueLabel,
  tone,
  compact = false,
  className = '',
}) {
  const target = max > 0 ? Math.min(100, Math.max(0, (Number(value) / max) * 100)) : 0;
  const [pct, setPct] = useState(() => (Motion.enabled ? 0 : target));
  const grewRef = useRef(false);

  useEffect(() => {
    if (!Motion.enabled) {
      setPct(target);
      return undefined;
    }
    if (!grewRef.current) {
      grewRef.current = true;
      setPct(0);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setPct(target));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setPct(target);
    return undefined;
  }, [target]);

  const cls = [
    'ui-bar-meter',
    compact ? 'ui-bar-meter--compact' : '',
    tone ? `ui-bar-meter--${tone}` : '',
    className,
  ].filter(Boolean).join(' ');

  return html`
    <div class=${cls}>
      ${(label || valueLabel != null) && html`
        <div class="ui-bar-meter__meta">
          ${label && html`<span class="ui-bar-meter__label">${label}</span>`}
          ${valueLabel != null && html`<span class="ui-bar-meter__value">${valueLabel}</span>`}
        </div>
      `}
      <div class="ui-bar-meter__track" role="progressbar" aria-valuenow=${Math.round(pct)} aria-valuemin=${0} aria-valuemax=${100}>
        <div class="ui-bar-meter__fill" style=${{ width: `${pct}%` }}></div>
      </div>
    </div>
  `;
}

function padHour(h) {
  return String(h).padStart(2, '0');
}

function hourRangeLabel(h) {
  const next = (h + 1) % 24;
  return `${padHour(h)}:00–${padHour(next)}:00 UTC`;
}

const TIP_EDGE = 8;
const TIP_GAP = 14;

function clampAboveCursor(clientX, clientY, tipW, tipH) {
  let left = clientX - tipW / 2;
  let top = clientY - tipH - TIP_GAP;
  if (top < TIP_EDGE) top = clientY + TIP_GAP;
  left = Math.max(TIP_EDGE, Math.min(left, window.innerWidth - tipW - TIP_EDGE));
  top = Math.max(TIP_EDGE, Math.min(top, window.innerHeight - tipH - TIP_EDGE));
  return { left, top };
}

/**
 * HourBars — 24 vertical bars (UTC hour → metric) with hover tip + live readout.
 * Tip is portaled to a body float layer and placed above the cursor.
 * Bars grow from 0 on first paint.
 */
export function HourBars({
  hours = [],
  max,
  format,
  tone = 'accent',
  title,
  metricLabel,
  samples,
  players,
  className = '',
}) {
  const [hover, setHover] = useState(null);
  const [grown, setGrown] = useState(!Motion.enabled);
  const cursorRef = useRef(null);
  const hostRef = useRef(null);
  const tipRef = useRef(null);
  const dataRef = useRef({ hours, format, metricLabel, samples, players });
  dataRef.current = { hours, format, metricLabel, samples, players };

  const vals = Array.from({ length: 24 }, (_, i) => {
    const v = hours[i];
    return v == null || Number.isNaN(Number(v)) ? null : Number(v);
  });
  const dataMax = max ?? Math.max(...vals.filter((v) => v != null), 0.001);

  useEffect(() => {
    if (!Motion.enabled || grown) return undefined;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setGrown(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [grown]);

  const active = hover;
  const activeVal = active != null ? vals[active] : null;
  const activeSamples = active != null && samples ? samples[active] : null;
  const activePlayers = active != null && players ? players[active] : null;

  function formatValue(v, fmt) {
    if (v == null) return '—';
    return fmt ? fmt(v) : String(v);
  }

  function tipVnode(i) {
    const d = dataRef.current;
    const raw = d.hours[i];
    const v = raw == null || Number.isNaN(Number(raw)) ? null : Number(raw);
    const rows = [];
    rows.push(html`<div key="h" class="ui-float-tip__title">${hourRangeLabel(i)}</div>`);
    if (v == null) {
      rows.push(html`<div key="e" class="ui-float-tip__muted">No samples</div>`);
    } else {
      rows.push(html`
        <div key="v" class="ui-float-tip__row">
          <span>${d.metricLabel || 'Value'}</span>
          <strong>${formatValue(v, d.format)}</strong>
        </div>
      `);
      if (d.players && d.players[i] != null) {
        rows.push(html`
          <div key="p" class="ui-float-tip__row">
            <span>Avg players</span>
            <strong>${Number(d.players[i]).toFixed(1)}</strong>
          </div>
        `);
      }
      if (d.samples && d.samples[i] != null) {
        rows.push(html`
          <div key="s" class="ui-float-tip__row">
            <span>Samples</span>
            <strong>${Math.round(d.samples[i])} min</strong>
          </div>
        `);
      }
    }
    return html`<div class="ui-float-tip" role="tooltip">${rows}</div>`;
  }

  function placeTip() {
    const tipEl = tipRef.current;
    const cur = cursorRef.current;
    if (!tipEl || !cur) return;
    tipEl.style.visibility = 'hidden';
    tipEl.style.left = '0px';
    tipEl.style.top = '0px';
    const tipW = Math.max(tipEl.offsetWidth, 120);
    const tipH = Math.max(tipEl.offsetHeight, 40);
    const { left, top } = clampAboveCursor(cur.x, cur.y, tipW, tipH);
    tipEl.style.left = `${left}px`;
    tipEl.style.top = `${top}px`;
    tipEl.style.visibility = 'visible';
  }

  useEffect(() => {
    const host = document.createElement('div');
    host.className = 'ui-float-layer';
    document.body.appendChild(host);
    hostRef.current = host;
    return () => {
      try { render(null, host); } catch { /* ignore */ }
      host.remove();
      hostRef.current = null;
      tipRef.current = null;
    };
  }, []);

  // Mount / update tip content only when the hovered hour changes
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    if (active == null) {
      render(null, host);
      tipRef.current = null;
      return undefined;
    }

    render(tipVnode(active), host);
    tipRef.current = host.firstElementChild;
    placeTip();
    return undefined;
  }, [active]);

  function trackPointer(i, e) {
    cursorRef.current = { x: e.clientX, y: e.clientY };
    setHover(i);
    if (tipRef.current) placeTip();
  }

  function clearHover() {
    cursorRef.current = null;
    setHover(null);
  }

  return html`
    <div class=${`ui-hour-bars ${className}`.trim()}>
      <div class="ui-hour-bars__head">
        ${title && html`<div class="ui-hour-bars__title">${title}</div>`}
        <div class="ui-hour-bars__readout" aria-live="polite">
          ${active == null
            ? html`<span class="ui-hour-bars__readout-hint">Hover a bar</span>`
            : activeVal == null
              ? html`<span>${padHour(active)}:00 · no data</span>`
              : html`
                  <span class="ui-hour-bars__readout-hour">${padHour(active)}:00</span>
                  <span class="ui-hour-bars__readout-value">${formatValue(activeVal, format)}</span>
                  ${activePlayers != null
                    ? html`<span class="ui-hour-bars__readout-meta">${Number(activePlayers).toFixed(1)} pl</span>`
                    : null}
                  ${activeSamples != null
                    ? html`<span class="ui-hour-bars__readout-meta">${Math.round(activeSamples)} min</span>`
                    : null}
                `}
        </div>
      </div>
      <div
        class="ui-hour-bars__plot"
        role="list"
        aria-label=${title || 'Hourly bars'}
        onMouseLeave=${clearHover}
      >
        ${vals.map((v, i) => {
          const h = !grown || v == null ? 0 : Math.max(4, (v / dataMax) * 100);
          const selected = active === i;
          return html`
            <button
              key=${i}
              type="button"
              class=${`ui-hour-bars__col${selected ? ' ui-hour-bars__col--active' : ''}${v == null ? ' ui-hour-bars__col--empty' : ''}`}
              role="listitem"
              aria-label=${v == null
                ? `${hourRangeLabel(i)}, no data`
                : `${hourRangeLabel(i)}, ${metricLabel || 'value'} ${formatValue(v, format)}`}
              onMouseEnter=${(e) => trackPointer(i, e)}
              onMouseMove=${(e) => trackPointer(i, e)}
              onFocus=${(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                cursorRef.current = { x: rect.left + rect.width / 2, y: rect.top };
                setHover(i);
              }}
              onBlur=${() => setHover((cur) => (cur === i ? null : cur))}
            >
              <div
                class=${`ui-hour-bars__bar ui-hour-bars__bar--${tone}${v == null ? ' ui-hour-bars__bar--empty' : ''}${selected ? ' ui-hour-bars__bar--active' : ''}`}
                style=${{ height: `${h}%` }}
              ></div>
            </button>
          `;
        })}
      </div>
      <div class="ui-hour-bars__axis">
        <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
      </div>
    </div>
  `;
}

export default BarMeter;
