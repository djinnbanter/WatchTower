import { html, useState, useEffect, useCallback } from '../../lib/preact.js';
import { Modal } from '../../ui/patterns/index.js';
import { Button } from '../../ui/primitives/index.js';
import { fsRoots, fsList } from '../../api/endpoints.js';
import { isEmbedded } from '../../api/index.js';

const PREVIEW_ROOTS = [
  { path: '/srv/minecraft/backups', label: 'Server backups (preview)', archive_count: 3 },
  { path: '/srv/minecraft', label: 'Server directory (preview)', archive_count: 0 },
];

async function loadBrowse(path) {
  if (!isEmbedded()) {
    if (!path) {
      return { roots: PREVIEW_ROOTS };
    }
    return {
      path,
      breadcrumbs: [path],
      entries: [
        { name: 'world-backups', path: `${path}/world-backups`, kind: 'dir', archive_count: 2 },
        { name: 'daily', path: `${path}/daily`, kind: 'dir', archive_count: 5 },
      ],
      archive_count: 0,
      truncated: false,
    };
  }
  if (!path) {
    return fsRoots();
  }
  return fsList(path);
}

export function FolderBrowseModal({ open, onClose, onSelect, title = 'Choose folder' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roots, setRoots] = useState([]);
  const [listing, setListing] = useState(null);

  const currentPath = listing?.path ?? null;

  const load = useCallback(async (path) => {
    setLoading(true);
    setError('');
    try {
      const data = await loadBrowse(path);
      if (data?.roots) {
        setRoots(data.roots ?? []);
        setListing(null);
      } else {
        setListing(data);
      }
    } catch (err) {
      setError(err?.message ?? 'Could not list folder');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setRoots([]);
    setListing(null);
    setError('');
    load(null);
  }, [open, load]);

  function enterDir(path) {
    load(path);
  }

  function handleSelect(path) {
    onSelect?.(path);
    onClose?.();
  }

  const breadcrumbs = listing?.breadcrumbs ?? [];
  const entries = (listing?.entries ?? []).filter((e) => e.kind === 'dir');

  return html`
    <${Modal}
      open=${open}
      title=${title}
      size="lg"
      onClose=${onClose}
      footer=${html`
        <${Button} kind="neutral" onClick=${onClose}>Cancel</${Button}>
        ${currentPath
          ? html`<${Button} kind="accent" onClick=${() => handleSelect(currentPath)}>Use this folder</${Button}>`
          : null}
      `}
    >
      <div class="feat-folder-browse">
        ${!isEmbedded() && html`
          <p class="feat-hint ui-text-low">Preview mode — sample folders only. On a live server you can browse real paths.</p>
        `}
        ${error && html`<p class="feat-folder-browse__error">${error}</p>`}
        ${loading && html`<p class="feat-hint ui-text-low">Loading…</p>`}

        ${!listing && roots.length > 0 && html`
          <p class="feat-label">Suggested locations</p>
          <ul class="feat-folder-browse__list">
            ${roots.map((r) => html`
              <li key=${r.path}>
                <button type="button" class="feat-folder-browse__row" onClick=${() => enterDir(r.path)}>
                  <span class="feat-folder-browse__name">${r.label ?? r.path}</span>
                  <span class="feat-folder-browse__meta">${r.archive_count ?? 0} archives</span>
                </button>
              </li>
            `)}
          </ul>
        `}

        ${listing && html`
          <nav class="feat-folder-browse__crumbs" aria-label="Path">
            ${breadcrumbs.map((crumb) => html`
              <button
                key=${crumb}
                type="button"
                class="feat-folder-browse__crumb"
                onClick=${() => enterDir(crumb)}
              >
                ${crumb.split(/[/\\]/).filter(Boolean).pop() || crumb}
              </button>
            `)}
          </nav>
          ${listing.archive_count > 0 && html`
            <p class="feat-hint ui-text-low">${listing.archive_count} backup archive${listing.archive_count === 1 ? '' : 's'} in this folder</p>
          `}
          <ul class="feat-folder-browse__list">
            ${entries.map((e) => html`
              <li key=${e.path}>
                <button type="button" class="feat-folder-browse__row" onClick=${() => enterDir(e.path)}>
                  <span class="feat-folder-browse__name">${e.name}</span>
                  ${e.archive_count > 0 && html`<span class="feat-folder-browse__meta">${e.archive_count} archives</span>`}
                </button>
              </li>
            `)}
          </ul>
          ${entries.length === 0 && !loading && html`
            <p class="feat-hint ui-text-low">No subfolders here. You can still select this folder if backups are stored here.</p>
          `}
        `}
      </div>
    </${Modal}>
  `;
}
