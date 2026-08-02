import { html } from '../../lib/preact.js';
import { useCountUp } from '../../motion/use-count-up.js';
import { resolveColor, chartPalette } from '../../theme/theme.js';
import { Motion } from '../../motion/reduced.js';

/**
 * RingChart — circular progress ring.
 */
export function RingChart({
  value = 0,
  max = 100,
  label,
  sublabel,
  size = 96,
  color,
  className = '',
}) {
  const raw = value == null || Number.isNaN(Number(value)) ? 0 : Number(value);
  const animated = useCountUp(raw);
  const v = Math.min(max, Math.max(0, Number(animated) || 0));
  const pct = max > 0 ? v / max : 0;

  const stroke = resolveColor(color || 'accent', chartPalette());
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);

  const display = max === 100
    ? `${Math.round(pct * 100)}%`
    : `${Math.round(v)}`;

  return html`
    <div
      class=${`ui-ring ${className}`.trim()}
      style=${{ width: size, height: size }}
      role="progressbar"
      aria-valuenow=${Math.round(v)}
      aria-valuemin=${0}
      aria-valuemax=${max}
      aria-label=${label || 'Progress ring'}
    >
      <svg class="ui-ring__svg" width=${size} height=${size} viewBox=${`0 0 ${size} ${size}`}>
        <circle
          class="ui-ring__track"
          cx=${size / 2}
          cy=${size / 2}
          r=${r}
        />
        <circle
          class="ui-ring__value"
          cx=${size / 2}
          cy=${size / 2}
          r=${r}
          stroke=${stroke}
          stroke-dasharray=${c}
          stroke-dashoffset=${Motion.enabled ? offset : c * (1 - (raw / max))}
        />
      </svg>
      <div class="ui-ring__label">
        <div class="ui-ring__num">${display}</div>
        ${(label || sublabel) && html`
          <div class="ui-ring__sub">${sublabel || label}</div>
        `}
      </div>
    </div>
  `;
}

export default RingChart;
