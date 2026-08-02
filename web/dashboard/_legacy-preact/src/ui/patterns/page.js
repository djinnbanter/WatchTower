import { html } from '../../lib/preact.js';
import { Motion } from '../../motion/reduced.js';
import { useMountEnter } from '../../motion/mount-enter.js';
import { staggerStyle } from '../../motion/transitions.js';

/**
 * Page({ title, subtitle, actions, children, footerSubtitle, tour, route })
 * Top-level page layout with mount-once stagger-enter children.
 */
export function Page({ title, subtitle, actions, children, footerSubtitle, tour, route }) {
  const raw = Array.isArray(children) ? children : children != null ? [children] : [];
  // Preact/htm leaves `false`/`null` for inactive `${cond && html`…`}` branches —
  // wrapping those still creates flex-gap holes in .ui-page__body.
  const kids = raw.filter((child) => child != null && child !== false && child !== true);

  const routeId = route || tour || undefined;
  const { motion, ref } = useMountEnter({ childCount: Math.max(kids.length, 1) });

  const staggeredKids = Motion.enabled
    ? kids.map((child, i) =>
        html`<div key=${i} style=${staggerStyle(i)}>${child}</div>`
      )
    : kids;

  return html`
    <div
      ref=${ref}
      class="ui-page"
      data-route=${routeId}
      data-motion=${motion}
    >
      <div class="ui-page__header">
        <div class="ui-page__title-group">
          ${title && html`<h1 class="ui-page__title">${title}</h1>`}
          ${subtitle && html`<p class="ui-page__subtitle">${subtitle}</p>`}
        </div>
        ${actions && html`<div class="ui-page__actions">${actions}</div>`}
      </div>
      <div class="ui-page__body">
        ${staggeredKids}
      </div>
      ${footerSubtitle && html`
        <div class="ui-freshness-footer" style=${{ paddingBottom: 'var(--ui-sp-8)' }}>
          <span class="ui-freshness-footer__subtitle">${footerSubtitle}</span>
        </div>
      `}
    </div>
  `;
}

export default Page;
