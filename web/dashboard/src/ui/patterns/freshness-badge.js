import { html } from '../../lib/preact.js';
import { useSignal, useSignalEffect } from '../../lib/signals.js';
import { now } from '../../state/clock.js';
import { ageMs, formatAge } from '../../domain/freshness.js';

/**
 * FreshnessBadge({ layer, at, stale })
 * layer: 'live' | 'scan' | 'report' | 'mixed'
 * at: ISO timestamp or ms epoch
 * stale: boolean override
 */
export function FreshnessBadge({ layer, at, stale = false }) {
  const ageStr = useSignal('—');

  useSignalEffect(() => {
    const ts = now.value;
    if (at != null) {
      const ms = ageMs(at, ts);
      ageStr.value = formatAge(ms);
    } else {
      ageStr.value = '—';
    }
  });

  const effectiveLayer = stale ? 'stale' : (layer || 'report');

  const layerLabels = {
    live: 'Live',
    scan: 'Ops scan',
    report: 'Report',
    mixed: 'Mixed',
    stale: 'Stale',
  };

  const cls = [
    'ui-freshness-badge',
    `ui-freshness-badge--${effectiveLayer}`,
  ].join(' ');

  return html`
    <span class=${cls}>
      <span class="ui-freshness-badge__dot" aria-hidden="true"></span>
      <span class="ui-freshness-badge__label">${layerLabels[effectiveLayer] || effectiveLayer}</span>
      ${at != null && html`<span class="ui-freshness-badge__age">${ageStr}</span>`}
    </span>
  `;
}

export default FreshnessBadge;
