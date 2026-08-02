import { html } from '../../lib/preact.js';

/**
 * Skeleton({ height, width, className })
 * Shimmer block for loading states.
 */
export function Skeleton({ height, width, className = '', style: extraStyle }) {
  const base = {
    height: height != null ? (typeof height === 'number' ? `${height}px` : height) : '16px',
    width: width != null ? (typeof width === 'number' ? `${width}px` : width) : '100%',
  };
  const style = typeof extraStyle === 'string'
    ? `${Object.entries(base).map(([key, value]) => `${key}:${value}`).join(';')};${extraStyle}`
    : { ...base, ...(extraStyle || {}) };

  return html`
    <div
      class=${['ui-skeleton', className].filter(Boolean).join(' ')}
      style=${style}
      aria-hidden="true"
    ></div>
  `;
}

export default Skeleton;
