import { useMemo } from 'react';
import { navigate } from '@/app/router';
import { asArray, asRecord, num, str } from '@/lib/utils';
import { ChevronRight } from '@/ui/icons';
import { Button, EmptyState, StatusPill } from '@/ui/patterns';
import { ModsSearch } from './components';

type ChangeKind = 'added' | 'removed' | 'changed';

const KIND_META: Record<
  ChangeKind,
  { title: string; tone: 'ok' | 'danger' | 'warn'; mark: string; verb: string }
> = {
  added: { title: 'Added', tone: 'ok', mark: '+', verb: 'added' },
  removed: { title: 'Removed', tone: 'danger', mark: '−', verb: 'removed' },
  changed: { title: 'Changed', tone: 'warn', mark: '~', verb: 'changed' },
};

function formatBytes(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n < 0) return null;
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 2 : 1)} MB`;
}

function formatSizeDelta(prev: number | null | undefined, next: number | null | undefined): string | null {
  if (prev == null || next == null || !Number.isFinite(prev) || !Number.isFinite(next)) return null;
  const delta = next - prev;
  if (delta === 0) return `${formatBytes(next)} · same size`;
  const sign = delta > 0 ? '+' : '−';
  return `${formatBytes(prev)} → ${formatBytes(next)} (${sign}${formatBytes(Math.abs(delta))})`;
}

function matchesSearch(it: Record<string, unknown>, q: string, factsById: Map<string, Record<string, unknown>>) {
  if (!q) return true;
  const id = str(it.mod_id ?? it.id ?? it.name);
  const name = str(it.display_name ?? it.name ?? factsById.get(id)?.display_name ?? id);
  const jar = str(it.jar ?? it.jar_name ?? it.path);
  return (
    name.toLowerCase().includes(q) ||
    id.toLowerCase().includes(q) ||
    jar.toLowerCase().includes(q)
  );
}

function formatVersionDelta(prev: string, next: string): string | null {
  if (!prev && !next) return null;
  if (prev && next && prev !== next) return `${prev} → ${next}`;
  if (next && !prev) return next;
  if (prev && !next) return `${prev} → ?`;
  if (prev && next && prev === next) return next;
  return next || prev || null;
}

function ChangeRow({
  item,
  kind,
  factsById,
  onSearch,
}: {
  item: Record<string, unknown>;
  kind: ChangeKind;
  factsById: Map<string, Record<string, unknown>>;
  onSearch: (v: string) => void;
}) {
  const id = str(item.mod_id ?? item.id ?? item.name);
  const fact = id ? factsById.get(id) : undefined;
  const name = str(item.display_name ?? item.name ?? fact?.display_name ?? id);
  const jar = str(item.jar ?? item.jar_name);
  const prevJar = str(item.prev_jar);
  const version = str(item.version || fact?.version);
  const prevVersion = str(item.prev_version || item.old_version || item.previous_version);
  const versionDelta = kind === 'changed' ? formatVersionDelta(prevVersion, version) : null;
  const versionChanged = !!(prevVersion && version && prevVersion !== version);
  const jarRenamed = !!(prevJar && jar && prevJar !== jar);
  const sizeBit =
    kind === 'changed'
      ? formatSizeDelta(num(item.prev_size, NaN), num(item.size, NaN))
      : formatBytes(num(item.size, NaN));

  const changeBits: string[] = [];
  if (kind === 'changed') {
    if (jarRenamed) changeBits.push(`${prevJar} → ${jar}`);
    else if (jar) changeBits.push(jar);
    if (sizeBit) changeBits.push(sizeBit);
    if (!versionChanged && !jarRenamed && !sizeBit) {
      changeBits.push('File replaced since last report');
    }
  }

  const metaBits =
    kind === 'changed'
      ? [id && id !== name ? id : null, ...changeBits].filter(Boolean)
      : [
          id && id !== name ? id : null,
          jar || null,
          version ? `v${version}` : null,
          sizeBit,
        ].filter(Boolean);

  const canOpen = !!id && kind !== 'removed';
  const meta = KIND_META[kind];
  const ariaChange =
    kind === 'changed' && versionChanged
      ? `${name} updated from ${prevVersion} to ${version}`
      : `${name}, ${meta.verb}`;

  return (
    <li>
      <button
        type="button"
        className={`md-changes__row md-changes__row--${kind}${canOpen ? '' : ' is-static'}`}
        disabled={!canOpen}
        onClick={() => {
          if (!canOpen || !id) return;
          onSearch('');
          navigate({ tab: 'mods', view: 'overview', mod: id });
        }}
        aria-label={
          canOpen
            ? `${ariaChange}. Open ${name} in Overview`
            : `${ariaChange}${jar ? `, ${jar}` : ''}`
        }
      >
        <span className="md-changes__mark" aria-hidden>
          {meta.mark}
        </span>
        <span className="md-changes__main">
          <span className="md-changes__name-row">
            <span className="md-changes__name">{name}</span>
            {kind === 'changed' && versionDelta ? (
              versionChanged ? (
                <span className="md-changes__ver-delta" title={`Was ${prevVersion}, now ${version}`}>
                  <span className="md-changes__ver-delta__prev">{prevVersion}</span>
                  <span className="md-changes__ver-delta__arrow" aria-hidden>
                    →
                  </span>
                  <span className="md-changes__ver-delta__next">{version}</span>
                </span>
              ) : (
                <StatusPill tone="warn">{version}</StatusPill>
              )
            ) : null}
            {version && kind === 'added' ? <StatusPill tone="ok">{version}</StatusPill> : null}
          </span>
          {metaBits.length ? (
            <span className="md-changes__meta">{metaBits.join(' · ')}</span>
          ) : null}
        </span>
        {canOpen ? (
          <span className="md-changes__go">
            Overview
            <ChevronRight size={14} aria-hidden />
          </span>
        ) : (
          <span className="md-changes__trail">
            <StatusPill tone="danger">removed</StatusPill>
          </span>
        )}
      </button>
    </li>
  );
}

export function ChangesTab({
  modsInventory,
  search,
  onSearch,
  factsMods,
}: {
  modsInventory: Record<string, unknown> | null;
  search: string;
  onSearch: (v: string) => void;
  factsMods: Record<string, unknown>[];
}) {
  const diff = asRecord(modsInventory?.diff);
  const added = asArray<Record<string, unknown>>(diff.added);
  const removed = asArray<Record<string, unknown>>(diff.removed);
  const changed = asArray<Record<string, unknown>>(diff.changed);
  const tldr = str(modsInventory?.tldr);
  const hasChanges = !!diff.has_changes || added.length + removed.length + changed.length > 0;

  const factsById = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const m of factsMods) {
      const id = str(m.id ?? m.mod_id);
      if (id) map.set(id, m);
    }
    return map;
  }, [factsMods]);

  const q = search.trim().toLowerCase();
  const groups = useMemo(() => {
    const filter = (items: Record<string, unknown>[]) =>
      items.filter((it) => matchesSearch(it, q, factsById));
    return [
      { kind: 'added' as const, items: filter(added) },
      { kind: 'removed' as const, items: filter(removed) },
      { kind: 'changed' as const, items: filter(changed) },
    ];
  }, [added, removed, changed, q, factsById]);

  const total = added.length + removed.length + changed.length;
  const visible = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="md-changes">
      <div className="md-chrome">
        <ModsSearch
          id="mods-changes-search"
          value={search}
          onChange={onSearch}
          placeholder="Search by name, id, or jar…"
          aria-label="Search jar changes"
        />
        <div className="md-changes__summary" aria-label="Change counts">
          <StatusPill tone="ok">
            +{added.length} added
          </StatusPill>
          <StatusPill tone="danger">
            −{removed.length} removed
          </StatusPill>
          <StatusPill tone="warn">
            ~{changed.length} changed
          </StatusPill>
        </div>
        <span className="md-chrome__count">
          {total} change{total === 1 ? '' : 's'}
          {q && visible !== total ? ` · ${visible} shown` : ''}
        </span>
      </div>

      {tldr && hasChanges ? <p className="md-changes__hint">{tldr}</p> : null}
      {!hasChanges ? (
        <div className="md-empty">
          <EmptyState title="No jar changes">
            The mod folder matches the last report — no added, removed, or changed jars.
          </EmptyState>
        </div>
      ) : !visible ? (
        <div className="md-empty">
          <EmptyState title="No matching jar changes">
            Nothing matches this search. Clear the filter to see all {total} change
            {total === 1 ? '' : 's'}.
          </EmptyState>
          <Button kind="default" onClick={() => onSearch('')}>
            Clear search
          </Button>
        </div>
      ) : (
        <div className="md-changes__board">
          {groups.map(({ kind, items }) =>
            items.length ? (
              <section
                key={kind}
                className={`md-changes__band md-changes__band--${kind}`}
                aria-label={KIND_META[kind].title}
              >
                <header className="md-changes__band-head">
                  <h3>
                    <span className="md-changes__band-mark" aria-hidden>
                      {KIND_META[kind].mark}
                    </span>
                    {KIND_META[kind].title}
                  </h3>
                  <StatusPill tone={KIND_META[kind].tone}>{items.length}</StatusPill>
                </header>
                <ul className="md-changes__list">
                  {items.map((it, i) => (
                    <ChangeRow
                      key={`${str(it.mod_id ?? it.jar)}-${i}`}
                      item={it}
                      kind={kind}
                      factsById={factsById}
                      onSearch={onSearch}
                    />
                  ))}
                </ul>
              </section>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
