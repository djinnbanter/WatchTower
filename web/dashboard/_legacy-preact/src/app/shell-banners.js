import { ui, overviewMeta } from '../state/stores.js';
import { isEmbedded } from '../api/index.js';
import { isStaleReport } from '../domain/freshness.js';

/**
 * Banner definition:
 * @typedef {{ id: string, tone: string, text: string, actions?: Array<{label: string, onClick: () => void}>, dismissKey?: string }} BannerDef
 */

/** Registry of all possible banners, evaluated in order. */
export const BANNERS = [
  {
    id: 'preview-mode',
    tone: 'info',
    text: 'Alpha preview — full fixture clone with redesigned charts/UI. Not shipped in the mod JAR.',
    when: () => !isEmbedded(),
    dismissKey: null, // cannot dismiss preview banner
  },
  {
    id: 'connection-down',
    tone: 'danger',
    text: 'Connection lost. Retrying in the background…',
    when: () => ui.value.connectionDown,
    dismissKey: null,
  },
  {
    id: 'stale-report',
    tone: 'warning',
    text: 'Report data is stale. Run a new report to get up-to-date information.',
    when: () => {
      const meta = overviewMeta.value.data;
      if (!meta) return false;
      return isStaleReport(meta);
    },
    dismissKey: 'staleReportDismissed',
  },
];

/**
 * Compute active banners given current store state and dismissed keys.
 * @param {Set<string>} dismissed
 * @returns {BannerDef[]}
 */
export function getActiveBanners(dismissed = new Set()) {
  return BANNERS.filter((b) => {
    if (b.dismissKey && dismissed.has(b.dismissKey)) return false;
    try {
      return b.when();
    } catch {
      return false;
    }
  });
}
