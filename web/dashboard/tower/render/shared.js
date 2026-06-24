/**
 * Watchtower UI v3 — shared tab renderers
 */
const TowerRenderShared = (function () {
  function sparklineCard(cardId, label, valueHtml, canvasId, subHtml) {
    return `
      <div class="wt-signal" id="${cardId}">
        <span class="wt-signal__question">${label}</span>
        <div class="wt-signal__value" id="${cardId}-val">${valueHtml}</div>
        <div class="wt-signal__chart">
          <div class="wt-chart-wrap"><canvas id="${canvasId}"></canvas></div>
        </div>
        <div class="wt-signal__readout" id="${canvasId}-readout" aria-live="polite">Hover chart for history</div>
        ${subHtml ? `<p class="wt-signal__caption" id="${cardId}-sub">${subHtml}</p>` : ''}
      </div>`;
  }

  function progressFillMod(pct) {
    const rounded = Math.min(100, Math.max(0, Math.round(pct ?? 0)));
    if (rounded >= 85) return 'danger';
    if (rounded >= 70) return 'warn';
    return 'on';
  }

  function renderProgressBar(pct, barId) {
    const mod = progressFillMod(pct);
    const rounded = Math.min(100, Math.max(0, Math.round(pct ?? 0)));
    return `
      <div class="wt-progress-bar" id="${barId}" style="--progress: ${pct ?? 0}" role="presentation">
        <div class="wt-progress-bar__fill wt-progress-bar__fill--${mod} wt-pattern-hatch"></div>
      </div>
      <span class="wt-visually-hidden">${rounded}%</span>`;
  }

  function kpiDeltaFromTps(tps) {
    const n = Number(tps);
    if (n >= 19.5) return '<span class="wt-kpi-delta wt-kpi-delta--up">Stable</span>';
    if (n >= 15) return '<span class="wt-kpi-delta wt-kpi-delta--down">Slow</span>';
    return '<span class="wt-kpi-delta wt-kpi-delta--down">Critical</span>';
  }

  function kpiSparkCard(cardId, label, valueHtml, canvasId, footHtml, deltaHtml, span) {
    const spanCls = span || 'wt-bento__span-6';
    const foot = (footHtml || deltaHtml) ? `
        <div class="wt-kpi__foot">
          ${footHtml ? `<span class="wt-kpi__foot-text" id="${cardId}-sub">${footHtml}</span>` : '<span class="wt-kpi__foot-text"></span>'}
          ${deltaHtml || ''}
        </div>` : '';
    return `
      <div class="wt-card wt-card--surface wt-kpi-spark wt-kpi-spark--stacked wt-live-metric ${spanCls}" id="${cardId}">
        <div class="wt-kpi wt-live-metric__body">
          <div class="wt-kpi__head">
            <span class="wt-kpi__label">${label}</span>
          </div>
          <div class="wt-kpi__value" id="${cardId}-val">${valueHtml}</div>
          ${foot}
        </div>
        <div class="wt-live-metric__chart-slot">
          <div class="wt-kpi-spark__chart">
            <div class="wt-chart-wrap"><canvas id="${canvasId}"></canvas></div>
          </div>
          <div class="wt-signal__readout" id="${canvasId}-readout" aria-live="polite">Hover chart for history</div>
        </div>
      </div>`;
  }

  function kpiDiskCard(cardId, label, valueHtml, pct, barId, pctLabelId, footHtml, span) {
    const spanCls = span || 'wt-bento__span-6';
    const diskRounded = Math.min(100, Math.max(0, Math.round(pct ?? 0)));
    const foot = footHtml ? `<div class="wt-kpi__foot"><span class="wt-kpi__foot-text" id="${cardId}-sub">${footHtml}</span></div>` : '';
    return `
      <div class="wt-card wt-card--surface wt-kpi-disk wt-live-metric ${spanCls}" id="${cardId}">
        <div class="wt-kpi wt-live-metric__body">
          <div class="wt-kpi__head">
            <span class="wt-kpi__label">${label}</span>
          </div>
          <div class="wt-kpi__value" id="${cardId}-val">${valueHtml}</div>
          <div class="wt-live-disk-bar">
            <div class="wt-live-disk-bar__head"><span>Disk usage</span><span id="${pctLabelId}">${diskRounded}%</span></div>
            ${renderProgressBar(pct, barId)}
          </div>
          ${foot}
        </div>
        <div class="wt-live-metric__chart-slot" aria-hidden="true">
          <div class="wt-kpi-spark__chart wt-kpi-spark__chart--empty"></div>
          <div class="wt-signal__readout wt-signal__readout--empty">&nbsp;</div>
        </div>
      </div>`;
  }

  function kpiDiskSparkCard(cardId, label, valueHtml, pct, barId, pctLabelId, canvasId, footHtml, span) {
    const spanCls = span || 'wt-bento__span-6';
    const diskRounded = Math.min(100, Math.max(0, Math.round(pct ?? 0)));
    const foot = footHtml ? `<div class="wt-kpi__foot"><span class="wt-kpi__foot-text" id="${cardId}-sub">${footHtml}</span></div>` : '';
    return `
      <div class="wt-card wt-card--surface wt-kpi-spark wt-kpi-spark--stacked wt-live-metric ${spanCls}" id="${cardId}">
        <div class="wt-kpi wt-live-metric__body">
          <div class="wt-kpi__head">
            <span class="wt-kpi__label">${label}</span>
          </div>
          <div class="wt-kpi__value" id="${cardId}-val">${valueHtml}</div>
          <div class="wt-live-disk-bar">
            <div class="wt-live-disk-bar__head"><span>Disk usage</span><span id="${pctLabelId}">${diskRounded}%</span></div>
            ${renderProgressBar(pct, barId)}
          </div>
          ${foot}
        </div>
        <div class="wt-kpi-spark__chart">
          <div class="wt-chart-wrap"><canvas id="${canvasId}"></canvas></div>
        </div>
        <div class="wt-signal__readout" id="${canvasId}-readout" aria-live="polite">Hover chart for history</div>
      </div>`;
  }

  function metricHint(id, text) {
    if (!text) return '';
    const tipId = `${id}-hint-tip`;
    return `<button type="button" class="wt-metric-hint" id="${id}-hint" aria-describedby="${tipId}" aria-label="About this metric">
      <span class="wt-metric-hint__glyph" aria-hidden="true">?</span>
      <span class="wt-metric-hint__tip" id="${tipId}" role="tooltip">${esc(text)}</span>
    </button>`;
  }

  function kpiCard(cardId, label, valueHtml, footHtml, deltaHtml, span, hint) {
    const spanCls = span || 'wt-bento__span-3';
    const hintCls = hint ? ' wt-card--has-hint' : '';
    const foot = (footHtml || deltaHtml) ? `
        <div class="wt-kpi__foot">
          ${footHtml ? `<span class="wt-kpi__foot-text" id="${cardId}-sub">${footHtml}</span>` : '<span class="wt-kpi__foot-text"></span>'}
          ${deltaHtml || ''}
        </div>` : '';
    return `
      <div class="wt-card wt-card--surface${hintCls} ${spanCls}" id="${cardId}">
        ${hint ? metricHint(cardId, hint) : ''}
        <div class="wt-kpi">
          <div class="wt-kpi__head">
            <span class="wt-kpi__label">${label}</span>
          </div>
          <div class="wt-kpi__value" id="${cardId}-val">${valueHtml}</div>
          ${foot}
        </div>
      </div>`;
  }

  function kpiDualCard(cardId, label, leftLabel, leftHtml, rightLabel, rightHtml, footHtml, span) {
    const spanCls = span || 'wt-bento__span-3';
    const foot = footHtml ? `<div class="wt-kpi__foot"><span class="wt-kpi__foot-text" id="${cardId}-sub">${footHtml}</span></div>` : '';
    return `
      <div class="wt-card wt-card--surface wt-kpi--dual wt-kpi--heap ${spanCls}" id="${cardId}">
        <div class="wt-kpi">
          <div class="wt-kpi__head">
            <span class="wt-kpi__label">${label}</span>
          </div>
          <div class="wt-kpi__dual">
            <div>
              <span class="wt-kpi__dual-label">${leftLabel}</span>
              <div class="wt-kpi__value wt-kpi__value--compact" id="${cardId}-used-val">${leftHtml}</div>
            </div>
            <div>
              <span class="wt-kpi__dual-label">${rightLabel}</span>
              <div class="wt-kpi__value wt-kpi__value--compact" id="${cardId}-free-val">${rightHtml}</div>
            </div>
          </div>
          ${foot}
        </div>
      </div>`;
  }

  function kpiDualSparkCard(cardId, label, leftLabel, leftHtml, rightLabel, rightHtml, canvasId, footHtml, span) {
    const spanCls = span || 'wt-bento__span-6';
    const foot = footHtml ? `
        <div class="wt-kpi__foot">
          <span class="wt-kpi__foot-text" id="${cardId}-sub">${footHtml}</span>
        </div>` : '';
    return `
      <div class="wt-card wt-card--surface wt-kpi-spark wt-kpi-spark--stacked wt-kpi--dual wt-kpi--heap wt-live-metric ${spanCls}" id="${cardId}">
        <div class="wt-kpi wt-live-metric__body">
          <div class="wt-kpi__head">
            <span class="wt-kpi__label">${label}</span>
          </div>
          <div class="wt-kpi__dual">
            <div>
              <span class="wt-kpi__dual-label">${leftLabel}</span>
              <div class="wt-kpi__value wt-kpi__value--compact" id="${cardId}-used-val">${leftHtml}</div>
            </div>
            <div>
              <span class="wt-kpi__dual-label">${rightLabel}</span>
              <div class="wt-kpi__value wt-kpi__value--compact" id="${cardId}-free-val">${rightHtml}</div>
            </div>
          </div>
          ${foot}
        </div>
        <div class="wt-live-metric__chart-slot">
          <div class="wt-kpi-spark__chart">
            <div class="wt-chart-wrap"><canvas id="${canvasId}"></canvas></div>
          </div>
          <div class="wt-signal__readout" id="${canvasId}-readout" aria-live="polite">Hover chart for history</div>
        </div>
      </div>`;
  }

  function bentoMetricCard(cardId, label, valueHtml, subHtml, variant, span) {
    return kpiCard(cardId, label, valueHtml, subHtml, '', span);
  }

  function bentoDualMetricCard(cardId, label, leftLabel, leftHtml, rightLabel, rightHtml, subHtml, variant, span) {
    return kpiDualCard(cardId, label, leftLabel, leftHtml, rightLabel, rightHtml, subHtml, span);
  }

  function bentoChip(label, severity, tab) {
    const cls = severity === 'critical' ? 'critical' : severity === 'ok' ? 'ok' : 'warn';
    if (tab) {
      return `<a href="#" class="wt-chip wt-chip--${cls} tab-link" data-tab="${esc(tab)}">${label}</a>`;
    }
    return `<span class="wt-chip wt-chip--${cls}">${label}</span>`;
  }

  function vitalStatCard(cardId, label, valueHtml, subHtml) {
    return `
      <div class="wt-vital" id="${cardId}">
        <span class="wt-vital__label">${label}</span>
        <div class="wt-vital__value" id="${cardId}-val">${valueHtml}</div>
        ${subHtml ? `<p class="wt-vital__sub" id="${cardId}-sub">${subHtml}</p>` : ''}
      </div>`;
  }

  function vitalDualStatCard(cardId, label, leftLabel, leftHtml, rightLabel, rightHtml, subHtml) {
    return `
      <div class="wt-vital wt-vital--dual" id="${cardId}">
        <span class="wt-vital__label">${label}</span>
        <div class="wt-vital__dual">
          <div class="wt-vital__dual-item">
            <span class="wt-vital__dual-label">${leftLabel}</span>
            <div class="wt-vital__value" id="${cardId}-used-val">${leftHtml}</div>
          </div>
          <div class="wt-vital__dual-item">
            <span class="wt-vital__dual-label">${rightLabel}</span>
            <div class="wt-vital__value" id="${cardId}-free-val">${rightHtml}</div>
          </div>
        </div>
        ${subHtml ? `<p class="wt-vital__sub" id="${cardId}-sub">${subHtml}</p>` : ''}
      </div>`;
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso.slice(0, 19);
      return d.toLocaleString(undefined, {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  function fmtTimeShort(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso.slice(11, 16);
    }
  }

  function fmtRelative(iso) {
    if (!iso) return '';
    try {
      const timeMs = new Date(iso).getTime();
      if (Number.isNaN(timeMs)) return 'Unknown time';
      const diff = Date.now() - timeMs;
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 48) return `${hrs}h ago`;
      return `${Math.floor(hrs / 24)}d ago`;
    } catch {
      return '';
    }
  }

  function eventSeverityClass(type) {
    const t = type === 'crash' ? 'crash_report' : type === 'reboot' ? 'manual_reboot' : type;
    if (t === 'crash_report' || t === 'kernel_oom') return 'crash';
    if (t === 'manual_reboot') return 'system';
    if (t === 'server_start' || t === 'clean_stop' || t === 'player_join' || t === 'player_leave') return 'lifecycle';
    return 'task';
  }

  function statusPillMod(tone) {
    if (tone === 'green' || tone === 'healthy') return 'wt-status-pill--healthy';
    if (tone === 'yellow' || tone === 'warn') return 'wt-status-pill--warn';
    return 'wt-status-pill--critical';
  }

  function timelineItemMod(type) {
    const sev = eventSeverityClass(type);
    if (sev === 'crash') return 'wt-timeline-item--alert';
    if (sev === 'system') return 'wt-timeline-item--system';
    if (sev === 'lifecycle') return 'wt-timeline-item--success';
    return '';
  }

  function thermalDialHotMod(band) {
    return band === 'hot' ? ' wt-thermal-dial--hot' : '';
  }

  function diagIconMod(tone) {
    if (tone === 'critical') return ' wt-diag-item__icon--critical';
    if (tone === 'warn') return ' wt-diag-item__icon--warn';
    return '';
  }

  function fmtUptime(seconds) {
    if (seconds == null) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function uptimeParts(seconds) {
    if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
    const total = Math.floor(seconds);
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return { days, hours, minutes, seconds: secs };
  }

  function fmtUptimeClock(seconds) {
    const p = uptimeParts(seconds);
    if (!p) return '—';
    const parts = [];
    if (p.days > 0) parts.push(`${p.days}d`);
    if (p.days > 0 || p.hours > 0) parts.push(`${p.hours}h`);
    parts.push(`${p.minutes}m`);
    parts.push(`${String(p.seconds).padStart(2, '0')}s`);
    return parts.join(' ');
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s ?? '';
    return d.innerHTML;
  }

  function eventTimeMs(time) {
    if (!time) return 0;
    const normalized = String(time).replace(',', '.').replace(' ', 'T');
    const t = Date.parse(normalized);
    return Number.isFinite(t) ? t : 0;
  }

  function sortEventsNewestFirst(events) {
    return [...(events || [])].sort((a, b) => eventTimeMs(b.time) - eventTimeMs(a.time));
  }

  function truncateDetail(s, max = 80) {
    if (!s) return '';
    const str = String(s);
    return str.length > max ? `${str.slice(0, max - 1)}…` : str;
  }

  return { sparklineCard, vitalStatCard, vitalDualStatCard, kpiCard, kpiDualCard, kpiSparkCard, kpiDualSparkCard, kpiDiskCard, kpiDiskSparkCard, kpiDeltaFromTps, renderProgressBar, progressFillMod, bentoMetricCard, bentoDualMetricCard, bentoChip, metricHint, fmtTime, fmtTimeShort, fmtRelative, fmtUptime, fmtUptimeClock, uptimeParts, esc, eventSeverityClass, statusPillMod, timelineItemMod, thermalDialHotMod, diagIconMod, eventTimeMs, sortEventsNewestFirst, truncateDetail };
})();

/** Globals for tower/data.js, tower/shell.js, and other non-render modules */
function fmtTime(iso) { return TowerRenderShared.fmtTime(iso); }
function fmtTimeShort(iso) { return TowerRenderShared.fmtTimeShort(iso); }
function fmtRelative(iso) { return TowerRenderShared.fmtRelative(iso); }
function fmtUptime(seconds) { return TowerRenderShared.fmtUptime(seconds); }
function fmtUptimeClock(seconds) { return TowerRenderShared.fmtUptimeClock(seconds); }
function esc(s) { return TowerRenderShared.esc(s); }
