import { html } from '../../lib/preact.js';
import { Card } from '../primitives/card.js';
import { MetricReadout } from './metric-readout.js';

/**
 * MetricTile — wraps MetricReadout in a Card.
 * Accepts all MetricReadout props plus Card's padding prop.
 */
export function MetricTile({ padding = '16', className = '', ...props }) {
  return html`
    <${Card} className=${`ui-metric-tile ${className}`.trim()} padding=${padding}>
      <${MetricReadout} ...${props} />
    </${Card}>
  `;
}

export default MetricTile;
