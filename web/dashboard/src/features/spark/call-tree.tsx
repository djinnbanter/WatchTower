import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { navigate } from '@/app/router';
import { Search } from '@/ui/icons';
import { Button } from '@/ui/patterns';
import { array, methods as profileMethods, numeric, record, text, type SparkMethod, type UnknownRecord } from './model';
import {
  buildFlatRoots,
  buildModSections,
  filterModSections,
  formatFrameLabel,
  type FlatSort,
  type ModSection,
  type TreeNode,
} from './tree-views';

type ViewMode = 'all' | 'flat' | 'mods';

type MutableNode = Omit<TreeNode, 'children'> & { children: Map<string, MutableNode> };

type FlatItem = {
  node: TreeNode;
  depth: number;
  parentKey: string | null;
};

type VisibleRow =
  | { kind: 'section'; section: ModSection }
  | { kind: 'row'; item: FlatItem };

function heatTone(pct: number): 'high' | 'mid' | 'low' | 'none' {
  if (pct >= 50) return 'high';
  if (pct >= 20) return 'mid';
  if (pct >= 5) return 'low';
  return 'none';
}

function emptyFrameFields(label: string, _source: string): Pick<TreeNode, 'className' | 'methodName' | 'methodDesc'> {
  return {
    className: '',
    methodName: label.replace(/\(\)$/, ''),
    methodDesc: '',
  };
}

function buildTree(methods: SparkMethod[]): TreeNode[] {
  const roots = new Map<string, MutableNode>();
  for (const [methodIndex, method] of methods.slice(0, 180).entries()) {
    const chain = [...method.parentChain.slice(0, 11), method.label].filter(Boolean);
    let level = roots;
    chain.forEach((label, depth) => {
      const mapKey = `${label}:${depth}`;
      let node = level.get(mapKey);
      const source = depth === chain.length - 1 ? method.source : '';
      if (!node) {
        node = {
          key: `${methodIndex}:${depth}:${label}`,
          label,
          source,
          ...emptyFrameFields(label, source),
          pct: method.pct,
          ownPct: depth === chain.length - 1 ? method.ownPct : 0,
          inclusiveByWindow: [],
          selfByWindow: [],
          children: new Map(),
        };
        level.set(mapKey, node);
      } else {
        node.pct = Math.max(node.pct, method.pct);
        node.ownPct = Math.max(node.ownPct, depth === chain.length - 1 ? method.ownPct : 0);
        if (!node.source && depth === chain.length - 1) node.source = method.source;
      }
      level = node.children;
    });
  }

  const freeze = (nodes: Map<string, MutableNode>): TreeNode[] =>
    [...nodes.values()]
      .sort((a, b) => b.pct - a.pct)
      .map((node) => ({
        ...node,
        children: freeze(node.children),
      }));
  return freeze(roots);
}

type TreeThread = TreeNode & { name: string; selected: boolean };

function parseNode(value: unknown, fallbackKey: string): TreeNode {
  const row = record(value);
  const className = text(row.class ?? row.class_name);
  const method = text(row.method ?? row.name);
  const methodDesc = text(row.method_desc ?? row.methodDesc);
  return {
    key: text(row.id, fallbackKey),
    label: formatFrameLabel(className, method, text(row.name, 'Unknown frame')),
    source: text(row.mod_id ?? row.source, 'unknown'),
    className,
    methodName: method,
    methodDesc,
    pct: numeric(row.involvement_pct ?? row.pct),
    ownPct: numeric(row.own_pct ?? row.self_pct),
    inclusiveByWindow: array<unknown>(row.inclusive_by_window).map((item) => numeric(item)),
    selfByWindow: array<unknown>(row.self_by_window).map((item) => numeric(item)),
    children: array<unknown>(row.children).map((child, index) => parseNode(child, `${fallbackKey}.${index}`)),
  };
}

function treeThreads(profile: UnknownRecord): { threads: TreeThread[]; windows: number[]; truncated: boolean } {
  const tree = record(profile.call_tree ?? record(profile.analysis).call_tree);
  const threads = array<unknown>(tree.threads).map((value, index) => {
    const row = record(value);
    const node = parseNode(row, `thread-${index}`);
    return {
      ...node,
      name: text(row.name, `Thread ${index + 1}`),
      selected: row.selected === true,
    };
  });
  return {
    threads,
    windows: array<unknown>(tree.time_windows).map((item) => numeric(item)),
    truncated: tree.truncated === true,
  };
}

function forWindow(node: TreeNode, index: number | null, denominator: number): TreeNode {
  if (index == null) return node;
  const inclusive = node.inclusiveByWindow[index] ?? 0;
  const self = node.selfByWindow[index] ?? 0;
  return {
    ...node,
    pct: denominator > 0 ? (inclusive / denominator) * 100 : 0,
    ownPct: denominator > 0 ? (self / denominator) * 100 : 0,
    children: node.children.map((child) => forWindow(child, index, denominator)),
  };
}

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query) return nodes;
  return nodes.flatMap((node) => {
    const children = filterTree(node.children, query);
    if (node.label.toLowerCase().includes(query) || node.source.toLowerCase().includes(query) || children.length) {
      return [{ ...node, children }];
    }
    return [];
  });
}

/** Open roots + one nested level. */
function collectDefaultOpenKeys(nodes: TreeNode[]): Set<string> {
  const open = new Set<string>();
  const walk = (list: TreeNode[], depth: number) => {
    for (const node of list) {
      if (node.children.length && depth < 2) {
        open.add(node.key);
        walk(node.children, depth + 1);
      }
    }
  };
  walk(nodes, 0);
  return open;
}

/** Open only ancestors needed to reveal search matches (not every node). */
function collectSearchOpenKeys(nodes: TreeNode[], query: string): Set<string> {
  const open = new Set<string>();
  const q = query.toLowerCase();
  const walk = (list: TreeNode[], ancestors: string[]): boolean => {
    let found = false;
    for (const node of list) {
      const self =
        node.label.toLowerCase().includes(q) || node.source.toLowerCase().includes(q);
      const childFound = walk(node.children, [...ancestors, node.key]);
      if (self || childFound) {
        found = true;
        for (const key of ancestors) open.add(key);
        if (childFound) open.add(node.key);
      }
    }
    return found;
  };
  walk(nodes, []);
  return open;
}

function flattenVisible(nodes: TreeNode[], open: Set<string>, depth = 0, parentKey: string | null = null): FlatItem[] {
  const out: FlatItem[] = [];
  for (const node of nodes) {
    out.push({ node, depth, parentKey });
    if (node.children.length && open.has(node.key)) {
      out.push(...flattenVisible(node.children, open, depth + 1, node.key));
    }
  }
  return out;
}

function TreeRow({
  item,
  open,
  selected,
  onSelect,
  onToggle,
  onKeyDown,
}: {
  item: FlatItem;
  open: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  const { node, depth } = item;
  const hasChildren = node.children.length > 0;
  const tone = heatTone(node.pct);
  const title = [
    node.label,
    node.source ? `mod ${node.source}` : '',
    `${node.pct.toFixed(2)}% total`,
    `${node.ownPct.toFixed(2)}% step`,
  ].filter(Boolean).join(' · ');

  return (
    <div
      role="treeitem"
      data-tree-key={node.key}
      aria-expanded={hasChildren ? open : undefined}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      className={`sp-tree-row${selected ? ' is-selected' : ''} is-heat-${tone}`}
      style={{ '--sp-tree-depth': depth } as CSSProperties}
      title={title}
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        className={`sp-tree-row__toggle${hasChildren ? '' : ' is-leaf'}${open ? ' is-open' : ''}`}
        aria-label={hasChildren ? (open ? 'Collapse' : 'Expand') : undefined}
        tabIndex={-1}
        disabled={!hasChildren}
        onClick={(event) => {
          event.stopPropagation();
          if (hasChildren) onToggle();
        }}
      >
        {hasChildren ? (open ? '−' : '+') : ''}
      </button>

      <div className="sp-tree-row__main">
        {node.source && node.source !== 'unknown' ? (
          <span className="sp-tree-row__mod">{node.source}</span>
        ) : null}
        <span className="sp-tree-row__label">{node.label}</span>
      </div>

      <code className="sp-tree-row__pct">{node.pct.toFixed(2)}%</code>

      <div className="sp-tree-row__bar" aria-hidden="true">
        <span style={{ width: `${Math.max(node.pct > 0 ? 1.5 : 0, Math.min(100, node.pct))}%` }} />
      </div>
    </div>
  );
}

export function CallTree({
  profile,
  profilePath = '',
  initialSource = '',
}: {
  profile: UnknownRecord;
  profilePath?: string;
  initialSource?: string;
}) {
  const [search, setSearch] = useState(initialSource);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [flatSort, setFlatSort] = useState<FlatSort>('total');
  const [focusModId, setFocusModId] = useState('');
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [pendingView, setPendingView] = useState<ViewMode | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (initialSource && viewMode !== 'mods') setSearch(initialSource);
  }, [initialSource, viewMode]);

  useEffect(() => {
    if (!isPending) {
      setBusyMessage(null);
      setPendingView(null);
    }
  }, [isPending]);

  const runHeavy = (message: string, update: () => void) => {
    setBusyMessage(message);
    startTransition(update);
  };

  const selectViewMode = (mode: ViewMode) => {
    if (mode === viewMode) return;
    const label = mode === 'all' ? 'All' : mode === 'flat' ? 'Flat' : 'Mods';
    setPendingView(mode);
    runHeavy(`Building ${label} view…`, () => {
      if (mode === 'mods') {
        // Deep-links from Sources set search=modId; Mods should list every mod, not one.
        const pinned = search.trim() || initialSource;
        setFocusModId(pinned);
        setSearch('');
        if (initialSource) {
          navigate({ tab: 'spark', profile: profilePath, view: 'calls', source: null });
        }
      }
      setViewMode(mode);
    });
  };

  const sourceFilter = search.trim();
  const treeQ = useQuery({
    queryKey: ['spark-tree', profilePath],
    queryFn: () => api.sparkTree(profilePath, { max_nodes: 250_000 }),
    enabled: Boolean(profilePath),
  });
  const profileForTree = useMemo(() => {
    const remoteTree = record(record(treeQ.data).tree);
    if (!Object.keys(remoteTree).length) return profile;
    return { ...profile, call_tree: remoteTree };
  }, [profile, treeQ.data]);

  const parsed = useMemo(() => treeThreads(profileForTree), [profileForTree]);
  const defaultThread = parsed.threads.find((thread) => thread.selected)?.key ?? parsed.threads[0]?.key ?? '';
  const [threadId, setThreadId] = useState(defaultThread);
  const [windowIndex, setWindowIndex] = useState<number | null>(null);
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());
  const [openModIds, setOpenModIds] = useState<Set<string>>(() => new Set());
  const [selectedKey, setSelectedKey] = useState('');
  const treeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setThreadId((prev) => (parsed.threads.some((thread) => thread.key === prev) ? prev : defaultThread));
  }, [defaultThread, parsed.threads]);

  const selectedThread = parsed.threads.find((thread) => thread.key === threadId) ?? parsed.threads[0];
  const fallbackMethods: SparkMethod[] = useMemo(() => profileMethods(profile), [profile]);

  const baseRoots = useMemo(() => {
    if (!selectedThread) return buildTree(fallbackMethods);
    const denominator = windowIndex == null
      ? 1
      : selectedThread.inclusiveByWindow[windowIndex] ?? 0;
    return selectedThread.children.map((node) => forWindow(node, windowIndex, denominator));
  }, [fallbackMethods, selectedThread, windowIndex]);

  const query = sourceFilter.toLowerCase();

  const allModSections = useMemo(() => {
    if (viewMode !== 'mods') return [] as ModSection[];
    return buildModSections(baseRoots);
  }, [baseRoots, viewMode]);

  const modSections = useMemo(() => {
    if (viewMode !== 'mods') return [] as ModSection[];
    return filterModSections(allModSections, query);
  }, [allModSections, query, viewMode]);

  useEffect(() => {
    if (viewMode !== 'mods' || !focusModId) return undefined;
    const id = focusModId.toLowerCase();
    const match = modSections.find((section) => section.id.toLowerCase() === id);
    if (match) {
      setOpenModIds((prev) => {
        if (prev.has(match.id)) return prev;
        const next = new Set(prev);
        next.add(match.id);
        return next;
      });
    }
    const frame = requestAnimationFrame(() => {
      const el = treeRef.current?.querySelector<HTMLElement>(`[data-mod-id="${CSS.escape(focusModId)}"]`)
        ?? treeRef.current?.querySelector<HTMLElement>(`[data-mod-id="${CSS.escape(id)}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusModId, modSections, viewMode]);

  const roots = useMemo(() => {
    if (viewMode === 'flat') {
      const flat = buildFlatRoots(baseRoots, flatSort, 250);
      return filterTree(flat, query);
    }
    if (viewMode === 'mods') {
      return modSections.flatMap((section) => section.entries);
    }
    return filterTree(baseRoots, query);
  }, [baseRoots, flatSort, modSections, query, viewMode]);

  const expandScopeKey = `${viewMode}:${flatSort}:${threadId}:${windowIndex ?? 'all'}:${query}:${roots.map((node) => node.key).slice(0, 40).join('|')}`;
  useEffect(() => {
    if (viewMode === 'flat') {
      // Flat list: keep roots collapsed by default so top 250 stays scannable.
      setOpenKeys(new Set());
      return;
    }
    if (viewMode === 'mods') {
      // Mods collapsed by default; open matches when searching, or the focused mod.
      const nextMods = new Set<string>();
      if (query) {
        for (const section of modSections) nextMods.add(section.id);
      }
      if (focusModId) {
        const match = modSections.find((section) => section.id.toLowerCase() === focusModId.toLowerCase());
        if (match) nextMods.add(match.id);
      }
      setOpenModIds(nextMods);
      setOpenKeys(query ? collectSearchOpenKeys(roots, query) : new Set());
      return;
    }
    setOpenKeys(query ? collectSearchOpenKeys(roots, query) : collectDefaultOpenKeys(roots));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- expandScopeKey captures roots
  }, [expandScopeKey]);

  const maxModPct = useMemo(
    () => modSections.reduce((max, section) => Math.max(max, section.pct), 0),
    [modSections],
  );

  const visibleRows = useMemo((): VisibleRow[] => {
    if (viewMode === 'mods') {
      const rows: VisibleRow[] = [];
      for (const section of modSections) {
        rows.push({ kind: 'section', section });
        if (!openModIds.has(section.id)) continue;
        rows.push(...flattenVisible(section.entries, openKeys, 0, null).map((item) => ({ kind: 'row' as const, item })));
      }
      return rows;
    }
    return flattenVisible(roots, openKeys).map((item) => ({ kind: 'row' as const, item }));
  }, [modSections, openKeys, openModIds, roots, viewMode]);

  const visibleItems = useMemo(
    () => visibleRows.filter((row): row is Extract<VisibleRow, { kind: 'row' }> => row.kind === 'row').map((row) => row.item),
    [visibleRows],
  );

  useEffect(() => {
    if (!visibleItems.length) {
      setSelectedKey('');
      return;
    }
    setSelectedKey((prev) => (visibleItems.some((item) => item.node.key === prev) ? prev : visibleItems[0].node.key));
  }, [visibleItems]);

  const toggleKey = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleMod = (modId: string) => {
    setOpenModIds((prev) => {
      const next = new Set(prev);
      if (next.has(modId)) next.delete(modId);
      else next.add(modId);
      return next;
    });
  };

  const collapseDeep = () => {
    if (viewMode === 'flat' || viewMode === 'mods') {
      setOpenKeys(new Set());
      if (viewMode === 'mods') setOpenModIds(new Set());
      return;
    }
    setOpenKeys(collectDefaultOpenKeys(roots));
  };

  const focusKey = (key: string) => {
    setSelectedKey(key);
    requestAnimationFrame(() => {
      const safe = typeof CSS !== 'undefined' && 'escape' in CSS ? CSS.escape(key) : key.replace(/"/g, '\\"');
      treeRef.current?.querySelector<HTMLElement>(`[data-tree-key="${safe}"]`)?.focus();
    });
  };

  const onRowKeyDown = (event: KeyboardEvent<HTMLDivElement>, item: FlatItem, index: number) => {
    const hasChildren = item.node.children.length > 0;
    const isOpen = openKeys.has(item.node.key);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = visibleItems[index + 1];
      if (next) focusKey(next.node.key);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = visibleItems[index - 1];
      if (prev) focusKey(prev.node.key);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (hasChildren && !isOpen) toggleKey(item.node.key);
      else if (hasChildren && isOpen && item.node.children[0]) focusKey(item.node.children[0].key);
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (hasChildren && isOpen) toggleKey(item.node.key);
      else if (item.parentKey) focusKey(item.parentKey);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (hasChildren) toggleKey(item.node.key);
    }
  };

  const itemIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    visibleItems.forEach((item, index) => map.set(item.node.key, index));
    return map;
  }, [visibleItems]);

  const treeLoading = treeQ.isLoading || (treeQ.isFetching && !treeQ.data);
  const treeBusy = Boolean(busyMessage) || isPending || treeLoading;
  const busyText = treeLoading
    ? 'Loading call tree…'
    : busyMessage ?? 'Updating view…';
  const displayView = pendingView ?? viewMode;

  return (
    <div className={`sp-tree-panel${treeBusy ? ' is-busy' : ''}`}>
      <div className="sp-tree-toolbar">
        <div className="sp-tree-toolbar__filters">
          <div className="sp-tree-field">
            <span>View</span>
            <div className="sp-segmented sp-tree-view-toggle" aria-label="Call path view mode" aria-busy={treeBusy}>
              <button type="button" className={displayView === 'all' ? 'is-active' : ''} disabled={treeBusy} onClick={() => selectViewMode('all')}>
                All
              </button>
              <button type="button" className={displayView === 'flat' ? 'is-active' : ''} disabled={treeBusy} onClick={() => selectViewMode('flat')}>
                Flat
              </button>
              <button type="button" className={displayView === 'mods' ? 'is-active' : ''} disabled={treeBusy} onClick={() => selectViewMode('mods')}>
                Mods
              </button>
            </div>
          </div>
          {viewMode === 'flat' ? (
            <div className="sp-tree-field">
              <span>Sort</span>
              <div className="sp-segmented sp-tree-view-toggle" aria-label="Flat sort mode">
                <button
                  type="button"
                  className={flatSort === 'total' ? 'is-active' : ''}
                  disabled={treeBusy && flatSort !== 'total'}
                  onClick={() => {
                    if (flatSort === 'total') return;
                    runHeavy('Sorting by total time…', () => setFlatSort('total'));
                  }}
                >
                  Total time
                </button>
                <button
                  type="button"
                  className={flatSort === 'self' ? 'is-active' : ''}
                  disabled={treeBusy && flatSort !== 'self'}
                  onClick={() => {
                    if (flatSort === 'self') return;
                    runHeavy('Sorting by self time…', () => setFlatSort('self'));
                  }}
                >
                  Self time
                </button>
              </div>
            </div>
          ) : null}
          {parsed.threads.length ? (
            <label className="sp-tree-field">
              <span>Thread</span>
              <select
                value={selectedThread?.key ?? ''}
                disabled={treeBusy}
                onChange={(event) => {
                  const next = event.target.value;
                  runHeavy('Switching thread…', () => setThreadId(next));
                }}
              >
                {parsed.threads.map((thread) => (
                  <option key={thread.key} value={thread.key}>{thread.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          {parsed.windows.length ? (
            <label className="sp-tree-field">
              <span>Window</span>
              <select
                value={windowIndex == null ? '' : String(windowIndex)}
                disabled={treeBusy}
                onChange={(event) => {
                  const next = event.target.value === '' ? null : Number(event.target.value);
                  runHeavy('Updating window…', () => setWindowIndex(next));
                }}
              >
                <option value="">Full capture</option>
                {parsed.windows.map((window, index) => (
                  <option key={`${window}:${index}`} value={index}>
                    Window {index + 1}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="sp-tree-search">
            <Search size={14} />
            <span className="sr-only">Search call paths</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search method or mod…"
            />
          </label>
        </div>
        <Button kind="ghost" className="sp-tree-collapse" onClick={collapseDeep}>
          Collapse deep
        </Button>
      </div>

      {treeBusy ? (
        <p className="sp-tree-toolbar__hint" role="status" aria-live="polite">{busyText}</p>
      ) : viewMode === 'mods' && sourceFilter ? (
        <p className="sp-tree-toolbar__hint">
          Showing {modSections.length} of {allModSections.length} mods matching “{sourceFilter}”.{' '}
          <button type="button" className="sp-tree-clear-filter" onClick={() => setSearch('')}>
            Show all mods
          </button>
        </p>
      ) : sourceFilter ? (
        <p className="sp-tree-toolbar__hint">
          Showing matching paths — ancestors stay open.{' '}
          <button type="button" className="sp-tree-clear-filter" onClick={() => setSearch('')}>
            Clear search
          </button>
        </p>
      ) : viewMode === 'flat' ? (
        <p className="sp-tree-toolbar__hint">Top 250 methods by {flatSort === 'self' ? 'self' : 'total'} time. Expand a row for callees.</p>
      ) : viewMode === 'mods' ? (
        <p className="sp-tree-toolbar__hint">
          {allModSections.length} mods in this capture — entry frames where each mod first appears on the stack.
          {' '}Mod totals can exceed 100% when entry paths overlap.
        </p>
      ) : null}

      <div className="sp-tree-frame">
        {treeBusy ? (
          <div className="sp-tree-busy" role="status" aria-live="polite">
            <span className="sp-tree-busy__spinner" aria-hidden="true" />
            <span>{busyText}</span>
          </div>
        ) : null}
        <div
          ref={treeRef}
          className="sp-tree"
          role="tree"
          aria-label="Call path tree"
          aria-busy={treeBusy}
        >
          {visibleRows.length ? (
            visibleRows.map((row) => {
              if (row.kind === 'section') {
                const focused = focusModId
                  && row.section.id.toLowerCase() === focusModId.toLowerCase();
                const open = openModIds.has(row.section.id);
                const entryCount = row.section.entries.length;
                const tone = heatTone(row.section.pct);
                const barWidth = maxModPct > 0
                  ? Math.max(row.section.pct > 0 ? 1.5 : 0, (row.section.pct / maxModPct) * 100)
                  : 0;
                return (
                  <button
                    type="button"
                    className={`sp-tree-section is-heat-${tone}${focused ? ' is-focused' : ''}${open ? ' is-open' : ''}`}
                    key={`section:${row.section.id}`}
                    data-mod-id={row.section.id}
                    aria-expanded={open}
                    title={`${row.section.id}: sum of ${entryCount} entry frame${entryCount === 1 ? '' : 's'} (can exceed 100% when paths overlap)`}
                    onClick={() => toggleMod(row.section.id)}
                  >
                    <span className={`sp-tree-row__toggle${open ? ' is-open' : ''}`} aria-hidden="true">
                      {open ? '−' : '+'}
                    </span>
                    <strong>{row.section.id}</strong>
                    <span className="sp-tree-section__count">{entryCount}</span>
                    <code className="sp-tree-section__pct">{row.section.pct.toFixed(2)}%</code>
                    <div className="sp-tree-row__bar sp-tree-section__bar" aria-hidden="true">
                      <span style={{ width: `${barWidth}%` }} />
                    </div>
                  </button>
                );
              }
              const navIndex = itemIndexByKey.get(row.item.node.key) ?? 0;
              return (
                <TreeRow
                  key={row.item.node.key}
                  item={row.item}
                  open={openKeys.has(row.item.node.key)}
                  selected={selectedKey === row.item.node.key}
                  onSelect={() => setSelectedKey(row.item.node.key)}
                  onToggle={() => toggleKey(row.item.node.key)}
                  onKeyDown={(event) => onRowKeyDown(event, row.item, navIndex)}
                />
              );
            })
          ) : (
            <div className="sp-tree__empty">
              {search.trim() ? `No call paths match “${search.trim()}”.` : 'No call paths in this capture.'}
            </div>
          )}
        </div>
      </div>

      <p className="sp-footnote">
        {parsed.threads.length
          ? `${parsed.truncated || treeQ.data?.truncated ? 'Tree was trimmed for this view. ' : ''}Total % can overlap across paths; step % is in the row tooltip.`
          : 'Fallback view: showing at most 180 hot methods and 12 levels.'}
      </p>
    </div>
  );
}