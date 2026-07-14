import { html } from '../../lib/preact.js';
import { Segmented } from '../primitives/segmented.js';

/**
 * ChartFrame({ title, layer, at, windowOptions, windowValue, onWindowChange, actions, caption, children, stale })
 * Header + chart body + caption wrapper.
 */
export function ChartFrame({
  title,
  layer,
  at,
  windowOptions,
  windowValue,
  onWindowChange,
  actions,
  caption,
  children,
  stale = false,
}) {
  return html`
    <div class=${['ui-chart-frame', stale ? 'ui-chart-frame--stale' : ''].filter(Boolean).join(' ')}>
      <div class="ui-chart-frame__header">
        <div class="ui-chart-frame__title-group">
          ${title && html`<h3 class="ui-chart-frame__title">${title}</h3>`}
          ${layer && html`<span class="ui-chart-frame__layer">${layer}</span>`}
          ${at && html`<span class="ui-chart-frame__at">${at}</span>`}
        </div>
        <div class="ui-chart-frame__actions">
          ${windowOptions && html`
            <${Segmented}
              options=${windowOptions}
              value=${windowValue}
              onChange=${onWindowChange}
              size="sm"
            />
          `}
          ${actions}
        </div>
      </div>
      <div class="ui-chart-frame__body">
        ${children}
      </div>
      ${caption && html`<p class="ui-chart-frame__caption">${caption}</p>`}
    </div>
  `;
}

export default ChartFrame;
