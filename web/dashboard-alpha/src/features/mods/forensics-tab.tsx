import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { navigate } from '@/app/router';
import { asArray, asRecord, str } from '@/lib/utils';
import { Button, EmptyState, StatusPill } from '@/ui/patterns';
import { ModsSearch } from './components';

export function ForensicsTab({
  factsOptional,
  search,
  onSearch,
  hasReport,
}: {
  factsOptional: Record<string, unknown>;
  search: string;
  onSearch: (v: string) => void;
  hasReport: boolean;
}) {
  const statusQ = useQuery({
    queryKey: ['forensics-status'],
    queryFn: api.forensicsStatus,
  });

  const [tick, setTick] = useState(0);
  useEffect(() => {
    void tick;
  }, [tick]);

  const status = asRecord(statusQ.data);
  const mf = asRecord(factsOptional.mod_forensics);
  const deep = asRecord(status.mods_deep);
  const health =
    Array.isArray(deep.config_health) && deep.config_health.length
      ? asArray<Record<string, unknown>>(deep.config_health)
      : asArray<Record<string, unknown>>(factsOptional.config_health);
  const corrupt =
    Array.isArray(deep.corrupt_jars) && deep.corrupt_jars.length
      ? asArray<Record<string, unknown>>(deep.corrupt_jars)
      : asArray<Record<string, unknown>>(mf.corrupt_jars);
  const hasDeepLedger =
    !!(deep && deep.status === 'ok') || corrupt.length > 0 || health.length > 0;

  const q = search.trim().toLowerCase();
  const corruptFiltered = useMemo(() => {
    if (!q) return corrupt;
    return corrupt.filter(
      (c) =>
        str(c.path).toLowerCase().includes(q) ||
        str(c.reason).toLowerCase().includes(q) ||
        str(c.source).toLowerCase().includes(q),
    );
  }, [corrupt, q]);
  const healthFiltered = useMemo(() => {
    if (!q) return health;
    return health.filter(
      (c) => str(c.path).toLowerCase().includes(q) || str(c.reason).toLowerCase().includes(q),
    );
  }, [health, q]);

  const index = asRecord(status.index);
  const indexState = str(index.state ?? mf.class_index_status, '—');
  const masterOff = asRecord(status.config).mod_forensics_scan === false;
  const skipped = masterOff || indexState === 'skipped';
  const jarCount = index.jar_count;
  const entryCount = index.entry_count;
  const stale = !!index.stale;
  const indexTone =
    skipped ? 'neutral' : stale ? 'warn' : indexState === 'ready' || indexState === 'ok' ? 'ok' : 'info';

  if (skipped) {
    return (
      <div className="md-empty">
        <EmptyState title="Forensics is off">
          Enable MOD_FORENSICS_SCAN in watchtower.conf to index jars for Find owning jar, corrupt
          scans, and config health.
        </EmptyState>
        <Button kind="default" onClick={() => navigate({ tab: 'settings', panel: 'integrations' })}>
          Open Settings
        </Button>
      </div>
    );
  }

  return (
    <div className="md-forensics">
      <div className="md-chrome">
        <ModsSearch
          id="mods-forensics-search"
          value={search}
          onChange={onSearch}
          placeholder="Search corrupt jars or config paths…"
          aria-label="Search forensics findings"
        />
        <Button
          kind="default"
          disabled={statusQ.isFetching}
          onClick={() => {
            void statusQ.refetch();
            setTick((t) => t + 1);
          }}
        >
          {statusQ.isFetching ? 'Refreshing…' : 'Refresh status'}
        </Button>
      </div>

      <div className="md-forensics__kpis">
        <div className="md-forensics__kpi">
          <span className="md-forensics__kpi-label">Class index</span>
          <span className="md-forensics__kpi-value">
            <StatusPill tone={indexTone as 'ok' | 'warn' | 'neutral' | 'info'}>{indexState}</StatusPill>
            {stale ? <StatusPill tone="warn">stale</StatusPill> : null}
          </span>
          <span className="md-forensics__kpi-hint">
            {jarCount != null
              ? `${jarCount} jars · ${entryCount ?? 0} entries`
              : 'From live status / last report'}
          </span>
        </div>
        <div className="md-forensics__kpi">
          <span className="md-forensics__kpi-label">Corrupt jars</span>
          <span className="md-forensics__kpi-value">{corrupt.length}</span>
          <span className="md-forensics__kpi-hint">
            {q
              ? `${corruptFiltered.length} match search`
              : hasDeepLedger
                ? 'From continuous ledger'
                : 'Awaiting continuous scan'}
          </span>
        </div>
        <div className="md-forensics__kpi">
          <span className="md-forensics__kpi-label">Config issues</span>
          <span className="md-forensics__kpi-value">{health.length}</span>
          <span className="md-forensics__kpi-hint">
            {q
              ? `${healthFiltered.length} match search`
              : hasDeepLedger
                ? 'From continuous ledger'
                : 'Awaiting continuous scan'}
          </span>
        </div>
      </div>

      <div className="md-forensics__hint">
        {indexState === 'idle' ? (
          <p>
            No class index yet — it builds on jar change / boot seed, or first{' '}
            <strong>Crashes → Find owning jar</strong>.
          </p>
        ) : (
          <p>
            Use <strong>Crashes → Find owning jar</strong> to resolve stack frames, or the CLI{' '}
            <code>watchtower forensics find-class</code>.
          </p>
        )}
        {!hasDeepLedger && !hasReport ? (
          <p className="md-forensics__hint-warn">
            Continuous Mods deep is warming — corrupt / config lists appear after jar inventory or
            boot seed (no deep audit required).
          </p>
        ) : null}
      </div>

      <div className="md-forensics__panels">
        <section className="md-forensics__panel">
          <header className="md-forensics__panel-head">
            <h3>Corrupt jars</h3>
            <StatusPill tone={corruptFiltered.length ? 'danger' : 'ok'}>
              {corruptFiltered.length}
            </StatusPill>
          </header>
          {corruptFiltered.length ? (
            <ul className="md-forensics__findings">
              {corruptFiltered.slice(0, 40).map((c, i) => (
                <li className="md-forensics__finding md-forensics__finding--danger" key={i}>
                  <div>
                    <span className="md-forensics__finding-path">{str(c.path, '?')}</span>
                    <span className="md-forensics__finding-meta">
                      {[c.source, c.reason].filter(Boolean).map(String).join(' · ')}
                    </span>
                  </div>
                  <StatusPill tone="danger">{str(c.reason, 'corrupt')}</StatusPill>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No corrupt jars">Nothing flagged in the continuous ledger.</EmptyState>
          )}
        </section>

        <section className="md-forensics__panel">
          <header className="md-forensics__panel-head">
            <h3>Config health</h3>
            <StatusPill tone={healthFiltered.length ? 'warn' : 'ok'}>
              {healthFiltered.length}
            </StatusPill>
          </header>
          {healthFiltered.length ? (
            <ul className="md-forensics__findings">
              {healthFiltered.slice(0, 40).map((c, i) => (
                <li className="md-forensics__finding" key={i}>
                  <div>
                    <span className="md-forensics__finding-path">{str(c.path, '?')}</span>
                    <span className="md-forensics__finding-meta">{str(c.reason)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No config issues">Config health looks clean.</EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}
