import { useEffect, type ReactNode } from 'react';
import { Button, StatusPill } from '@/ui/patterns';
import { VERDICT_LABEL, VERDICT_TONE } from './side';
import type { MutateVersion } from './mutate-api';

export type MutateConfirmKind = 'swap' | 'batch' | 'install' | 'quarantine' | 'undo';

export type MutateConfirmItem = {
  mod_id: string;
  label: string;
  fromVersion?: string;
  toVersion?: string;
  verdict?: string;
  version_id?: string;
};

export type MutateConfirmSheetProps = {
  open: boolean;
  kind: MutateConfirmKind;
  title?: string;
  items: MutateConfirmItem[];
  /** Shown impact summary / blockers text. */
  impactSummary?: string;
  impactVerdict?: string;
  liveServer?: boolean;
  /** Extra warning when selection includes Caution/Break. */
  allowNonSafe?: boolean;
  onAllowNonSafeChange?: (v: boolean) => void;
  /** High world-risk quarantine needs an extra tick. */
  worldRisk?: boolean;
  confirmWorldRisk?: boolean;
  onConfirmWorldRiskChange?: (v: boolean) => void;
  /** Optional version list for single-swap picker inside the sheet. */
  versions?: MutateVersion[];
  selectedVersionId?: string;
  onSelectedVersionIdChange?: (id: string) => void;
  busy?: boolean;
  error?: string | null;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
};

const KIND_COPY: Record<MutateConfirmKind, { title: string; confirm: string }> = {
  swap: { title: 'Apply this update?', confirm: 'Apply update' },
  batch: { title: 'Apply selected updates?', confirm: 'Apply updates' },
  install: { title: 'Install this mod?', confirm: 'Install jar' },
  quarantine: { title: 'Quarantine this jar?', confirm: 'Quarantine jar' },
  undo: { title: 'Undo last jar change?', confirm: 'Undo' },
};

export function MutateConfirmSheet({
  open,
  kind,
  title,
  items,
  impactSummary,
  impactVerdict,
  liveServer = true,
  allowNonSafe = false,
  onAllowNonSafeChange,
  worldRisk = false,
  confirmWorldRisk = false,
  onConfirmWorldRiskChange,
  versions,
  selectedVersionId,
  onSelectedVersionIdChange,
  busy = false,
  error = null,
  confirmLabel,
  onCancel,
  onConfirm,
  children,
}: MutateConfirmSheetProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const copy = KIND_COPY[kind];
  const needsNonSafe = Boolean(onAllowNonSafeChange);
  const needsWorldRisk = worldRisk && Boolean(onConfirmWorldRiskChange);
  const blocked =
    busy ||
    (needsNonSafe && !allowNonSafe) ||
    (needsWorldRisk && !confirmWorldRisk) ||
    (versions && versions.length > 0 && !selectedVersionId);

  return (
    <div className="md-mutate-sheet" role="dialog" aria-modal="true" aria-labelledby="md-mutate-sheet-title">
      <button
        type="button"
        className="md-mutate-sheet__backdrop"
        aria-label="Close"
        disabled={busy}
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div className="md-mutate-sheet__panel">
        <header className="md-mutate-sheet__head">
          <h3 id="md-mutate-sheet-title">{title || copy.title}</h3>
          <Button kind="ghost" size="xs" disabled={busy} onClick={onCancel}>
            Close
          </Button>
        </header>

        <div className="md-mutate-sheet__body">
          {items.length ? (
            <ul className="md-mutate-sheet__items">
              {items.map((item) => (
                <li key={item.mod_id}>
                  <div className="md-mutate-sheet__item-main">
                    <strong>{item.label}</strong>
                    {item.verdict ? (
                      <StatusPill tone={VERDICT_TONE[item.verdict] ?? 'neutral'}>
                        {VERDICT_LABEL[item.verdict] || item.verdict}
                      </StatusPill>
                    ) : null}
                  </div>
                  {(item.fromVersion || item.toVersion) && (
                    <p className="md-mutate-sheet__item-ver">
                      {item.fromVersion || '—'} → {item.toVersion || '—'}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          {versions && versions.length > 0 && onSelectedVersionIdChange ? (
            <label className="md-mutate-sheet__field">
              <span className="md-mutate-sheet__label">Version</span>
              <select
                className="md-mutate-sheet__select"
                value={selectedVersionId || ''}
                disabled={busy}
                onChange={(e) => onSelectedVersionIdChange(e.target.value)}
              >
                <option value="">Choose a version…</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.version_number}
                    {v.name && v.name !== v.version_number ? ` — ${v.name}` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {(impactVerdict || impactSummary) && (
            <div className={`md-mutate-sheet__impact md-impact--${impactVerdict || 'unknown'}`}>
              {impactVerdict ? (
                <StatusPill tone={VERDICT_TONE[impactVerdict] ?? 'neutral'}>
                  {VERDICT_LABEL[impactVerdict] || impactVerdict}
                </StatusPill>
              ) : null}
              {impactSummary ? <p>{impactSummary}</p> : null}
            </div>
          )}

          {children}

          {liveServer ? (
            <p className="md-mutate-sheet__warn" role="note">
              The server is live. Jar files change on disk now; players stay connected until you
              restart from your host panel.
            </p>
          ) : null}

          <p className="md-mutate-sheet__hint">
            WatchTower will not restart the server for you.
          </p>

          {needsNonSafe ? (
            <label className="md-mutate-sheet__check">
              <input
                type="checkbox"
                checked={allowNonSafe}
                disabled={busy}
                onChange={(e) => onAllowNonSafeChange?.(e.target.checked)}
              />
              <span>
                I understand this selection includes Caution or Break updates (allow non-safe).
              </span>
            </label>
          ) : null}

          {needsWorldRisk ? (
            <label className="md-mutate-sheet__check">
              <input
                type="checkbox"
                checked={confirmWorldRisk}
                disabled={busy}
                onChange={(e) => onConfirmWorldRiskChange?.(e.target.checked)}
              />
              <span>
                This mod looks tied to the world. Quarantine anyway (confirm world risk).
              </span>
            </label>
          ) : null}

          {kind === 'quarantine' ? (
            <p className="md-mutate-sheet__hint">
              Quarantine moves the jar aside (not delete) and keeps an undo backup. Soft Disable
              only renames to <code>.disabled</code> — use that when you just want to skip load.
            </p>
          ) : null}

          {error ? <p className="md-mutate-sheet__error">{error}</p> : null}
        </div>

        <footer className="md-mutate-sheet__foot">
          <Button kind="default" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button kind="primary" disabled={!!blocked} onClick={onConfirm}>
            {busy ? 'Working…' : confirmLabel || copy.confirm}
          </Button>
        </footer>
      </div>
    </div>
  );
}
