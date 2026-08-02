'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useReducedMotion } from 'motion/react';
import { LanternSparkLayer, type SparkParticle, type SparkTone } from './lantern-spark';

type SparkApi = {
  burst: (x: number, y: number, tone?: SparkTone) => void;
};

const SparkContext = createContext<SparkApi | null>(null);

let sparkSeq = 0;

export function SparkProvider({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const [particles, setParticles] = useState<SparkParticle[]>([]);
  const timers = useRef<Map<number, number>>(new Map());

  const burst = useCallback(
    (x: number, y: number, tone: SparkTone = 'accent') => {
      if (reduce) return;
      const id = ++sparkSeq;
      setParticles((prev) => [...prev, { id, x, y, tone, born: performance.now() }]);
      const t = window.setTimeout(() => {
        setParticles((prev) => prev.filter((p) => p.id !== id));
        timers.current.delete(id);
      }, 520);
      timers.current.set(id, t);
    },
    [reduce],
  );

  useEffect(() => {
    return () => {
      for (const t of timers.current.values()) window.clearTimeout(t);
      timers.current.clear();
    };
  }, []);

  const api = useMemo(() => ({ burst }), [burst]);

  return (
    <SparkContext.Provider value={api}>
      {children}
      <LanternSparkLayer particles={particles} />
    </SparkContext.Provider>
  );
}

export function useSpark(): SparkApi {
  const ctx = useContext(SparkContext);
  if (!ctx) {
    return {
      burst: () => {
        /* no provider */
      },
    };
  }
  return ctx;
}
