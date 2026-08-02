import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useCanWrite, VIEW_ONLY_TITLE } from '@/app/permissions';
import { str } from '@/lib/utils';
import { acksMapFromResponse, isIssueAcked } from '@/features/issues/helpers';
import { CheckCircle2, ChevronRight } from '@/ui/icons';
import { Button, EmptyState, StatusPill } from '@/ui/patterns';
import { ModsSearch } from './components';
import { mergeLogErrorRows } from './log-errors';
import type { LogErrorRow } from './types';

type LogErrorBand = 'active' | 'reviewed';

function modAckKey(modId: string): string {
  return `mod:${modId}`;
}

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
  const canWrite = useCanWrite();
  const qc = useQueryClient();
  const acksQ = useQuery({ queryKey: ['issues-acks'], queryFn: api.issuesAcks });
  const [band, setBand] = useState<LogErrorBand>('active');
  const [openId, setOpenId] = useState<string | null>(null);
  const scanM = useMutation({
    mutationFn: () => api.modsScan(true),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ops-cache'] });
      void qc.invalidateQueries({ queryKey: ['issues-acks'] });
    },
  });
  const invalidateAfterAck = () => {
    void qc.invalidateQueries({ queryKey: ['issues-acks'] });
    void qc.invalidateQueries({ queryKey: ['ops-cache'] });
    void qc.invalidateQueries({ queryKey: ['issues-peek'] });
  };
  const ackM = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.ackIssue(payload),
    onSuccess: invalidateAfterAck,
  });
  const ackAllM = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.acknowledgeAllIssues(payload),
    onSuccess: invalidateAfterAck,
  });

  const ackedModIds = useMemo(() => {
    const acks = acksMapFromResponse(acksQ.data);
    const ids: string[] = [];
    for (const key of Object.keys(acks)) {
      if (key.startsWith('mod:') && isIssueAcked(acks, key)) {
        ids.push(key.slice(4));
      }
    }
    for (const iss of modIssues) {
      if (iss.resolved && str(iss.mod_id)) ids.push(str(iss.mod_id));
    }
    return ids;
  }, [acksQ.data, modIssues]);

  const mergeInput = useMemo(
    () => ({
      opsBlock: modLogErrors,
      factsErrors,
      recommendations,
      modIssues,
      hasReport,
      ackedModIds,
    }),
    [modLogErrors, factsErrors, recommendations, modIssues, hasReport, ackedModIds],
  );

  const activeRows = useMemo(
    () => mergeLogErrorRows({ ...mergeInput, band: 'active' }),
    [mergeInput],
  );
  const reviewedRows = useMemo(
    () => mergeLogErrorRows({ ...mergeInput, band: 'reviewed' }),
    [mergeInput],
  );
  const rows = band === 'reviewed' ? reviewedRows : activeRows;

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

  useEffect(() => {
    setOpenId(null);
  }, [band]);

  const busy = ackM.isPending || ackAllM.isPending;

  const markReviewed = (modId: string) => {
    const key = modAckKey(modId);
    const nextOpen =
      openId === modId
        ? (filtered.find((r) => r.mod_id !== modId)?.mod_id ?? null)
        : openId;
    ackM.mutate(
      { id: key, key, reviewed: true, ack: true },
      { onSuccess: () => setOpenId(nextOpen) },
    );
  };

  const moveToActive = (modId: string) => {
    const key = modAckKey(modId);
    ackM.mutate(
      { id: key, key, reviewed: false, ack: false },
      {
        onSuccess: () => {
          setBand('active');
          setOpenId(modId);
        },
      },
    );
  };

  const markAllReviewed = () => {
    const ids = filtered.map((r) => modAckKey(r.mod_id));
    if (!ids.length) return;
    ackAllM.mutate(
      { ids },
      {
        onSuccess: () => {
          setOpenId(null);
          setBand('reviewed');
        },
      },
    );
  };

  const bandToggle = (
    <div className="md-log-errors__bands" role="tablist" aria-label="Log error lists">
      <button
        type="button"
        role="tab"
        aria-selected={band === 'active'}
        className={`md-log-errors__band md-log-errors__band--active${band === 'active' ? ' is-active' : ''}`}
        onClick={() => setBand('active')}
      >
        Active
        <span className="md-log-errors__band-count">{activeRows.length}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={band === 'reviewed'}
        className={`md-log-errors__band md-log-errors__band--reviewed${band === 'reviewed' ? ' is-active' : ''}`}
        onClick={() => setBand('reviewed')}
      >
        Reviewed
        <span className="md-log-errors__band-count">{reviewedRows.length}</span>
      </button>
    </div>
  );

  if (!activeRows.length && !reviewedRows.length) {
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
          <Button
            kind="default"
            disabled={!canWrite || scanM.isPending}
            title={canWrite ? undefined : VIEW_ONLY_TITLE}
            onClick={() => scanM.mutate()}
          >
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
        {bandToggle}
        <Button
          kind="default"
          disabled={!canWrite || scanM.isPending}
          title={canWrite ? undefined : VIEW_ONLY_TITLE}
          onClick={() => scanM.mutate()}
        >
          {scanM.isPending ? 'Scanning…' : 'Rescan'}
        </Button>
        <Button
          kind="default"
          className={band === 'active' ? undefined : 'invisible'}
          disabled={!canWrite || busy || band !== 'active' || filtered.length === 0}
          title={canWrite ? undefined : VIEW_ONLY_TITLE}
          aria-hidden={band !== 'active'}
          tabIndex={band === 'active' ? undefined : -1}
          onClick={markAllReviewed}
        >
          Mark all reviewed
        </Button>
        <span className="md-chrome__count">
          {filtered.length} of {rows.length}
        </span>
      </div>
      <p className="md-log-errors__hint" aria-live="polite">
        {band === 'active'
          ? 'Expand a row for samples and fix steps. Mark reviewed when triaged — find them under Reviewed.'
          : 'Reviewed groups stay here while evidence is still in the ledger. Move to Active to triage again.'}
      </p>
      {!rows.length ? (
        <EmptyState
          title={band === 'reviewed' ? 'Nothing reviewed yet' : 'Active list is clear'}
        >
          {band === 'reviewed'
            ? 'Mark an active log-error group reviewed to see it here.'
            : reviewedRows.length
              ? 'Everything here is reviewed — open the Reviewed tab to browse them.'
              : 'No matching groups in this list.'}
        </EmptyState>
      ) : !filtered.length ? (
        <EmptyState title="No matching log errors">
          Try another search. {rows.length} group{rows.length === 1 ? '' : 's'} still listed.
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
                      {band === 'reviewed' ? <StatusPill tone="ok">reviewed</StatusPill> : null}
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
                    <div className="md-card__actions flex flex-wrap items-center gap-2">
                      {band === 'active' ? (
                        <Button
                          kind="primary"
                          disabled={!canWrite || busy}
                          title={canWrite ? undefined : VIEW_ONLY_TITLE}
                          onClick={() => markReviewed(r.mod_id)}
                        >
                          <CheckCircle2 size={14} className="mr-1.5" />
                          Mark reviewed
                        </Button>
                      ) : (
                        <Button
                          kind="primary"
                          disabled={!canWrite || busy}
                          title={canWrite ? undefined : VIEW_ONLY_TITLE}
                          onClick={() => moveToActive(r.mod_id)}
                        >
                          Move to Active
                        </Button>
                      )}
                      {r.doc_url ? (
                        <Button
                          kind="ghost"
                          onClick={() => window.open(r.doc_url!, '_blank', 'noopener')}
                        >
                          Open docs
                        </Button>
                      ) : null}
                    </div>
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
