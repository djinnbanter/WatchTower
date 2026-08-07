import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Bug, ExternalLink, Package, Users } from '@/ui/icons';
import { navigate } from '@/app/router';
import { api } from '@/api/client';
import { useCanWrite, VIEW_ONLY_TITLE } from '@/app/permissions';
import { Button, EmptyState, StatusPill } from '@/ui/patterns';
import { modIconUrl } from './modrinth';
import { toTree } from './mod-graph';
import { bucketLabel, humanizeSideSignal, modDisplayName, sideSummaryForMod } from './side';
import { BUCKET_TONE } from './side';
import type { BadgeMaps, CatalogRow, DepTreeNode, SideSummary } from './types';

export function ModrinthMark({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className ? `md-signal__mr ${className}` : 'md-signal__mr'}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12.252.004a11.78 11.768 0 0 0-8.92 3.73 11 10.999 0 0 0-2.17 3.11 11.37 11.359 0 0 0-1.16 5.169c0 1.42.17 2.5.6 3.77.24.759.77 1.899 1.17 2.529a12.3 12.298 0 0 0 8.85 5.639c.44.05 2.54.07 2.76.02.2-.04.22.1-.26-1.7l-.36-1.37-1.01-.06a8.5 8.489 0 0 1-5.18-1.8 5.34 5.34 0 0 1-1.3-1.26c0-.05.34-.28.74-.5a37.572 37.545 0 0 1 2.88-1.629c.03 0 .5.45 1.06.98l1 .97 2.07-.43 2.06-.43 1.47-1.47c.8-.8 1.48-1.5 1.48-1.52 0-.09-.42-1.63-.46-1.7-.04-.06-.2-.03-1.02.18-.53.13-1.2.3-1.45.4l-.48.15-.53.53-.53.53-.93.1-.93.07-.52-.5a2.7 2.7 0 0 1-.96-1.7l-.13-.6.43-.57c.68-.9.68-.9 1.46-1.1.4-.1.65-.2.83-.33.13-.099.65-.579 1.14-1.069l.9-.9-.7-.7-.7-.7-1.95.54c-1.07.3-1.96.53-1.97.53-.03 0-2.23 2.48-2.63 2.97l-.29.35.28 1.03c.16.56.3 1.16.31 1.34l.03.3-.34.23c-.37.23-2.22 1.3-2.84 1.63-.36.2-.37.2-.44.1-.08-.1-.23-.6-.32-1.03-.18-.86-.17-2.75.02-3.73a8.84 8.839 0 0 1 7.9-6.93c.43-.03.77-.08.78-.1.06-.17.5-2.999.47-3.039-.01-.02-.1-.02-.2-.03Zm3.68.67c-.2 0-.3.1-.37.38-.06.23-.46 2.42-.46 2.52 0 .04.1.11.22.16a8.51 8.499 0 0 1 2.99 2 8.38 8.379 0 0 1 2.16 3.449 6.9 6.9 0 0 1 .4 2.8c0 1.07 0 1.27-.1 1.73a9.37 9.369 0 0 1-1.76 3.769c-.32.4-.98 1.06-1.37 1.38-.38.32-1.54 1.1-1.7 1.14-.1.03-.1.06-.07.26.03.18.64 2.56.7 2.78l.06.06a12.07 12.058 0 0 0 7.27-9.4c.13-.77.13-2.58 0-3.4a11.96 11.948 0 0 0-5.73-8.578c-.7-.42-2.05-1.06-2.25-1.06Z"
      />
    </svg>
  );
}

export function SideSignalChip({ signal }: { signal: string }) {
  const raw = String(signal ?? '');
  const fromModrinth = raw.startsWith('modrinth:');
  const label = humanizeSideSignal(raw);
  if (fromModrinth) {
    return (
      <span className="md-signal md-signal--modrinth" title="Checked against Modrinth">
        <ModrinthMark size={12} />
        <span>{label}</span>
      </span>
    );
  }
  return <StatusPill tone="neutral">{label}</StatusPill>;
}

export function ModSideCallout({ summary }: { summary: SideSummary | null }) {
  if (!summary) return null;
  return (
    <div className={`md-side md-side--${summary.tone}`}>
      <div className="md-side__top">
        <span className="md-side__role">{summary.role}</span>
        {summary.confidence ? (
          <span className="md-side__confidence">{summary.confidence} confidence</span>
        ) : null}
      </div>
      <p className="md-side__title">{summary.title}</p>
      <p className="md-side__reason">{summary.reason}</p>
      {summary.advice ? <p className="md-side__advice">{summary.advice}</p> : null}
      {summary.signals.length ? (
        <div className="md-side__signals">
          {summary.signals.map((s) => (
            <SideSignalChip key={s} signal={s} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

const LINK_ICONS: Record<string, typeof Package> = {
  Modrinth: Package,
  Wiki: BookOpen,
  Source: Package,
  Issues: Bug,
  Discord: Users,
};

export function ModLinkChip({ href, label }: { href: string; label: string }) {
  const Icon = LINK_ICONS[label];
  const hint =
    label === 'Modrinth' || label.startsWith('Open')
      ? 'Opens Modrinth in a new tab'
      : 'Opens in a new tab';
  return (
    <a
      className="md-link-chip"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={hint}
      aria-label={`${label} (${hint})`}
      onClick={(e) => e.stopPropagation()}
    >
      {Icon ? <Icon size={14} /> : null}
      <span>{label}</span>
      <ExternalLink size={12} className="md-link-chip__ext" />
    </a>
  );
}

export function modLinkEntries(mod: Record<string, unknown> | null | undefined): [string, string][] {
  if (!mod) return [];
  return (
    [
      [mod.modrinth_compatible_url || mod.modrinth_cta_url || mod.modrinth_url, 'Modrinth'],
      [mod.modrinth_wiki_url, 'Wiki'],
      [mod.modrinth_source_url, 'Source'],
      [mod.modrinth_issues_url, 'Issues'],
      [mod.modrinth_discord_url, 'Discord'],
    ] as [unknown, string][]
  )
    .filter(([href]) => !!href)
    .map(([href, label]) => [String(href), label]);
}

export function ModLinkCluster({
  mod,
  layout = 'inline',
}: {
  mod: Record<string, unknown>;
  layout?: 'inline' | 'stack';
}) {
  const chips = modLinkEntries(mod);
  if (!chips.length) return null;
  return (
    <div
      className={layout === 'stack' ? 'md-link-grid' : 'md-catalog__links'}
      onClick={(e) => e.stopPropagation()}
    >
      {chips.map(([href, label]) => (
        <ModLinkChip key={label} href={href} label={label} />
      ))}
    </div>
  );
}

export function ModIcon({
  url,
  name,
  size = 36,
}: {
  url?: string | null;
  name: string;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const cls = size > 36 ? 'md-catalog__icon md-detail__icon' : 'md-catalog__icon';
  const dim = { width: size, height: size };
  if (!url || broken) {
    return (
      <span className={`${cls} md-catalog__icon--ph`} style={dim} aria-hidden>
        {letter}
      </span>
    );
  }
  return (
    <img
      className={cls}
      src={url}
      alt=""
      width={size}
      height={size}
      style={dim}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

function TreeNode({
  node,
  depth = 0,
  onSelectMod,
}: {
  node: DepTreeNode;
  depth?: number;
  onSelectMod?: (id: string) => void;
}) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const [open, setOpen] = useState(depth < 2);
  const modId = node.mod_id;
  return (
    <div className="md-tree__node" style={{ ['--depth' as string]: depth }}>
      <div
        className={`md-tree__row${onSelectMod && modId ? ' md-tree__row--clickable' : ''}`}
        onClick={onSelectMod && modId ? () => onSelectMod(modId) : undefined}
        role={onSelectMod && modId ? 'button' : undefined}
        tabIndex={onSelectMod && modId ? 0 : undefined}
        onKeyDown={
          onSelectMod && modId
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectMod(modId);
                }
              }
            : undefined
        }
      >
        {hasChildren ? (
          <button
            type="button"
            className="md-tree__toggle"
            aria-expanded={open}
            aria-label={open ? 'Collapse dependency' : 'Expand dependency'}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="md-tree__toggle md-tree__toggle--leaf">•</span>
        )}
        <span className="md-tree__name">{node.display_name ?? node.mod_id}</span>
        <span className="md-tree__meta">{node.version ?? ''}</span>
        <div className="md-badges">
          {/* Side badges only on roots — repeating server-required on every child is noise */}
          {node.side_score && depth === 0 ? (
            <StatusPill tone={BUCKET_TONE[node.side_score] ?? 'neutral'}>
              {bucketLabel(node.side_score)}
            </StatusPill>
          ) : null}
          {node.is_mcreator ? <StatusPill tone="neutral">MCreator</StatusPill> : null}
          {node.loader_hint === 'fabric_in_neoforge_jar' ? (
            <StatusPill tone="warn">Fabric jar</StatusPill>
          ) : null}
          {node.mandatory === false ? <StatusPill tone="neutral">optional</StatusPill> : null}
        </div>
      </div>
      {hasChildren && open ? (
        <div className="md-tree__children">
          {node.children.map((c) => (
            <TreeNode key={c.mod_id} node={c} depth={depth + 1} onSelectMod={onSelectMod} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ModDepsSection({
  modId,
  factsMods,
  onSelectMod,
}: {
  modId: string;
  factsMods: Record<string, unknown>[];
  onSelectMod?: (id: string) => void;
}) {
  const trees = useMemo(() => {
    if (!modId || !factsMods?.length) return null;
    return {
      dependents: toTree(modId, factsMods, 'dependents', 5),
      dependencies: toTree(modId, factsMods, 'dependencies', 5),
    };
  }, [modId, factsMods]);

  if (!modId) return null;

  if (!factsMods?.length) {
    return (
      <div className="md-detail__block md-detail__block--deps">
        <h3>Dependencies</h3>
        <p className="md-drawer__desc text-wt-text-low">
          Trees appear after Scanning builds the mod manifest (mods_light / deep deltas).
        </p>
      </div>
    );
  }

  return (
    <div className="md-detail__block md-detail__block--deps">
      <h3>Dependencies</h3>
      <div className="md-deps-grid">
        <div className="md-deps-col">
          <p className="md-drawer__label">Needed by</p>
          {trees?.dependents?.children?.length ? (
            <div className="md-tree">
              <TreeNode node={trees.dependents} onSelectMod={onSelectMod} />
            </div>
          ) : (
            <p className="md-drawer__empty">No mods declare a mandatory dependency on this one.</p>
          )}
        </div>
        <div className="md-deps-col">
          <p className="md-drawer__label">Needs</p>
          {trees?.dependencies?.children?.length ? (
            <div className="md-tree">
              <TreeNode node={trees.dependencies} onSelectMod={onSelectMod} />
            </div>
          ) : (
            <p className="md-drawer__empty">No declared dependencies in the report manifest.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ModDetailPanel({
  mod,
  showTechNames,
  badgeMaps,
  factsMods,
  onSelectMod,
}: {
  mod: CatalogRow | null;
  showTechNames: boolean;
  badgeMaps: BadgeMaps;
  factsMods: Record<string, unknown>[];
  onSelectMod?: (id: string) => void;
}) {
  const canWrite = useCanWrite();
  const qc = useQueryClient();
  const [confirmRisk, setConfirmRisk] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const jarName = mod ? String(mod.jar_file ?? mod.jar ?? '') : '';
  const disabled = mod?.disabled === true;

  useEffect(() => {
    setConfirmRisk(false);
    setActionError(null);
  }, [mod?.id, jarName]);

  const invalidateMods = () => {
    void qc.invalidateQueries({ queryKey: ['ops-cache'] });
    void qc.invalidateQueries({ queryKey: ['facts'] });
    void qc.invalidateQueries({ queryKey: ['overview-meta'] });
  };

  const disableM = useMutation({
    mutationFn: (confirm: boolean) =>
      api.modsDisable({ jar: jarName, confirm_world_risk: confirm || undefined }),
    onSuccess: () => {
      setConfirmRisk(false);
      setActionError(null);
      invalidateMods();
    },
    onError: (e: Error) => {
      const msg = e?.message ?? 'Disable failed';
      if (msg.includes('world_risk_confirm_required') || msg.includes('400')) {
        setConfirmRisk(true);
        setActionError('This mod looks tied to the world. Confirm to disable anyway.');
      } else {
        setActionError(msg);
      }
    },
  });

  const enableM = useMutation({
    mutationFn: () => api.modsEnable({ jar: jarName }),
    onSuccess: () => {
      setActionError(null);
      invalidateMods();
    },
    onError: (e: Error) => setActionError(e?.message ?? 'Enable failed'),
  });

  if (!mod) {
    return (
      <aside className="md-detail md-detail--empty" role="complementary" aria-label="Mod details">
        <EmptyState title="Select a mod">
          Click a row in the list to see status, description, and links here.
        </EmptyState>
      </aside>
    );
  }

  const name = modDisplayName(mod, showTechNames);
  const side = sideSummaryForMod(mod, badgeMaps);
  const hasSlug = !!(mod.modrinth_slug || mod.modrinth_url);
  const updateUrl = String(mod.modrinth_compatible_url || mod.modrinth_cta_url || '');
  const hasLinks = modLinkEntries(mod).length > 0;
  const nestedJars = Array.isArray(mod.jar_in_jar) ? (mod.jar_in_jar as Record<string, unknown>[]) : [];
  const worldRisk =
    badgeMaps.worldRiskById.get(mod.id) ??
    (mod.world_risk && typeof mod.world_risk === 'object'
      ? (mod.world_risk as Record<string, unknown>)
      : null);
  const highWorldRisk = String(worldRisk?.level ?? '') === 'high';
  const riskReasons = Array.isArray(worldRisk?.reasons)
    ? (worldRisk!.reasons as unknown[]).map(String)
    : [];

  const busy = disableM.isPending || enableM.isPending;
  const enabled = !disabled;

  function onToggleEnabled(nextEnabled: boolean) {
    if (!canWrite || !jarName || busy) return;
    if (nextEnabled) {
      if (disabled) enableM.mutate();
      return;
    }
    if (highWorldRisk) {
      setConfirmRisk(true);
      return;
    }
    disableM.mutate(false);
  }

  const hasFooterActions = !!(
    (mod.modrinth_outdated && updateUrl) ||
    mod.modrinth_url ||
    mod.modrinth_outdated
  );

  return (
    <aside className="md-detail" role="complementary" aria-label={name}>
      <header className="md-detail__head">
        <div className="md-detail__title-row">
          <ModIcon url={modIconUrl(mod)} name={name} size={44} />
          <div className="md-detail__titles">
            <h2 className="md-detail__title">{name}</h2>
            <p className="md-detail__sub">
              <span className="md-detail__id">
                {mod.id}
                {mod.version ? ` · ${mod.version}` : ''}
                {jarName ? ` · ${jarName}` : ''}
              </span>
              {highWorldRisk ? <StatusPill tone="warn">World risk</StatusPill> : null}
              {mod.modrinth_outdated ? <StatusPill tone="warn">Update available</StatusPill> : null}
              {mod.meta?.is_mcreator ? <StatusPill tone="neutral">MCreator</StatusPill> : null}
              {mod.meta?.loader_hint === 'fabric_in_neoforge_jar' ? (
                <StatusPill tone="warn">Fabric jar</StatusPill>
              ) : null}
              {badgeMaps.connectorById.has(mod.id) ? (
                <StatusPill tone="info">Connector</StatusPill>
              ) : null}
              {badgeMaps.securityById.has(mod.id) ? (
                <StatusPill tone="danger">Security risk</StatusPill>
              ) : null}
            </p>
          </div>
        </div>

        {jarName ? (
          <div className="md-detail__enable">
            <div className="md-detail__enable-copy">
              <div className="md-detail__enable-label">
                {busy ? (enabled ? 'Disabling…' : 'Enabling…') : enabled ? 'Enabled' : 'Disabled'}
              </div>
              <div className="md-detail__enable-hint">
                {enabled
                  ? 'Jar loads from mods/ on next boot'
                  : 'Renamed to .disabled — skipped on next boot'}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={enabled ? 'Disable mod jar' : 'Enable mod jar'}
              disabled={!canWrite || busy}
              title={canWrite ? undefined : VIEW_ONLY_TITLE}
              onClick={() => onToggleEnabled(!enabled)}
              className={`md-detail__switch${enabled ? ' is-on' : ''}${busy ? ' is-busy' : ''}`}
            >
              <span className="md-detail__switch-knob" aria-hidden />
            </button>
          </div>
        ) : null}

        {confirmRisk ? (
          <div className="md-detail__enable-confirm" role="alert">
            <p>
              High world risk. Disable anyway? Jar becomes{' '}
              <code>{jarName.endsWith('.jar') ? `${jarName}.disabled` : jarName}</code>.
            </p>
            <div className="md-action-row">
              <Button
                kind="primary"
                disabled={!canWrite || disableM.isPending || !jarName}
                title={canWrite ? undefined : VIEW_ONLY_TITLE}
                onClick={() => disableM.mutate(true)}
              >
                {disableM.isPending ? 'Disabling…' : 'Disable anyway'}
              </Button>
              <Button kind="default" onClick={() => setConfirmRisk(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {actionError ? <p className="md-detail__enable-error">{actionError}</p> : null}
      </header>

      <div className="md-detail__body">
        {highWorldRisk ? (
          <div className="md-detail__block">
            <h3>World risk</h3>
            <p className="md-drawer__desc text-wt-text-low">
              Disabling this mod may break the save. WatchTower checked world dimension folders and
              jar data paths — not full NBT.
            </p>
            {riskReasons.length ? (
              <ul className="md-nested">
                {riskReasons.map((r) => (
                  <li key={r} className="md-nested__item">
                    {r}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {side ? (
          <div className="md-detail__block md-detail__block--status">
            <h3>Client / server</h3>
            <ModSideCallout summary={side} />
          </div>
        ) : null}

        <div className="md-detail__block">
          <h3>About</h3>
          {mod.modrinth_description ? (
            <p className="md-drawer__desc">{String(mod.modrinth_description)}</p>
          ) : (
            <p className="md-drawer__desc text-wt-text-low">
              {hasSlug
                ? 'No project description from Modrinth for this jar.'
                : 'No Modrinth description yet — run a report with Modrinth lookup enabled in Settings → Monitoring.'}
            </p>
          )}
        </div>

        {nestedJars.length > 0 ? (
          <div className="md-detail__block">
            <h3>Nested / embedded jars</h3>
            <p className="md-drawer__desc text-wt-text-low">
              These mods ship inside this jar (jar-in-jar). They are not separate files in mods/.
            </p>
            <ul className="md-nested">
              {nestedJars.map((j, i) => {
                const nid = String(j.id ?? j.mod_id ?? 'unknown');
                const label = String(j.display_name || nid);
                const ver = j.version ? ` · ${j.version}` : '';
                return (
                  <li className="md-nested__item" key={`${nid}-${i}`}>
                    <div className="md-nested__title">
                      {label}
                      <span className="text-wt-text-low">{ver}</span>
                    </div>
                    <div className="md-nested__id text-wt-text-low">{nid}</div>
                    {j.nested_path ? (
                      <div className="md-nested__path">{String(j.nested_path)}</div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="md-detail__footer">
          <div className="md-detail__block md-detail__block--links">
            <h3>Links</h3>
            {hasLinks ? (
              <ModLinkCluster mod={mod} layout="stack" />
            ) : (
              <p className="md-drawer__empty">No external links for this mod.</p>
            )}
          </div>

          {hasFooterActions ? (
            <div className="md-action-row">
              {mod.modrinth_outdated && updateUrl ? (
                <Button
                  kind="primary"
                  onClick={() => window.open(updateUrl, '_blank', 'noopener')}
                >
                  Open update on Modrinth
                </Button>
              ) : mod.modrinth_url ? (
                <Button
                  kind="default"
                  onClick={() => window.open(String(mod.modrinth_url), '_blank', 'noopener')}
                >
                  Open on Modrinth
                </Button>
              ) : null}
              {mod.modrinth_outdated ? (
                <Button
                  kind="default"
                  onClick={() =>
                    navigate({ tab: 'mods', view: 'updates', filter: null, mod: mod.id })
                  }
                >
                  Open update details
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <ModDepsSection modId={mod.id} factsMods={factsMods} onSelectMod={onSelectMod} />
      </div>
    </aside>
  );
}

export function ModsSearch({
  id,
  value,
  onChange,
  placeholder,
  'aria-label': ariaLabel,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  'aria-label': string;
}) {
  return (
    <div className="md-search">
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="md-segmented">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? 'is-active' : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ActionRow({ children }: { children: ReactNode }) {
  return <div className="md-action-row">{children}</div>;
}
