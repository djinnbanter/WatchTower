import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { str } from '@/lib/utils';
import { Button } from '@/ui/patterns';
import { MutateConfirmSheet } from './mutate-confirm-sheet';
import { MutateJobProgress } from './mutate-job-progress';
import {
  fetchMutateVersions,
  fingerprintFromUpdateRow,
  jobIdFromAccepted,
  primaryFileSha512,
  versionIdFromUpdateRow,
  type MutateVersion,
} from './mutate-api';
import { modDisplayName } from './side';
import type { CatalogRow } from './types';

export function MutateApplyPanel({
  mod,
  updateRow,
  showTechNames,
}: {
  mod: CatalogRow;
  updateRow: Record<string, unknown> | null;
  showTechNames: boolean;
}) {
  const qc = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoOpen, setUndoOpen] = useState(false);

  const versionsQ = useQuery({
    queryKey: ['mods-mutate-versions', mod.id],
    queryFn: () => fetchMutateVersions(mod.id),
    enabled: sheetOpen || !!updateRow,
    staleTime: 60_000,
  });

  const preferredVersion = versionIdFromUpdateRow(updateRow);
  const versions: MutateVersion[] = versionsQ.data ?? [];

  useEffect(() => {
    if (selectedVersionId) return;
    if (preferredVersion) {
      setSelectedVersionId(preferredVersion);
      return;
    }
    if (versions[0]?.id) setSelectedVersionId(versions[0].id);
  }, [preferredVersion, selectedVersionId, versions]);

  const label = modDisplayName(mod, showTechNames);
  const fingerprint = useMemo(
    () =>
      fingerprintFromUpdateRow(
        updateRow ? { ...updateRow, mod_id: str(updateRow.mod_id) || mod.id } : { mod_id: mod.id },
        selectedVersionId,
      ),
    [updateRow, mod.id, selectedVersionId],
  );
  const selected = versions.find((v) => v.id === selectedVersionId);
  const currentVersion = str(updateRow?.current_version) || str(mod.version) || '—';
  const latestVersion =
    selected?.version_number ||
    str(updateRow?.latest_compatible) ||
    '—';
  const verdict = str(updateRow?.impact_verdict, 'unknown');
  const summary = str(updateRow?.impact_summary);

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['ops-cache'] });
    void qc.invalidateQueries({ queryKey: ['facts'] });
    void qc.invalidateQueries({ queryKey: ['overview-meta'] });
    void qc.invalidateQueries({ queryKey: ['mods-mutate-status'] });
    void qc.invalidateQueries({ queryKey: ['mods-mutate-backups', mod.id] });
  }, [qc, mod.id]);

  async function runSwap() {
    if (!selectedVersionId) {
      setError('Pick a version first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const sha = primaryFileSha512(selected);
      const body = await api.modsMutateSwap({
        mod_id: mod.id,
        modrinth_version_id: selectedVersionId,
        impact_fingerprint: fingerprint,
        confirm: true,
        jar: str(mod.jar_file || mod.jar) || undefined,
        expected_sha512: sha,
      });
      const id = jobIdFromAccepted(body);
      setSheetOpen(false);
      setJobId(id || null);
      invalidate();
    } catch (e) {
      setError((e as Error)?.message || 'Apply failed');
    } finally {
      setBusy(false);
    }
  }

  async function runUndo() {
    setBusy(true);
    setError(null);
    try {
      const body = await api.modsMutateUndo({ mod_id: mod.id, confirm: true });
      const id = jobIdFromAccepted(body);
      setUndoOpen(false);
      setJobId(id || null);
      invalidate();
    } catch (e) {
      setError((e as Error)?.message || 'Undo failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="md-mutate-apply">
      <h3>Apply with WatchTower</h3>
      <p className="md-drawer__desc">
        Download, verify, back up the current jar, then swap. WatchTower will not restart the
        server.
      </p>

      <div className="md-mutate-apply__actions">
        <Button
          kind="primary"
          disabled={busy || !!jobId}
          onClick={() => {
            setError(null);
            setSheetOpen(true);
          }}
        >
          Apply this version
        </Button>
        <Button
          kind="default"
          disabled={busy || !!jobId}
          onClick={() => {
            setError(null);
            setUndoOpen(true);
          }}
        >
          Undo last swap
        </Button>
      </div>

      {jobId ? (
        <MutateJobProgress
          jobId={jobId}
          onTerminal={(job) => {
            invalidate();
            if (job.state === 'done') setJobId(null);
          }}
        />
      ) : null}

      {error && !sheetOpen && !undoOpen ? (
        <p className="md-mutate-apply__error">{error}</p>
      ) : null}

      <MutateConfirmSheet
        open={sheetOpen}
        kind="swap"
        items={[
          {
            mod_id: mod.id,
            label,
            fromVersion: currentVersion,
            toVersion: latestVersion,
            verdict,
            version_id: selectedVersionId,
          },
        ]}
        impactSummary={summary || undefined}
        impactVerdict={verdict}
        versions={versions}
        selectedVersionId={selectedVersionId}
        onSelectedVersionIdChange={setSelectedVersionId}
        busy={busy || versionsQ.isLoading}
        error={error || (versionsQ.isError ? (versionsQ.error as Error).message : null)}
        onCancel={() => {
          if (!busy) setSheetOpen(false);
        }}
        onConfirm={() => void runSwap()}
      />

      <MutateConfirmSheet
        open={undoOpen}
        kind="undo"
        title="Undo last jar change?"
        items={[{ mod_id: mod.id, label }]}
        busy={busy}
        error={error}
        confirmLabel="Undo"
        onCancel={() => {
          if (!busy) setUndoOpen(false);
        }}
        onConfirm={() => void runUndo()}
      />
    </div>
  );
}
