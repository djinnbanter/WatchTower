import { html } from '../../lib/preact.js';

/**
 * ListRow({ icon, tone, title, meta, badge, actions, onClick, children, staggerIndex })
 */
export function ListRow({ icon, tone, title, meta, badge, actions, onClick, children, staggerIndex, style, className }) {
  const clickable = !!onClick;
  const cls = [
    'ui-list-row',
    tone ? `ui-list-row--${tone}` : '',
    clickable ? 'ui-list-row--clickable' : '',
    className || '',
  ].filter(Boolean).join(' ');

  const handleKeyDown = (e) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick(e);
    }
  };

  const mergedStyle = staggerIndex != null
    ? { ...(style || {}), '--ui-stagger-index': String(staggerIndex) }
    : style;

  return html`
    <div
      class=${cls}
      style=${mergedStyle}
      onClick=${onClick}
      onKeyDown=${handleKeyDown}
      tabIndex=${clickable ? 0 : undefined}
      role=${clickable ? 'button' : undefined}
    >
      ${icon && html`
        <div class=${['ui-list-row__icon', tone ? `ui-list-row__icon--${tone}` : ''].filter(Boolean).join(' ')}>
          ${icon}
        </div>
      `}
      <div class="ui-list-row__content">
        ${title && html`<div class="ui-list-row__title">${title}</div>`}
        ${meta && html`<div class="ui-list-row__meta">${meta}</div>`}
        ${children && html`<div class="ui-list-row__children">${children}</div>`}
      </div>
      <div class="ui-list-row__end">
        ${badge}
        ${actions}
      </div>
    </div>
  `;
}

export default ListRow;
