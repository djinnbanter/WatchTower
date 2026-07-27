import { useMemo, useState, type ComponentType } from 'react';
import {
  Activity,
  Archive,
  BookOpen,
  Bug,
  ChevronRight,
  ClipboardList,
  Compass,
  Database,
  ExternalLink,
  Layers,
  LifeBuoy,
  Package,
  Rocket,
  Search,
  Settings,
  Shield,
  Wrench,
  Zap,
} from '@/ui/icons';
import { navigate, type RouteState } from '@/app/router';
import { PageEnter } from '@/ui/motion';
import { Button, EmptyState, Section } from '@/ui/patterns';
import { WIKI } from '@/wiki/content.js';
import { renderMarkdown, splitMarkdownLead } from '@/wiki/render';
import { widgetsFor } from './widgets';
import '@/features/docs/docs.css';
type Guide = {
  id: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  body: string;
  wiki: string;
};

const GET_STARTED: Guide[] = [
  {
    id: 'quick-start',
    Icon: Rocket,
    title: 'Quick start',
    body: 'Solid first setup in about 15 minutes.',
    wiki: 'Quick-Start-Checklist',
  },
  {
    id: 'install',
    Icon: Package,
    title: 'Installation',
    body: 'Drop the mod in, open the dashboard.',
    wiki: 'Installation',
  },
];

const LEARN: Guide[] = [
  {
    id: 'data-sources',
    Icon: Database,
    title: 'Data sources',
    body: 'Watching, Scanning, Support — and the Sources tab.',
    wiki: 'Understanding-Data-Sources',
  },
  {
    id: 'tabs',
    Icon: Layers,
    title: 'Dashboard tabs',
    body: 'Rail map — when to open each tab.',
    wiki: 'Dashboard-Tabs',
  },
  {
    id: 'overview',
    Icon: Compass,
    title: 'Overview',
    body: 'Health grade, vitals, and what needs attention.',
    wiki: 'Dashboard-Overview',
  },
  {
    id: 'live-charts',
    Icon: Activity,
    title: 'Live charts',
    body: 'TPS, tick lag, heap, and players right now.',
    wiki: 'Live-Charts',
  },
  {
    id: 'insights',
    Icon: Compass,
    title: 'Insights',
    body: 'Patterns, configs, mod churn, and storage trends.',
    wiki: 'Insights',
  },
  {
    id: 'session',
    Icon: Activity,
    title: 'Session',
    body: 'Who is online, peaks, and the player directory.',
    wiki: 'Session',
  },
  {
    id: 'startup',
    Icon: Rocket,
    title: 'Startup',
    body: 'Last boot verdict, phases, and history.',
    wiki: 'Startup',
  },
  {
    id: 'health-reports',
    Icon: ClipboardList,
    title: 'Support packs',
    body: 'Support packs and optional scheduled reports.',
    wiki: 'Health-Reports',
  },
];

const OPS: Guide[] = [
  {
    id: 'issues',
    Icon: ClipboardList,
    title: 'Issues',
    body: 'Fix inbox — what to tackle next.',
    wiki: 'Issues',
  },
  {
    id: 'crashes',
    Icon: Bug,
    title: 'Crashes',
    body: 'Fingerprint groups with Fix and Evidence.',
    wiki: 'Crashes',
  },
  {
    id: 'logs',
    Icon: BookOpen,
    title: 'Logs',
    body: 'Browse server logs with filters and search.',
    wiki: 'Logs',
  },
  {
    id: 'mods',
    Icon: Package,
    title: 'Mods',
    body: 'Inventory, updates, conflicts, and forensics.',
    wiki: 'Mods',
  },
  {
    id: 'sources',
    Icon: Database,
    title: 'Sources',
    body: 'Pollers, freshness, and next data pulls.',
    wiki: 'Sources',
  },
  {
    id: 'activity',
    Icon: Activity,
    title: 'Activity',
    body: 'Timeline of commands, joins, lag, and jobs.',
    wiki: 'Activity',
  },
  {
    id: 'backups',
    Icon: Archive,
    title: 'Backups',
    body: 'Folder health and heartbeat webhooks.',
    wiki: 'Backups',
  },
  {
    id: 'spark',
    Icon: Zap,
    title: 'Spark profiler',
    body: 'Attach profiles for deep lag analysis.',
    wiki: 'Using-Spark-with-Watchtower',
  },
  {
    id: 'security',
    Icon: Shield,
    title: 'Security',
    body: 'Passwords, 2FA, and dashboard access.',
    wiki: 'Security-and-Access',
  },
  {
    id: 'dr',
    Icon: Bug,
    title: 'Disaster recovery',
    body: 'When the server will not start.',
    wiki: 'Disaster-Recovery',
  },
  {
    id: 'troubleshooting',
    Icon: Wrench,
    title: 'Troubleshooting',
    body: 'Common issues and fixes.',
    wiki: 'Troubleshooting',
  },
];

const REFERENCE = [
  { title: 'HTTP API', wiki: 'HTTP-API', hint: 'Endpoints for tooling' },
  { title: 'Commands', wiki: 'Commands', hint: 'In-game / console' },
  { title: 'On-disk files', wiki: 'On-disk-Files', hint: 'Config & data paths' },
  { title: 'Configuration', wiki: 'Configuration', hint: 'TOML and .conf' },
  { title: 'Crash rule packs', wiki: 'Crash-Rule-Packs', hint: 'Optional YAML matchers' },
  { title: 'DR CLI', wiki: 'DR-CLI-Reference', hint: 'Recovery tool flags' },
  { title: 'Changelog', wiki: 'Changelog', hint: 'What changed' },
];

const ALL_GUIDES = [...GET_STARTED, ...LEARN, ...OPS];

function openSupport() {
  window.dispatchEvent(new Event('wt:open-support'));
}

function openArticle(wiki: string) {
  navigate({ tab: 'docs', wiki });
}

function GuideCard({ Icon, title, body, wiki }: Guide) {
  return (
    <button
      type="button"
      className="help-guide-card"
      onClick={() => openArticle(wiki)}
      aria-label={`Read: ${title}`}
    >
      <span className="help-guide-card__icon">
        <Icon size={20} />
      </span>
      <span className="help-guide-card__title">{title}</span>
      <span className="help-guide-card__body">{body}</span>
    </button>
  );
}

function DocsHub() {
  const [query, setQuery] = useState('');

  const wikiHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: { slug: string; title: string; category: string }[] = [];
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

  return (
    <div className="docs-hub">
      <div className="docs-hub__hero">
        <h2 className="docs-hub__title">How can we help?</h2>
        <p className="docs-hub__lead">
          Learn how WatchTower watches your server — from first install to disaster recovery. Search
          guides below, or open the full article tree anytime.
        </p>
        <div className="docs-hub__search">
          <Search size={16} className="docs-hub__search-icon" />
          <input
            type="search"
            className="docs-hub__search-input"
            placeholder="Search guides and articles…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search documentation"
          />
        </div>
      </div>

      {searching ? (
        <Section title={`Results (${(guideHits?.length ?? 0) + wikiHits.length})`}>
          {(guideHits?.length || wikiHits.length) ? (
            <div className="docs-hub-results">
              {guideHits?.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="docs-hub-result"
                  onClick={() => openArticle(g.wiki)}
                >
                  <g.Icon size={16} />
                  <span className="docs-hub-result__title">{g.title}</span>
                  <span className="docs-hub-result__hint">{g.body}</span>
                </button>
              ))}
              {wikiHits.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  className="docs-hub-result"
                  onClick={() => openArticle(p.slug)}
                >
                  <BookOpen size={16} />
                  <span className="docs-hub-result__title">{p.title}</span>
                  <span className="docs-hub-result__hint">{p.category}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="docs-hub__empty">No matches for “{query.trim()}”.</p>
          )}
        </Section>
      ) : (
        <>
          <div className="help-actions">
            <div className="help-actions__card">
              <Settings size={22} />
              <div className="help-actions__card-text">
                <strong>Welcome tour</strong>
                <p>Reopen the setup walkthrough from Settings → About.</p>
              </div>
              <Button kind="default" onClick={() => navigate({ tab: 'settings', panel: 'about' })}>
                Open About
              </Button>
            </div>
            <div className="help-actions__card">
              <BookOpen size={22} />
              <div className="help-actions__card-text">
                <strong>Browse all articles</strong>
                <p>Open the wiki from Home.</p>
              </div>
              <Button kind="default" onClick={() => openArticle('Home')}>
                Open Home
              </Button>
            </div>
            <div className="help-actions__card">
              <LifeBuoy size={22} />
              <div className="help-actions__card-text">
                <strong>Support pack</strong>
                <p>Build a redacted zip when something’s wrong.</p>
              </div>
              <Button kind="default" onClick={openSupport}>
                Build pack
              </Button>
            </div>
          </div>

          <Section title="Get started">
            <div className="help-guide-grid">
              {GET_STARTED.map((c) => (
                <GuideCard key={c.id} {...c} />
              ))}
            </div>
          </Section>

          <Section title="Learn the dashboard">
            <div className="help-guide-grid">
              {LEARN.map((c) => (
                <GuideCard key={c.id} {...c} />
              ))}
            </div>
          </Section>

          <Section title="Ops & recovery">
            <div className="help-guide-grid">
              {OPS.map((c) => (
                <GuideCard key={c.id} {...c} />
              ))}
            </div>
          </Section>

          <Section title="Reference">
            <div className="docs-hub-ref">
              {REFERENCE.map((r) => (
                <button
                  key={r.wiki}
                  type="button"
                  className="docs-hub-ref__item"
                  onClick={() => openArticle(r.wiki)}
                >
                  <span className="docs-hub-ref__title">{r.title}</span>
                  <span className="docs-hub-ref__hint">{r.hint}</span>
                  <ChevronRight size={14} className="docs-hub-ref__chev" />
                </button>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function flatNavPages(nav: typeof WIKI.nav) {
  const list: { slug: string; title: string }[] = [];
  for (const cat of nav) {
    for (const p of cat.pages) list.push(p);
  }
  return list;
}

function WikiNav({
  activeSlug,
  search,
  onSearch,
  onSelect,
  onHome,
}: {
  activeSlug: string;
  search: string;
  onSearch: (q: string) => void;
  onSelect: (slug: string) => void;
  onHome: () => void;
}) {
  const filtered = useMemo(() => {
    if (!search.trim()) return WIKI.nav;
    const q = search.toLowerCase();
    return WIKI.nav
      .map((cat) => ({
        ...cat,
        pages: cat.pages.filter(
          (p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
        ),
      }))
      .filter((cat) => cat.pages.length > 0);
  }, [search]);

  return (
    <nav className="docs-nav" aria-label="Documentation navigation">
      <button type="button" className="docs-nav__home" onClick={onHome}>
        <Compass size={14} />
        Help home
      </button>
      <div className="docs-nav__search">
        <Search size={14} className="docs-nav__search-icon" />
        <input
          type="search"
          className="docs-nav__search-input"
          placeholder="Search docs…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="Search documentation"
        />
      </div>
      <div className="docs-nav__tree">
        {filtered.length === 0 ? (
          <p className="docs-nav__empty">No results</p>
        ) : (
          filtered.map((cat) => (
            <div key={cat.id} className="docs-nav__group">
              <div className="docs-nav__group-label">{cat.label}</div>
              {cat.pages.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  className={`docs-nav__item${p.slug === activeSlug ? ' docs-nav__item--active' : ''}`}
                  onClick={() => onSelect(p.slug)}
                  aria-current={p.slug === activeSlug ? 'page' : undefined}
                >
                  {p.title}
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </nav>
  );
}

function WikiArticle({ slug }: { slug: string }) {
  const page = WIKI.pages[slug];
  const pages = useMemo(() => flatNavPages(WIKI.nav), []);
  const idx = pages.findIndex((p) => p.slug === slug);
  const prev = idx > 0 ? pages[idx - 1] : null;
  const next = idx >= 0 && idx < pages.length - 1 ? pages[idx + 1] : null;

  if (!page) {
    return (
      <div className="docs-article docs-article--missing">
        <h2 className="docs-article__title">Page not found</h2>
        <p>
          No wiki page found for <code>{slug}</code>.
        </p>
        <Button kind="default" onClick={() => navigate({ tab: 'docs', wiki: null })}>
          Back to Help home
        </Button>
      </div>
    );
  }

  const { lead, body } = splitMarkdownLead(page.markdown);
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

  return (
    <article className="docs-article" aria-label={page.title}>
      <header className="docs-article__header">
        <button
          type="button"
          className="docs-article__back"
          onClick={() => navigate({ tab: 'docs', wiki: null })}
        >
          <Compass size={14} />
          Help home
        </button>
        <h2 className="docs-article__title">{page.title}</h2>
        <a
          href={`https://github.com/djinnbanter/WatchTower/wiki/${page.slug}`}
          target="_blank"
          rel="noreferrer"
          className="docs-article__ext"
        >
          GitHub wiki <ExternalLink size={13} />
        </a>
      </header>

      {widgets ? <div className="docs-article__widgets">{widgets}</div> : null}

      {leadNodes ? <div className="docs-article__lead wiki-content">{leadNodes}</div> : null}

      <div className="docs-article__body wiki-content">{bodyNodes}</div>

      <nav className="docs-article__pager" aria-label="Adjacent articles">
        {prev ? (
          <button
            type="button"
            className="docs-article__pager-btn docs-article__pager-btn--prev"
            onClick={() => openArticle(prev.slug)}
          >
            <span className="docs-article__pager-label">Previous</span>
            <span className="docs-article__pager-title">{prev.title}</span>
          </button>
        ) : (
          <span />
        )}
        {next ? (
          <button
            type="button"
            className="docs-article__pager-btn docs-article__pager-btn--next"
            onClick={() => openArticle(next.slug)}
          >
            <span className="docs-article__pager-label">Next</span>
            <span className="docs-article__pager-title">{next.title}</span>
          </button>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}

export function PageView({ route }: { route: RouteState }) {
  const wikiSlug = route.wiki ?? '';
  const [search, setSearch] = useState('');
  const hasContent = WIKI.nav.length > 0;

  if (!wikiSlug) {
    return (
      <PageEnter>
        <DocsHub />
      </PageEnter>
    );
  }

  if (!hasContent) {
    return (
      <EmptyState title="Documentation not built">
        Run <code>npm run build:wiki</code> to generate the wiki bundle.
      </EmptyState>
    );
  }

  return (
    <PageEnter className="docs-shell">
      <WikiNav
        activeSlug={wikiSlug}
        search={search}
        onSearch={setSearch}
        onSelect={(slug) => {
          openArticle(slug);
          setSearch('');
        }}
        onHome={() => navigate({ tab: 'docs', wiki: null })}
      />
      <div className="docs-content">
        <WikiArticle slug={wikiSlug} />
      </div>
    </PageEnter>
  );
}
