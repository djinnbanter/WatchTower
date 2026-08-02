import { html } from '../../lib/preact.js';
import { useCountUp } from '../../motion/use-count-up.js';
import { DUR } from '../../motion/tokens.js';

/**
 * AnimatedNumber — count-up/down text for raw numeric values.
 * AnimatedNumber({ value, format, duration, className })
 * format: (n: number) => string
 */
export function AnimatedNumber({
  value,
  format,
  duration = DUR[5],
  className = '',
}) {
  const raw = value == null || value === '' || Number.isNaN(Number(value))
    ? null
    : Number(value);
  const animated = useCountUp(raw, { duration });

  if (animated == null) {
    return html`<span class=${className || undefined}>—</span>`;
  }

  const text = format ? format(animated) : String(Math.round(animated));
  return html`<span class=${className || undefined}>${text}</span>`;
}

export default AnimatedNumber;
