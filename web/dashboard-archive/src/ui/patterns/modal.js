import { html, useEffect, useRef } from '../../lib/preact.js';

const CLOSE_ICON = html`<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>`;

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Modal({ title, size, onClose, footer, children, open })
 * Focus trap, Escape, scrim click. role=dialog aria-modal.
 */
export function Modal({ title, size = 'md', onClose, footer, children, open = true }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement;
    const panel = panelRef.current;

    // Focus first focusable element
    if (panel) {
      const focusable = panel.querySelectorAll(FOCUSABLE);
      if (focusable.length > 0) focusable[0].focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return html`
    <div
      class=${`ui-modal ui-modal--${size}`}
      role="dialog"
      aria-modal="true"
      aria-label=${title}
    >
      <div
        class="ui-modal__scrim"
        onClick=${(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      >
        <div class="ui-modal__panel" ref=${panelRef}>
          <div class="ui-modal__header">
            <h2 class="ui-modal__title">${title}</h2>
            ${onClose && html`
              <button class="ui-modal__close" aria-label="Close dialog" onClick=${onClose}>
                ${CLOSE_ICON}
              </button>
            `}
          </div>
          <div class="ui-modal__body">
            ${children}
          </div>
          ${footer && html`<div class="ui-modal__footer">${footer}</div>`}
        </div>
      </div>
    </div>
  `;
}

export default Modal;
