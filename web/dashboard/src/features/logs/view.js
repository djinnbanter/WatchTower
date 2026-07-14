import { html, useState, useEffect, useCallback, useMemo, useRef } from '../../lib/preact.js';
import { opsCache } from '../../state/stores.js';
import { fetchLogsList, fetchLogContent, fetchCrashReport, addToast } from '../../state/actions.js';
import { Page, EmptyState, FreshnessBadge } from '../../ui/patterns/index.js';
import { Button, Segmented, TextField, CopyButton, Badge, ScrollRegion } from '../../ui/primitives/index.js';
import { Icon } from '../../ui/icons.js';

const TAIL_OPTIONS = [
  { value: '500', label: '500' },
  { value: '2000', label: '2k' },
  { value: '5000', label: '5k' },
  { value: '10000', label: '10k' },
];

function formatAge(mtime) {
  if (!mtime) return '—';
  const ms = typeof mtime === 'number' ? mtime * 1000 : Date.parse(mtime);
  if (isNaN(ms)) return '—';
  const diffMs = Date.now() - ms;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 0) return 'just now';
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours === 0) {
      const mins = Math.floor(diffMs / 60000);
      return mins <= 0 ? 'just now' : `${mins}m ago`;
    }
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

function formatBytes(size) {
  if (size == null || isNaN(size)) return '—';
  const n = Number(size);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadText(filename, text) {
  const blob = new Blob([text ?? ''], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'log.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function FileRow({ item, selected, onSelect }) {
  const active = selected?.kind === item.kind && selected?.id === item.id;
  return html`
    <button
      type="button"
      class=${`logs-file ${active ? 'logs-file--active' : ''}`}
      onClick=${() => onSelect(item)}
      aria-current=${active ? 'true' : undefined}
    >
      <div class="logs-file__top">
        <span class="logs-file__name" title=${item.name}>${item.name}</span>
        ${item.gz ? html`<${Badge} tone="neutral">gz</${Badge}>` : null}
      </div>
      <div class="logs-file__meta">
        <span>${formatAge(item.mtime)}</span>
        <span>${formatBytes(item.size)}</span>
      </div>
      ${item.label ? html`<div class="logs-file__label">${item.label}</div>` : null}
    </button>
  `;
}

function highlightLines(content, query) {
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  if (!query) {
    return lines.map((line, i) => ({ i, line, match: true }));
  }
  const q = query.toLowerCase();
  return lines
    .map((line, i) => ({ i, line, match: line.toLowerCase().includes(q) }))
    .filter((row) => row.match);
}

export function PageView() {
  const [logFiles, setLogFiles] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [tail, setTail] = useState('2000');
  const [search, setSearch] = useState('');
  const [content, setContent] = useState('');
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const contentRef = useRef(null);

  const crashEntries = opsCache.value.data?.crashes?.entries ?? [];

  const crashItems = useMemo(
    () =>
      crashEntries.map((e) => ({
        kind: 'crash',
        id: e.file,
        name: e.file,
        mtime: e.mtime,
        size: e.size,
        label: e.display_label ?? null,
        gz: false,
      })),
    [crashEntries],
  );

  const logItems = useMemo(
    () =>
      logFiles.map((f) => ({
        kind: 'log',
        id: f.name,
        name: f.name,
        mtime: f.mtime,
        size: f.size,
        label: null,
        gz: !!f.gz,
      })),
    [logFiles],
  );

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await fetchLogsList();
      setLogFiles(data?.files ?? []);
    } catch (err) {
      addToast(`Could not list logs: ${err.message}`, 'error');
      setLogFiles([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Auto-select latest.log (or first available file) once lists are ready
  useEffect(() => {
    if (selected || listLoading) return;
    const preferred = logItems.find((f) => f.name === 'latest.log') ?? logItems[0] ?? crashItems[0] ?? null;
    if (preferred) setSelected(preferred);
  }, [logItems, crashItems, selected, listLoading]);

  const loadContent = useCallback(async (item, tailLines) => {
    if (!item) return;
    setLoading(true);
    setError(null);
    try {
      if (item.kind === 'log') {
        const data = await fetchLogContent(item.name, Number(tailLines) || 2000);
        if (!data) throw new Error('No content returned');
        setContent(data.content ?? '');
        setMeta({
          truncated: !!data.truncated,
          size: data.size ?? item.size,
          lines: data.lines ?? null,
          file: data.file ?? item.name,
        });
      } else {
        const text = await fetchCrashReport(item.name);
        setContent(text ?? '(No content available)');
        setMeta({
          truncated: false,
          size: item.size,
          lines: (text ?? '').split(/\r?\n/).length,
          file: item.name,
        });
      }
    } catch (err) {
      setContent('');
      setMeta(null);
      setError(err?.message || 'Failed to load file');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    loadContent(selected, tail);
  }, [selected, tail, loadContent]);

  // Scroll to bottom after load (tail view)
  useEffect(() => {
    if (loading || search) return;
    const el = contentRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [content, loading, search]);

  const rows = useMemo(() => highlightLines(content, search.trim()), [content, search]);

  const handleSelect = useCallback((item) => {
    setSearch('');
    setSelected(item);
  }, []);

  const handleDownload = useCallback(() => {
    if (!selected || !content) return;
    const name = selected.name.endsWith('.gz')
      ? selected.name.replace(/\.gz$/i, '.txt')
      : selected.name;
    downloadText(name, content);
    addToast('Download started', 'success');
  }, [selected, content]);

  const hasFiles = logItems.length > 0 || crashItems.length > 0;

  return html`
    <${Page}
      tour="logs"
      title="Logs"
      subtitle="Browse server logs and crash reports"
      actions=${html`
        <${Button} kind="neutral" size="sm" onClick=${loadList} loading=${listLoading}>
          Refresh list
        </${Button}>
      `}
    >
      <div class="logs-layout">
        <aside class="logs-sidebar">
          <div class="logs-sidebar__section">
            <div class="logs-sidebar__heading">
              <${Icon} name="terminal" size=${14} />
              <span>Server logs</span>
              <span class="logs-sidebar__count">${logItems.length}</span>
            </div>
            ${listLoading && !logItems.length
              ? html`<p class="logs-sidebar__empty">Loading…</p>`
              : logItems.length
                ? logItems.map((item) => html`
                    <${FileRow}
                      key=${`log-${item.id}`}
                      item=${item}
                      selected=${selected}
                      onSelect=${handleSelect}
                    />
                  `)
                : html`<p class="logs-sidebar__empty">No log files found</p>`}
          </div>

          <div class="logs-sidebar__section">
            <div class="logs-sidebar__heading">
              <${Icon} name="flame" size=${14} />
              <span>Crash reports</span>
              <span class="logs-sidebar__count">${crashItems.length}</span>
            </div>
            ${crashItems.length
              ? crashItems.map((item) => html`
                  <${FileRow}
                    key=${`crash-${item.id}`}
                    item=${item}
                    selected=${selected}
                    onSelect=${handleSelect}
                  />
                `)
              : html`<p class="logs-sidebar__empty">No crash reports</p>`}
          </div>
        </aside>

        <section class="logs-viewer">
          ${!hasFiles && !listLoading
            ? html`
                <${EmptyState}
                  title="No logs available"
                  body="Server log files and crash reports will appear here once the server has written them."
                />
              `
            : !selected
              ? html`
                  <${EmptyState}
                    title="Select a file"
                    body="Pick a server log or crash report from the list."
                  />
                `
              : html`
                  <div class="logs-viewer__toolbar">
                    <div class="logs-viewer__title-group">
                      <code class="logs-viewer__file">${selected.name}</code>
                      <div class="logs-viewer__meta">
                        <span>${formatAge(selected.mtime)}</span>
                        <span>${formatBytes(meta?.size ?? selected.size)}</span>
                        ${meta?.lines != null ? html`<span>${meta.lines} lines</span>` : null}
                        ${meta?.truncated
                          ? html`<${Badge} tone="warn">Truncated</${Badge}>`
                          : null}
                        ${selected.kind === 'crash'
                          ? html`<${Badge} tone="danger">Crash</${Badge}>`
                          : html`<${FreshnessBadge} layer="scan" at=${selected.mtime ? selected.mtime * 1000 : null} />`}
                      </div>
                    </div>
                    <div class="logs-viewer__controls">
                      ${selected.kind === 'log'
                        ? html`
                            <${Segmented}
                              size="sm"
                              options=${TAIL_OPTIONS}
                              value=${tail}
                              onChange=${setTail}
                            />
                          `
                        : null}
                      <${TextField}
                        className="logs-viewer__search"
                        placeholder="Filter lines…"
                        value=${search}
                        onInput=${(e) => setSearch(e.target.value)}
                        icon="search"
                      />
                      <${CopyButton} text=${content ?? ''} label="Copy log" />
                      <${Button}
                        kind="neutral"
                        size="sm"
                        disabled=${!content || loading}
                        onClick=${handleDownload}
                      >Download</${Button}>
                    </div>
                  </div>

                  ${error
                    ? html`<p class="logs-viewer__error">${error}</p>`
                    : loading
                      ? html`<p class="logs-viewer__loading">Loading…</p>`
                      : html`
                          <${ScrollRegion}
                            className="logs-viewer__scroll"
                            label="Log content"
                            maxHeight="none"
                          >
                            <div class="logs-viewer__scroll-inner" ref=${contentRef}>
                              ${rows.length === 0
                                ? html`<p class="logs-viewer__empty-filter">No matching lines</p>`
                                : html`
                                    <pre class="logs-viewer__pre">${rows.map(
                                      (row) => html`<span
                                        key=${row.i}
                                        class=${search.trim() ? 'logs-viewer__line logs-viewer__line--hit' : 'logs-viewer__line'}
                                      >${row.line}${'\n'}</span>`,
                                    )}</pre>
                                  `}
                            </div>
                          </${ScrollRegion}>
                        `}
                `}
        </section>
      </div>
    </${Page}>
  `;
}
