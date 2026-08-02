import { html } from '../../lib/preact.js';
import { useState, useMemo, useEffect } from '../../lib/preact.js';
import { ui } from '../../state/stores.js';
import { navigate } from '../../app/router.js';
import { WIKI } from '../../wiki/content.js';
import { renderMarkdown, splitMarkdownLead } from '../../wiki/render.js';
import { widgetsFor } from './widgets.js';
import { Icon } from '../../ui/icons.js';
import { Button } from '../../ui/primitives/index.js';
import { Page, Section } from '../../ui/patterns/index.js';

// ── Hub catalog ────────────────────────────────────────────────────────────────

const GET_STARTED = [
  { id: 'quick-start', icon: 'rocket', title: 'Quick start', body: 'Solid first setup in about 15 minutes.', wiki: 'Quick-Start-Checklist' },
  { id: 'install', icon: 'package', title: 'Installation', body: 'Drop the mod in, open the dashboard.', wiki: 'Installation' },
];

const LEARN = [
  { id: 'data-sources', icon: 'database', title: 'Data sources', body: 'Live vs scanned vs report — and why it matters.', wiki: 'Understanding-Data-Sources' },
  { id: 'tabs', icon: 'layers', title: 'Dashboard tabs', body: 'What each rail item is for.', wiki: 'Dashboard-Tabs' },
  { id: 'overview', icon: 'home', title: 'Overview', body: 'Health grade, vitals, and what needs attention.', wiki: 'Dashboard-Overview' },
  { id: 'live-charts', icon: 'activity', title: 'Live charts', body: 'TPS, MSPT, heap, and players in real time.', wiki: 'Live-Charts' },
  { id: 'health-reports', icon: 'clipboard', title: 'Health reports', body: 'Schedule and read full audit snapshots.', wiki: 'Health-Reports' },
];

const OPS = [
  { id: 'backups', icon: 'archive', title: 'Backups', body: 'Folder health and heartbeat webhooks.', wiki: 'Backups' },
  { id: 'spark', icon: 'zap', title: 'Spark profiler', body: 'Attach profiles for deep lag analysis.', wiki: 'Using-Spark-with-Watchtower' },
  { id: 'security', icon: 'shield', title: 'Security', body: 'Passwords, 2FA, and dashboard access.', wiki: 'Security-and-Access' },
  { id: 'dr', icon: 'bug', title: 'Disaster recovery', body: 'When the server will not start.', wiki: 'Disaster-Recovery' },
  { id: 'troubleshooting', icon: 'wrench', title: 'Troubleshooting', body: 'Common issues and fixes.', wiki: 'Troubleshooting' },
];

const REFERENCE = [
  { title: 'HTTP API', wiki: 'HTTP-API', hint: 'Endpoints for tooling' },
  { title: 'Commands', wiki: 'Commands', hint: 'In-game / console' },
  { title: 'On-disk files', wiki: 'On-disk-Files', hint: 'Config & data paths' },
  { title: 'Configuration', wiki: 'Configuration', hint: 'TOML and .conf' },
  { title: 'DR CLI', wiki: 'DR-CLI-Reference', hint: 'Recovery tool flags' },
  { title: 'Changelog', wiki: 'Changelog', hint: 'What changed' },
];

const ALL_GUIDES = [...GET_STARTED, ...LEARN, ...OPS];

function GuideCard({ icon, title, body, wiki }) {
  return html`
    <button
      class="help-guide-card"
      onClick=${() => navigate('docs', { wiki })}
      aria-label=${`Read: ${title}`}
      type="button"
    >
      <span class="help-guide-card__icon"><${Icon} name=${icon} size=${20} /></span>
      <span class="help-guide-card__title">${title}</span>
      <span class="help-guide-card__body">${body}</span>
    </button>
  `;
}

function DocsHub() {
  const [query, setQuery] = useState('');

  function startTour() {
    import('../../app/tour.js').then((m) => m.startTour());
  }

  function restartWizard() {
    import('../wizard/view.js').then((m) => m.relaunchSetupWizard());
  }

  const wikiHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits = [];
    for (const cat of WIKI.nav) {
      for (const p of cat.pages) {
        if (p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)) {
          hits.push({ ...p, category: cat.label });
        }
      }
    }
    return hits;
  }, [query]);

  const guideHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return ALL_GUIDES.filter(
      (g) => g.title.toLowerCase().includes(q) || g.body.toLowerCase().includes(q),
    );
  }, [query]);

  const searching = query.trim().length > 0;

  return html`
    <div class="docs-hub" data-tour="docs">
      <div class="docs-hub__hero">
        <h1 class="docs-hub__title">Documentation</h1>
        <p class="docs-hub__lead">
          Learn how WatchTower watches your server — from first install to disaster recovery.
          Search guides below, or open the full article tree anytime.
        </p>
        <div class="docs-hub__search">
          <${Icon} name="search" size=${16} class="docs-hub__search-icon" />
          <input
            type="search"
            class="docs-hub__search-input"
            placeholder="Search guides and articles…"
            value=${query}
            onInput=${(e) => setQuery(e.target.value)}
            aria-label="Search documentation"
          />
        </div>
      </div>

      ${searching ? html`
        <${Section} title=${`Results (${(guideHits?.length ?? 0) + wikiHits.length})`}>
          ${(guideHits?.length || wikiHits.length) ? html`
            <div class="docs-hub-results">
              ${guideHits?.map((g) => html`
                <button
                  key=${g.id}
                  type="button"
                  class="docs-hub-result"
                  onClick=${() => navigate('docs', { wiki: g.wiki })}
                >
                  <${Icon} name=${g.icon} size=${16} />
                  <span class="docs-hub-result__title">${g.title}</span>
                  <span class="docs-hub-result__hint">${g.body}</span>
                </button>
              `)}
              ${wikiHits.map((p) => html`
                <button
                  key=${p.slug}
                  type="button"
                  class="docs-hub-result"
                  onClick=${() => navigate('docs', { wiki: p.slug })}
                >
                  <${Icon} name="book" size=${16} />
                  <span class="docs-hub-result__title">${p.title}</span>
                  <span class="docs-hub-result__hint">${p.category}</span>
                </button>
              `)}
            </div>
          ` : html`<p class="docs-hub__empty">No matches for “${query.trim()}”.</p>`}
        </${Section}>
      ` : html`
        <div class="help-actions">
          <div class="help-actions__card">
            <${Icon} name="map" size=${22} />
            <div class="help-actions__card-text">
              <strong>Dashboard tour</strong>
              <p>A guided walkthrough of every panel.</p>
            </div>
            <${Button} kind="accent" onClick=${startTour}>Start tour</${Button}>
          </div>
          <div class="help-actions__card">
            <${Icon} name="settings" size=${22} />
            <div class="help-actions__card-text">
              <strong>Setup wizard</strong>
              <p>Re-run initial configuration.</p>
            </div>
            <${Button} kind="neutral" onClick=${restartWizard}>Run again</${Button}>
          </div>
          <div class="help-actions__card">
            <${Icon} name="book" size=${22} />
            <div class="help-actions__card-text">
              <strong>Browse all articles</strong>
              <p>Open the wiki with the sidebar.</p>
            </div>
            <${Button} kind="neutral" onClick=${() => navigate('docs', { wiki: 'Home' })}>Open Home</${Button}>
          </div>
        </div>

        <${Section} title="Get started">
          <div class="help-guide-grid">
            ${GET_STARTED.map((c) => html`<${GuideCard} key=${c.id} ...${c} />`)}
          </div>
        </${Section}>

        <${Section} title="Learn the dashboard">
          <div class="help-guide-grid">
            ${LEARN.map((c) => html`<${GuideCard} key=${c.id} ...${c} />`)}
          </div>
        </${Section}>

        <${Section} title="Ops & recovery">
          <div class="help-guide-grid">
            ${OPS.map((c) => html`<${GuideCard} key=${c.id} ...${c} />`)}
          </div>
        </${Section}>

        <${Section} title="Reference">
          <div class="docs-hub-ref">
            ${REFERENCE.map((r) => html`
              <button
                key=${r.wiki}
                type="button"
                class="docs-hub-ref__item"
                onClick=${() => navigate('docs', { wiki: r.wiki })}
              >
                <span class="docs-hub-ref__title">${r.title}</span>
                <span class="docs-hub-ref__hint">${r.hint}</span>
              </button>
            `)}
          </div>
        </${Section}>
      `}
    </div>
  `;
}

// ── Nav + article ──────────────────────────────────────────────────────────────

function WikiNav({ nav, activeSlug, onSelect, search, onSearch, onHome }) {
  const filtered = useMemo(() => {
    if (!search.trim()) return nav;
    const q = search.toLowerCase();
    return nav.map((cat) => ({
      ...cat,
      pages: cat.pages.filter(
        (p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
      ),
    })).filter((cat) => cat.pages.length > 0);
  }, [nav, search]);

  return html`
    <nav class="docs-nav" aria-label="Documentation navigation">
      <button class="docs-nav__home" onClick=${onHome} type="button">
        <${Icon} name="home" size=${14} />
        Docs home
      </button>
      <div class="docs-nav__search">
        <${Icon} name="search" size=${14} class="docs-nav__search-icon" />
        <input
          type="search"
          class="docs-nav__search-input"
          placeholder="Search docs…"
          value=${search}
          onInput=${(e) => onSearch(e.target.value)}
          aria-label="Search documentation"
        />
      </div>
      <div class="docs-nav__tree">
        ${filtered.length === 0
          ? html`<p class="docs-nav__empty">No results</p>`
          : filtered.map((cat) => html`
            <div key=${cat.id} class="docs-nav__group">
              <div class="docs-nav__group-label">${cat.label}</div>
              ${cat.pages.map((p) => html`
                <button
                  key=${p.slug}
                  type="button"
                  class=${'docs-nav__item' + (p.slug === activeSlug ? ' docs-nav__item--active' : '')}
                  onClick=${() => onSelect(p.slug)}
                  aria-current=${p.slug === activeSlug ? 'page' : undefined}
                >
                  ${p.title}
                </button>
              `)}
            </div>
          `)}
      </div>
    </nav>
  `;
}

function flatNavPages(nav) {
  const list = [];
  for (const cat of nav) {
    for (const p of cat.pages) list.push(p);
  }
  return list;
}

function WikiArticle({ slug }) {
  const page = WIKI.pages[slug];
  const pages = useMemo(() => flatNavPages(WIKI.nav), []);
  const idx = pages.findIndex((p) => p.slug === slug);
  const prev = idx > 0 ? pages[idx - 1] : null;
  const next = idx >= 0 && idx < pages.length - 1 ? pages[idx + 1] : null;

  if (!page) {
    return html`
      <div class="docs-article docs-article--missing">
        <h1 class="docs-article__title">Page not found</h1>
        <p>No wiki page found for <code>${slug}</code>.</p>
        <${Button} kind="neutral" onClick=${() => navigate('docs')}>Back to Docs home</${Button}>
      </div>
    `;
  }

  const { lead, body } = splitMarkdownLead(page.markdown);
  // Drop duplicate H1 from body if it matches the title (articles often start with # Title)
  let bodyMd = body || page.markdown;
  const h1 = bodyMd.match(/^#\s+(.+)\n?/);
  if (h1 && h1[1].trim() === page.title) {
    bodyMd = bodyMd.slice(h1[0].length).replace(/^\n+/, '');
  }
  let leadMd = lead;
  if (leadMd) {
    const leadH1 = leadMd.match(/^#\s+(.+)\n?/);
    if (leadH1 && leadH1[1].trim() === page.title) {
      leadMd = leadMd.slice(leadH1[0].length).trim() || null;
    }
  }

  const widgets = widgetsFor(slug);
  const leadNodes = leadMd ? renderMarkdown(leadMd) : null;
  const bodyNodes = renderMarkdown(bodyMd);

  return html`
    <article class="docs-article" aria-label=${page.title}>
      <header class="docs-article__header">
        <button type="button" class="docs-article__back" onClick=${() => navigate('docs')}>
          <${Icon} name="home" size=${14} />
          Docs home
        </button>
        <h1 class="docs-article__title">${page.title}</h1>
      </header>

      ${widgets ? html`<div class="docs-article__widgets">${widgets}</div>` : null}

      ${leadNodes ? html`
        <div class="docs-article__lead wiki-content">${leadNodes}</div>
      ` : null}

      <div class="docs-article__body wiki-content">
        ${bodyNodes}
      </div>

      <nav class="docs-article__pager" aria-label="Adjacent articles">
        ${prev ? html`
          <button type="button" class="docs-article__pager-btn docs-article__pager-btn--prev" onClick=${() => navigate('docs', { wiki: prev.slug })}>
            <span class="docs-article__pager-label">Previous</span>
            <span class="docs-article__pager-title">${prev.title}</span>
          </button>
        ` : html`<span></span>`}
        ${next ? html`
          <button type="button" class="docs-article__pager-btn docs-article__pager-btn--next" onClick=${() => navigate('docs', { wiki: next.slug })}>
            <span class="docs-article__pager-label">Next</span>
            <span class="docs-article__pager-title">${next.title}</span>
          </button>
        ` : html`<span></span>`}
      </nav>
    </article>
  `;
}

export function PageView() {
  const { route } = ui.value;
  const wikiSlug = route?.params?.wiki ?? '';
  const [search, setSearch] = useState('');
  const hasContent = WIKI.nav.length > 0;

  useEffect(() => {
    if (route?.tab === 'help') navigate('docs', {}, { replace: true });
  }, [route?.tab]);

  function selectPage(slug) {
    navigate('docs', { wiki: slug });
    setSearch('');
  }

  if (!wikiSlug) {
    return html`
      <${Page} title="Docs" subtitle="Guides, recovery, and reference">
        <${DocsHub} />
      </${Page}>
    `;
  }

  return html`
    <div class="docs-shell" data-tour="docs">
      ${hasContent
        ? html`
          <${WikiNav}
            nav=${WIKI.nav}
            activeSlug=${wikiSlug}
            onSelect=${selectPage}
            search=${search}
            onSearch=${setSearch}
            onHome=${() => navigate('docs')}
          />
          <div class="docs-content">
            <${WikiArticle} slug=${wikiSlug} />
          </div>
        `
        : html`
          <div class="docs-empty">
            <${Icon} name="book" size=${48} />
            <h1 class="docs-empty__title">Documentation not built</h1>
            <p class="docs-empty__body">Run <code>node scripts/build.mjs</code> to generate the wiki bundle.</p>
          </div>
        `}
    </div>
  `;
}
