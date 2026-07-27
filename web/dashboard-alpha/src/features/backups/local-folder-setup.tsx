/**
 * Local backup folder path — browse + POST /api/backups/dirs (prod LocalFolderStep).
 */
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { FolderBrowseModal } from '@/features/backups/folder-browse';
import { Button } from '@/ui/patterns';
import { asRecord } from '@/lib/utils';

export function parseBackupDirs(data: Record<string, unknown> | null | undefined): string[] {
  const raw = data?.backup_dirs ?? data?.backup_dir ?? '';
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
  if (!raw || typeof raw !== 'string') return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function LocalFolderSetup({
  settingsData,
  onSaved,
  compact = false,
}: {
  settingsData?: Record<string, unknown> | null;
  onSaved?: (dirs: string[]) => void;
  compact?: boolean;
}) {
  const savedDirs = parseBackupDirs(settingsData);
  const [path, setPath] = useState(savedDirs[0] ?? '');
  const [browseOpen, setBrowseOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedHint, setSavedHint] = useState(savedDirs[0] ?? '');

  useEffect(() => {
    const dirs = parseBackupDirs(settingsData);
    if (dirs[0]) {
      setPath(dirs[0]);
      setSavedHint(dirs[0]);
    }
  }, [settingsData]);

  async function handleSave() {
    const trimmed = path.trim();
    if (!trimmed) {
      setError('Choose a folder first — browse or paste a path.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = asRecord(await api.saveBackupDirs([trimmed]));
      const next = Array.isArray(result.saved_dirs)
        ? (result.saved_dirs as string[])
        : [trimmed];
      setSavedHint(next[0] ?? trimmed);
      onSaved?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save folder');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {!compact ? (
        <div>
          <h3 className="text-sm font-semibold text-wt-text">Folder on this server</h3>
          <p className="mt-1 text-xs text-wt-text-low">
            Choose the folder with your <code className="rounded bg-wt-bg2 px-1">.zip</code> /{' '}
            <code className="rounded bg-wt-bg2 px-1">.tar.gz</code> archives — WatchTower never
            guesses the path.
          </p>
        </div>
      ) : null}

      <label className="block text-sm">
        <span className="font-medium text-wt-text">Backup folder</span>
        <div className="mt-1.5 flex gap-2">
          <input
            id="backup-local-path"
            type="text"
            value={path}
            placeholder="Choose a folder…"
            onChange={(e) => {
              setPath(e.target.value);
              setError('');
            }}
            className="min-w-0 flex-1 rounded-xl border border-wt-line bg-wt-bg2 px-3 py-2 font-mono text-sm outline-none focus:border-wt-accent"
          />
          <Button kind="default" type="button" onClick={() => setBrowseOpen(true)}>
            Browse…
          </Button>
        </div>
        <span className="mt-1 block text-xs text-wt-text-low">
          {savedHint ? `Saved: ${savedHint}` : 'Browse to your backup output directory'}
        </span>
      </label>

      {error ? <p className="text-sm text-wt-danger">{error}</p> : null}

      <Button
        kind="primary"
        disabled={!path.trim() || saving}
        onClick={() => void handleSave()}
      >
        {saving ? 'Saving…' : 'Save folder & scan'}
      </Button>

      <FolderBrowseModal
        open={browseOpen}
        onClose={() => setBrowseOpen(false)}
        onSelect={(p) => {
          setPath(p);
          setError('');
        }}
        title="Choose backup folder"
      />
    </div>
  );
}

/** Convenience: load settings once for standalone panels. */
export function LocalFolderSetupFromApi({ onSaved }: { onSaved?: (dirs: string[]) => void }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = asRecord(await api.settings());
        if (!cancelled) setData(s);
      } catch {
        if (!cancelled) setData({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <LocalFolderSetup
      settingsData={data}
      onSaved={(dirs) => {
        setData((prev) => ({ ...(prev ?? {}), backup_dirs: dirs.join(', '), backup_dir: dirs[0] ?? '' }));
        onSaved?.(dirs);
      }}
    />
  );
}
