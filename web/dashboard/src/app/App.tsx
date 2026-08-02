import { lazy, Suspense, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppShell } from '@/app/shell';
import { AuthGate } from '@/app/auth-gate';
import { BootScreen } from '@/app/boot';
import { getRoute, subscribeRoute } from '@/app/router';
import { getPage } from '@/app/registry';
import { useSessionStore } from '@/app/session-store';
import { ThemeProvider } from '@/app/theme';
import { TimezoneProvider } from '@/app/timezone';

const WizardView = lazy(() =>
  import('@/features/wizard/view').then((m) => ({ default: m.PageView })),
);

function useRoute() {
  return useSyncExternalStore(subscribeRoute, getRoute, getRoute);
}

export function App() {
  const route = useRoute();
  const page = useMemo(() => getPage(route.tab), [route.tab]);
  const PageView = page?.render;
  const bootPhase = useSessionStore((s) => s.bootPhase);
  const gate = useSessionStore((s) => s.gate);
  const bootstrap = useSessionStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <ThemeProvider>
      <TimezoneProvider>
        {bootPhase === 'boot' ? <BootScreen /> : null}
        {bootPhase === 'auth' && gate !== 'none' ? <AuthGate /> : null}
        {bootPhase === 'auth' && gate === 'none' ? <BootScreen message="Checking session…" /> : null}
        {bootPhase === 'loading' ? <BootScreen message="Loading saved reports…" /> : null}
        {bootPhase === 'wizard' ? (
          <Suspense fallback={<BootScreen message="Loading…" />}>
            <WizardView route={route} />
          </Suspense>
        ) : null}
        {bootPhase === 'ready' ? (
          <AppShell route={route} page={page}>
            {PageView ? (
              <Suspense fallback={<BootScreen message="Loading…" />}>
                <PageView route={route} />
              </Suspense>
            ) : (
              <div className="p-8 text-wt-text-mid">Unknown page: {route.tab}</div>
            )}
          </AppShell>
        ) : null}
      </TimezoneProvider>
    </ThemeProvider>
  );
}
