/**
 * Tab subtitles and unified data-source footers
 */
const TowerTabFooter = (function () {
  const SUBTITLES = {
    overview: 'Live vitals and charts update now; health narrative and storage use your last full report.',
    live: 'TPS, MSPT, CPU, and RAM charts sample every few seconds while the dashboard is open.',
    issues: 'Urgent items from your last full report; lag spikes update from live scans.',
    mods: 'Log errors update in the background (~60s); full mod list needs a report.',
    crashes: 'Crash folder scans in the background; classification depth comes from reports.',
    activity: 'Recent events from background log scans; older history from reports.',
    session: 'Online roster is live while the dashboard is open; playtime and window stats need a report.',
    backups: 'Backup signals read in the background; folder rescan on demand — inventory baseline from reports.',
    performance: 'Performance patterns from live rollups and your last report window.',
    spark: 'Spark profiles from uploads and report snapshots.',
    sources: 'Freshness timestamps and which dashboard areas use live, scan, or report data.',
    docs: 'Step-by-step guides built into Watchtower — search for a topic or browse by category.',
  };

  function subtitle(tabId) {
    const text = SUBTITLES[tabId];
    if (!text) return '';
    return `<p class="wt-tab-subtitle" id="tower-tab-subtitle">${text}</p>`;
  }

  function footerLines() {
    if (typeof TowerDataSources !== 'undefined' && TowerDataSources.footerCaptionParts) {
      return TowerDataSources.footerCaptionParts();
    }
    return { live: null, scan: null, report: null };
  }

  function footerHtml() {
    if (typeof TowerDataSources !== 'undefined' && TowerDataSources.renderFooter) {
      return TowerDataSources.renderFooter();
    }
    const parts = footerLines();
    const bits = [];
    if (parts.live) bits.push(parts.live);
    if (parts.scan) bits.push(parts.scan);
    if (parts.report) bits.push(parts.report);
    if (!bits.length) return '';
    return `<footer class="wt-tab-footer" id="tower-tab-footer">${bits.join(' · ')}</footer>`;
  }

  function wrapTab(tabId, innerHtml) {
    const foot = tabId === 'docs' ? '' : footerHtml();
    return `${subtitle(tabId)}${innerHtml}${foot}`;
  }

  return { subtitle, footerHtml, wrapTab, SUBTITLES };
})();
