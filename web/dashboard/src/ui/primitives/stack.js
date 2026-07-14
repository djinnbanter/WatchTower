import { html } from '../../lib/preact.js';

export function Stack({
  gap = '8',
  align,
  justify,
  wrap = false,
  direction = 'column',
  children,
  className = '',
  as: Tag = 'div',
  style: extraStyle,
  ...rest
}) {
  const cls = [
    'ui-stack',
    direction === 'row' ? 'ui-stack--row' : '',
    wrap ? 'ui-stack--wrap' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const style = {
    gap: `var(--ui-sp-${gap})`,
    ...(align ? { alignItems: align } : {}),
    ...(justify ? { justifyContent: justify } : {}),
    ...extraStyle,
  };

  return html`<${Tag} class=${cls} style=${style} ...${rest}>${children}</${Tag}>`;
}

export default Stack;
