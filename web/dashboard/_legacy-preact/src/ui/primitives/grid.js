import { html } from '../../lib/preact.js';

/**
 * Grid — responsive auto-fit by default (override with className + media queries).
 * Use `cols` for a fixed column count that ignores auto-fit.
 */
export function Grid({ cols, min = '180px', gap = '16', children, className = '', style: extraStyle, ...rest }) {
  const cls = ['ui-grid', className].filter(Boolean).join(' ');

  const style = {
    gap: `var(--ui-sp-${gap})`,
    ...(cols
      ? {
          gridTemplateColumns: typeof cols === 'number' ? `repeat(${cols}, minmax(0, 1fr))` : cols,
        }
      : {
          '--ui-grid-min': min,
        }),
    ...extraStyle,
  };

  return html`<div class=${cls} style=${style} ...${rest}>${children}</div>`;
}

export default Grid;
