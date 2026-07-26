import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { str } from '@/lib/utils';
import { ChevronRight } from '@/ui/icons';
import { Button, EmptyState, StatusPill } from '@/ui/patterns';
import { ModsSearch } from './components';
import { mergeLogErrorRows } from './log-errors';
import type { LogErrorRow } from './types';

export function LogErrorsTab({
  modLogErrors,
  factsErrors,
  recommendations,
  modIssues,
  hasReport,
  search,
  onSearch,
}: {
  modLogErrors: Record<string, unknown> | null;
  factsErrors: unknown;
  recommendations: Record<string, unknown>[];
  modIssues: Record<string, unknown>[];
  hasReport: boolean;
  search: string;
  onSearch: (v: string) => void;
}) {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const scanM = useMutation({
    mutationFn: () => api.modsScan(true),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ops-cache'] });
    },
  });

  const rows = useMemo(
    () =>
      mergeLogErrorRows({
        opsBlock: modLogErrors,
        factsErrors,
        recommendations,
        modIssues,
        hasReport,
      }),
    [modLogErrors, factsErrors, recommendations, modIssues, hasReport],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const cats = Object.keys(r.by_category || {});
      const recipes = (r.top_recipes || []).map(String);
      const hay = [
        r.mod_id,
        r.display_name,
        r.category_label,
        r.why,
        r.explanation,
        ...cats,
        ...recipes,
        ...(r.sample_lines || []),
      ]
        .map((x) => str(x).toLowerCase())
        .join(' ');
      return hay.includes(q);
    });
  }, [rows, search]);

  useEffect(() => {
    if (filtered.length === 1) setOpenId(filtered[0].mod_id);
  }, [filtered]);

  if (!rows.length) {
    return (
      <div className="md-log-errors">
        <div className="md-chrome">
          <ModsSearch
            id="mods-log-errors-search"
            value={search}
            onChange={onSearch}
            placeholder="Search log errors…"
            aria-label="Search log errors"
          />
          <Button kind="default" disabled={scanM.isPending} onClick={() => scanM.mutate()}>
            {scanM.isPending ? 'Scanning…' : 'Scan now'}
          </Button>
        </div>
        <div className="md-empty">
          <EmptyState title="No mod log errors yet">
            Continuous Scanning watches for mod errors in logs. Tap Scan now to refresh the ledger.
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="md-log-errors">
      <div className="md-chrome">
        <ModsSearch
          id="mods-log-errors-search"
          value={search}
          onChange={onSearch}
          placeholder="Search log errors…"
          aria-label="Search log errors"
        />
        <Button kind="default" disabled={scanM.isPending} onClick={() => scanM.mutate()}>
          {scanM.isPending ? 'Scanning…' : 'Rescan'}
        </Button>
        <span className="md-chrome__count">
          {filtered.length} of {rows.length}
        </span>
      </div>
      <p className="md-log-errors__hint">
        Expand a row for samples, categories, and fix steps.
      </p>
      {!filtered.length ? (
        <EmptyState title="No matching log errors">
          Try another search. {rows.length} error group{rows.length === 1 ? '' : 's'} still listed.
        </EmptyState>
      ) : (
        <div className="md-card-list">
          {filtered.map((r: LogErrorRow) => {
            const open = openId === r.mod_id;
            const title = r.display_name || r.mod_id;
            const cats = Object.entries(r.by_category || {});
            const recipes = (r.top_recipes || []).map(String).filter(Boolean);
            const sources = (r.sources || []).filter(Boolean);
            return (
              <article key={r.mod_id} className={`md-card${open ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="md-card__toggle"
                  aria-expanded={open}
                  aria-controls={`md-log-error-${r.mod_id}`}
                  id={`md-log-error-btn-${r.mod_id}`}
                  onClick={() => setOpenId(open ? null : r.mod_id)}
                  aria-label={
                    open
                      ? `Hide details for ${title}`
                      : `Show details for ${title}, ${r.total} error${r.total === 1 ? '' : 's'}`
                  }
                >
                  <span className={`md-card__chev${open ? ' is-open' : ''}`} aria-hidden>
                    <ChevronRight size={16} />
                  </span>
                  <div className="md-card__main">
                    <h3>{title}</h3>
                    <p className="md-card__meta">
                      {r.mod_id}
                      {r.category_label ? ` · ${r.category_label}` : ''}
                    </p>
                  </div>
                  <div className="md-card__trail">
                    <div className="md-badges">
                      <StatusPill tone="danger">{r.total}</StatusPill>
                      {r.severity ? (
                        <StatusPill
                          tone={
                            r.severity === 'critical' || r.severity === 'danger'
                              ? 'danger'
                              : r.severity === 'info' || r.severity === 'informational'
                                ? 'info'
                                : 'warn'
                          }
                        >
                          {r.severity}
                        </StatusPill>
                      ) : null}
                      {r.boot_only ? <StatusPill tone="info">boot</StatusPill> : null}
                    </div>
                    <span className="md-card__go">{open ? 'Hide' : 'Details'}</span>
                  </div>
                </button>
                {open ? (
                  <div
                    className="md-card__expand"
                    id={`md-log-error-${r.mod_id}`}
                    role="region"
                    aria-labelledby={`md-log-error-btn-${r.mod_id}`}
                  >
                    {r.why || r.explanation ? (
                      <p className="md-card__body">{r.why || r.explanation}</p>
                    ) : null}
                    {sources.length ? (
                      <p className="md-card__sources">Sources: {sources.join(' · ')}</p>
                    ) : null}
                    {cats.length ? (
                      <div className="md-badges">
                        {cats.map(([k, v]) => (
                          <StatusPill key={k} tone="neutral">
                            {String(k).replace(/_/g, ' ')} · {String(v)}
                          </StatusPill>
                        ))}
                      </div>
                    ) : null}
                    {recipes.length ? (
                      <div>
                        <p className="md-drawer__label">Top recipes</p>
                        <ul className="md-simple-list">
                          {recipes.map((recipe) => (
                            <li key={recipe}>
                              <code className="text-xs">{recipe}</code>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {r.sample_lines?.length ? (
                      <pre className="md-samples" aria-label="Sample log lines">
                        {r.sample_lines.join('\n')}
                      </pre>
                    ) : null}
                    {r.fix_steps?.length ? (
                      <ol className="md-steps">
                        {r.fix_steps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                    ) : null}
                    {r.doc_url ? (
                      <Button
                        kind="ghost"
                        onClick={() => window.open(r.doc_url!, '_blank', 'noopener')}
                      >
                        Open docs
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
