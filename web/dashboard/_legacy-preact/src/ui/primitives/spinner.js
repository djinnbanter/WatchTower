import { html } from '../../lib/preact.js';

export function Spinner({ size = 16 }) {
  const r = (size / 2) * 0.75;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  return html`
    <svg
      class="ui-spinner"
      width=${size}
      height=${size}
      viewBox="0 0 ${size} ${size}"
      fill="none"
      aria-hidden="true"
    >
      <circle
        class="ui-spinner__track"
        cx=${cx}
        cy=${cx}
        r=${r}
        stroke-width="2"
        fill="none"
      />
      <circle
        class="ui-spinner__arc"
        cx=${cx}
        cy=${cx}
        r=${r}
        stroke-width="2"
        fill="none"
        stroke-dasharray="${circumference}"
        stroke-dashoffset="${circumference * 0.75}"
        stroke-linecap="round"
      />
    </svg>
  `;
}

export default Spinner;
