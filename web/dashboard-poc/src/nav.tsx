import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type PageId =
  | 'overview'
  | 'issues'
  | 'live'
  | 'crashes'
  | 'insights'
  | 'session'
  | 'startup'
  | 'spark'
  | 'logs'
  | 'mods'
  | 'backups'
  | 'activity'
  | 'sources'
  | 'docs'
  | 'roadmap'
  | 'settings'
  | 'kit';

type NavContextValue = {
  page: PageId;
  setPage: (id: PageId) => void;
};

const NavContext = createContext<NavContextValue | null>(null);

const IMPLEMENTED: PageId[] = ['overview', 'issues', 'live', 'startup', 'backups', 'kit'];

export function isPageReady(id: PageId): boolean {
  return IMPLEMENTED.includes(id);
}

export function NavProvider({ children }: { children: ReactNode }) {
  const [page, setPageState] = useState<PageId>('overview');
  const setPage = useCallback((id: PageId) => {
    if (!isPageReady(id)) return;
    setPageState(id);
  }, []);
  const value = useMemo(() => ({ page, setPage }), [page, setPage]);
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}
