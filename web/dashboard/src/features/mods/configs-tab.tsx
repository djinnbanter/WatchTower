import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useCanWrite, VIEW_ONLY_TITLE } from '@/app/permissions';
import { navigate } from '@/app/router';
import { asArray, asRecord, bool, num, str } from '@/lib/utils';
import { Button, EmptyState, StatusPill } from '@/ui/patterns';
import { ModsSearch } from './components';
import {
  fieldsEqual,
  flattenLeaves,
  serializeTomlFields,
  setFieldValueByPath,
  type TomlFormField,
} from './toml-form';

type ConfigFileRow = {
  path: string;
  size: number;
  mtime: number;
  has_backup: boolean;
  secret_hint: boolean;
};

type EditorMode = 'form' | 'raw';

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

function coerceFields(raw: unknown): TomlFormField[] {
  return asArray<Record<string, unknown>>(raw).map((row) => ({
    kind: str(row.kind) as TomlFormField['kind'],
    key: str(row.key),
    path: str(row.path),
    section: str(row.section),
    value: row.value,
    hint: row.hint != null ? str(row.hint) : undefined,
    children: row.children != null ? coerceFields(row.children) : undefined,
  }));
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
          <p className="md-cfg-modal__hint">
            WatchTower will back up the current file, then write your edit. Form saves rewrite the TOML
            cleanly — original comments may be dropped.
          </p>
          <Button kind="primary" onClick={onConfirm} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </footer>
      </div>
    </div>
  );
}

function FormFieldControl({
  field,
  disabled,
  onChange,
}: {
  field: TomlFormField;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  if (field.kind === 'bool') {
    return (
      <label className="md-cfg-toggle">
        <input
          type="checkbox"
          checked={Boolean(field.value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{field.value ? 'On' : 'Off'}</span>
      </label>
    );
  }
  if (field.kind === 'integer' || field.kind === 'number') {
    return (
      <input
        className="md-cfg-input"
        type="number"
        step={field.kind === 'integer' ? 1 : 'any'}
        value={field.value == null ? '' : String(field.value)}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '' || raw === '-') {
            onChange(0);
            return;
          }
          const n = field.kind === 'integer' ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
          onChange(Number.isFinite(n) ? n : 0);
        }}
      />
    );
  }
  if (field.kind === 'array') {
    return (
      <textarea
        className="md-cfg-array"
        value={JSON.stringify(field.value ?? [], null, 0)}
        disabled={disabled}
        spellCheck={false}
        rows={2}
        aria-label={`${field.key} array as JSON`}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value);
            if (Array.isArray(parsed)) onChange(parsed);
          } catch {
            /* keep typing */
          }
        }}
      />
    );
  }
  return (
    <input
      className="md-cfg-input"
      type="text"
      value={field.value == null ? '' : String(field.value)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function ConfigFormEditor({
  fields,
  filter,
  canWrite,
  onChange,
}: {
  fields: TomlFormField[];
  filter: string;
  canWrite: boolean;
  onChange: (next: TomlFormField[]) => void;
}) {
  const leaves = useMemo(() => flattenLeaves(fields), [fields]);
  const q = filter.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? leaves.filter((l) => l.key.toLowerCase().includes(q) || l.path.toLowerCase().includes(q)) : leaves),
    [leaves, q],
  );

  const groups = useMemo(() => {
    const map = new Map<string, TomlFormField[]>();
    for (const leaf of filtered) {
      const section = leaf.section?.trim() ? leaf.section : '';
      const list = map.get(section) ?? [];
      list.push(leaf);
      map.set(section, list);
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0] === '') return -1;
      if (b[0] === '') return 1;
      return a[0].localeCompare(b[0]);
    });
  }, [filtered]);

  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (!filtered.length) {
    return <p className="md-cfg-form__empty">No fields match this filter.</p>;
  }

  return (
    <div className="md-cfg-form" aria-label="Config form">
      {groups.map(([section, sectionLeaves]) => {
        const label = section || 'General';
        const isOpen = open[section] !== false;
        return (
          <section key={section || '__general'} className="md-cfg-section">
            <button
              type="button"
              className="md-cfg-section__head"
              aria-expanded={isOpen}
              onClick={() => setOpen((prev) => ({ ...prev, [section]: !isOpen }))}
            >
              <span>{label}</span>
              <span className="md-cfg-section__count">{sectionLeaves.length}</span>
            </button>
            {isOpen ? (
              <ul className="md-cfg-section__list">
                {sectionLeaves.map((leaf) => (
                  <li key={leaf.path} className="md-cfg-field">
                    <div className="md-cfg-field__label">
                      <span className="md-cfg-field__key">{leaf.key}</span>
                      {leaf.hint ? <span className="md-cfg-field__hint">{leaf.hint}</span> : null}
                    </div>
                    <FormFieldControl
                      field={leaf}
                      disabled={!canWrite}
                      onChange={(value) => onChange(setFieldValueByPath(fields, leaf.path, value))}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
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
  const [fields, setFields] = useState<TomlFormField[]>([]);
  const [baselineFields, setBaselineFields] = useState<TomlFormField[]>([]);
  const [formAvailable, setFormAvailable] = useState(false);
  const [mode, setMode] = useState<EditorMode>('raw');
  const [fieldFilter, setFieldFilter] = useState('');
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
    const editor = str(row.editor) === 'form';
    const nextFields = editor ? coerceFields(row.fields) : [];
    setFormAvailable(editor);
    setFields(nextFields);
    setBaselineFields(nextFields);
    setMode(editor ? 'form' : 'raw');
    setFieldFilter('');
    const listRow = files.find((f) => f.path === selectedPath);
    setHasBackup(!!listRow?.has_backup);
    setBanner(null);
  }, [readQ.data, selectedPath, files]);

  const previewAfter = useMemo(() => {
    if (mode === 'form' && formAvailable) {
      try {
        return serializeTomlFields(fields);
      } catch {
        return draft;
      }
    }
    return draft;
  }, [mode, formAvailable, fields, draft]);

  const dirty =
    mode === 'form' && formAvailable ? !fieldsEqual(fields, baselineFields) : draft !== baseline;

  const saveM = useMutation({
    mutationFn: () => {
      if (mode === 'form' && formAvailable) {
        return api.modsConfigSave({
          path: selectedPath!,
          expected_mtime: mtime,
          fields,
        });
      }
      return api.modsConfigSave({
        path: selectedPath!,
        expected_mtime: mtime,
        content: draft,
      });
    },
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

  function switchMode(next: EditorMode) {
    if (next === mode || !formAvailable) return;
    if (next === 'raw') {
      try {
        setDraft(serializeTomlFields(fields));
      } catch {
        /* keep draft */
      }
      setMode('raw');
      return;
    }
    // Raw → Form: keep current fields tree (edits in raw are not re-parsed in v1)
    setMode('form');
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

  const editorLabel =
    mode === 'form' && formAvailable
      ? 'Form editor'
      : 'Raw text editor';

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
            <EmptyState title="Select a file">Pick a path on the left to edit.</EmptyState>
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
                    {editorLabel} · {formatBytes(num(asRecord(readQ.data).size))}
                    {secretHint ? ' · contains secret-looking keys' : ''}
                    {dirty ? ' · unsaved changes' : ''}
                  </p>
                </div>
                <div className="md-cfg-editor__actions">
                  {formAvailable ? (
                    <div className="md-cfg-mode" role="group" aria-label="Editor mode">
                      <button
                        type="button"
                        className={`md-cfg-mode__btn${mode === 'form' ? ' md-cfg-mode__btn--on' : ''}`}
                        aria-pressed={mode === 'form'}
                        onClick={() => switchMode('form')}
                      >
                        Form
                      </button>
                      <button
                        type="button"
                        className={`md-cfg-mode__btn${mode === 'raw' ? ' md-cfg-mode__btn--on' : ''}`}
                        aria-pressed={mode === 'raw'}
                        onClick={() => switchMode('raw')}
                      >
                        Raw
                      </button>
                    </div>
                  ) : null}
                  <Button
                    kind="ghost"
                    disabled={!canWrite || !hasBackup || undoM.isPending || dirty}
                    title={
                      !canWrite
                        ? VIEW_ONLY_TITLE
                        : !hasBackup
                          ? 'No backup yet'
                          : dirty
                            ? 'Save or discard first'
                            : 'Restore newest backup'
                    }
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

              {mode === 'form' && formAvailable ? (
                <>
                  <ModsSearch
                    id="md-cfg-field-search"
                    value={fieldFilter}
                    onChange={setFieldFilter}
                    placeholder="Filter fields…"
                    aria-label="Filter config fields"
                  />
                  <ConfigFormEditor
                    fields={fields}
                    filter={fieldFilter}
                    canWrite={canWrite}
                    onChange={setFields}
                  />
                </>
              ) : (
                <textarea
                  className="md-cfg-textarea"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                  readOnly={!canWrite}
                  aria-label={`Contents of ${selectedPath}`}
                />
              )}
            </>
          )}
        </aside>
      </div>

      {diffOpen && selectedPath ? (
        <DiffModal
          path={selectedPath}
          before={baseline}
          after={previewAfter}
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
