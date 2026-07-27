/**
 * Runtime context for the dashboard.
 * - Embedded: served from the mod JAR (data-embedded injected by DashboardHttpServer).
 * - Live proxy: Vite dev with WATCHTOWER_ORIGIN → real /api/* (no fixtures).
 * - Fixture preview: default :8081 design mode.
 */

export function isEmbedded(): boolean {
  return document.documentElement.dataset.embedded === 'true';
}

/** True when Vite was started with WATCHTOWER_ORIGIN (live soak). */
export function isLiveProxy(): boolean {
  return import.meta.env.VITE_LIVE_PROXY === '1' || import.meta.env.VITE_LIVE_PROXY === 'true';
}

/** Fixture-backed design preview (not embedded, not live proxy). */
export function isFixturePreview(): boolean {
  return !isEmbedded() && !isLiveProxy();
}

/** Real auth / support zip / discovery — anything that must hit a live server. */
export function requiresLiveAuth(): boolean {
  return isEmbedded() || isLiveProxy();
}
