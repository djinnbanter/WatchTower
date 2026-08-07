import { useEffect, useMemo, useState } from 'react';
import AnimatedList from '@/components/animated-list/AnimatedList';
import { navigate } from '@/app/router';
import { str } from '@/lib/utils';
import { AlertTriangle, ChevronRight, ExternalLink } from '@/ui/icons';
import { FadeIn } from '@/ui/motion';
import { Button, EmptyState, StatusPill } from '@/ui/patterns';
import { ModsSearch } from './components';

type SeverityTone = 'danger' | 'warn' | 'info' | 'neutral';

type ConflictRow = {
  key: string;
  mod_id: string;
  title: string;
  why: string;
  severity: string;
  category: string;
  fix: string;
  fix_steps: string[];
  action: string;
  action_detail: string;
  sample_line: string;
  modrinth_url: string;
  doc_url: string;
  count: number;
};

const CATEGORY_LABEL: Record<string, string> = {
  registry_missing: 'Missing registry',
  recipe_compat: 'Recipe clash',
  config: 'Config / scripts',
  mod_load_failed: 'Load failure',
  mixin_conflict: 'Mixin conflict',
  dependency: 'Dependency',
  version_mismatch: 'Version mismatch',
  issue: 'Issue',
};

function severityTone(sev: string): SeverityTone {
  const s = sev.toLowerCase();
  if (s === 'critical' || s === 'danger' || s === 'error') return 'danger';
  if (s === 'warning' || s === 'warn') return 'warn';
  if (s === 'info' || s === 'informational') return 'info';
  return 'neutral';
}

function severityRank(sev: string): number {
  const t = severityTone(sev);
  if (t === 'danger') return 0;
  if (t === 'warn') return 1;
  if (t === 'info') return 2;
  return 3;
}

function severityLabel(sev: string): string {
  const s = sev.toLowerCase();
  if (s === 'critical' || s === 'danger') return 'Critical';
  if (s === 'warning' || s === 'warn') return 'Warning';
  if (s === 'info' || s === 'informational') return 'Info';
  return sev || 'Unknown';
}

function categoryLabel(cat: string): string {
  if (!cat) return 'Conflict';
  return CATEGORY_LABEL[cat] || cat.replaceAll('_', ' ');
}

function normalizeRow(
  raw: Record<string, unknown>,
  modById: Map<string, Record<string, unknown>>,
  index: number,
): ConflictRow {
  const id = str(raw.mod_id ?? raw.id);
  const fact = modById.get(id);
  const steps = Array.isArray(raw.fix_steps)
    ? (raw.fix_steps as unknown[]).map(String).filter(Boolean)
    : raw.fix
      ? [str(raw.fix)]
      : Array.isArray(raw.hints)
        ? (raw.hints as unknown[]).map(String).filter(Boolean)
        : [];
  return {
    key: `${id || 'row'}-${index}`,
    mod_id: id,
    title:
      str(raw.title) ||
      str(fact?.modrinth_title) ||
      str(fact?.display_name) ||
      id ||
      'Unknown mod',
    why: str(raw.why ?? raw.narrative ?? raw.message),
    severity: str(raw.severity, 'warning'),
    category: str(raw.category ?? raw.kind),
    fix: str(raw.fix),
    fix_steps: steps,
    action: str(raw.action),
    action_detail: str(raw.action_detail),
    sample_line: str(raw.sample_line),
    modrinth_url:
      str(raw.modrinth_url) ||
      str(fact?.modrinth_compatible_url) ||
      str(fact?.modrinth_cta_url) ||
      str(fact?.modrinth_url),
    doc_url: str(raw.doc_url),
    count: typeof raw.count === 'number' ? raw.count : Number(raw.count) || 0,
  };
}

function ConflictDetail({
  row,
  onOpenLogErrors,
}: {
  row: ConflictRow | null;
  onOpenLogErrors?: (modId: string) => void;
}) {
  if (!row) {
    return (
      <aside className="md-detail md-detail--empty" role="complementary" aria-label="Conflict details">
        <EmptyState title="Select a conflict">
          Pick a row to see what broke, why it matters, and the fix steps.
        </EmptyState>
      </aside>
    );
  }

  const tone = severityTone(row.severity);
  const link = row.modrinth_url || row.doc_url;
  const steps = row.fix_steps;

  return (
    <aside className="md-detail md-conflicts__detail" role="complementary" aria-label={row.title}>
      <header className="md-detail__head">
        <div className="md-detail__titles">
          <div className="md-conflicts__detail-kicker">
            <StatusPill tone={tone}>{severityLabel(row.severity)}</StatusPill>
            <span className="md-conflicts__cat">{categoryLabel(row.category)}</span>
            {row.count > 0 ? (
              <span className="md-conflicts__hits">
                {row.count} hit{row.count === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
          <h2 className="md-detail__title">{row.title}</h2>
          {row.mod_id ? <p className="md-detail__sub md-detail__id">{row.mod_id}</p> : null}
        </div>
      </header>

      <div className="md-detail__body md-conflicts__detail-body">
        {row.why ? (
          <div className="md-detail__block">
            <h3>What happened</h3>
            <p className="md-drawer__desc">{row.why}</p>
          </div>
        ) : null}

        {row.fix || row.action_detail ? (
          <div className={`md-conflicts__next md-conflicts__next--${tone}`}>
            <div className="md-conflicts__next-top">
              <AlertTriangle size={16} aria-hidden />
              <span>Do this next</span>
            </div>
            <p className="md-conflicts__next-fix">{row.fix || 'Follow the steps below.'}</p>
            {row.action_detail ? (
              <p className="md-conflicts__next-detail">{row.action_detail}</p>
            ) : null}
          </div>
        ) : null}

        {steps.length ? (
          <div className="md-detail__block">
            <h3>Fix steps</h3>
            <ol className="md-conflicts__steps">
              {steps.map((s, i) => (
                <li key={i}>
                  <span className="md-conflicts__step-num" aria-hidden>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {row.sample_line ? (
          <div className="md-detail__block">
            <h3>Sample log</h3>
            <pre className="md-samples" aria-label="Sample log line">
              {row.sample_line}
            </pre>
          </div>
        ) : null}

        <div className="md-action-row">
          {row.mod_id ? (
            <Button
              kind="primary"
              onClick={() => navigate({ tab: 'mods', view: 'overview', mod: row.mod_id })}
            >
              Open in Overview
              <ChevronRight size={14} />
            </Button>
          ) : null}
          {link ? (
            <Button kind="default" onClick={() => window.open(link, '_blank', 'noopener')}>
              <ExternalLink size={14} />
              Docs / Modrinth
            </Button>
          ) : null}
          {row.mod_id && onOpenLogErrors ? (
            <Button kind="ghost" onClick={() => onOpenLogErrors(row.mod_id)}>
              Related log errors
            </Button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

export function ConflictsTab({
  recommendations,
  modIssues,
  factsMods,
  search,
  onSearch,
}: {
  recommendations: Record<string, unknown>[];
  modIssues: Record<string, unknown>[];
  factsMods: Record<string, unknown>[];
  search: string;
  onSearch: (v: string) => void;
}) {
  const modById = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const m of factsMods) {
      const id = str(m.id ?? m.mod_id);
      if (id) map.set(id, m);
    }
    return map;
  }, [factsMods]);

  const rows = useMemo(() => {
    const source = recommendations.length
      ? recommendations
      : modIssues.filter((iss) => !iss.resolved);
    return source
      .map((r, i) => normalizeRow(r, modById, i))
      .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.count - a.count);
  }, [recommendations, modIssues, modById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.mod_id,
        r.title,
        r.why,
        r.severity,
        r.category,
        r.fix,
        r.action_detail,
        categoryLabel(r.category),
        ...r.fix_steps,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !filtered.some((r) => r.key === selectedKey)) {
      setSelectedKey(filtered[0]!.key);
    }
  }, [filtered, selectedKey]);

  const selected = filtered.find((r) => r.key === selectedKey) ?? null;

  const counts = useMemo(() => {
    let critical = 0;
    let warning = 0;
    let info = 0;
    for (const r of rows) {
      const t = severityTone(r.severity);
      if (t === 'danger') critical += 1;
      else if (t === 'warn') warning += 1;
      else info += 1;
    }
    return { critical, warning, info };
  }, [rows]);

  const selectedIndex = selected ? filtered.findIndex((r) => r.key === selected.key) : -1;

  return (
    <div className="md-conflicts">
      <div className="md-chrome">
        <ModsSearch
          id="mods-conflicts-search"
          value={search}
          onChange={onSearch}
          placeholder="Search by mod, category, or fix…"
          aria-label="Search conflicts"
        />
        <div className="md-conflicts__summary" aria-label="Severity counts">
          <StatusPill tone="danger">{counts.critical} critical</StatusPill>
          <StatusPill tone="warn">{counts.warning} warning</StatusPill>
          <StatusPill tone="info">{counts.info} info</StatusPill>
        </div>
        <span className="md-chrome__count">
          {rows.length} conflict{rows.length === 1 ? '' : 's'}
          {search.trim() && filtered.length !== rows.length ? ` · ${filtered.length} shown` : ''}
        </span>
      </div>

      <p className="md-conflicts__hint">
        Compatibility and startup clashes from Scanning / health reports — not jar inventory changes.
      </p>

      {!rows.length ? (
        <div className="md-empty">
          <EmptyState title="No conflicts flagged">
            Recommendations appear here after Scanning or a health report finds mixins, recipe, or
            loader clashes.
          </EmptyState>
        </div>
      ) : !filtered.length ? (
        <div className="md-empty">
          <EmptyState title="No matching conflicts">
            Nothing matches this search. Clear the filter to see all {rows.length} conflict
            {rows.length === 1 ? '' : 's'}.
          </EmptyState>
          <Button kind="default" onClick={() => onSearch('')}>
            Clear search
          </Button>
        </div>
      ) : (
        <FadeIn>
          <div className="md-split md-conflicts__split">
            <div className="md-list md-conflicts__list">
              <AnimatedList
                className="md-conflicts__animated"
                items={filtered}
                getKey={(r) => r.key}
                selectedIndex={selectedIndex}
                showGradients={filtered.length > 6}
                enableArrowNavigation
                displayScrollbar={filtered.length > 8}
                onItemSelect={(row) => setSelectedKey(row.key)}
                renderItem={(row, _i, active) => {
                  const tone = severityTone(row.severity);
                  return (
                    <div
                      className={`md-conflicts__row md-conflicts__row--${tone}${active ? ' is-selected' : ''}`}
                    >
                      <span className="md-conflicts__row-tone" aria-hidden />
                      <div className="md-conflicts__row-main">
                        <div className="md-conflicts__row-top">
                          <span className="md-conflicts__row-title">{row.title}</span>
                          <StatusPill tone={tone}>{severityLabel(row.severity)}</StatusPill>
                        </div>
                        <p className="md-conflicts__row-meta">
                          {[
                            categoryLabel(row.category),
                            row.mod_id && row.mod_id !== row.title ? row.mod_id : null,
                            row.count > 0 ? `${row.count}× in logs` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        {row.why ? (
                          <p className="md-conflicts__row-why">{row.why}</p>
                        ) : null}
                      </div>
                    </div>
                  );
                }}
              />
            </div>
            <ConflictDetail
              row={selected}
              onOpenLogErrors={(modId) => {
                onSearch(modId);
                navigate({ tab: 'mods', view: 'log-errors' });
              }}
            />
          </div>
        </FadeIn>
      )}
    </div>
  );
}
