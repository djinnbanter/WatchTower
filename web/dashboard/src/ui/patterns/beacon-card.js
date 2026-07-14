import { html } from '../../lib/preact.js';
import { Card } from '../primitives/card.js';

/**
 * BeaconCard — pulsing health / inbox status card.
 * BeaconCard({ label, hint, word, tone, children, className })
 * tone: ok | warn | danger | neutral | info
 */
export function BeaconCard({
  label,
  hint,
  word,
  tone = 'neutral',
  children,
  className = '',
  padding = '16',
}) {
  return html`
    <${Card}
      className=${[`ui-beacon-card`, `ui-beacon-card--${tone}`, className].filter(Boolean).join(' ')}
      padding=${padding}
    >
      ${label && html`<div class="ui-beacon-card__label">${label}</div>`}
      ${hint && html`<div class="ui-beacon-card__hint">${hint}</div>`}
      <div class="ui-beacon-card__value">
        <span class=${`ui-beacon ui-beacon--${tone}`} aria-hidden="true"></span>
        ${word != null && html`<span class="ui-beacon-card__word">${word}</span>`}
        ${children}
      </div>
    </${Card}>
  `;
}

/**
 * UptimeClock — segmented d/h/m/s display
 */
export function UptimeClock({ seconds, className = '' }) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return html`<span class=${`ui-uptime ui-uptime--empty ${className}`.trim()}>—</span>`;
  }
  const total = Math.floor(seconds);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const showDays = d > 0;
  const showHours = showDays || h > 0;

  return html`
    <div class=${`ui-uptime ${className}`.trim()} aria-live="polite">
      ${showDays && html`
        <span class="ui-uptime__block">
          <span class="ui-uptime__num">${d}</span><span class="ui-uptime__unit">d</span>
        </span>
      `}
      ${showHours && html`
        <span class="ui-uptime__block">
          <span class="ui-uptime__num">${h}</span><span class="ui-uptime__unit">h</span>
        </span>
      `}
      <span class="ui-uptime__block">
        <span class="ui-uptime__num">${m}</span><span class="ui-uptime__unit">m</span>
      </span>
      <span class="ui-uptime__block ui-uptime__block--sec">
        <span class="ui-uptime__num">${String(s).padStart(2, '0')}</span><span class="ui-uptime__unit">s</span>
      </span>
    </div>
  `;
}

export default BeaconCard;
