import { html, useState } from '../../lib/preact.js';

/**
 * Section({ title, hint, badge, actions, collapsible, defaultOpen=true, open, onOpenChange, children })
 * h2 heading + hairline + body. Optionally collapsible.
 * Controlled: pass `open` + `onOpenChange`. Uncontrolled: `defaultOpen` only.
 */
export function Section({
  title,
  hint,
  badge,
  actions,
  collapsible = false,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  children,
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const controlled = openProp != null;
  const open = controlled ? !!openProp : uncontrolledOpen;
  const isOpen = collapsible ? open : true;

  const setOpen = (next) => {
    if (!controlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const headingContent = html`
    <div class="ui-section__heading-group">
      ${title && html`<h2 class="ui-section__title">${title}</h2>`}
      ${badge}
    </div>
    ${hint && html`<p class="ui-section__hint">${hint}</p>`}
  `;

  return html`
    <div class=${['ui-section', !isOpen ? 'ui-section--collapsed' : ''].filter(Boolean).join(' ')}>
      <div class="ui-section__header">
        ${collapsible
          ? html`
              <button
                class="ui-section__toggle"
                aria-expanded=${isOpen}
                onClick=${() => setOpen(!isOpen)}
              >
                ${headingContent}
                <svg class="ui-section__chevron" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M3.293 5.293a1 1 0 011.414 0L8 8.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                </svg>
              </button>
            `
          : headingContent
        }
        ${actions && html`<div class="ui-section__actions">${actions}</div>`}
      </div>
      <div class="ui-section__body">
        ${children}
      </div>
    </div>
  `;
}

export default Section;
