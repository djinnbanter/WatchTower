import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useCanWrite, VIEW_ONLY_TITLE } from '@/app/permissions';
import { navigate } from '@/app/router';
import { asArray, asRecord, bool, num, str } from '@/lib/utils';
import { Button, EmptyState, StatusPill } from '@/ui/patterns';
import { ModsSearch } from './components';

type ConfigFileRow = {
  path: string;
  size: number;
  mtime: number;
  has_backup: boolean;
  secret_hint: boolean;
};

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function simpleLineDiff(before: string, after: string): { kind: 'same' | 'del' | 'add'; text: string }[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const max = Math.max(a.length, b.length);
  const rows: { kind: 'same' | 'del' | 'add'; text: string }[] = [];
  for (let i = 0; i < max; i++) {
    const left = a[i];
    const right = b[i];
    if (left === right) {
      if (left !== undefined) rows.push({ kind: 'same', text: left });
      continue;
    }
    if (left !== undefined) rows.push({ kind: 'del', text: left });
    if (right !== undefined) rows.push({ kind: 'add', text: right });
  }
  return rows;
}

function DiffModal({
  path,
  before,
  after,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  path: string;
  before: string;
  after: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const rows = useMemo(() => simpleLineDiff(before, after), [before, after]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="md-cfg-modal" role="dialog" aria-modal="true" aria-label="Review config diff">
      <button type="button" className="md-cfg-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="md-cfg-modal__panel">
        <header className="md-cfg-modal__head">
          <div>
            <h3>Review changes</h3>
            <p className="md-cfg-modal__path">{path}</p>
          </div>
          <Button kind="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </header>
        <div className="md-cfg-diff" aria-label="Line diff">
          {rows.length === 0 ? (
            <p className="md-cfg-diff__empty">No line changes.</p>
          ) : (
            rows.map((row, i) => (
              <div key={i} className={`md-cfg-diff__row md-cfg-diff__row--${row.kind}`}>
                <span className="md-cfg-diff__mark">
                  {row.kind === 'add' ? '+' : row.kind === 'del' ? '−' : ' '}
                </span>
                <code>{row.text || ' '}</code>
              </div>
            ))
          )}
        </div>
        {error ? <p className="md-cfg-banner md-cfg-banner--danger">{error}</p> : null}
        <footer className="md-cfg-modal__foot">
          <p className="md-cfg-modal__hint">WatchTower will back up the current file, then write your edit.</p>
          <Button kind="primary" onClick={onConfirm} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </footer>
      </div>
    </div>
  );
}

export function ConfigsTab({
  search,
  onSearch,
  initialPath,
}: {
  search: string;
  onSearch: (v: string) => void;
  initialPath?: string | null;
}) {
  const canWrite = useCanWrite();
  const qc = useQueryClient();
  const [selectedPath, setSelectedPath] = useState<string | null>(initialPath ?? null);
  const [draft, setDraft] = useState('');
  const [baseline, setBaseline] = useState('');
  const [mtime, setMtime] = useState(0);
  const [hasBackup, setHasBackup] = useState(false);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [secretHint, setSecretHint] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerTone, setBannerTone] = useState<'ok' | 'warn' | 'danger'>('ok');
  const [diffOpen, setDiffOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ['mods-configs'],
    queryFn: api.modsConfigsList,
    retry: false,
  });

  const files = useMemo(() => {
    const root = asRecord(listQ.data);
    return asArray<Record<string, unknown>>(root.files).map(
      (row): ConfigFileRow => ({
        path: str(row.path),
        size: num(row.size),
        mtime: num(row.mtime),
        has_backup: bool(row.has_backup),
        secret_hint: bool(row.secret_hint),
      }),
    );
  }, [listQ.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.path.toLowerCase().includes(q));
  }, [files, search]);

  useEffect(() => {
    if (initialPath) setSelectedPath(initialPath);
  }, [initialPath]);

  useEffect(() => {
    if (!selectedPath && filtered[0]) {
      setSelectedPath(filtered[0].path);
    }
  }, [filtered, selectedPath]);

  const readQ = useQuery({
    queryKey: ['mods-config', selectedPath],
    queryFn: () => api.modsConfigRead(selectedPath!),
    enabled: !!selectedPath,
    retry: false,
  });

  useEffect(() => {
    if (!readQ.data || !selectedPath) return;
    const row = asRecord(readQ.data);
    const content = str(row.content);
    setDraft(content);
    setBaseline(content);
    setMtime(num(row.mtime));
    setSecretHint(bool(row.secret_hint));
    setParseWarnings(asArray(row.parse_warnings).map((w) => str(w)).filter(Boolean));
    const listRow = files.find((f) => f.path === selectedPath);
    setHasBackup(!!listRow?.has_backup);
    setBanner(null);
  }, [readQ.data, selectedPath, files]);

  const dirty = draft !== baseline;

  const saveM = useMutation({
    mutationFn: () =>
      api.modsConfigSave({
        path: selectedPath!,
        content: draft,
        expected_mtime: mtime,
      }),
    onSuccess: async () => {
      setDiffOpen(false);
      setSaveError(null);
      setBannerTone('ok');
      setBanner('Saved. Restart the server if the mod only reloads config on boot.');
      await qc.invalidateQueries({ queryKey: ['mods-configs'] });
      await qc.invalidateQueries({ queryKey: ['mods-config', selectedPath] });
    },
    onError: async (e: Error) => {
      const msg = e?.message ?? 'Save failed';
      if (msg.includes('409') || msg.includes('mtime_conflict')) {
        setSaveError('This file changed on disk. Reloading the latest version.');
        await qc.invalidateQueries({ queryKey: ['mods-config', selectedPath] });
        setBannerTone('warn');
        setBanner('Conflict — file was reloaded from disk. Review and try again.');
        return;
      }
      setSaveError(msg);
    },
  });

  const undoM = useMutation({
    mutationFn: () => api.modsConfigUndo(selectedPath!),
    onSuccess: async () => {
      setBannerTone('ok');
      setBanner('Restored from the newest backup.');
      await qc.invalidateQueries({ queryKey: ['mods-configs'] });
      await qc.invalidateQueries({ queryKey: ['mods-config', selectedPath] });
    },
    onError: (e: Error) => {
      setBannerTone('danger');
      setBanner(e?.message ?? 'Undo failed');
    },
  });

  function selectPath(path: string) {
    setSelectedPath(path);
    navigate({ tab: 'mods', view: 'configs', panel: path, mod: null });
  }

  const disabledReason = listQ.isError
    ? (listQ.error as Error)?.message?.includes('403') ||
      (listQ.error as Error)?.message?.includes('mod_config_edit_disabled')
      ? 'Config editing is turned off on this server (MOD_CONFIG_EDIT_ENABLED=false).'
      : (listQ.error as Error)?.message
    : null;

  if (disabledReason) {
    return (
      <div className="md-configs">
        <EmptyState title="Configs unavailable">{disabledReason}</EmptyState>
      </div>
    );
  }

  return (
    <div className="md-configs">
      <div className="md-configs__toolbar">
        <ModsSearch
          id="md-configs-search"
          value={search}
          onChange={onSearch}
          placeholder="Search config paths…"
          aria-label="Search config files"
        />
        <StatusPill tone={files.length ? 'info' : 'neutral'}>{files.length} files</StatusPill>
      </div>

      {banner ? (
        <p className={`md-cfg-banner md-cfg-banner--${bannerTone}`} role="status">
          {banner}
        </p>
      ) : null}

      <div className="md-split md-configs__split">
        <section className="md-list" aria-label="Config files">
          {listQ.isLoading ? (
            <div className="md-list__empty">
              <p className="text-sm text-wt-text-low">Loading config files…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="md-list__empty">
              <EmptyState title="No config files">
                Nothing under <code>config/</code> matched this search.
              </EmptyState>
            </div>
          ) : (
            <ul className="md-catalog md-cfg-catalog">
              {filtered.map((f) => {
                const active = f.path === selectedPath;
                return (
                  <li key={f.path}>
                    <button
                      type="button"
                      className={`md-cfg-row${active ? ' md-cfg-row--active' : ''}`}
                      onClick={() => selectPath(f.path)}
                      aria-current={active ? 'true' : undefined}
                    >
                      <span className="md-cfg-row__path">{f.path}</span>
                      <span className="md-cfg-row__meta">
                        {f.secret_hint ? (
                          <StatusPill tone="warn">Secret</StatusPill>
                        ) : null}
                        {f.has_backup ? <StatusPill tone="info">Backup</StatusPill> : null}
                        <span>{formatBytes(f.size)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="md-detail md-cfg-editor" aria-label="Config editor">
          {!selectedPath ? (
            <EmptyState title="Select a file">Pick a path on the left to edit raw text.</EmptyState>
          ) : readQ.isLoading ? (
            <p className="text-sm text-wt-text-low">Loading {selectedPath}…</p>
          ) : readQ.isError ? (
            <EmptyState title="Couldn’t open file">{(readQ.error as Error)?.message}</EmptyState>
          ) : (
            <>
              <header className="md-cfg-editor__head">
                <div>
                  <h3 className="md-cfg-editor__title">{selectedPath}</h3>
                  <p className="md-cfg-editor__sub">
                    Raw text editor · {formatBytes(num(asRecord(readQ.data).size))}
                    {secretHint ? ' · contains secret-looking keys' : ''}
                    {dirty ? ' · unsaved changes' : ''}
                  </p>
                </div>
                <div className="md-cfg-editor__actions">
                  <Button
                    kind="ghost"
                    disabled={!canWrite || !hasBackup || undoM.isPending || dirty}
                    title={!canWrite ? VIEW_ONLY_TITLE : !hasBackup ? 'No backup yet' : dirty ? 'Save or discard first' : 'Restore newest backup'}
                    onClick={() => undoM.mutate()}
                  >
                    Undo
                  </Button>
                  <Button
                    kind="primary"
                    disabled={!canWrite || !dirty || saveM.isPending}
                    title={!canWrite ? VIEW_ONLY_TITLE : !dirty ? 'No changes' : 'Review diff and save'}
                    onClick={() => {
                      setSaveError(null);
                      setDiffOpen(true);
                    }}
                  >
                    Review & save
                  </Button>
                </div>
              </header>

              {parseWarnings.length ? (
                <ul className="md-cfg-warnings" aria-label="Parse warnings">
                  {parseWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              ) : null}

              <textarea
                className="md-cfg-textarea"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                spellCheck={false}
                readOnly={!canWrite}
                aria-label={`Contents of ${selectedPath}`}
              />
            </>
          )}
        </aside>
      </div>

      {diffOpen && selectedPath ? (
        <DiffModal
          path={selectedPath}
          before={baseline}
          after={draft}
          busy={saveM.isPending}
          error={saveError}
          onClose={() => {
            if (!saveM.isPending) {
              setDiffOpen(false);
              setSaveError(null);
            }
          }}
          onConfirm={() => saveM.mutate()}
        />
      ) : null}
    </div>
  );
}
