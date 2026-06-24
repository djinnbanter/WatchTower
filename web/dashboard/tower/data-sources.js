/**
 * Data source timestamps and footer helpers (1.0.0)
 */
const TowerDataSources = (function () {
  function fmtRelative(iso) {
    if (!iso) return null;
    if (typeof TowerRenderShared !== 'undefined' && TowerRenderShared.fmtRelative) {
      return TowerRenderShared.fmtRelative(iso);
    }
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return null;
    const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 48) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  }

  function fmtNextMinutes(min) {
    const n = Number(min);
    if (!Number.isFinite(n) || n < 0) return null;
    if (n < 60) return `${n}m`;
    const h = Math.floor(n / 60);
    const m = n % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  function snapshot() {
    const liveAt = state.liveLatest?.time || state.dataSources?.live_at || null;
    const scanAt = state.dataSources?.ops_scan_at
      || state.overviewMeta?.ops_cache_updated_at
      || state.opsCache?.updated_at
      || null;
    const reportAt = state.dataSources?.full_report_at
      || state.overviewMeta?.last_report_at
      || state.activeFacts?.meta?.generated
      || null;
    const nextMin = state.dataSources?.next_scheduled_minutes ?? state.dashboardSettings?.next_report_in_minutes;
    const opsPollSec = state.dataSources?.ops_log_scan_sec ?? state.dashboardSettings?.ops_log_scan_sec ?? 60;
    return { liveAt, scanAt, reportAt, nextMin, opsPollSec };
  }

  function footerCaptionParts() {
    const { liveAt, scanAt, reportAt } = snapshot();
    return {
      live: liveAt ? `Live · ${fmtRelative(liveAt)}` : null,
      scan: scanAt ? `Ops scan · ${fmtRelative(scanAt)}` : null,
      report: reportAt ? `Last full report · ${fmtRelative(reportAt)}` : null,
    };
  }

  function renderFooter() {
    const parts = footerCaptionParts();
    const bits = [parts.live, parts.scan, parts.report].filter(Boolean);
    if (!bits.length) return '';
    return `<footer class="wt-tab-footer" id="tower-tab-footer">${bits.join(' · ')}</footer>`;
  }

  function refreshTab() {
    if (typeof TowerRenderSources !== 'undefined') {
      TowerRenderSources.applySourcesUpdate();
    }
  }

  async function fetchFromApi() {
    if (!state.apiMode || typeof WatchtowerApi === 'undefined') return;
    try {
      const data = await WatchtowerApi.fetchDataSources();
      if (data) state.dataSources = data;
      refreshTab();
    } catch (_) {
      /* optional endpoint */
    }
  }

  return {
    snapshot,
    footerCaptionParts,
    renderFooter,
    refreshTab,
    fetchFromApi,
    fmtRelative,
    fmtNextMinutes,
  };
})();
