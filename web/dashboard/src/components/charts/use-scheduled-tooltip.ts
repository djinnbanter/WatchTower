"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ScheduledTooltipControls<T> {
  tooltipData: T | null;
  setTooltipData: React.Dispatch<React.SetStateAction<T | null>>;
  scheduleTooltip: (tooltip: T, dedupeKey?: string) => void;
  clearTooltip: () => void;
  resetTooltipDedupe: () => void;
}

function defaultDedupeKey<T>(tooltip: T): string {
  if (
    typeof tooltip === "object" &&
    tooltip !== null &&
    "index" in tooltip &&
    typeof (tooltip as { index: unknown }).index === "number"
  ) {
    const { index, point } = tooltip as {
      index: number;
      point?: { date?: Date } & Record<string, unknown>;
    };
    const date = point?.date;
    if (date instanceof Date && Number.isFinite(date.getTime())) {
      return `t:${date.getTime()}`;
    }
    return String(index);
  }
  return JSON.stringify(tooltip);
}

export function useScheduledTooltip<T>(): ScheduledTooltipControls<T> {
  const [tooltipData, setTooltipData] = useState<T | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  const pendingRef = useRef<T | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingKeyRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const commitTooltip = useCallback((tooltip: T, dedupeKey: string) => {
    if (dedupeKey === lastKeyRef.current) {
      // Same sample identity — still refresh pixel positions when scales slide.
      setTooltipData((prev) => {
        if (!prev) return tooltip;
        const prevObj = prev as { x?: number; yPositions?: Record<string, number> };
        const nextObj = tooltip as { x?: number; yPositions?: Record<string, number> };
        if (
          prevObj.x === nextObj.x &&
          JSON.stringify(prevObj.yPositions) === JSON.stringify(nextObj.yPositions)
        ) {
          return prev;
        }
        return tooltip;
      });
      return;
    }
    lastKeyRef.current = dedupeKey;
    setTooltipData(tooltip);
  }, []);

  const scheduleTooltip = useCallback(
    (tooltip: T, dedupeKey?: string) => {
      const key = dedupeKey ?? defaultDedupeKey(tooltip);
      pendingRef.current = tooltip;
      pendingKeyRef.current = key;
      // Always schedule a frame so same-sample re-anchors can refresh pixel x/y
      // when the live xDomain slides (dedupe still avoids noop setState in commit).
      if (rafRef.current !== null) {
        return;
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const next = pendingRef.current;
        const nextKey = pendingKeyRef.current;
        if (next && nextKey) {
          commitTooltip(next, nextKey);
        }
      });
    },
    [commitTooltip]
  );

  const clearTooltip = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingRef.current = null;
    pendingKeyRef.current = null;
    lastKeyRef.current = null;
    setTooltipData(null);
  }, []);

  const resetTooltipDedupe = useCallback(() => {
    lastKeyRef.current = null;
  }, []);

  return {
    tooltipData,
    setTooltipData,
    scheduleTooltip,
    clearTooltip,
    resetTooltipDedupe,
  };
}
