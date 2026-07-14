import { html, useState } from '../../lib/preact.js';

/**
 * Accordion({ summary, children, open, onToggle, defaultOpen })
 * Controlled or uncontrolled collapsible section.
 */
export function Accordion({ summary, children, open: controlledOpen, onToggle, defaultOpen = false }) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const handleToggle = () => {
    if (isControlled) {
      onToggle?.(!isOpen);
    } else {
      setInternalOpen((v) => !v);
      onToggle?.(!isOpen);
    }
  };

  return html`
    <div class=${['ui-accordion', isOpen ? 'ui-accordion--open' : ''].filter(Boolean).join(' ')}>
      <button
        class="ui-accordion__summary"
        aria-expanded=${isOpen}
        onClick=${handleToggle}
      >
        ${summary}
        <svg class="ui-accordion__chevron" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M3.293 5.293a1 1 0 011.414 0L8 8.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
        </svg>
      </button>
      ${isOpen && html`
        <div class="ui-accordion__body">
          <div class="ui-accordion__content">
            ${children}
          </div>
        </div>
      `}
    </div>
  `;
}

export default Accordion;
