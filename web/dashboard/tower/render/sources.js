/**
 * Watchtower UI v3 — Data sources tab
 */
const TowerRenderSources = (function () {
  const esc = TowerRenderShared.esc;

  function fmtAbs(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return String(iso);
    }
  }

  function freshnessCard(id, opts) {
    const { kind, icon, label, value, hint, iso, muted, schedule } = opts;
    const title = iso ? fmtAbs(iso) : '';
    const tone = schedule || muted ? 'neutral' : (kind || 'neutral');
    const badge = kind && !schedule ? `<div class="wt-stat-card__badge">${TowerSourceBadge.badge(kind)}</div>` : '';
    const iconHtml = icon
      ? `<span class="wt-stat-card__icon wt-stat-card__icon--${kind || 'neutral'}" aria-hidden="true"><i data-lucide="${icon}" width="20" height="20"></i></span>`
      : '';
    return `
      <article class="wt-card wt-card--surface wt-stat-card wt-stat-card--${tone}" id="${id}">
        <div class="wt-stat-card__top">
          ${iconHtml}
          ${badge}
        </div>
        <span class="wt-stat-card__label">${esc(label)}</span>
        <span class="wt-stat-card__value" id="${id}-val"${title ? ` title="${esc(title)}"` : ''}>${esc(value)}</span>
        <span class="wt-stat-card__hint">${esc(hint)}</span>
      </article>`;
  }

  function freshnessRow() {
    const snap = TowerDataSources.snapshot();
    const live = TowerDataSources.fmtRelative(snap.liveAt) || '—';
    const scan = TowerDataSources.fmtRelative(snap.scanAt) || '—';
    const report = TowerDataSources.fmtRelative(snap.reportAt) || '—';
    const nextMin = snap.nextMin;
    const next = nextMin >= 0 ? (TowerDataSources.fmtNextMinutes(nextMin) || '—') : 'Off';
    const scanSec = snap.opsPollSec ?? 60;

    return `
      <div class="wt-stat-grid wt-bento__span-12">
        ${freshnessCard('sources-live-card', {
          kind: 'live',
          icon: 'activity',
          label: 'Live metrics',
          value: live,
          hint: 'Charts tick while dashboard is open',
          iso: snap.liveAt,
        })}
        ${freshnessCard('sources-scan-card', {
          kind: 'scanned',
          icon: 'scan-line',
          label: 'Ops scan',
          value: scan,
          hint: `Background every ~${scanSec}s · server always on`,
          iso: snap.scanAt,
        })}
        ${freshnessCard('sources-report-card', {
          kind: 'report',
          icon: 'file-stack',
          label: 'Full report',
          value: report,
          hint: 'Newest health report on disk',
          iso: snap.reportAt,
        })}
        ${freshnessCard('sources-next-card', {
          icon: 'calendar-clock',
          label: 'Next scheduled',
          value: next,
          hint: 'From report schedule in Settings',
          schedule: true,
          muted: true,
        })}
      </div>`;
  }

  function layerCards() {
    const layers = [
      {
        kind: 'live',
        icon: 'gauge',
        title: 'Live',
        body: 'TPS, MSPT, CPU, RAM charts, and online player counts. Updates every few seconds while you have the dashboard open.',
        config: 'config/watchtower-server.toml',
        configNote: 'live sample rate · restart required',
      },
      {
        kind: 'scanned',
        icon: 'radar',
        title: 'Scanned',
        body: 'Log tail, activity events, mod errors, and crash folder on the server — runs in the background even when nobody has the web UI open.',
        config: 'watchtower.conf',
        configNote: 'OPS_LOG_SCAN_SEC (default 60)',
      },
      {
        kind: 'report',
        icon: 'file-search',
        title: 'Report',
        body: 'Full audit snapshot: Issues queue, mod manifest, session peaks, and DR-quality evidence. Run on a schedule, not every visit.',
        config: 'Settings → Schedule',
        configNote: 'REPORT_RETENTION_COUNT / DAYS',
      },
    ];
    return layers.map((l) => `
      <article class="wt-card wt-card--surface wt-sources-layer wt-sources-layer--${l.kind} wt-bento__span-4 wt-scroll-reveal">
        <header class="wt-sources-layer__head">
          <span class="wt-sources-layer__icon"><i data-lucide="${l.icon}" width="20" height="20"></i></span>
          <div class="wt-sources-layer__titles">
            ${TowerSourceBadge.badge(l.kind)}
            <h3 class="wt-sources-layer__title">${esc(l.title)}</h3>
          </div>
        </header>
        <p class="wt-sources-layer__body">${esc(l.body)}</p>
        <footer class="wt-sources-layer__foot">
          <code class="wt-sources-layer__config">${esc(l.config)}</code>
          <span class="wt-sources-layer__config-note">${esc(l.configNote)}</span>
        </footer>
      </article>`).join('');
  }

  function matrixSection() {
    const copy = Labels.dataSourcesExplainer();
    const rows = (copy.rows || []).map((r, i) => `
      <tr class="wt-sources-matrix__row${i % 2 === 1 ? ' wt-sources-matrix__row--alt' : ''}">
        <th scope="row" class="wt-sources-matrix__area">${esc(r.area)}</th>
        <td class="wt-sources-matrix__cell">${matrixCell(r.live)}</td>
        <td class="wt-sources-matrix__cell">${matrixCell(r.scan)}</td>
        <td class="wt-sources-matrix__cell">${matrixCell(r.report)}</td>
      </tr>`).join('');
    return `
      <section class="wt-card wt-card--surface wt-bento__span-12 wt-sources-matrix wt-scroll-reveal" id="sources-matrix">
        <header class="wt-card__head wt-sources-matrix__head">
          <div>
            <h2 class="wt-card__title"><i data-lucide="table-2" width="18" height="18"></i> What updates how</h2>
            <p class="wt-card__lead wt-text-secondary wt-sources-matrix__intro">${copy.intro}</p>
          </div>
        </header>
        <div class="wt-table-wrap wt-sources-matrix__wrap">
          <table class="wt-table wt-sources-matrix__table">
            <thead>
              <tr>
                <th scope="col" class="wt-sources-matrix__area-head">Dashboard area</th>
                <th scope="col" class="wt-sources-matrix__col-head wt-sources-matrix__col-head--live">${TowerSourceBadge.badge('live')}</th>
                <th scope="col" class="wt-sources-matrix__col-head wt-sources-matrix__col-head--scanned">${TowerSourceBadge.badge('scanned')}</th>
                <th scope="col" class="wt-sources-matrix__col-head wt-sources-matrix__col-head--report">${TowerSourceBadge.badge('report')}</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <p class="wt-text-caption wt-text-tertiary wt-sources-matrix__footer">${copy.footer || ''}</p>
      </section>`;
  }

  function matrixCell(on) {
    if (on) {
      return '<span class="wt-sources-matrix__pill wt-sources-matrix__pill--yes" aria-label="Yes"><i data-lucide="check" width="14" height="14"></i></span>';
    }
    return '<span class="wt-sources-matrix__pill wt-sources-matrix__pill--no" aria-hidden="true">—</span>';
  }

  function sectionHead(icon, title, sub) {
    if (typeof TowerTabChrome !== 'undefined') {
      return TowerTabChrome.sectionHead({ icon, title, sub });
    }
    return `
      <header class="wt-tab-section wt-bento__span-12">
        <h2 class="wt-tab-section__title">
          <i data-lucide="${icon}" width="18" height="18"></i>
          ${esc(title)}
        </h2>
        ${sub ? `<p class="wt-tab-section__sub">${esc(sub)}</p>` : ''}
      </header>`;
  }

  function renderSources() {
    const hero = typeof TowerTabChrome !== 'undefined'
      ? TowerTabChrome.tabHero('sources')
      : '';
    return `
      <div class="wt-tab-sources wt-enter">
        <div class="wt-bento wt-stagger">
          ${hero}

          ${sectionHead('clock', 'Freshness', 'When each layer last updated on this server')}
          ${freshnessRow()}

          ${sectionHead('layers', 'Three update layers', 'What each layer collects and where to configure it')}
          ${layerCards()}

          ${matrixSection()}

          ${typeof TowerTabChrome !== 'undefined'
    ? TowerTabChrome.tabActions({
      text: 'Tune poll intervals, schedule, and retention in Settings.',
      buttons: `<button type="button" class="wt-btn wt-btn--primary wt-btn--sm" id="sources-open-monitoring">
                <i data-lucide="gauge" width="14" height="14"></i> Open Monitoring settings
              </button>
              <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="sources-open-wiki">
                <i data-lucide="book-open" width="14" height="14"></i> Documentation
              </button>`,
    })
    : `<footer class="wt-card wt-card--surface wt-tab-actions wt-bento__span-12">
            <p class="wt-tab-actions__text">Tune poll intervals, schedule, and retention in Settings.</p>
            <div class="wt-tab-actions__buttons">
              <button type="button" class="wt-btn wt-btn--primary wt-btn--sm" id="sources-open-monitoring">
                <i data-lucide="gauge" width="14" height="14"></i> Open Monitoring settings
              </button>
              <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="sources-open-wiki">
                <i data-lucide="book-open" width="14" height="14"></i> Documentation
              </button>
            </div>
          </footer>`}
        </div>
      </div>`;
  }

  function applySourcesUpdate() {
    if (!document.querySelector('.wt-tab-sources')) return;
    const snap = TowerDataSources.snapshot();
    const set = (id, text, iso) => {
      const el = document.getElementById(`${id}-val`);
      if (!el) return;
      el.textContent = text;
      if (iso) el.title = fmtAbs(iso);
      else el.removeAttribute('title');
    };
    set('sources-live-card', TowerDataSources.fmtRelative(snap.liveAt) || '—', snap.liveAt);
    set('sources-scan-card', TowerDataSources.fmtRelative(snap.scanAt) || '—', snap.scanAt);
    set('sources-report-card', TowerDataSources.fmtRelative(snap.reportAt) || '—', snap.reportAt);
    const nextMin = snap.nextMin;
    set('sources-next-card', nextMin >= 0 ? (TowerDataSources.fmtNextMinutes(nextMin) || '—') : 'Off', null);
    const hint = document.querySelector('#sources-scan-card .wt-stat-card__hint');
    if (hint) hint.textContent = `Background every ~${snap.opsPollSec ?? 60}s · server always on`;
  }

  function bindSourcesEvents() {
    document.getElementById('sources-open-monitoring')?.addEventListener('click', () => {
      if (typeof TowerViews !== 'undefined') TowerViews.openSettings('monitoring');
    });
    document.getElementById('sources-open-wiki')?.addEventListener('click', () => {
      window.openWiki?.('Understanding-Data-Sources');
    });
  }

  return { renderSources, applySourcesUpdate, bindSourcesEvents };
})();
