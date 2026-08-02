'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from 'react';
import { NIGHT } from '@/content/night';

type LogProgress = {
  activeId: string | null;
  setEntryNode: (id: string, node: HTMLElement | null) => void;
};

const LogProgressContext = createContext<LogProgress | null>(null);

export function useLogProgressContext(): LogProgress {
  const ctx = useContext(LogProgressContext);
  if (!ctx) throw new Error('useLogProgressContext must be used inside ShiftLog');
  return ctx;
}

/** Tracks which tour entry is in view (e.g. Crashes kill pulse). No rail progress. */
export function LogProgressProvider({
  rootRef: _rootRef,
  children,
}: {
  rootRef: RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) {
  const [activeId, setActiveId] = useState<string | null>(NIGHT[0]?.id ?? null);
  const [nodes, setNodes] = useState<Partial<Record<string, HTMLElement>>>({});

  const setEntryNode = useCallback((id: string, node: HTMLElement | null) => {
    setNodes((prev) => {
      if (node == null) {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      if (prev[id] === node) return prev;
      return { ...prev, [id]: node };
    });
  }, []);

  useEffect(() => {
    const entries = Object.entries(nodes) as [string, HTMLElement][];
    if (!entries.length) return;

    const io = new IntersectionObserver(
      (obs) => {
        const visible = obs
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (!top) return;
        const id = (top.target as HTMLElement).dataset.entryId;
        if (id) setActiveId(id);
      },
      { root: null, rootMargin: '-20% 0px -45% 0px', threshold: [0.15, 0.35, 0.55] },
    );

    for (const [, el] of entries) io.observe(el);
    return () => io.disconnect();
  }, [nodes]);

  const value = useMemo(
    () => ({ activeId, setEntryNode }),
    [activeId, setEntryNode],
  );

  return <LogProgressContext.Provider value={value}>{children}</LogProgressContext.Provider>;
}
