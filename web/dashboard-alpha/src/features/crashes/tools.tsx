import { useState } from 'react';
import { api } from '@/api/client';
import { navigate } from '@/app/router';
import { Button, EmptyState } from '@/ui/patterns';
import { asArray, asRecord, str } from '@/lib/utils';
import { formatAge } from './helpers';

export function CrashTools({
  needsReview,
  total,
  unreviewedFiles,
  latestAt,
  onMarkAll,
  onScan,
  busy,
}: {
  needsReview: number;
  total: number;
  unreviewedFiles: number;
  latestAt: string | number | null;
  onMarkAll: () => void;
  onScan: () => void;
  busy: boolean;
}) {
  const [query, setQuery] = useState('');
  const [finding, setFinding] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const handleFind = async () => {
    const q = query.trim();
    if (!q) return;
    setFinding(true);
    setResult(null);
    try {
      const classPath = q.includes('/') ? q : q.replace(/\./g, '/');
      const res = await api.forensicsFindClass({ class: classPath, include_nested: true });
      setResult(asRecord(res));
    } catch (e) {
      setResult({ error: (e as Error)?.message || 'Find owning jar failed', matches: [] });
    } finally {
      setFinding(false);
    }
  };

  const matches = asArray<Record<string, unknown>>(result?.matches);

  return (
    <div className="cr-tools">
      <div className="cr-kpi-strip">
        <div className="cr-kpi">
          <div className="cr-kpi__label">Needs review</div>
          <div className={`cr-kpi__value${needsReview ? ' cr-kpi__value--danger' : ''}`}>{needsReview}</div>
        </div>
        <div className="cr-kpi">
          <div className="cr-kpi__label">Total crashes</div>
          <div className="cr-kpi__value">{total}</div>
        </div>
        <div className="cr-kpi">
          <div className="cr-kpi__label">Unreviewed files</div>
          <div className="cr-kpi__value">{unreviewedFiles}</div>
        </div>
        <div className="cr-kpi">
          <div className="cr-kpi__label">Latest age</div>
          <div className="cr-kpi__value cr-kpi__value--sm">{formatAge(latestAt)}</div>
        </div>
      </div>

      <div className="cr-card">
        <h3 className="cr-card__title">Mark all reviewed</h3>
        <p className="cr-card__hint">
          Acknowledges every unreviewed crash file. Files stay on disk — this only clears the Review queue.
        </p>
        <Button kind="primary" disabled={busy || unreviewedFiles <= 0} onClick={onMarkAll}>
          Mark {unreviewedFiles || 'all'} reviewed
        </Button>
      </div>

      <div className="cr-card">
        <h3 className="cr-card__title">Scan now</h3>
        <p className="cr-card__hint">
          Refresh crash grouping from the current ops cache and facts (preview refreshes fixtures).
        </p>
        <Button disabled={busy} onClick={onScan}>
          Scan now
        </Button>
      </div>

      <div className="cr-card">
        <h3 className="cr-card__title">Find owning jar</h3>
        <p className="cr-card__hint">
          Look up which mod jar contains a class or package from a stack trace. Same lookup as Mods → Forensics.
        </p>
        <div className="cr-find-row">
          <input
            className="cr-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. com.example.ModClass"
            aria-label="Class or package name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleFind();
            }}
          />
          <Button disabled={finding || !query.trim()} onClick={() => void handleFind()}>
            {finding ? 'Finding…' : 'Find'}
          </Button>
        </div>
        {matches.length ? (
          <ul className="cr-find-matches">
            {matches.slice(0, 20).map((m, i) => (
              <li key={`${str(m.jar)}-${i}`}>
                <code>{str(m.jar, '?')}</code>
                <span>{str(m.mod_id, '?')}</span>
                {str(m.entry || m.inner_path) ? (
                  <span className="cr-find-matches__entry">{str(m.entry || m.inner_path)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : result && !matches.length ? (
          <EmptyState title="No matches">
            {str(result.error, 'Nothing in the class index matched that name.')}
          </EmptyState>
        ) : null}
      </div>

      <div className="cr-card cr-card--tips">
        <h3 className="cr-card__title">Tips</h3>
        <ul className="cr-tips">
          <li>Group by fingerprint — same exception + mods stay together across days.</li>
          <li>Ack a file when that crash is fixed; mark the group when the pattern is done.</li>
          <li>Use Evidence for pre-crash TPS when Scanning has context for that file.</li>
        </ul>
        <div className="cr-tips__links">
          <Button onClick={() => navigate({ tab: 'mods', view: 'forensics', group: null })}>
            Mods → Forensics
          </Button>
          <Button onClick={() => navigate({ tab: 'logs', view: null, group: null })}>
            Open Logs
          </Button>
        </div>
      </div>
    </div>
  );
}
