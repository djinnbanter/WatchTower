import { html } from '../../lib/preact.js';
import { useComputed } from '../../lib/signals.js';
import { now } from '../../state/clock.js';
import { dataSources } from '../../state/stores.js';
import { ageMs, formatAge } from '../../domain/freshness.js';
import { FreshnessBadge } from './freshness-badge.js';

/**
 * FreshnessFooter({ subtitle })
 * Reads dataSources + now from stores by default.
 * Shows "Live · Xs ago · Ops scan · Ys ago · Full report · Zh ago"
 */
export function FreshnessFooter({ subtitle }) {
  const sources = useComputed(() => {
    const ds = dataSources.value;
    const ts = now.value;
    return [
      { layer: 'live', label: 'Live', at: ds.liveAt },
      { layer: 'scan', label: 'Ops scan', at: ds.scanAt },
      { layer: 'report', label: 'Full report', at: ds.reportAt },
    ].filter((s) => s.at != null);
  });

  return html`
    <div class="ui-freshness-footer">
      ${subtitle && html`<span class="ui-freshness-footer__subtitle">${subtitle}</span>`}
      <div class="ui-freshness-footer__sources">
        ${sources.value.map((s, i) => html`
          <${FreshnessBadge}
            key=${s.layer}
            layer=${s.layer}
            at=${s.at}
          />
          ${i < sources.value.length - 1 && html`<span class="ui-freshness-footer__sep" aria-hidden="true"></span>`}
        `)}
      </div>
    </div>
  `;
}

export default FreshnessFooter;
