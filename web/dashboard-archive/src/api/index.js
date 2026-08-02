import { LiveSource } from './source-live.js';
import { FixtureSource } from './source-fixture.js';

/**
 * Returns true when the dashboard is running inside the embedded Watchtower mod
 * (the mod sets data-embedded="true" on <html> before the page loads).
 */
export function isEmbedded() {
  return document.documentElement.dataset.embedded === 'true';
}

/**
 * Create the appropriate data source based on the runtime context.
 * - Embedded (live server): LiveSource → talks to real /api/* endpoints.
 * - Static preview / dev:  FixtureSource → loads data/*.json fixtures.
 */
export function createSource() {
  return isEmbedded() ? new LiveSource() : new FixtureSource();
}
