"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { resolveDataXExtent } from "./filter-data-by-x-domain";

export type BrushSelection = { start: Date; end: Date };

export type ChartBrushLayoutValue = {
  /** Visible x-range for main charts — updates on brush release / preset. */
  xDomain: [Date, Date] | undefined;
  /** Full dataset length for x-scale padding. */
  xDomainSlotCount: number | undefined;
  /** Live brush window (updates while dragging the strip). */
  brushSelection: BrushSelection | null;
  /** Pass to `ChartBrush` `onSelectionChange` (strip-only while dragging). */
  onBrushSelectionChange: (selection: BrushSelection | null) => void;
  /** Commit a window immediately (presets / programmatic). Animates charts. */
  setWindow: (selection: BrushSelection) => void;
};

export interface ChartBrushLayoutProps {
  /** Full dataset for extent + main chart slot count. */
  data: Record<string, unknown>[];
  /** Key in data for x-axis values. Default: `"date"`. */
  xDataKey?: string;
  /** When `false`, children render without brush zoom. */
  enabled: boolean;
  /** Brush strip height in pixels. */
  height: number;
  /** Mini chart + `ChartBrush`. */
  brushStrip?: (layout: ChartBrushLayoutValue) => ReactNode;
  /** Main chart(s) render function. */
  children: (layout: ChartBrushLayoutValue) => ReactNode;
  /** Wrapper class name. */
  className?: string;
  /** Place the brush strip above (`top`) or below (`bottom`) the main content. */
  brushPosition?: "top" | "bottom";
  /** Starting brush window. */
  initialSelection?: BrushSelection;
}

function normalizeSelection(
  selection: BrushSelection | null
): BrushSelection | null {
  if (!selection) {
    return null;
  }
  const startMs = selection.start.getTime();
  const endMs = selection.end.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return null;
  }
  if (startMs <= endMs) {
    return { start: selection.start, end: selection.end };
  }
  return { start: selection.end, end: selection.start };
}

function selectionEquals(a: BrushSelection | null, b: BrushSelection | null) {
  if (a == null || b == null) {
    return a === b;
  }
  return (
    a.start.getTime() === b.start.getTime() &&
    a.end.getTime() === b.end.getTime()
  );
}

export function ChartBrushLayout({
  data,
  xDataKey = "date",
  enabled,
  height,
  brushStrip,
  children,
  className,
  brushPosition = "bottom",
  initialSelection,
}: ChartBrushLayoutProps) {
  const xAccessor = useCallback(
    (datum: Record<string, unknown>) => {
      const value = datum[xDataKey];
      return value instanceof Date ? value : new Date(value as string | number);
    },
    [xDataKey]
  );

  const dataExtent = useMemo(
    () => resolveDataXExtent(data, xAccessor),
    [data, xAccessor]
  );

  const [brushSelection, setBrushSelection] = useState<BrushSelection | null>(
    () => normalizeSelection(initialSelection ?? null)
  );
  /** Charts only see this — set on release / preset so morph can run once. */
  const [chartSelection, setChartSelection] = useState<BrushSelection | null>(
    () => normalizeSelection(initialSelection ?? null)
  );

  const pendingRef = useRef<BrushSelection | null>(
    normalizeSelection(initialSelection ?? null)
  );
  const draggingRef = useRef(false);

  useEffect(() => {
    if (brushSelection != null || !initialSelection) {
      return;
    }
    const next = normalizeSelection(initialSelection);
    setBrushSelection(next);
    setChartSelection(next);
    pendingRef.current = next;
  }, [brushSelection, initialSelection]);

  const commitChartSelection = useCallback((next: BrushSelection | null) => {
    const normalized = normalizeSelection(next);
    pendingRef.current = normalized;
    setBrushSelection((prev) =>
      selectionEquals(prev, normalized) ? prev : normalized
    );
    setChartSelection((prev) =>
      selectionEquals(prev, normalized) ? prev : normalized
    );
  }, []);

  const onBrushSelectionChange = useCallback(
    (selection: BrushSelection | null) => {
      const next = normalizeSelection(selection);
      pendingRef.current = next;
      draggingRef.current = true;
      // Strip only — keep main charts on the last committed window until release.
      setBrushSelection((prev) =>
        selectionEquals(prev, next) ? prev : next
      );
    },
    []
  );

  const setWindow = useCallback(
    (selection: BrushSelection) => {
      draggingRef.current = false;
      commitChartSelection(selection);
    },
    [commitChartSelection]
  );

  useEffect(() => {
    const flush = () => {
      if (!draggingRef.current) {
        return;
      }
      draggingRef.current = false;
      commitChartSelection(pendingRef.current);
    };
    window.addEventListener("pointerup", flush);
    window.addEventListener("pointercancel", flush);
    return () => {
      window.removeEventListener("pointerup", flush);
      window.removeEventListener("pointercancel", flush);
    };
  }, [commitChartSelection]);

  const resolvedBrush = useMemo(() => {
    if (!enabled) {
      return null;
    }
    if (brushSelection) {
      return brushSelection;
    }
    if (initialSelection) {
      return normalizeSelection(initialSelection);
    }
    if (!dataExtent) {
      return null;
    }
    return { start: dataExtent[0], end: dataExtent[1] };
  }, [brushSelection, dataExtent, enabled, initialSelection]);

  const resolvedChart = useMemo(() => {
    if (!enabled) {
      return null;
    }
    return chartSelection ?? resolvedBrush;
  }, [chartSelection, enabled, resolvedBrush]);

  const stripLayout = useMemo<ChartBrushLayoutValue>(() => {
    if (!enabled || !resolvedBrush) {
      return {
        xDomain: undefined,
        xDomainSlotCount: undefined,
        brushSelection: null,
        onBrushSelectionChange,
        setWindow,
      };
    }
    return {
      // Strip preview can follow the live brush while dragging.
      xDomain: [resolvedBrush.start, resolvedBrush.end],
      xDomainSlotCount: data.length,
      brushSelection: resolvedBrush,
      onBrushSelectionChange,
      setWindow,
    };
  }, [data.length, enabled, onBrushSelectionChange, resolvedBrush, setWindow]);

  const chartLayout = useMemo<ChartBrushLayoutValue>(() => {
    if (!enabled || !resolvedChart) {
      return {
        xDomain: undefined,
        xDomainSlotCount: undefined,
        brushSelection: resolvedBrush,
        onBrushSelectionChange,
        setWindow,
      };
    }
    return {
      xDomain: [resolvedChart.start, resolvedChart.end],
      xDomainSlotCount: data.length,
      brushSelection: resolvedBrush,
      onBrushSelectionChange,
      setWindow,
    };
  }, [
    data.length,
    enabled,
    onBrushSelectionChange,
    resolvedBrush,
    resolvedChart,
    setWindow,
  ]);

  const strip =
    enabled && brushStrip ? (
      <div className="w-full shrink-0" data-brush-height={height}>
        {brushStrip(stripLayout)}
      </div>
    ) : null;

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      {brushPosition === "top" ? strip : null}
      <div className="min-w-0 flex-1">{children(chartLayout)}</div>
      {brushPosition === "bottom" ? strip : null}
    </div>
  );
}

ChartBrushLayout.displayName = "ChartBrushLayout";

export default ChartBrushLayout;
