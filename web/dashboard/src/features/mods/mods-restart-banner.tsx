import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMutateStatus } from './mutate-api';

const TIP_KEY = 'wt.modsRestartTip.shown';

/**
 * Banner when pack jars changed and a host-panel restart is still owed.
 * Clears when the server reports needs_restart false (usually after boot).
 */
export function ModsRestartBanner({
  /** Also show when overview meta already has an active mod restart nudge. */
  forceActive = false,
  className = '',
}: {
  forceActive?: boolean;
  className?: string;
}) {
  const statusQ = useQuery({
    queryKey: ['mods-mutate-status'],
    queryFn: fetchMutateStatus,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  const needsRestart = forceActive || statusQ.data?.needs_restart === true;
  const prev = useRef<boolean | null>(null);
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    const was = prev.current;
    prev.current = needsRestart;
    if (was === true && needsRestart === false) {
      try {
        if (localStorage.getItem(TIP_KEY) === '1') return;
        localStorage.setItem(TIP_KEY, '1');
        setShowTip(true);
      } catch {
        /* ignore */
      }
    }
  }, [needsRestart]);

  if (!needsRestart && !showTip) return null;

  if (showTip && !needsRestart) {
    return (
      <div className={`md-restart-banner md-restart-banner--tip ${className}`.trim()} role="status">
        <p>Pack restart cleared. Did that help?</p>
        <button
          type="button"
          className="md-restart-banner__dismiss"
          onClick={() => setShowTip(false)}
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className={`md-restart-banner ${className}`.trim()} role="status">
      <p>
        Pack files changed — restart the server from your host panel. WatchTower will not restart it
        for you.
      </p>
    </div>
  );
}
