'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type LivePulse = {
  alive: boolean;
  kill: () => void;
};

const LivePulseContext = createContext<LivePulse | null>(null);

export function LivePulseProvider({ children }: { children: ReactNode }) {
  const [alive, setAlive] = useState(true);
  const value = useMemo(
    () => ({
      alive,
      kill: () => setAlive(false),
    }),
    [alive],
  );
  return <LivePulseContext.Provider value={value}>{children}</LivePulseContext.Provider>;
}

export function useLivePulse(): LivePulse {
  const ctx = useContext(LivePulseContext);
  if (!ctx) throw new Error('useLivePulse must be used inside LivePulseProvider');
  return ctx;
}
