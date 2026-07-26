import { html, useState, useEffect, useRef } from '../../lib/preact.js';
import { useCountUp } from '../../motion/use-count-up.js';
import { DUR } from '../../motion/tokens.js';
import { Icon } from '../icons.js';
import { Tooltip } from '../primitives/tooltip.js';
import { Sparkline } from './sparkline.js';
import { FreshnessBadge } from './freshness-badge.js';

/**
 * MetricReadout({ label, value, format, unit, tone, delta, source, spark, sparkMin, sparkMax, size, hint, caption })
 * Animated numeric metric with optional sparkline and freshness badge.
 */
export function MetricReadout({
  label,
  value,
  format,
  unit,
  tone,
  delta,
  source,
  spark,
  sparkMin,
  sparkMax,
  size = 'metric',
  hint,
  caption,
}) {
  const displayValue = useCountUp(value ?? 0, { duration: DUR[5] });
  const prevToneRef = useRef(tone);
  const [flash, setFlash] = useState(false);

  // Flash on warn/danger threshold cross
  useEffect(() => {
    const prev = prevToneRef.current;
    const isNowBad = tone === 'warn' || tone === 'danger';
    const wasBad = prev === 'warn' || prev === 'danger';
    if (isNowBad && !wasBad) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 700);
      return () => clearTimeout(t);
    }
    prevToneRef.current = tone;
  }, [tone]);

  const shown = displayValue ?? 0;
  const formatted = format ? format(shown) : String(Math.round(shown));

  const deltaEl = delta != null
    ? html`
        <span class=${[
          'ui-metric__delta',
          delta > 0 ? 'ui-metric__delta--up' : delta < 0 ? 'ui-metric__delta--down' : '',
        ].filter(Boolean).join(' ')}>
          ${delta > 0 ? '+' : ''}${delta}
        </span>
      `
    : null;

  const cls = [
    'ui-metric',
    size === 'sm' ? 'ui-metric--sm' : '',
    tone ? `ui-metric--${tone}` : '',
    flash ? 'ui-metric--flash' : '',
  ].filter(Boolean).join(' ');

  return html`
    <div class=${cls}>
      ${(label || hint) && html`
        <div class="ui-metric__head">
          ${label && html`<div class="ui-metric__label">${label}</div>`}
          ${hint && html`
            <${Tooltip} content=${hint} className="ui-metric__hint">
              <button type="button" class="ui-metric__hint-btn" aria-label=${`About ${label || 'metric'}`}>
                <${Icon} name="help-circle" size=${14} />
              </button>
            </${Tooltip}>
          `}
        </div>
      `}
      <div class="ui-metric__value-row">
        <span class="ui-metric__value">${formatted}</span>
        ${unit && html`<span class="ui-metric__unit">${unit}</span>`}
        ${deltaEl}
      </div>
      ${caption && html`<div class="ui-metric__caption">${caption}</div>`}
      ${spark && html`
        <div class="ui-metric__spark">
          <${Sparkline}
            series=${spark}
            tone=${tone === 'ok' || tone === 'warn' || tone === 'danger' ? tone : 'accent'}
            fill=${true}
            height=${48}
            ymin=${sparkMin}
            ymax=${sparkMax}
          />
        </div>
      `}
      ${source && html`
        <div class="ui-metric__footer">
          <${FreshnessBadge} layer=${source.layer} at=${source.at} stale=${source.stale} />
        </div>
      `}
    </div>
  `;
}

export default MetricReadout;
