import { html } from '../lib/preact.js';
import { useState, useEffect, useRef, useCallback } from '../lib/preact.js';
import { ui, setUi } from '../state/stores.js';
import { getPages, getActions } from './registry.js';
import { navigate } from './router.js';
import { Icon } from '../ui/icons.js';
import { WIKI } from '../wiki/content.js';

/**
 * Initialise the global Ctrl/Cmd+K keyboard shortcut.
 * Call once from main.js after mount.
 */
export function initPalette() {
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setUi({ paletteOpen: !ui.value.paletteOpen });
    }
  });
}

function buildItems(query) {
  const q = query.trim().toLowerCase();
  const pages = getPages().map((p) => ({
    id: `page:${p.id}`,
    label: p.title,
    subtitle: p.subtitle || '',
    icon: p.icon || 'layout-dashboard',
    kind: 'page',
    pageId: p.id,
  }));
  const actions = getActions().map((a) => ({
    id: `action:${a.id}`,
    label: a.title,
    subtitle: a.subtitle || '',
    icon: a.icon || 'zap',
    kind: 'action',
    run: a.run,
  }));
  const wikiItems = WIKI.nav.flatMap((cat) =>
    cat.pages.map((p) => ({
      id: `wiki:${p.slug}`,
      label: p.title,
      subtitle: `Docs · ${cat.label}`,
      icon: 'book',
      kind: 'wiki',
      slug: p.slug,
    })),
  );
  const all = [...pages, ...actions, ...wikiItems];
  if (!q) return all;
  return all.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      (item.subtitle || '').toLowerCase().includes(q),
  );
}

/**
 * Command palette overlay component.
 * Reads ui.paletteOpen; handles arrow keys, Enter, Escape internally.
 */
export function CommandPalette() {
  const open = ui.value.paletteOpen;
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const items = buildItems(query);

  const close = useCallback(() => {
    setUi({ paletteOpen: false });
    setQuery('');
    setActiveIdx(0);
  }, []);

  const select = useCallback(
    (item) => {
      close();
      if (item.kind === 'page') navigate(item.pageId);
      else if (item.kind === 'wiki') navigate('docs', { wiki: item.slug });
      else if (item.kind === 'action' && item.run) item.run();
    },
    [close],
  );

  useEffect(() => {
    if (!open) return;
    setActiveIdx(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[activeIdx]) select(items[activeIdx]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, activeIdx, select, close]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!open) return null;

  return html`
    <div class="ui-palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="ui-palette__scrim" onClick=${close}></div>
      <div class="ui-palette__panel">
        <div class="ui-palette__search-row">
          <${Icon} name="search" size=${16} class="ui-palette__search-icon" />
          <input
            ref=${inputRef}
            class="ui-palette__input"
            type="search"
            placeholder="Search pages and actions…"
            value=${query}
            onInput=${(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            autocomplete="off"
            spellcheck="false"
          />
          <kbd class="ui-palette__esc-hint">Esc</kbd>
        </div>
        ${items.length === 0
          ? html`<p class="ui-palette__empty">No results for "${query}"</p>`
          : html`
            <ul class="ui-palette__results" ref=${listRef} role="listbox">
              ${items.map((item, i) => html`
                <li
                  key=${item.id}
                  class=${'ui-palette__item' + (i === activeIdx ? ' ui-palette__item--active' : '')}
                  data-active=${i === activeIdx}
                  role="option"
                  aria-selected=${i === activeIdx}
                  onClick=${() => select(item)}
                  onMouseEnter=${() => setActiveIdx(i)}
                >
                  <span class="ui-palette__item-icon">
                    <${Icon} name=${item.icon} size=${16} />
                  </span>
                  <span class="ui-palette__item-text">
                    <span class="ui-palette__item-label">${item.label}</span>
                    ${item.subtitle
                      ? html`<span class="ui-palette__item-sub">${item.subtitle}</span>`
                      : null}
                  </span>
                  <span class="ui-palette__item-kind">${item.kind}</span>
                </li>
              `)}
            </ul>
          `}
      </div>
    </div>
  `;
}

export default CommandPalette;
