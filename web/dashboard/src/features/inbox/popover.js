import { html } from '../../lib/preact.js';
import { useState, useEffect, useRef } from '../../lib/preact.js';
import { inbox } from '../../state/stores.js';
import { dismissInboxItem, fetchInbox } from '../../state/actions.js';
import { navigate } from '../../app/router.js';
import { Icon } from '../../ui/icons.js';
import { IconButton } from '../../ui/primitives/icon-button.js';
import { Badge } from '../../ui/primitives/badge.js';

function parseHref(href) {
  if (!href) return null;
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return { external: href };
  }
  try {
    const qs = href.startsWith('?') ? href.slice(1) : href.includes('?') ? href.split('?')[1] : href;
    const params = new URLSearchParams(qs);
    const tab = params.get('tab') || 'crashes';
    const routeParams = {};
    for (const [k, v] of params.entries()) {
      if (k !== 'tab') routeParams[k] = v;
    }
    return { tab, params: routeParams };
  } catch {
    return null;
  }
}

function severityTone(sev) {
  if (sev === 'critical') return 'danger';
  if (sev === 'warning') return 'warn';
  return 'neutral';
}

/**
 * Topbar inbox bell + popover list (crash groups + update nudges).
 */
export function InboxBell() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const items = inbox.value?.items ?? [];
  const count = items.length;

  useEffect(() => {
    if (open) fetchInbox?.();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function openItem(item) {
    const parsed = parseHref(item.href);
    setOpen(false);
    if (!parsed) return;
    if (parsed.external) {
      try {
        window.open(parsed.external, '_blank', 'noopener,noreferrer');
      } catch { /* ignore */ }
      return;
    }
    navigate(parsed.tab, parsed.params || {});
  }

  return html`
    <div class="ui-topbar__inbox" ref=${rootRef}>
      <button
        type="button"
        class="ui-topbar__palette-btn ui-topbar__inbox-btn"
        aria-label=${count ? `Inbox (${count})` : 'Inbox'}
        aria-expanded=${open}
        title="Inbox"
        onClick=${() => setOpen((v) => !v)}
      >
        <${Icon} name="bell" size=${16} />
        ${count > 0 ? html`
          <span class="ui-topbar__inbox-badge">${count > 9 ? '9+' : count}</span>
        ` : null}
      </button>

      ${open ? html`
        <div class="ui-inbox-popover" role="dialog" aria-label="Inbox">
          <p class="ui-inbox-popover__title">Inbox</p>
          ${items.length === 0 ? html`
            <p class="ui-inbox-popover__empty">Nothing waiting — you're clear.</p>
          ` : items.map((item) => html`
            <div class="ui-inbox-item" key=${item.id}>
              <div class="ui-inbox-item__row">
                <button
                  type="button"
                  class="ui-inbox-item__title"
                  onClick=${() => openItem(item)}
                >${item.title}</button>
                <${IconButton}
                  className="ui-inbox-item__dismiss"
                  icon="x"
                  label="Dismiss"
                  size="sm"
                  onClick=${() => dismissInboxItem(item.id)}
                />
              </div>
              ${item.body ? html`<p class="ui-inbox-item__body">${item.body}</p>` : null}
              ${item.severity ? html`
                <${Badge} tone=${severityTone(item.severity)}>${item.kind === 'crash_group' ? 'crash' : item.kind?.replace(/_/g, ' ') || item.severity}</${Badge}>
              ` : null}
            </div>
          `)}
        </div>
      ` : null}
    </div>
  `;
}

export default InboxBell;
