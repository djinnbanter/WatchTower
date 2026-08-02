import { html } from '../../lib/preact.js';

/**
 * Skeleton({ height, width, className })
 * Shimmer block for loading states.
 */
export function Skeleton({ height, width, className = '', style: extraStyle }) {
  const style = {
    height: height != null ? (typeof height === 'number' ? `${height}px` : height) : '16px',
    width: width != null ? (typeof width === 'number' ? `${width}px` : width) : '100%',
    ...extraStyle,
  };

  return html`
    <div
      class=${['ui-skeleton', className].filter(Boolean).join(' ')}
      style=${style}
      aria-hidden="true"
    ></div>
  `;
}

export default Skeleton;
