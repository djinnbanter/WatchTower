/**
 * Watchtower UI v3 — mods tab renderers
 */
const TowerRenderMods = (function () {
  const esc = TowerRenderShared.esc;
  const CLIENT_MOD_BUCKET_ORDER = ['test_remove', 'likely_removable', 'uncertain', 'client_library'];
  const AGGREGATE_REC_IDS = new Set(['client_noise', 'client_only_mods', 'client_only_mods_test']);
  const MODS_VIEWS = [
    { id: 'overview', label: 'Overview', icon: 'layout-grid' },
    { id: 'conflicts', label: 'Update conflicts', icon: 'link' },
    { id: 'client', label: 'Client-only', icon: 'monitor-smartphone' },
    { id: 'errors', label: 'Log errors', icon: 'alert-triangle' },
  ];

  function escAttr(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function matchesSearch(modId, displayName, q) {
    if (!q) return true;
    const needle = q.toLowerCase();
    const id = (modId || '').toLowerCase();
    const name = (displayName || Labels.modFriendlyName(modId) || '').toLowerCase();
    return id.includes(needle) || name.includes(needle);
  }

  function isConflictRec(r) {
    return ['recipe_compat', 'mod_load_failed', 'registry_missing'].includes(r.category) || !!r.action;
  }

  function modProblemIcon(category) {
    if (category === 'recipe_compat' || category === 'registry_missing') return 'link';
    if (category === 'mod_corrupt' || category === 'mod_load_failed') return 'alert-triangle';
    return 'package';
  }

  function severityAccent(severity) {
    if (severity === 'critical') return 'wt-mod-issue-card__accent--critical';
    if (severity === 'warning') return 'wt-mod-issue-card__accent--warn';
    return 'wt-mod-issue-card__accent--info';
  }

  function renderSourceBadge(source) {
    if (!source) return '';
    const cls = source === 'live' ? 'wt-source-badge--live'
      : source === 'scanned' ? 'wt-source-badge--scanned'
        : 'wt-source-badge--report';
    const label = source === 'live' ? 'Live' : source === 'scanned' ? 'Scanned' : 'Report';
    return `<span class="wt-source-badge ${cls}">${esc(label)}</span>`;
  }

  function computeModsBase(f) {
    const opt = f?.optional || {};
    const running = typeof mergedRunningMods === 'function'
      ? mergedRunningMods(f, state.opsCache)
      : { mods: opt.mods ?? [], source: 'report' };
    const mods = running.mods ?? [];
    const manifestSource = running.source;
    const modErrs = typeof mergedModLogErrors === 'function'
      ? mergedModLogErrors(f, state.opsCache)
      : (opt.mod_log_errors ?? []).filter((e) => e.mod_id !== 'client_noise');
    const scanSource = hasOpsModScanData(state.opsCache) ? 'scanned' : (modErrs.length ? 'report' : null);
    const modScanAt = state.opsCache?.mod_log_errors?.scanned_at ?? null;
    const errorModIds = new Set(modErrs.map((e) => e.mod_id));
    const clientModIds = new Set((opt.client_only_mods ?? []).map((m) => m.mod_id));
    const allRecs = (opt.mod_recommendations ?? []).filter((r) => !AGGREGATE_REC_IDS.has(r.mod_id));
    const conflictRecsAll = allRecs.filter(isConflictRec);
    const otherRecsAll = allRecs.filter((r) => !isConflictRec(r));
    const conflictIds = new Set(conflictRecsAll.map((r) => r.mod_id));
    const ignores = getClientModIgnores();
    const clientSummary = ClientModIgnores.effectiveSummary(f, ignores) || opt.client_only_mods_summary;
    const clientToReview = (clientSummary?.likely_removable_count ?? 0) + (clientSummary?.test_remove_count ?? 0);
    const clientMods = opt.client_only_mods ?? [];
    const inventoryDiff = state.opsCache?.mods_inventory?.diff;
    const changedModIds = new Set();
    const changedJars = new Map();
    if (inventoryDiff?.has_changes) {
      for (const row of [...(inventoryDiff.added || []), ...(inventoryDiff.removed || []), ...(inventoryDiff.changed || [])]) {
        if (row.mod_id) changedModIds.add(row.mod_id);
        if (row.jar) changedJars.set(row.jar, row.change || 'changed');
      }
    }

    return {
      mods,
      modErrs,
      manifestSource,
      scanSource,
      modScanAt,
      errorModIds,
      clientModIds,
      conflictRecsAll,
      otherRecsAll,
      conflictIds,
      allRecs,
      clientSummary,
      clientToReview,
      clientMods,
      ignores,
      changedModIds,
      changedJars,
      inventoryDiff,
    };
  }

  function computeModsContext(f) {
    const base = computeModsBase(f);
    const view = state.modsView || 'overview';
    const q = (state.modsSearch || '').trim().toLowerCase();

    const filterRecs = (recs) => recs.filter((r) => matchesSearch(r.mod_id, r.display_name, q));
    const conflictRecs = filterRecs(base.conflictRecsAll);
    const otherRecs = filterRecs(base.otherRecsAll);

    let filteredMods = base.mods;
    if (view === 'errors') filteredMods = base.mods.filter((m) => base.errorModIds.has(m.id));
    else if (view === 'client') filteredMods = base.mods.filter((m) => base.clientModIds.has(m.id));
    else if (view === 'conflicts') filteredMods = base.mods.filter((m) => base.conflictIds.has(m.id));
    if (q) {
      filteredMods = filteredMods.filter((m) => matchesSearch(m.id, m.display_name || Labels.modFriendlyName(m.id), q));
    }
    if (view === 'errors') {
      filteredMods = [...filteredMods].sort((a, b) => Number(base.errorModIds.has(b.id)) - Number(base.errorModIds.has(a.id)));
    }

    return {
      ...base,
      view,
      q,
      conflictRecs,
      otherRecs,
      filteredMods,
    };
  }

  function searchPlaceholder(view) {
    const map = {
      overview: 'Search manifest…',
      conflicts: 'Search conflicts…',
      client: 'Search client mods…',
      errors: 'Search mods with errors…',
    };
    return map[view] || map.overview;
  }

  function modsCountLabel(ctx) {
    if (ctx.manifestSource === 'live') {
      return `${ctx.mods.length} mod${ctx.mods.length === 1 ? '' : 's'} running`;
    }
    return `${ctx.mods.length} mod${ctx.mods.length === 1 ? '' : 's'} in report`;
  }

  function renderModsStatusBar(ctx) {
    return `
      <div id="mods-status-bar" class="wt-mods-status-bar" role="region" aria-label="Mod scan status">
        <div class="wt-mods-status-bar__main">
          <span class="wt-mods-status-bar__count">${esc(modsCountLabel(ctx))}</span>
        </div>
        <button type="button" class="wt-btn wt-btn--outline wt-btn--sm wt-mods-status-bar__scan" id="mods-scan-btn">
          <i data-lucide="refresh-cw" width="14" height="14"></i> Scan log now
        </button>
      </div>`;
  }

  function renderModsChrome(f, ctx, counts) {
    const view = ctx.view;
    const buttons = MODS_VIEWS.map(({ id, label, icon }) => {
      const n = id === 'conflicts' ? counts.conflicts
        : id === 'client' ? counts.client
          : id === 'errors' ? counts.errors
            : 0;
      const badge = n ? `<span class="wt-mods-subnav__badge">${n}</span>` : '';
      const active = view === id ? ' active' : '';
      return `<button type="button" class="wt-mods-subnav__btn${active}" data-mod-view="${id}">
        <i data-lucide="${icon}" width="14" height="14" aria-hidden="true"></i>
        <span>${esc(label)}</span>${badge}
      </button>`;
    }).join('');

    const showTech = view === 'overview' || view === 'errors';

    return `
      <div class="wt-card wt-card--surface wt-mods-chrome">
        <nav class="wt-mods-subnav" id="mods-subnav" aria-label="Mods sections">${buttons}</nav>
        <div class="wt-mods-chrome__toolbar">
          <input type="search" id="mod-search" class="wt-mods-search" value="${esc(state.modsSearch)}" placeholder="${esc(searchPlaceholder(view))}" aria-label="Search mods">
          <label class="wt-mods-toolbar__toggle" id="mods-tech-toggle-wrap"${showTech ? '' : ' hidden'}>
            <input type="checkbox" id="tech-names-toggle" ${state.showTechNames ? 'checked' : ''}>
            <span>Technical names</span>
          </label>
        </div>
      </div>`;
  }

  function worryChipCls(cls) {
    if (cls === 'mod-worry-critical') return 'wt-mod-chip--error';
    if (cls === 'mod-worry-action') return 'wt-mod-chip--warning';
    if (cls === 'mod-worry-monitor') return 'wt-mod-chip--info';
    return 'wt-mod-chip--muted';
  }

  function modManifestMeta(modId, ctx) {
    const m = (ctx?.mods ?? []).find((entry) => entry.id === modId);
    return {
      display_name: m?.display_name,
      version: m?.version,
    };
  }

  function modLogErrorCount(modId, ctx) {
    const err = (ctx?.modErrs ?? []).find((e) => e.mod_id === modId);
    return err?.total ?? null;
  }

  function modLogSamples(r, ctx) {
    const fromRec = r.sample_lines?.length
      ? r.sample_lines
      : (r.sample_line ? [r.sample_line] : []);
    if (fromRec.length) return fromRec;
    const err = (ctx?.modErrs ?? []).find((e) => e.mod_id === r.mod_id);
    if (!err) return [];
    if (err.sample_lines?.length) return err.sample_lines;
    if (err.sample_line) return [err.sample_line];
    return [];
  }

  function formatLogSnippet(samples, maxLines = 3, maxChars = 360) {
    return samples
      .slice(0, maxLines)
      .map((line) => String(line).slice(0, maxChars))
      .join('\n');
  }

  function buildFixSteps(r, fixSteps, fixText, startupFix) {
    const steps = [];
    const append = (s) => {
      const t = String(s || '').trim();
      if (t && !steps.includes(t)) steps.push(t);
    };
    if (fixText) append(fixText);
    const rest = startupFix ? fixSteps.slice(1) : fixSteps;
    rest.forEach(append);
    if (!steps.length && fixSteps.length) fixSteps.forEach(append);
    return steps;
  }

  function renderModIssueCard(r, ctx) {
    const worry = Labels.modWorryBadge(r);
    const sev = r.severity || 'warning';
    const meta = modManifestMeta(r.mod_id, ctx);
    const modName = r.display_name || meta.display_name || Labels.modFriendlyName(r.mod_id);
    const version = meta.version ? `v${meta.version}` : '';
    const why = r.why || r.explanation || '';
    const logCount = modLogErrorCount(r.mod_id, ctx) ?? r.count ?? null;
    const fixSteps = r.fix_steps?.length
      ? r.fix_steps
      : Labels.modDrFixSteps(r.mod_id, r.category);
    const startupFix = fixSteps.length && (r.category === 'mod_corrupt' || r.category === 'mod_load_failed');
    const fixText = startupFix ? fixSteps[0] : (r.fix || '');
    const allFixSteps = buildFixSteps(r, fixSteps, fixText, startupFix);
    if (!allFixSteps.length && r.install_hint) allFixSteps.push(r.install_hint);
    const fixLead = r.action_detail && !allFixSteps.includes(r.action_detail) && r.action_detail !== why
      ? r.action_detail
      : '';
    const samples = modLogSamples(r, ctx);
    const snippetText = samples.length ? formatLogSnippet(samples) : '';
    const issueLabel = r.category ? Labels.modCategoryLabel(r.category) : 'Mod issue';

    const whyBody = [
      why ? `<p>${esc(why)}</p>` : '',
      r.should_worry ? `<p class="wt-mod-issue-card__why-extra">${esc(r.should_worry)}</p>` : '',
      logCount ? `<p class="wt-mod-issue-card__why-extra">${logCount} error${logCount === 1 ? '' : 's'} in logs</p>` : '',
    ].filter(Boolean).join('');

    const stepsHtml = allFixSteps.length
      ? `<ol class="wt-mod-issue-card__steps">
          ${allFixSteps.map((s, i) => `
            <li class="wt-mod-issue-card__step">
              <span class="wt-mod-issue-card__step-num" aria-hidden="true">${i + 1}</span>
              <span class="wt-mod-issue-card__step-text">${esc(s)}</span>
            </li>`).join('')}
        </ol>`
      : '';

    const logSection = snippetText
      ? `<section class="issue-section wt-mod-issue-card__log-section">
          <div class="wt-mod-issue-card__log-head">
            <span class="issue-section-label">Log snippet</span>
            <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm copy-hint" data-copy="${escAttr(snippetText)}">Copy</button>
          </div>
          <pre class="wt-mod-issue-card__sample mono-cell">${esc(snippetText)}</pre>
          ${samples.length > 3 ? `<p class="wt-mod-issue-card__log-more">${samples.length - 3} more line${samples.length - 3 === 1 ? '' : 's'} in logs</p>` : ''}
        </section>`
      : '';

    const copyText = allFixSteps.join('\n');
    const fixSection = stepsHtml || fixLead
      ? `<section class="issue-section wt-mod-issue-card__fix-section">
          <div class="wt-mod-issue-card__fix-head">
            <span class="issue-section-label">How to fix</span>
            ${copyText ? `<button type="button" class="wt-btn wt-btn--ghost wt-btn--sm copy-hint" data-copy="${escAttr(copyText)}">Copy all steps</button>` : ''}
          </div>
          ${stepsHtml}
          ${fixLead ? `<p class="wt-mod-issue-card__fix-note">${esc(fixLead)}</p>` : ''}
        </section>`
      : '';


    return `
      <article class="wt-mod-issue-card wt-card--interactive wt-scroll-reveal" id="mod-problem-${escAttr(r.mod_id)}" data-mod-id="${escAttr(r.mod_id)}">
        <span class="wt-mod-issue-card__accent ${severityAccent(sev)}" aria-hidden="true"></span>
        <header class="wt-mod-issue-card__banner">
          <h3 class="wt-mod-issue-card__issue">${esc(issueLabel)}</h3>
          <span class="wt-mod-chip ${worryChipCls(worry.cls)}">${esc(worry.text)}</span>
        </header>
        <div class="wt-mod-issue-card__sections">
          <section class="issue-section">
            <span class="issue-section-label">Mod</span>
            <p class="wt-mod-issue-card__mod-line">
              <strong class="wt-mod-issue-card__mod-name">${esc(modName)}</strong>
              <span class="wt-mod-issue-card__mod-sep" aria-hidden="true">·</span>
              <code class="mono-cell">${esc(r.mod_id)}</code>
              ${version ? `<span class="wt-mod-issue-card__mod-sep" aria-hidden="true">·</span><span class="mono-cell wt-mod-issue-card__mod-version">${esc(version)}</span>` : ''}
            </p>
          </section>
          ${whyBody ? `<section class="issue-section">
            <span class="issue-section-label">Why this is happening</span>
            ${whyBody}
          </section>` : ''}
          ${logSection}
          ${fixSection}
        </div>
      </article>`;
  }

  function clientModVerdictCls(bucket) {
    if (bucket === 'likely_removable') return 'wt-status-pill--healthy';
    if (bucket === 'test_remove') return 'wt-status-pill--warn';
    if (bucket === 'client_library') return 'wt-status-pill--warn';
    return '';
  }

  function renderModClientCard(m, ignores, q) {
    if (q && !matchesSearch(m.mod_id, m.display_name, q)) return '';
    const name = m.display_name || Labels.modFriendlyName(m.mod_id);
    const reason = m.reason || Labels.clientModReason(m.mod_id, m.reason);
    const verdict = Labels.clientModVerdict(m.bucket);
    const ignored = ClientModIgnores.isIgnored(ignores, m.mod_id);
    const conf = m.confidence && m.confidence !== 'medium'
      ? `<span class="wt-status-pill wt-mod-client-card__conf">${esc(Labels.clientModConfidenceLabel(m.confidence))}</span>`
      : '';
    const version = m.version ? `<span class="wt-mod-client-card__version mono-cell">${esc(m.version)}</span>` : '';
    const advice = m.removal_advice ? `<p class="wt-mod-client-card__advice">${esc(m.removal_advice)}</p>` : '';
    const deps = (m.dependents ?? []).length
      ? `<p class="wt-mod-client-card__deps text-caption">Required by: ${esc(m.dependents.join(', '))}</p>`
      : '';
    const signals = (m.signals ?? []).join(', ');
    const ignoreBtn = ignored
      ? `<button type="button" class="wt-btn wt-btn--ghost wt-btn--sm client-mod-ignore-btn" data-client-mod-ignore="${escAttr(m.mod_id)}" data-ignored="true">Stop ignoring</button>`
      : `<button type="button" class="wt-btn wt-btn--ghost wt-btn--sm client-mod-ignore-btn" data-client-mod-ignore="${escAttr(m.mod_id)}" data-ignored="false">Keep on server</button>`;

    return `
      <article class="wt-mod-client-card wt-scroll-reveal${ignored ? ' wt-mod-client-card--ignored' : ''}" data-mod-id="${escAttr(m.mod_id)}">
        <header class="wt-mod-client-card__header">
          <div class="wt-mod-client-card__ident">
            <h3 class="wt-mod-client-card__name">${esc(name)}</h3>
            ${version}
          </div>
          <div class="wt-mod-client-card__pills">
            <span class="wt-status-pill ${clientModVerdictCls(m.bucket)}">${esc(verdict)}</span>${conf}
          </div>
          <div class="wt-mod-client-card__action">${ignoreBtn}</div>
        </header>
        <p class="wt-mod-client-card__reason">${esc(reason)}</p>
        ${advice}
        ${deps}
        <footer class="wt-mod-client-card__foot">
          <code class="mono-cell">${esc(m.mod_id)}</code>
          ${signals ? `<span class="text-caption">${esc(signals)}</span>` : ''}
        </footer>
      </article>`;
  }

  function groupClientModsByBucket(mods) {
    const groups = new Map(CLIENT_MOD_BUCKET_ORDER.map((b) => [b, []]));
    mods.forEach((m) => {
      const bucket = m.bucket || 'uncertain';
      if (!groups.has(bucket)) groups.set(bucket, []);
      groups.get(bucket).push(m);
    });
    return groups;
  }

  function renderModsPageIntro(text) {
    if (!text) return '';
    return `<p class="wt-mods-page__intro">${esc(text)}</p>`;
  }

  function renderModsEmpty(message) {
    return `<div class="wt-mods-page__empty"><p class="wt-empty">${esc(message)}</p></div>`;
  }

  function renderModsConflictsPage(f, ctx) {
    const cards = ctx.conflictRecs.map((r) => renderModIssueCard(r, ctx)).join('');
    const body = cards || renderModsEmpty(ctx.q ? 'No update conflicts match your search.' : 'No update conflicts in this report — pack versions look aligned.');
    return `
      ${renderModsPageIntro('Version mismatches and missing registry entries after a pack update. Fix or remove the listed mods before players join with stale world data.')}
      <div class="wt-mods-page__stack">${body}</div>`;
  }

  function renderModsClientPage(f, ctx) {
    const opt = f?.optional || {};
    const ignores = ctx.ignores;
    const summary = ctx.clientSummary;
    const clientErr = (opt.mod_log_errors ?? []).find((e) => e.mod_id === 'client_noise');
    const warningCount = clientErr?.total ?? summary?.client_warning_count ?? 0;
    const keptCount = ClientModIgnores.ignoredMods(f, ignores).length;

    const unignored = ClientModIgnores.unignoredMods(f, ignores);
    const groups = groupClientModsByBucket(unignored);
    const bucketSections = CLIENT_MOD_BUCKET_ORDER.map((bucket) => {
      const items = (groups.get(bucket) ?? [])
        .map((m) => renderModClientCard(m, ignores, ctx.q))
        .filter(Boolean);
      if (!items.length) return '';
      const accent = bucket.replace(/_/g, '-');
      return `
        <section class="wt-mods-client-page__group wt-mods-client-page__group--${accent}">
          <h3 class="wt-mods-client-page__group-title">${esc(Labels.bucketTitle(bucket))}<span class="wt-mods-client-page__group-count">${items.length}</span></h3>
          <div class="wt-mods-client-page__cards">${items.join('')}</div>
        </section>`;
    }).filter(Boolean).join('');

    const ignoredMods = ClientModIgnores.ignoredMods(f, ignores);
    const ignoredCards = ignoredMods.map((m) => renderModClientCard(m, ignores, ctx.q)).filter(Boolean);
    const ignoredSection = ignoredCards.length
      ? `<section class="wt-mods-client-page__group wt-mods-client-page__group--kept">
          <h3 class="wt-mods-client-page__group-title">Kept on server<span class="wt-mods-client-page__group-count">${ignoredCards.length}</span></h3>
          <div class="wt-mods-client-page__cards">${ignoredCards.join('')}</div>
        </section>`
      : '';

    const hasContent = bucketSections || ignoredSection;
    const body = hasContent
      ? `${bucketSections}${ignoredSection}`
      : renderModsEmpty(ctx.q ? 'No client-only mods match your search.' : 'No client-only mods flagged on this server.');

    const intro = `${Labels.clientModIntro(summary, warningCount)} Use Keep on server when you intentionally run a client mod on the dedicated host.${keptCount ? ` ${keptCount} mod${keptCount === 1 ? '' : 's'} currently ignored.` : ''}`;

    return `
      ${renderModsPageIntro(intro)}
      <div class="wt-mods-client-page">${body}</div>`;
  }

  function renderModsErrorsPage(f, ctx) {
    const cards = ctx.otherRecs.map((r) => renderModIssueCard(r, ctx)).join('');
    const manifest = renderManifestSection(ctx, ctx.modErrs, ctx.allRecs, ctx.clientModIds);
    const problems = cards ? `<div class="wt-mods-page__stack">${cards}</div>` : '';
    const emptyOther = !cards && !ctx.q
      ? renderModsEmpty(ctx.modErrs.length
        ? 'No other mod problems beyond update conflicts and client-only noise.'
        : (hasOpsModScanData()
          ? 'No mod log errors in scanned window.'
          : 'No other mod problems beyond update conflicts and client-only noise.'))
      : (!cards && ctx.q ? renderModsEmpty('No log errors match your search.') : '');
    const badge = renderSourceBadge(ctx.scanSource);

    return `
      ${renderModsPageIntro('Mods with errors attributed from server logs. Cross-check the manifest below for counts and samples.')}
      ${badge ? `<p class="wt-mods-page__source">${badge}</p>` : ''}
      ${problems || emptyOther}
      ${manifest}`;
  }

  function renderModsOverviewPage(f, ctx) {
    const otherCards = ctx.otherRecs.length
      ? `<section class="wt-card wt-card--surface wt-mods-overview__problems">
          <header class="wt-card__head">
            <h3 class="wt-card__title"><i data-lucide="alert-circle" width="16" height="16"></i> Other problems</h3>
            <span class="wt-mods-tier__count">${ctx.otherRecs.length}</span>
          </header>
          <div class="wt-mods-page__stack">${ctx.otherRecs.slice(0, 3).map((r) => renderModIssueCard(r, ctx)).join('')}</div>
          ${ctx.otherRecs.length > 3 ? `<footer class="wt-mods-overview__more"><button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" data-mod-view="errors">View all ${ctx.otherRecs.length} on Log errors</button></footer>` : ''}
        </section>`
      : '';

    return `
      ${renderModsPageIntro('Full mod list from the latest report.')}
      ${otherCards}
      ${renderManifestSection(ctx, ctx.modErrs, ctx.allRecs, ctx.clientModIds)}`;
  }

  function modErrorRowForManifest(modId, modErrs, recs) {
    const err = modErrs.find((e) => e.mod_id === modId);
    const rec = recs.find((r) => r.mod_id === modId);
    if (!err && !rec) return '<td class="wt-mod-manifest__errors"><span class="wt-mod-manifest__none">—</span></td>';
    const cats = err?.by_category || rec?.by_category || {};
    const chips = Object.entries(cats).map(([cat, count]) => {
      const chipCls = cat === 'mod_corrupt' || cat === 'mod_load_failed' ? 'wt-mod-chip--error' : 'wt-mod-chip--warning';
      return `<span class="wt-mod-chip ${chipCls}">${esc(Labels.modCategoryLabel(cat))} ×${count}</span>`;
    }).join('');
    const total = err?.total ?? rec?.count ?? '';
    const sample = (err?.sample_lines || rec?.sample_lines || [])[0] || err?.sample_line || rec?.sample_line || '';
    const tip = [total ? `${total} error${total === 1 ? '' : 's'}` : '', sample ? String(sample) : ''].filter(Boolean).join(' — ');
    return `<td class="wt-mod-manifest__errors"${tip ? ` title="${escAttr(tip)}"` : ''}>
      <div class="wt-mod-manifest__err-cell">${chips || '<span class="wt-mod-chip wt-mod-chip--warning">Error</span>'}</div>
    </td>`;
  }

  function renderManifestSection(ctx, modErrs, recs, clientModIds) {
    const { filteredMods, mods, errorModIds, changedModIds, inventoryDiff } = ctx;
    const totalPages = Math.max(1, Math.ceil(filteredMods.length / state.modsPerPage));
    const page = Math.min(state.modsPage, totalPages - 1);
    const slice = filteredMods.slice(page * state.modsPerPage, (page + 1) * state.modsPerPage);
    const showTech = state.showTechNames;
    const perPage = state.modsPerPage;
    const rangeStart = filteredMods.length ? page * perPage + 1 : 0;
    const rangeEnd = page * perPage + slice.length;
    const metaLine = filteredMods.length === 0
      ? (mods.length ? 'No mods match the current search' : 'Run a report for the full mod scan')
      : (totalPages > 1
        ? `Showing ${rangeStart}–${rangeEnd} of ${filteredMods.length}`
        : `${filteredMods.length} mod${filteredMods.length === 1 ? '' : 's'}`);

    const manifestRows = slice.length
      ? slice.map((m) => {
        const label = showTech ? m.id : (m.display_name || Labels.modFriendlyName(m.id));
        const rowCls = errorModIds.has(m.id) ? 'wt-mod-manifest__row--error' : '';
        const change = changedModIds.has(m.id) ? (inventoryDiff?.added?.find?.((r) => r.mod_id === m.id) ? 'added'
          : inventoryDiff?.removed?.find?.((r) => r.mod_id === m.id) ? 'removed' : 'changed') : null;
        const changeChip = change
          ? `<span class="wt-mod-chip wt-mod-chip--${change === 'added' ? 'info' : change === 'removed' ? 'muted' : 'warning'}">${esc(change)}</span>`
          : '';
        return `<tr class="wt-mod-manifest__row ${rowCls}" data-mod-id="${escAttr(m.id)}">
          <td class="wt-mod-manifest__name">
            <span class="wt-mod-manifest__name-inner">
              <span class="wt-mod-manifest__label">${esc(label)}</span>
              ${changeChip}
              ${clientModIds.has(m.id) ? '<span class="wt-mod-chip wt-mod-chip--client">Client</span>' : ''}
            </span>
          </td>
          <td class="wt-mod-manifest__version mono-cell">${esc(m.version) || '—'}</td>
          ${modErrorRowForManifest(m.id, modErrs, recs)}
        </tr>`;
      }).join('')
      : `<tr><td colspan="3" class="wt-mod-manifest__empty">${mods.length === 0 ? 'Run report for full mod scan' : 'No mods match this search'}</td></tr>`;

    const pager = totalPages > 1
      ? `<nav class="wt-mod-manifest__pager" aria-label="Manifest pages">
          <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="mod-prev" ${page <= 0 ? 'disabled' : ''}>Prev</button>
          <span class="wt-mod-manifest__page">${page + 1} / ${totalPages}</span>
          <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="mod-next" ${page >= totalPages - 1 ? 'disabled' : ''}>Next</button>
        </nav>`
      : '';

    return `
      <section class="wt-card wt-card--surface wt-mod-manifest">
        <header class="wt-mod-manifest__head">
          <div class="wt-mod-manifest__head-main">
            <h3 class="wt-card__title"><i data-lucide="list" width="16" height="16"></i> Mod manifest ${renderSourceBadge(ctx.manifestSource === 'live' ? 'live' : (ctx.mods.length ? 'report' : null))}</h3>
            <p class="wt-mod-manifest__meta">${esc(metaLine)}</p>
          </div>
          ${pager}
        </header>
        <div class="wt-table-wrap wt-mod-manifest__table-wrap">
          <table class="wt-table wt-table--compact wt-mod-manifest__table">
            <thead>
              <tr>
                <th scope="col">Mod</th>
                <th scope="col">Version</th>
                <th scope="col">Log errors</th>
              </tr>
            </thead>
            <tbody>${manifestRows}</tbody>
          </table>
        </div>
      </section>`;
  }

  function renderModsPageBody(f, ctx) {
    if (ctx.view === 'conflicts') return renderModsConflictsPage(f, ctx);
    if (ctx.view === 'client') return renderModsClientPage(f, ctx);
    if (ctx.view === 'errors') return renderModsErrorsPage(f, ctx);
    return renderModsOverviewPage(f, ctx);
  }

  function renderMods() {
    const f = state.activeFacts;
    const ctx = computeModsContext(f);
    const counts = {
      conflicts: ctx.conflictRecsAll.length,
      client: ctx.clientToReview || ctx.clientMods.length,
      errors: ctx.errorModIds.size,
    };
    const scanBanner = '';
    const noDataBanner = !ctx.mods.length && !hasOpsModScanData() && state.noReportYet
      ? `<div class="wt-banner wt-banner--warn wt-bento__span-12"><p>No mod data yet. Run <code>/watchtower run</code> or wait for the background log watcher.</p></div>`
      : '';

    return `
      <div class="wt-tab-mods">
        <div class="wt-bento wt-stagger" id="mods-bento">
          ${typeof TowerTabChrome !== 'undefined' ? TowerTabChrome.tabHero('mods') : ''}
          ${scanBanner}
          ${noDataBanner}
          <div class="wt-bento__span-12" id="mods-status-bar-wrap">${renderModsStatusBar(ctx)}</div>
          <div id="mods-chrome" class="wt-bento__span-12">${renderModsChrome(f, ctx, counts)}</div>
          <div id="mods-page-body" class="wt-bento__span-12">${renderModsPageBody(f, ctx)}</div>
        </div>
      </div>`;
  }

  return {
    renderMods,
    renderModsPageBody,
    renderModsChrome,
    renderModsStatusBar,
    modsCountLabel,
    searchPlaceholder,
    renderModIssueCard,
    renderModClientCard,
    renderClientModRow: renderModClientCard,
    renderClientModsSection: renderModsClientPage,
    computeModsContext,
    computeModsBase,
    resolveModViewForId(base, modId) {
      if (base.clientModIds.has(modId)) return 'client';
      if (base.conflictIds.has(modId)) return 'conflicts';
      if (base.errorModIds.has(modId)) return 'errors';
      return 'overview';
    },
  };
})();
