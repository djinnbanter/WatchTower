import { html, useMemo, useRef } from '../../lib/preact.js';
import { useCountUp } from '../../motion/use-count-up.js';
import { DUR } from '../../motion/tokens.js';

let _gaugeUid = 0;

/**
 * Gauge — SVG arc dial for temperatures or 0–100 progress.
 * Gauge({ value, max=100, label, band, warnAt, critAt, size=120, unit='°', tone, className, hero, labelPlacement })
 * band: 'cool'|'warm'|'hot'|null — overrides auto band from warn/crit
 * hero: larger glow + gradient stroke + glass halo (Live thermal dials)
 * labelPlacement: 'inside' (default) | 'above' — title above dial, number only in center
 */
export function Gauge({
  value,
  max = 100,
  label,
  band,
  warnAt = 70,
  critAt = 85,
  size = 120,
  unit = '°',
  tone,
  className = '',
  hero = false,
  labelPlacement = 'inside',
}) {
  const uidRef = useRef(null);
  if (uidRef.current == null) uidRef.current = `g${++_gaugeUid}`;
  const uid = uidRef.current;
  const raw = value == null || Number.isNaN(Number(value)) ? null : Number(value);
  const animated = useCountUp(raw, { duration: DUR[5] });
  const v = animated == null || Number.isNaN(Number(animated)) ? null : Number(animated);
  const frac = v == null ? 0 : Math.min(1, Math.max(0, v / max));

  const autoBand = v == null ? null : v >= critAt ? 'hot' : v >= warnAt ? 'warm' : 'cool';
  const resolvedBand = band || autoBand;
  const resolvedTone = tone
    || (resolvedBand === 'hot' ? 'danger' : resolvedBand === 'warm' ? 'warn' : 'ok');
  const labelAbove = labelPlacement === 'above';

  const r = size * (hero ? 0.36 : 0.34);
  const cx = size / 2;
  const cy = size / 2 + size * 0.05;
  const start = 0.78 * Math.PI;
  const sweep = 1.44 * Math.PI;
  const end = start + sweep;

  const arc = useMemo(() => {
    const polar = (t, radius) => ({
      x: cx + Math.cos(t) * radius,
      y: cy + Math.sin(t) * radius,
    });
    const a0 = polar(start, r);
    const a1 = polar(end, r);
    const large = sweep > Math.PI ? 1 : 0;
    const track = `M ${a0.x} ${a0.y} A ${r} ${r} 0 ${large} 1 ${a1.x} ${a1.y}`;
    const glowR = r + (hero ? 6 : 0);
    const g0 = polar(start, glowR);
    const g1 = polar(end, glowR);
    const glowTrack = hero
      ? `M ${g0.x} ${g0.y} A ${glowR} ${glowR} 0 ${large} 1 ${g1.x} ${g1.y}`
      : '';
    const valEnd = polar(start + sweep * frac, r);
    const largeVal = sweep * frac > Math.PI ? 1 : 0;
    const valuePath = frac > 0
      ? `M ${a0.x} ${a0.y} A ${r} ${r} 0 ${largeVal} 1 ${valEnd.x} ${valEnd.y}`
      : '';
    const needle = frac > 0 ? valEnd : null;
    const ticks = Array.from({ length: hero ? 13 : 9 }, (_, i) => {
      const n = hero ? 12 : 8;
      const t = start + (sweep * i) / n;
      const major = i % (hero ? 3 : 4) === 0;
      const inner = r - (major ? (hero ? 12 : 10) : (hero ? 7 : 6));
      const o0 = polar(t, inner);
      const o1 = polar(t, r + (hero ? 4 : 3));
      return { x1: o0.x, y1: o0.y, x2: o1.x, y2: o1.y, key: i, major };
    });
    const hub = { x: cx, y: cy };
    return { track, glowTrack, valuePath, needle, ticks, hub };
  }, [cx, cy, r, start, sweep, end, frac, hero]);

  const bandLabel = resolvedBand === 'hot' ? 'HOT' : resolvedBand === 'warm' ? 'WARM' : resolvedBand === 'cool' ? 'COOL' : null;
  const gradId = `gg-${uid}`;
  const glowId = `gl-${uid}`;

  return html`
    <div
      class=${[
        'ui-gauge',
        resolvedTone ? `ui-gauge--${resolvedTone}` : '',
        hero ? 'ui-gauge--hero' : '',
        labelAbove ? 'ui-gauge--label-above' : '',
        className,
      ].filter(Boolean).join(' ')}
      role="img"
      aria-label=${`${label || 'Gauge'}: ${v == null ? 'unavailable' : `${Math.round(v)}${unit}`}`}
    >
      ${labelAbove && label ? html`
        <div class="ui-gauge__title">${label}</div>
      ` : null}
      <div class="ui-gauge__face" style=${{ width: size, height: size }}>
        <div class="ui-gauge__halo" aria-hidden="true"></div>
        <svg width=${size} height=${size} viewBox=${`0 0 ${size} ${size}`}>
          <defs>
            <linearGradient id=${gradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="var(--ui-ok)" />
              <stop offset="55%" stop-color="var(--ui-warn)" />
              <stop offset="100%" stop-color="var(--ui-danger)" />
            </linearGradient>
            <filter id=${glowId} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation=${hero ? 3.5 : 2} result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          ${arc.glowTrack && html`
            <path class="ui-gauge__glow-track" d=${arc.glowTrack} fill="none" />
          `}
          ${arc.ticks.map((t) => html`
            <line
              key=${t.key}
              class=${`ui-gauge__tick${t.major ? ' ui-gauge__tick--major' : ''}`}
              x1=${t.x1} y1=${t.y1} x2=${t.x2} y2=${t.y2}
            />
          `)}
          <path class="ui-gauge__track" d=${arc.track} fill="none" />
          ${arc.valuePath && html`
            <path
              class="ui-gauge__value"
              d=${arc.valuePath}
              fill="none"
              stroke=${hero ? `url(#${gradId})` : undefined}
              filter=${`url(#${glowId})`}
            />
          `}
          ${hero && html`
            <circle class="ui-gauge__hub-ring" cx=${arc.hub.x} cy=${arc.hub.y} r=${size * 0.08} fill="none" />
          `}
          ${arc.needle && html`
            <circle class="ui-gauge__needle-glow" cx=${arc.needle.x} cy=${arc.needle.y} r=${hero ? 8 : 5} />
            <circle class="ui-gauge__needle" cx=${arc.needle.x} cy=${arc.needle.y} r=${hero ? 5 : 4} />
            <circle class="ui-gauge__needle-core" cx=${arc.needle.x} cy=${arc.needle.y} r=${hero ? 2.5 : 2} />
          `}
        </svg>
        <div class="ui-gauge__readout">
          <div class="ui-gauge__value-text">${v == null ? '—' : Math.round(v)}${v != null ? unit : ''}</div>
          ${!labelAbove && label ? html`<div class="ui-gauge__label">${label}</div>` : null}
          ${!labelAbove && bandLabel ? html`<div class="ui-gauge__band">${bandLabel}</div>` : null}
        </div>
      </div>
    </div>
  `;
}

/**
 * RadarDial — compact % progress visualization (square or circular fill).
 * kind: 'square' (DH-like) | 'circle' (Chunky-like)
 */
export function RadarDial({ pct = 0, kind = 'circle', size = 72, className = '' }) {
  const animated = useCountUp(Number(pct) || 0, { duration: DUR[5] });
  const p = Math.min(100, Math.max(0, Number(animated) || 0));
  const cx = size / 2;
  const cy = size / 2;

  if (kind === 'square') {
    const maxHalf = size * 0.38;
    const half = maxHalf * (p / 100);
    return html`
      <div class=${`ui-radar ui-radar--square ${className}`.trim()} style=${{ width: size, height: size }} role="img" aria-label=${`${p.toFixed(0)}%`}>
        <svg width=${size} height=${size} viewBox=${`0 0 ${size} ${size}`}>
          <line class="ui-radar__grid" x1=${cx} y1=${0} x2=${cx} y2=${size} />
          <line class="ui-radar__grid" x1=${0} y1=${cy} x2=${size} y2=${cy} />
          <rect class="ui-radar__grid" x=${cx - 12} y=${cy - 12} width=${24} height=${24} fill="none" />
          <rect class="ui-radar__grid" x=${cx - 24} y=${cy - 24} width=${48} height=${48} fill="none" />
          <rect class="ui-radar__ring" x=${cx - maxHalf} y=${cy - maxHalf} width=${maxHalf * 2} height=${maxHalf * 2} fill="none" />
          ${half > 0 && html`
            <rect class="ui-radar__fill" x=${cx - half} y=${cy - half} width=${half * 2} height=${half * 2} />
          `}
          <circle class="ui-radar__dot" cx=${cx} cy=${cy} r=${2} />
        </svg>
      </div>
    `;
  }

  const maxR = size * 0.38;
  const activeR = maxR * Math.sqrt(p / 100);
  return html`
    <div class=${`ui-radar ui-radar--circle ${className}`.trim()} style=${{ width: size, height: size }} role="img" aria-label=${`${p.toFixed(0)}%`}>
      <svg width=${size} height=${size} viewBox=${`0 0 ${size} ${size}`}>
        <circle class="ui-radar__grid" cx=${cx} cy=${cy} r=${maxR * 0.33} fill="none" />
        <circle class="ui-radar__grid" cx=${cx} cy=${cy} r=${maxR * 0.66} fill="none" />
        <circle class="ui-radar__ring" cx=${cx} cy=${cy} r=${maxR} fill="none" />
        ${activeR > 0 && html`
          <circle class="ui-radar__fill" cx=${cx} cy=${cy} r=${activeR} />
        `}
        <circle class="ui-radar__dot" cx=${cx} cy=${cy} r=${2} />
      </svg>
    </div>
  `;
}

export default Gauge;
