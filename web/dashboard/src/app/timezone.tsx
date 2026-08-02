import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  TIMEZONE_STORAGE_KEY,
  isValidTimeZone,
  listTimeZones,
  parseTimezonePreference,
  resolveTimeZone,
  type TimezonePreference,
} from '@/lib/datetime';

type TimezoneCtx = {
  preference: TimezonePreference;
  resolvedZone: string;
  setBrowser: () => void;
  setUtc: () => void;
  setIana: (zone: string) => boolean;
  availableZones: string[];
};

const Ctx = createContext<TimezoneCtx | null>(null);

function readStored(): TimezonePreference {
  try {
    return parseTimezonePreference(localStorage.getItem(TIMEZONE_STORAGE_KEY));
  } catch {
    return { mode: 'browser' };
  }
}

function writeStored(pref: TimezonePreference) {
  try {
    localStorage.setItem(TIMEZONE_STORAGE_KEY, JSON.stringify(pref));
  } catch {
    // ignore quota / private mode
  }
}

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<TimezonePreference>(() => readStored());

  useEffect(() => {
    writeStored(preference);
  }, [preference]);

  const availableZones = useMemo(() => listTimeZones(), []);

  const value = useMemo<TimezoneCtx>(() => {
    const resolvedZone = resolveTimeZone(preference);
    return {
      preference,
      resolvedZone,
      availableZones,
      setBrowser: () => setPreference({ mode: 'browser' }),
      setUtc: () => setPreference({ mode: 'utc' }),
      setIana: (zone: string) => {
        const trimmed = zone.trim();
        if (!isValidTimeZone(trimmed)) return false;
        setPreference({ mode: 'iana', zone: trimmed });
        return true;
      },
    };
  }, [preference, availableZones]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboardTimezone() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDashboardTimezone outside TimezoneProvider');
  return ctx;
}
