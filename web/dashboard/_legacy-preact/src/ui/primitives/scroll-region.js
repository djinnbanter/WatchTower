import { html } from '../../lib/preact.js';

export function ScrollRegion({
  maxHeight,
  fadeEdges = false,
  children,
  label,
  className = '',
  style: extraStyle,
  ...rest
}) {
  const cls = [
    'ui-scroll',
    fadeEdges ? 'ui-scroll--fade-edges' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const style = {
    ...(maxHeight ? { maxHeight } : {}),
    ...extraStyle,
  };

  return html`
    <div
      class=${cls}
      role="region"
      tabIndex=${0}
      aria-label=${label}
      style=${style}
      ...${rest}
    >
      ${children}
    </div>
  `;
}

export default ScrollRegion;
