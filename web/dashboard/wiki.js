/**
 * In-app documentation — renders bundled wiki markdown with dashboard-native chrome.
 */
const WatchtowerWiki = (function () {
  const data = () => window.WATCHTOWER_WIKI || { nav: [], pages: {} };
  let currentSlug = 'Home';
  let searchQuery = '';
  let mountRoot = null;

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function slugFromLink(raw) {
    const base = String(raw || '').trim().split('#')[0];
    return base.replace(/\s+/g, '-');
  }

  function wikiHref(slug) {
    if (typeof TowerRouting !== 'undefined') {
      return TowerRouting.buildUrl({ tab: 'docs', wiki: slug });
    }
    return `#wiki/${encodeURIComponent(slug)}`;
  }

  function inlineFormat(text) {
    let s = esc(text);
    s = s.replace(/\[\[([^\]|#]+)(?:#[^\]]+)?\|([^\]]+)\]\]/g, (_, page, label) =>
      `<a href="${wikiHref(slugFromLink(page))}" class="wt-wiki-link" data-wiki-slug="${esc(slugFromLink(page))}">${esc(label.trim())}</a>`);
    s = s.replace(/\[\[([^\]|#]+)(?:#([^\]]+))?\]\]/g, (_, page, anchor) => {
      const slug = slugFromLink(page);
      const label = anchor ? `${page.trim()} — ${anchor.trim()}` : page.trim();
      return `<a href="${wikiHref(slug)}" class="wt-wiki-link" data-wiki-slug="${esc(slug)}">${esc(label)}</a>`;
    });
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      const u = url.trim();
      const ext = /^https?:\/\//i.test(u);
      return `<a href="${esc(u)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(label)}</a>`;
    });
    return s;
  }

  function isTableRow(line) {
    return /^\|.+\|$/.test(line.trim());
  }

  function parseTableRow(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  }

  function renderTable(rows) {
    if (rows.length < 2) return '';
    const header = rows[0];
    const body = rows.slice(2);
    return `<div class="wt-wiki-table-wrap"><table class="wt-wiki-table">
      <thead><tr>${header.map((c) => `<th>${inlineFormat(c)}</th>`).join('')}</tr></thead>
      <tbody>${body.map((row) => `<tr>${row.map((c) => `<td>${inlineFormat(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
  }

  function parseMarkdown(md) {
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let i = 0;
    let inCode = false;
    let codeBuf = [];
    let listType = null;
    let listBuf = [];

    function flushList() {
      if (!listBuf.length) return;
      if (listType === 'ol') {
        out.push(`<ol class="wt-wiki-list wt-wiki-list--steps">${listBuf.join('')}</ol>`);
      } else {
        const cls = listType === 'check' ? ' wt-wiki-checklist' : ' wt-wiki-list--bullets';
        out.push(`<ul class="wt-wiki-list${cls}">${listBuf.join('')}</ul>`);
      }
      listBuf = [];
      listType = null;
    }

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (inCode) {
        if (trimmed.startsWith('```')) {
          out.push(`<pre class="wt-wiki-pre"><code>${esc(codeBuf.join('\n'))}</code></pre>`);
          codeBuf = [];
          inCode = false;
        } else {
          codeBuf.push(line);
        }
        i += 1;
        continue;
      }

      if (trimmed.startsWith('```')) {
        flushList();
        inCode = true;
        i += 1;
        continue;
      }

      if (trimmed === '---' || trimmed === '***') {
        flushList();
        out.push('<hr class="wt-wiki-hr">');
        i += 1;
        continue;
      }

      if (/^>\s?/.test(trimmed)) {
        flushList();
        const quoteLines = [];
        while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
          quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
          i += 1;
        }
        out.push(`<blockquote class="wt-wiki-callout wt-wiki-callout--quote"><p>${inlineFormat(quoteLines.join(' '))}</p></blockquote>`);
        continue;
      }

      if (isTableRow(trimmed)) {
        flushList();
        const tableRows = [];
        while (i < lines.length && isTableRow(lines[i].trim())) {
          tableRows.push(parseTableRow(lines[i]));
          i += 1;
        }
        out.push(renderTable(tableRows));
        continue;
      }

      const h = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (h) {
        flushList();
        const level = h[1].length;
        const id = h[2].toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
        out.push(`<h${level} class="wt-wiki-h wt-wiki-h${level}" id="wiki-${esc(id)}">${inlineFormat(h[2])}</h${level}>`);
        i += 1;
        continue;
      }

      const check = trimmed.match(/^-\s+\[([ xX])\]\s+(.+)$/);
      if (check) {
        if (listType !== 'check') {
          flushList();
          listType = 'check';
        }
        const checked = check[1].toLowerCase() === 'x';
        listBuf.push(`<li><label class="wt-wiki-check"><input type="checkbox"${checked ? ' checked' : ''} disabled> <span>${inlineFormat(check[2])}</span></label></li>`);
        i += 1;
        continue;
      }

      const ul = trimmed.match(/^[-*]\s+(.+)$/);
      if (ul) {
        if (listType !== 'ul') {
          flushList();
          listType = 'ul';
        }
        listBuf.push(`<li>${inlineFormat(ul[1])}</li>`);
        i += 1;
        continue;
      }

      const ol = trimmed.match(/^\d+\.\s+(.+)$/);
      if (ol) {
        if (listType !== 'ol') {
          flushList();
          listType = 'ol';
        }
        listBuf.push(`<li>${inlineFormat(ol[1])}</li>`);
        i += 1;
        continue;
      }

      if (!trimmed) {
        if (listType === 'check' || listType === 'ol') {
          let j = i + 1;
          while (j < lines.length && !lines[j].trim()) j += 1;
          const next = j < lines.length ? lines[j].trim() : '';
          if (listType === 'check' && /^-\s+\[([ xX])\]\s+/.test(next)) {
            i += 1;
            continue;
          }
          if (listType === 'ol' && /^\d+\.\s+/.test(next)) {
            i += 1;
            continue;
          }
        }
        flushList();
        i += 1;
        continue;
      }

      flushList();
      out.push(`<p class="wt-wiki-p">${inlineFormat(trimmed)}</p>`);
      i += 1;
    }

    flushList();
    if (inCode && codeBuf.length) {
      out.push(`<pre class="wt-wiki-pre"><code>${esc(codeBuf.join('\n'))}</code></pre>`);
    }
    return out.join('\n');
  }

  function findPage(slug) {
    const pages = data().pages || {};
    if (pages[slug]) return pages[slug];
    const key = Object.keys(pages).find((k) => k.toLowerCase() === String(slug || '').toLowerCase());
    return key ? pages[key] : null;
  }

  function allPagesFlat() {
    const flat = [];
    for (const cat of data().nav || []) {
      for (const p of cat.pages || []) flat.push({ ...p, category: cat.label });
    }
    return flat;
  }

  function splitMarkdownLead(markdown) {
    const stripped = markdown.replace(/^#\s+.+\n+/, '').trim();
    const normalized = stripped.replace(/\r\n/g, '\n');
    const splitIdx = normalized.indexOf('\n---\n');
    if (splitIdx < 0) return { lead: '', rest: stripped };
    return {
      lead: normalized.slice(0, splitIdx).trim(),
      rest: normalized.slice(splitIdx + 5).trim(),
    };
  }

  function renderArticle(slug) {
    const page = findPage(slug);
    if (!page) {
      return `<div class="wt-wiki-empty"><p>Page not found: <code>${esc(slug)}</code></p></div>`;
    }
    const widget = typeof WatchtowerWikiWidgets !== 'undefined' ? WatchtowerWikiWidgets.forPage(slug) : '';
    const { lead, rest } = splitMarkdownLead(page.markdown);
    const leadHtml = lead ? parseMarkdown(lead) : '';
    const bodyHtml = rest ? parseMarkdown(rest) : '';
    return `
      <article class="wt-wiki-article wt-enter">
        <header class="wt-wiki-article__head">
          <h1 class="wt-wiki-article__title">${esc(page.title)}</h1>
        </header>
        ${leadHtml ? `<div class="wt-wiki-body wt-wiki-lead">${leadHtml}</div>` : ''}
        ${widget}
        <div class="wt-wiki-body">${bodyHtml}</div>
      </article>`;
  }

  function renderNav() {
    const q = searchQuery.trim().toLowerCase();
    const cats = data().nav || [];
    return cats.map((cat) => {
      const pages = (cat.pages || []).filter((p) => {
        if (!q) return true;
        return p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
      });
      if (!pages.length) return '';
      return `
        <div class="wt-wiki-nav__group">
          <div class="wt-wiki-nav__cat">${esc(cat.label)}</div>
          ${pages.map((p) => `
            <button type="button" class="wt-wiki-nav__btn wt-hub-nav__btn${p.slug === currentSlug ? ' active' : ''}" data-wiki-nav="${esc(p.slug)}">${esc(p.title)}</button>
          `).join('')}
        </div>`;
    }).join('');
  }

  function renderShell() {
    return `
      <div class="wt-wiki">
        <article class="wt-card wt-card--surface wt-wiki-shell">
          <header class="wt-wiki-shell__toolbar">
            <div class="wt-wiki-search">
              <i data-lucide="search" width="16" height="16" aria-hidden="true"></i>
              <input type="search" class="wt-wiki-search__input" id="wiki-search" placeholder="Search documentation…" value="${esc(searchQuery)}" autocomplete="off">
            </div>
          </header>
          <div class="wt-wiki-shell__layout wt-wiki__layout">
            <nav class="wt-wiki-shell__nav wt-wiki__nav" aria-label="Documentation pages">${renderNav()}</nav>
            <div class="wt-wiki-shell__article wt-card wt-card--surface wt-wiki__main" id="wiki-article-root">${renderArticle(currentSlug)}</div>
          </div>
        </article>
      </div>`;
  }

  function navigate(slug, { pushHash = true, replace = false } = {}) {
    const page = findPage(slug);
    currentSlug = page ? page.slug : slug;
    state.wikiPageSlug = currentSlug;
    const articleRoot = mountRoot?.querySelector('#wiki-article-root');
    if (articleRoot) {
      articleRoot.innerHTML = renderArticle(currentSlug);
      articleRoot.scrollTop = 0;
    }
    mountRoot?.querySelectorAll('[data-wiki-nav]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.wikiNav === currentSlug);
    });
    if (pushHash) {
      if (typeof TowerRouting !== 'undefined') {
        TowerRouting.write({ tab: 'docs', wiki: currentSlug }, { push: !replace });
      } else {
        const next = `#wiki/${encodeURIComponent(currentSlug)}`;
        if (location.hash !== next) history.replaceState(null, '', next);
      }
    }
    if (window.lucide && articleRoot) lucide.createIcons({ root: articleRoot });
    if (typeof TowerMotion !== 'undefined' && articleRoot) TowerMotion.staggerEnter(articleRoot);
  }

  function bindEvents() {
    if (!mountRoot) return;
    mountRoot.querySelector('#wiki-search')?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      const nav = mountRoot.querySelector('.wt-wiki__nav');
      if (nav) nav.innerHTML = renderNav();
      bindNavClicks();
    });
    bindNavClicks();
    mountRoot.addEventListener('click', (e) => {
      const link = e.target.closest('[data-wiki-slug]');
      if (link) {
        e.preventDefault();
        navigate(link.dataset.wikiSlug);
      }
    });
  }

  function bindNavClicks() {
    mountRoot?.querySelectorAll('[data-wiki-nav]').forEach((btn) => {
      btn.addEventListener('click', () => navigate(btn.dataset.wikiNav));
    });
  }

  function parseHash() {
    if (typeof TowerRouting !== 'undefined') return TowerRouting.parseWikiSlug();
    const m = location.hash.match(/^#wiki\/([^?#]+)/);
    if (m) return decodeURIComponent(m[1]);
    return null;
  }

  function mount(root, slug) {
    mountRoot = root;
    currentSlug = slug
      || (typeof TowerRouting !== 'undefined' ? TowerRouting.resolveWikiSlug({}) : parseHash())
      || currentSlug
      || 'Home';
    if (!findPage(currentSlug)) currentSlug = 'Home';
    state.wikiPageSlug = currentSlug;
    root.innerHTML = renderShell();
    bindEvents();
    if (typeof TowerRouting !== 'undefined') {
      TowerRouting.write({ tab: 'docs', wiki: currentSlug }, { push: false });
    }
    if (window.lucide) lucide.createIcons({ root });
    if (typeof TowerMotion !== 'undefined') TowerMotion.staggerEnter(root);
  }

  function open(slug) {
    if (typeof navigateToTab === 'function') {
      navigateToTab('docs', { wikiSlug: slug || state.wikiPageSlug || 'Home' });
      return;
    }
    if (typeof WatchtowerWiki !== 'undefined' && mountRoot) {
      navigate(slug || 'Home');
    }
  }

  window.addEventListener('hashchange', () => {
    const slug = parseHash();
    if (slug && state.activeTab === 'docs' && mountRoot) navigate(slug, { pushHash: true, replace: true });
  });

  return { mount, navigate, open, parseHash };
})();
