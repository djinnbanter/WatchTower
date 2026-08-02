import { html } from '../../lib/preact.js';
import { Card } from '../primitives/card.js';
import { Sparkline } from './sparkline.js';
import { AnimatedNumber } from './animated-number.js';

/**
 * DualMetricTile — two related metrics in one card (e.g. TPS + MSPT, Heap used/free).
 * DualMetricTile({ label, left, right, caption, spark, sparkMin, sparkMax, tone })
 * left/right: { label, value, format? } — numeric value + optional format animates
 */
export function DualMetricTile({
  label,
  left,
  right,
  caption,
  spark,
  sparkMin,
  sparkMax,
  tone,
  className = '',
  padding = '16',
}) {
  const cls = [
    'ui-metric-tile',
    'ui-dual-metric',
    tone ? `ui-dual-metric--${tone}` : '',
    className,
  ].filter(Boolean).join(' ');

  const sparkTone = tone === 'ok' || tone === 'warn' || tone === 'danger' ? tone : 'accent';

  function sideValue(side) {
    if (side == null || side.value == null || side.value === '') return '—';
    if (typeof side.value === 'number' || (side.format && !Number.isNaN(Number(side.value)))) {
      return html`<${AnimatedNumber} value=${side.value} format=${side.format} />`;
    }
    return side.value;
  }

  return html`
    <${Card} className=${cls} padding=${padding}>
      <div class="ui-dual-metric__body">
        ${label && html`<div class="ui-metric__label">${label}</div>`}
        <div class="ui-dual-metric__row">
          <div class="ui-dual-metric__side">
            ${left?.label && html`<div class="ui-dual-metric__side-label">${left.label}</div>`}
            <div class="ui-dual-metric__side-value">${sideValue(left)}</div>
          </div>
          <div class="ui-dual-metric__divider" aria-hidden="true"></div>
          <div class="ui-dual-metric__side">
            ${right?.label && html`<div class="ui-dual-metric__side-label">${right.label}</div>`}
            <div class="ui-dual-metric__side-value">${sideValue(right)}</div>
          </div>
        </div>
        ${caption && html`<div class="ui-metric__caption">${caption}</div>`}
      </div>
      ${spark && html`
        <div class="ui-metric__spark">
          <${Sparkline}
            series=${spark}
            tone=${sparkTone}
            fill=${true}
            height=${52}
            ymin=${sparkMin}
            ymax=${sparkMax}
          />
        </div>
      `}
    </${Card}>
  `;
}

export default DualMetricTile;
