/**
 * Runtime context for the dashboard.
 * - Embedded: served from the mod JAR (data-embedded injected by DashboardHttpServer).
 * - Live proxy: Vite dev with WATCHTOWER_ORIGIN → real /api/* (no fixtures).
 * - Fixture preview: default :8081 design mode.
 * - Static demo: Vercel/static build with baked ./demo-api JSON.
 */

function viteEnv(key: string): string | undefined {
  try {
    const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
    return env?.[key];
  } catch {
    return undefined;
  }
}

export function isEmbedded(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.embedded === 'true';
}

/** True when Vite was started with WATCHTOWER_ORIGIN (live soak). */
export function isLiveProxy(): boolean {
  const v = viteEnv('VITE_LIVE_PROXY');
  return v === '1' || v === 'true';
}

/** Static Vercel demo build (VITE_STATIC_DEMO=1). Implies fixture-preview auth skip. */
export function isStaticDemo(): boolean {
  const v = viteEnv('VITE_STATIC_DEMO');
  return v === '1' || v === 'true';
}

/** Fixture-backed design preview (not embedded, not live proxy). */
export function isFixturePreview(): boolean {
  return isStaticDemo() || (!isEmbedded() && !isLiveProxy());
}

/** Real auth / support zip / discovery — anything that must hit a live server. */
export function requiresLiveAuth(): boolean {
  return isEmbedded() || isLiveProxy();
}
