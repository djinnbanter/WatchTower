/**
 * Queue row selection for Issues / Crashes.
 *
 * Plain module state (not Preact signals): this app reconciles via kickRender().
 * A real signal here caused dual updates (signals subscriber + kickRenderNow) that
 * detached live DOM nodes — selection looked frozen and the Issues tree could
 * stay visible after leaving the tab.
 *
 * URL is updated only as a soft deep-link mirror, and only while still on that tab.
 */
import { ui, setRoute } from '../../state/stores.js';
import { kickRenderNow } from '../../app/kick-render.js';

let issuesSelectedKey = null;
let crashesSelectedFp = null;

/** @returns {string|null} */
export function getIssuesSelection() {
  return issuesSelectedKey;
}

/** @returns {string|null} */
export function getCrashesSelection() {
  return crashesSelectedFp;
}

function softReplaceHistory(tab, params) {
  try {
    const qs = new URLSearchParams({ tab, ...params }).toString();
    history.replaceState({ tab, params }, '', `${location.pathname}?${qs}`);
  } catch {
    // history may be unavailable
  }
}

/**
 * Select an Issues row.
 * @param {string|null} key
 * @param {{ view?: string, syncUrl?: boolean }} [opts]
 */
export function selectIssue(key, opts = {}) {
  const syncUrl = opts.syncUrl !== false;
  const next = key == null || key === '' ? null : String(key);
  const changed = issuesSelectedKey !== next;
  if (changed) issuesSelectedKey = next;

  if (syncUrl && ui.value.route?.tab === 'issues') {
    const view = opts.view || ui.value.route.params?.view || 'active';
    const params = { view };
    if (next) params.issue = next;
    const cur = ui.value.route.params || {};
    const same = String(cur.issue || '') === String(next || '')
      && String(cur.view || 'active') === String(view);
    if (!same) {
      // One render path: setRoute → setUi → kickRender (do not also kickRenderNow).
      setRoute('issues', params);
      softReplaceHistory('issues', params);
      return;
    }
  }

  if (changed) kickRenderNow();
}

/**
 * Select a Crashes group.
 * @param {string|null} fp
 * @param {{ view?: string, syncUrl?: boolean }} [opts]
 */
export function selectCrash(fp, opts = {}) {
  const syncUrl = opts.syncUrl !== false;
  const next = fp == null || fp === '' ? null : String(fp);
  const changed = crashesSelectedFp !== next;
  if (changed) crashesSelectedFp = next;

  if (syncUrl && ui.value.route?.tab === 'crashes') {
    const view = opts.view || ui.value.route.params?.view || 'review';
    const params = { view };
    if (next) params.group = next;
    const cur = ui.value.route.params || {};
    const same = String(cur.group || '') === String(next || '')
      && String(cur.view || 'review') === String(view);
    if (!same) {
      setRoute('crashes', params);
      softReplaceHistory('crashes', params);
      return;
    }
  }

  if (changed) kickRenderNow();
}
