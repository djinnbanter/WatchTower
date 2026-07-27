import { html } from '../../lib/preact.js';
import { useStaggerPhase } from '../../motion/mount-enter.js';
import { staggerStyle } from '../../motion/transitions.js';

/**
 * StaggerList — mount/filter-keyed stagger for list children.
 * Applies ui-list--entering / settled; sets --ui-stagger-index on wrappers.
 * StaggerList({ children, className, resetKey })
 */
export function StaggerList({ children, className = '', resetKey = 'list' }) {
  const raw = Array.isArray(children) ? children : children != null ? [children] : [];
  const kids = raw.filter((child) => child != null && child !== false && child !== true);
  const phase = useStaggerPhase(resetKey, { childCount: kids.length });

  return html`
    <div class=${[`ui-list`, `ui-list--${phase}`, className].filter(Boolean).join(' ')}>
      ${kids.map((child, i) => html`
        <div key=${i} class="ui-list__item" style=${staggerStyle(i)}>${child}</div>
      `)}
    </div>
  `;
}

export default StaggerList;
