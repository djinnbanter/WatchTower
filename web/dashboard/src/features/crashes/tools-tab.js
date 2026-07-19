import { html, useState } from '../../lib/preact.js';
import { forensicsFindClass } from '../../api/endpoints.js';
import { navigate } from '../../app/router.js';
import { Section, EmptyState, MetricTile } from '../../ui/patterns/index.js';
import { Button, TextField } from '../../ui/primitives/index.js';
import { formatAge, toast } from './helpers.js';

/**
 * Tools subtab — Scan, Mark all, Find owning jar, short tips.
 */
export function ToolsTab({
  grouped,
  latestAt,
  onScan,
  scanning,
  onAckAll,
  acking,
}) {
  const [query, setQuery] = useState('');
  const [finding, setFinding] = useState(false);
  const [result, setResult] = useState(null);

  const needsReview = grouped?.unreviewed_groups ?? 0;
  const total = grouped?.count ?? 0;
  const unreviewedFiles = grouped?.unreviewed ?? 0;

  async function handleFind() {
    const q = query.trim();
    if (!q) {
      toast('Enter a class or package name', 'warn');
      return;
    }
    setFinding(true);
    setResult(null);
    try {
      const classPath = q.includes('/') ? q : q.replace(/\./g, '/');
      const res = await forensicsFindClass({ class: classPath, include_nested: true });
      setResult(res);
      const n = res?.matches?.length ?? 0;
      toast(n ? `Found ${n} match(es)` : (res?.error || 'No owning jar found'), n ? 'success' : 'warn');
    } catch (e) {
      toast(e?.message || 'Find owning jar failed', 'error');
    } finally {
      setFinding(false);
    }
  }

  return html`
    <div class="crashes-tools">
      <div class="crashes-kpi-strip">
        <div class="feat-kpi-row crashes-kpi-strip__metrics">
          <${MetricTile}
            label="Needs review"
            value=${needsReview}
            tone=${needsReview > 0 ? 'danger' : 'ok'}
            padding="12"
          />
          <${MetricTile}
            label="Total crashes"
            value=${total}
            padding="12"
          />
          <${MetricTile}
            label="Latest age"
            value=${latestAt ? 1 : 0}
            format=${() => (latestAt ? formatAge(latestAt) : '—')}
            padding="12"
          />
        </div>
        <div class="crashes-kpi-strip__actions">
          <${Button}
            kind="neutral"
            size="sm"
            loading=${acking}
            disabled=${!(unreviewedFiles > 0)}
            onClick=${onAckAll}
          >Mark all reviewed</${Button}>
          <${Button}
            kind="primary"
            size="sm"
            loading=${scanning}
            onClick=${onScan}
          >Scan now</${Button}>
        </div>
      </div>

      <${Section} title="Find owning jar">
        <p class="crashes-tools__hint">
          Look up which mod jar contains a class or package from a stack trace.
          Same lookup as Mods → Forensics.
        </p>
        <div class="crashes-tools__find">
          <${TextField}
            value=${query}
            onInput=${(e) => setQuery(e.target.value)}
            placeholder="e.g. com.example.ModClass or path/to/Class"
            aria-label="Class or package name"
            onKeyDown=${(e) => { if (e.key === 'Enter') handleFind(); }}
          />
          <${Button} kind="neutral" size="sm" loading=${finding} onClick=${handleFind}>
            Find
          </${Button}>
        </div>
        ${result?.matches?.length ? html`
          <ul class="crashes-tools__matches">
            ${result.matches.slice(0, 20).map((m, i) => html`
              <li key=${i}>
                <code>${m.jar}</code>
                <span>${m.mod_id || '?'}</span>
                ${m.entry ? html`<span class="text-caption">${m.entry}</span>` : null}
              </li>
            `)}
          </ul>
        ` : result && !result.matches?.length ? html`
          <${EmptyState}
            title="No matches"
            body=${result.error || 'Nothing in the class index matched that name. Run a full report if the index is empty.'}
          />
        ` : null}
      </${Section}>

      <${Section} title="Tips">
        <ul class="crashes-tools__tips">
          <li>
            <strong>Groups</strong> — similar crash reports share a fingerprint so you fix once, not once per file.
          </li>
          <li>
            <strong>Mark reviewed</strong> — moves the group from Review to Reviewed and clears the inbox bell. Files stay on disk; use Logs to read them anytime.
          </li>
          <li>
            <strong>Scan vs full report</strong> — Scan re-reads the crash folder quickly. A full report refreshes richer facts (pre-crash context, rule hits, Modrinth cache).
          </li>
          <li>
            More tooling: <button type="button" class="ui-link" onClick=${() => navigate('mods', { view: 'forensics' })}>Mods → Forensics</button>
            ${' · '}
            <button type="button" class="ui-link" onClick=${() => navigate('logs')}>Logs</button>
          </li>
        </ul>
      </${Section}>
    </div>
  `;
}
