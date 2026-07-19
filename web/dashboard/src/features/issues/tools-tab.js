/**
 * Issues Tools — Mark all reviewed, Hidden suppressions, tips.
 */
import { html } from '../../lib/preact.js';
import { navigate } from '../../app/router.js';
import { Section, MetricTile } from '../../ui/patterns/index.js';
import { Badge, Button, Card } from '../../ui/primitives/index.js';

export function ToolsTab({
  needsCount,
  watchingCount,
  reviewedCount,
  hidden,
  onAckAll,
  onUnsuppress,
  acking,
  hasActive,
}) {
  const hiddenList = Array.isArray(hidden) ? hidden : [];

  return html`
    <div class="issues-tools">
      <div class="issues-kpi-strip">
        <div class="feat-kpi-row issues-kpi-strip__metrics">
          <${MetricTile}
            label="Needs attention"
            value=${needsCount}
            tone=${needsCount > 0 ? 'danger' : 'ok'}
            padding="12"
          />
          <${MetricTile}
            label="Worth watching"
            value=${watchingCount}
            tone=${watchingCount > 0 ? 'warn' : null}
            padding="12"
          />
          <${MetricTile}
            label="Reviewed"
            value=${reviewedCount}
            padding="12"
          />
        </div>
        <div class="issues-kpi-strip__actions">
          <${Button}
            kind="primary"
            size="sm"
            loading=${acking}
            disabled=${!hasActive}
            onClick=${onAckAll}
          >Mark all reviewed</${Button}>
          <${Button}
            kind="neutral"
            size="sm"
            onClick=${() => navigate('issues', { view: 'active' })}
          >Open Active</${Button}>
        </div>
      </div>

      <${Section}
        title="Hidden (suppressed)"
        subtitle="Won’t show in Active until restored"
        badge=${hiddenList.length
          ? html`<${Badge} tone="neutral">${hiddenList.length}</${Badge}>`
          : null}
      >
        ${!hiddenList.length ? html`
          <p class="issues-tools__hint">
            No suppressed issue ids. On Active, use <strong>Don't show again</strong> on a report finding
            to silence a noisy id (see Rules / crash rule packs).
          </p>
        ` : html`
          <div class="issues-list">
            ${hiddenList.map((issue) => html`
              <${Card} tone="neutral" className="issues-card" padding="12" key=${issue.id}>
                <div class="issues-card__top">
                  <div class="issues-card__title-row">
                    <${Badge} tone="neutral">hidden</${Badge}>
                    <strong class="issues-card__title">${issue.id || 'Issue'}</strong>
                  </div>
                  <${Button} kind="neutral" size="sm" onClick=${() => onUnsuppress(issue.id)}>
                    Restore
                  </${Button}>
                </div>
                ${issue.message ? html`<p class="issues-card__narrative">${issue.message}</p>` : null}
              </${Card}>
            `)}
          </div>
        `}
      </${Section}>

      <${Section} title="Tips">
        <ul class="issues-tools__tips">
          <li>Issues is the cross-cutting fix inbox — deep crash forensics live on <strong>Crashes</strong>, mod inventory on <strong>Mods</strong>.</li>
          <li><strong>Mark reviewed</strong> clears the queue; <strong>Don't show again</strong> hides a report issue id until you restore it here.</li>
          <li>Live lag / mod / log-stale rows come from the ops peek (no full report required).</li>
          <li>Crash rows on Active only point at Crashes — open that tab for Fix · Evidence · Details.</li>
        </ul>
      </${Section}>
    </div>
  `;
}
