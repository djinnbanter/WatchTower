import { html, useEffect, useRef, useState } from '../../lib/preact.js';
import { Card } from '../primitives/card.js';
import { Motion } from '../../motion/reduced.js';

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
 * UptimeClock — segmented d/h/m/s display with soft second tick pulse.
 */
export function UptimeClock({ seconds, className = '' }) {
  const [tick, setTick] = useState(false);
  const prevSec = useRef(null);
  const valid = seconds != null && Number.isFinite(seconds) && seconds >= 0;
  const total = valid ? Math.floor(seconds) : 0;
  const s = total % 60;

  useEffect(() => {
    if (!valid || !Motion.enabled) return undefined;
    if (prevSec.current != null && prevSec.current !== s) {
      setTick(true);
      const t = setTimeout(() => setTick(false), 220);
      prevSec.current = s;
      return () => clearTimeout(t);
    }
    prevSec.current = s;
    return undefined;
  }, [s, valid]);

  if (!valid) {
    return html`<span class=${`ui-uptime ui-uptime--empty ${className}`.trim()}>—</span>`;
  }

  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
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
      <span class=${`ui-uptime__block ui-uptime__block--sec${tick ? ' is-tick' : ''}`}>
        <span class="ui-uptime__num">${String(s).padStart(2, '0')}</span><span class="ui-uptime__unit">s</span>
      </span>
    </div>
  `;
}

export default BeaconCard;
