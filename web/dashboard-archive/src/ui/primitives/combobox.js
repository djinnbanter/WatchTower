import { html } from '../../lib/preact.js';
import { useState, useRef, useEffect, useCallback } from '../../lib/preact.js';
import { Icon } from '../icons.js';

/**
 * Combobox with typeahead filter and keyboard navigation.
 * options: [{ value, label, hint? }]
 */
export function Combobox({
  options = [],
  value,
  onSelect,
  allowFree = false,
  placeholder = 'Select…',
  label,
  disabled = false,
  id,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const listId = id ? `${id}-listbox` : undefined;

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value ?? '';

  const filtered = query
    ? options.filter((o) => {
        const q = query.toLowerCase();
        return (
          o.label.toLowerCase().includes(q) ||
          (o.hint && o.hint.toLowerCase().includes(q))
        );
      })
    : options;

  const openMenu = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    setActiveIdx(-1);
  }, [disabled]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIdx(-1);
  }, []);

  const selectOption = useCallback(
    (opt) => {
      onSelect && onSelect(opt.value);
      closeMenu();
    },
    [onSelect, closeMenu],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (!open) {
        if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
          e.preventDefault();
          openMenu();
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIdx >= 0 && filtered[activeIdx]) {
          selectOption(filtered[activeIdx]);
        } else if (allowFree && query) {
          onSelect && onSelect(query);
          closeMenu();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
      }
    },
    [open, filtered, activeIdx, allowFree, query, openMenu, closeMenu, selectOption, onSelect],
  );

  // Scroll active item into view
  useEffect(() => {
    if (!open || activeIdx < 0 || !menuRef.current) return;
    const item = menuRef.current.children[activeIdx];
    item && item.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        inputRef.current &&
        !inputRef.current.closest('.ui-combo').contains(e.target)
      ) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, closeMenu]);

  const wrapCls = [
    'ui-combo',
    disabled ? 'ui-combo--disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const displayValue = open ? query : selectedLabel;

  return html`
    <div class="ui-field">
      ${label
        ? html`<label class="ui-field__label" for=${id}>${label}</label>`
        : null}
      <div
        class=${wrapCls}
        role="combobox"
        aria-expanded=${open}
        aria-haspopup="listbox"
        aria-owns=${listId}
      >
        <div
          class="ui-combo__trigger"
          onClick=${openMenu}
        >
          <input
            ref=${inputRef}
            class="ui-combo__input"
            id=${id}
            value=${displayValue}
            placeholder=${open ? placeholder : (selectedLabel || placeholder)}
            disabled=${disabled || null}
            onFocus=${openMenu}
            onInput=${(e) => {
              setQuery(e.target.value);
              setActiveIdx(-1);
              if (!open) setOpen(true);
            }}
            onKeyDown=${handleKeyDown}
            role="combobox"
            aria-autocomplete="list"
            aria-controls=${listId}
            aria-activedescendant=${activeIdx >= 0 ? `${id}-opt-${activeIdx}` : undefined}
            autocomplete="off"
          />
          <span class="ui-combo__chevron" aria-hidden="true">
            <${Icon} name="chevron-down" size=${14} />
          </span>
        </div>
        ${open
          ? html`
            <div
              ref=${menuRef}
              class="ui-combo__menu"
              id=${listId}
              role="listbox"
            >
              ${filtered.length === 0
                ? html`<div class="ui-combo__empty">No results</div>`
                : filtered.map(
                    (opt, i) => html`
                      <div
                        key=${opt.value}
                        id=${id ? `${id}-opt-${i}` : undefined}
                        class=${[
                          'ui-combo__option',
                          i === activeIdx ? 'ui-combo__option--active' : '',
                          opt.value === value ? 'ui-combo__option--selected' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        role="option"
                        aria-selected=${opt.value === value}
                        onMouseDown=${(e) => {
                          e.preventDefault();
                          selectOption(opt);
                        }}
                        onMouseEnter=${() => setActiveIdx(i)}
                      >
                        <span class="ui-combo__opt-label">${opt.label}</span>
                        ${opt.hint
                          ? html`<span class="ui-combo__opt-hint">${opt.hint}</span>`
                          : null}
                      </div>
                    `,
                  )}
            </div>`
          : null}
      </div>
    </div>
  `;
}

export default Combobox;
