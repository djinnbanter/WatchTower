import { navigate } from '@/app/router';
import { useCanMutateMods } from '@/app/permissions';
import { useState } from 'react';
import { api } from '@/api/client';
import { str } from '@/lib/utils';
import { Button, StatusPill } from '@/ui/patterns';
import { MutateConfirmSheet } from './mutate-confirm-sheet';
import { MutateJobProgress } from './mutate-job-progress';
import { impactFingerprint, jobIdFromAccepted } from './mutate-api';
import { VERDICT_LABEL, VERDICT_TONE, modDisplayName } from './side';
import type { CatalogRow } from './types';
import { enrichUpdateImpactForDisplay } from './update-impact-enrich';

export function VersionDelta({ current, latest }: { current?: string; latest?: string }) {
  if (!current && !latest) return null;
  return (
    <span className="md-ver-delta">
      <span className="md-ver-delta__cur">{current || '—'}</span>
      <span className="md-ver-delta__arrow" aria-hidden>
        →
      </span>
      <span className="md-ver-delta__next">{latest || '—'}</span>
    </span>
  );
}

function impactRowTitle(
  row: Record<string, unknown> | null | undefined,
  catalogById: Map<string, CatalogRow>,
  showTechNames: boolean,
): string {
  if (!row) return 'Unknown';
  if (showTechNames) return str(row.mod_id || row.display_name, 'Unknown');
  if (row.display_name) return str(row.display_name);
  const mod = catalogById.get(str(row.mod_id));
  if (mod) return modDisplayName(mod, false);
  return str(row.mod_id, 'Unknown');
}

/** Pack-impact block for a Modrinth update row — used on update detail and project pages. */
export function ModUpdateImpactSection({
  row,
  mod: _mod,
  showTechNames,
  catalogById,
  onSelectMod,
  omitVersionDelta = false,
  mods = [],
}: {
  row: Record<string, unknown>;
  mod: CatalogRow | undefined;
  showTechNames: boolean;
  catalogById: Map<string, CatalogRow>;
  onSelectMod?: (id: string) => void;
  omitVersionDelta?: boolean;
  /** Local pack mods — used to fill impact when the scan only shipped a summary. */
  mods?: Record<string, unknown>[];
}) {
  const canMutate = useCanMutateMods();
  const [installJobId, setInstallJobId] = useState<string | null>(null);
  const [installOpen, setInstallOpen] = useState<Record<string, unknown> | null>(null);
  const [installBusy, setInstallBusy] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  const enriched = enrichUpdateImpactForDisplay(row, mods);
  const verdict = str(enriched.impact_verdict, 'unknown');
  const blockers = Array.isArray(enriched.blockers)
    ? (enriched.blockers as Record<string, unknown>[])
    : [];
  const coUpdates = Array.isArray(enriched.co_updates)
    ? (enriched.co_updates as Record<string, unknown>[])
    : [];
  const dependents = Array.isArray(enriched.dependents)
    ? (enriched.dependents as Record<string, unknown>[])
    : [];
  const relatedPair = str(enriched.related_pair);

  return (
    <div className="md-update-impact">
      <div className="md-detail__block">
        <h3>Update impact</h3>
        {!omitVersionDelta ? (
          <div className="md-detail__sub" style={{ marginBottom: '0.5rem' }}>
            <VersionDelta
              current={str(enriched.current_version) || undefined}
              latest={str(enriched.latest_compatible) || undefined}
            />{' '}
            <StatusPill tone={VERDICT_TONE[verdict] ?? 'neutral'}>
              {VERDICT_LABEL[verdict] || 'Unknown'}
            </StatusPill>
          </div>
        ) : null}
        <div className={`md-impact md-impact--${verdict}`}>
          <div className="md-impact__top">
            <span className="md-impact__verdict">{VERDICT_LABEL[verdict] || 'Unknown'}</span>
            {enriched.confidence ? (
              <span className="md-impact__confidence">{str(enriched.confidence)} confidence</span>
            ) : null}
          </div>
          <p className="md-impact__summary">
            {str(enriched.impact_summary, 'No impact summary for this update.')}
          </p>
        </div>
      </div>

      <div className="md-detail__block">
        <h3>Will break / blockers</h3>
        {blockers.length ? (
          <ul className="md-simple-list">
            {blockers.map((b, i) => {
              const kind = str(b.kind, 'issue');
              const projectId =
                str(b.project_id) || str(b.modrinth_project_id) || str(b.dependency_project_id);
              const versionId =
                str(b.version_id) || str(b.modrinth_version_id) || str(b.dependency_version_id);
              const depModId = str(b.mod_id);
              const canInstall =
                canMutate && kind === 'need_install' && !!projectId && !!versionId && !!depModId;
              return (
                <li key={`${b.mod_id}-${i}`}>
                  <strong>{impactRowTitle(b, catalogById, showTechNames)}</strong>
                  <span className="text-wt-text-low">
                    {[
                      !showTechNames && b.display_name && b.mod_id && b.display_name !== b.mod_id
                        ? str(b.mod_id)
                        : null,
                      str(b.detail),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <StatusPill
                    tone={kind === 'conflict' || kind === 'need_install' ? 'danger' : 'warn'}
                  >
                    {kind.replace(/_/g, ' ')}
                  </StatusPill>
                  {canInstall ? (
                    <Button
                      kind="default"
                      onClick={() => {
                        setInstallError(null);
                        setInstallOpen(b);
                      }}
                    >
                      Install with WatchTower
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="md-drawer__desc text-wt-text-low">No blockers flagged for this update.</p>
        )}
        {installJobId ? <MutateJobProgress jobId={installJobId} /> : null}
        <MutateConfirmSheet
          open={!!installOpen}
          kind="install"
          items={[
            {
              mod_id: str(installOpen?.mod_id, 'dep'),
              label: impactRowTitle(installOpen, catalogById, showTechNames),
              toVersion: str(installOpen?.version_id) || undefined,
            },
          ]}
          busy={installBusy}
          error={installError}
          onCancel={() => {
            if (!installBusy) setInstallOpen(null);
          }}
          onConfirm={() => {
            if (!installOpen) return;
            const projectId =
              str(installOpen.project_id) ||
              str(installOpen.modrinth_project_id) ||
              str(installOpen.dependency_project_id);
            const versionId =
              str(installOpen.version_id) ||
              str(installOpen.modrinth_version_id) ||
              str(installOpen.dependency_version_id);
            const depModId = str(installOpen.mod_id);
            void (async () => {
              setInstallBusy(true);
              setInstallError(null);
              try {
                const body = await api.modsMutateInstall({
                  mod_id: depModId,
                  project_id: projectId || undefined,
                  modrinth_version_id: versionId || undefined,
                  confirm: true,
                  impact_fingerprint: impactFingerprint({
                    mod_id: depModId,
                    version_id: versionId,
                    verdict: 'need_install',
                    summary: str(installOpen.detail),
                    blockers: [installOpen],
                  }),
                });
                setInstallOpen(null);
                setInstallJobId(jobIdFromAccepted(body) || null);
              } catch (e) {
                setInstallError((e as Error)?.message || 'Install failed');
              } finally {
                setInstallBusy(false);
              }
            })();
          }}
        />
      </div>

      <div className="md-detail__block">
        <h3>Update together</h3>
        {relatedPair ? (
          <p className="md-drawer__desc">
            Paired with{' '}
            {onSelectMod ? (
              <Button kind="default" onClick={() => onSelectMod(relatedPair)}>
                {impactRowTitle(
                  {
                    mod_id: relatedPair,
                    display_name: catalogById.get(relatedPair)
                      ? modDisplayName(catalogById.get(relatedPair)!, showTechNames)
                      : null,
                  },
                  catalogById,
                  showTechNames,
                )}
              </Button>
            ) : (
              <strong>
                {impactRowTitle(
                  {
                    mod_id: relatedPair,
                    display_name: catalogById.get(relatedPair)
                      ? modDisplayName(catalogById.get(relatedPair)!, showTechNames)
                      : null,
                  },
                  catalogById,
                  showTechNames,
                )}
              </strong>
            )}{' '}
            — update both jars together.
          </p>
        ) : null}
        {coUpdates.length ? (
          <ul className="md-simple-list">
            {coUpdates.map((c, i) => {
              const id = str(c.mod_id);
              const title = impactRowTitle(c, catalogById, showTechNames);
              const detail = [c.current ? `installed ${c.current}` : null, str(c.detail)]
                .filter(Boolean)
                .join(' · ');
              return (
                <li key={`${c.mod_id}-${i}`}>
                  {onSelectMod && id ? (
                    <Button kind="default" onClick={() => onSelectMod(id)}>
                      {title}
                    </Button>
                  ) : (
                    <strong>{title}</strong>
                  )}
                  {detail ? <span className="text-wt-text-low">{detail}</span> : null}
                </li>
              );
            })}
          </ul>
        ) : !relatedPair ? (
          <p className="md-drawer__desc text-wt-text-low">
            No co-updates called out for this update.
          </p>
        ) : null}
      </div>

      <div className="md-detail__block">
        <h3>Mods that depend on this</h3>
        {dependents.length ? (
          <div className="md-badges">
            {dependents.map((d) => (
              <Button
                key={str(d.mod_id)}
                kind="default"
                onClick={() => {
                  const id = str(d.mod_id);
                  if (onSelectMod) onSelectMod(id);
                  else navigate({ tab: 'mods', view: 'overview', mod: id });
                }}
              >
                {impactRowTitle(d, catalogById, showTechNames)}
              </Button>
            ))}
          </div>
        ) : (
          <p className="md-drawer__desc text-wt-text-low">
            No dependents recorded for this mod.
          </p>
        )}
      </div>
    </div>
  );
}
