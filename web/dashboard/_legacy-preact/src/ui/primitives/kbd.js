import { html } from '../../lib/preact.js';

export function Kbd({ children }) {
  return html`<kbd class="ui-kbd">${children}</kbd>`;
}

export default Kbd;
