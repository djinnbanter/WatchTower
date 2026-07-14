import { html, useMemo } from '../../lib/preact.js';

/**
 * Timeline({ items, groupByDay })
 * items: [{id, time, tone, title, detail, badge, meta, actions}]
 */
export function Timeline({ items = [], groupByDay = true }) {
  const groups = useMemo(() => {
    if (!groupByDay) return [{ label: null, items }];
    const map = new Map();
    for (const item of items) {
      const d = item.time ? new Date(item.time) : null;
      const key = d ? d.toDateString() : 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, [items, groupByDay]);

  function formatTime(time) {
    if (!time) return '';
    const d = new Date(time);
    if (isNaN(d.getTime())) return String(time);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function formatDayLabel(label) {
    if (!label || label === 'Unknown') return label;
    const d = new Date(label);
    if (isNaN(d.getTime())) return label;
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  return html`
    <div class="ui-timeline">
      ${groups.map(({ label, items: groupItems }) => html`
        <div class="ui-timeline__day-group" key=${label}>
          ${label && html`
            <div class="ui-timeline__day-label">
              <span class="ui-timeline__day-text">${formatDayLabel(label)}</span>
              <span class="ui-timeline__day-count">${groupItems.length}</span>
            </div>
          `}
          <div class="ui-timeline__day-items">
            ${groupItems.map((item) => html`
              <div
                key=${item.id}
                class=${['ui-timeline__item', item.tone ? `ui-timeline__item--${item.tone}` : ''].filter(Boolean).join(' ')}
              >
                <div class="ui-timeline__spine">
                  <div class=${['ui-timeline__dot', item.tone ? `ui-timeline__dot--${item.tone}` : ''].filter(Boolean).join(' ')}></div>
                  <div class="ui-timeline__line"></div>
                </div>
                <div class="ui-timeline__body">
                  <div class="ui-timeline__header">
                    <div class="ui-timeline__title-row">
                      ${item.badge}
                      <span class="ui-timeline__title">${item.title}</span>
                    </div>
                    ${item.time && html`<span class="ui-timeline__time">${formatTime(item.time)}</span>`}
                  </div>
                  ${item.meta && html`<div class="ui-timeline__meta">${item.meta}</div>`}
                  ${item.detail && html`<p class="ui-timeline__detail">${item.detail}</p>`}
                  ${item.actions && html`<div class="ui-timeline__actions">${item.actions}</div>`}
                </div>
              </div>
            `)}
          </div>
        </div>
      `)}
    </div>
  `;
}

export default Timeline;
