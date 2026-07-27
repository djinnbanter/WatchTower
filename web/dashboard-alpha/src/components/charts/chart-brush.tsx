"use client";

import { localPoint } from "@visx/event";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { chartCssVars, useChartStable } from "./chart-context";
import {
  resolveBrushTrackXExtent,
  resolveDataXExtent,
} from "./filter-data-by-x-domain";
import {
  type PatternPresetId,
  renderPatternPreset,
} from "./pattern-preset";

export type ChartBrushSelection = { start: Date; end: Date };

export type ChartBrushDirection = "horizontal" | "vertical" | "both";

export type ChartBrushSelectionPattern = {
  preset: Exclude<PatternPresetId, "none" | "circles">;
  color?: string;
};

export interface ChartBrushProps {
  /** Fires while dragging with the selected date range. */
  onSelectionChange?: (domain: ChartBrushSelection) => void;
  /** Initial brush window (uncontrolled). */
  initialSelection?: ChartBrushSelection;
  /** Controlled selection. */
  selection?: ChartBrushSelection;
  /** Brush axis. Default: `"horizontal"`. */
  brushDirection?: ChartBrushDirection;
  /** Backdrop blur on dimmed track (0–5 px). Default: `1.5`. */
  blurPx?: number;
  /** Fade dimmed regions at outer track edges. Default: `true`. */
  fadeOuterEdges?: boolean;
  /** Pattern fill inside the selection window. */
  selectionPattern?: ChartBrushSelectionPattern;
  /** Use window move events (recommended for brush strips). Default: `true`. */
  useWindowMoveEvents?: boolean;
  /** Minimum selection span in ms. Default: 60_000 (1m). */
  minSelectionMs?: number;
}

type DragMode = "move" | "start" | "end";

type DragState = {
  mode: DragMode;
  pointerId: number;
  originX: number;
  startMs: number;
  endMs: number;
};

const HANDLE_HIT_PX = 18;
const HANDLE_BAR_W = 3;
const HANDLE_GRIP_W = 14;
const HANDLE_GRIP_H = 28;
const MIN_SELECTION_PX = 8;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRange(startMs: number, endMs: number): [number, number] {
  return startMs <= endMs ? [startMs, endMs] : [endMs, startMs];
}

function selectionFromMs(startMs: number, endMs: number): ChartBrushSelection {
  const [start, end] = normalizeRange(startMs, endMs);
  return { start: new Date(start), end: new Date(end) };
}

function sameSelection(
  a: ChartBrushSelection | null | undefined,
  b: ChartBrushSelection | null | undefined
) {
  if (!a || !b) {
    return a === b;
  }
  return (
    a.start.getTime() === b.start.getTime() &&
    a.end.getTime() === b.end.getTime()
  );
}

function BrushHandle({
  x,
  height,
  mode,
  active,
  onPointerDown,
}: {
  x: number;
  height: number;
  mode: "start" | "end";
  active: boolean;
  onPointerDown: (event: ReactPointerEvent<SVGElement>) => void;
}) {
  const gripX = x - HANDLE_GRIP_W / 2;
  const gripY = Math.max(0, (height - HANDLE_GRIP_H) / 2);
  const barFill = active
    ? "var(--chart-line-primary)"
    : chartCssVars.brushBorder;
  const gripFill = active
    ? "color-mix(in srgb, var(--chart-line-primary) 92%, white)"
    : "color-mix(in srgb, var(--chart-foreground) 88%, var(--chart-background))";
  const gripStroke = active
    ? "var(--chart-line-primary)"
    : "color-mix(in srgb, var(--chart-foreground) 45%, transparent)";

  return (
    <g
      aria-label={mode === "start" ? "Brush start handle" : "Brush end handle"}
      cursor="ew-resize"
      onPointerDown={onPointerDown}
      style={{ pointerEvents: "all" }}
    >
      {/* Full-height edge line */}
      <rect
        fill={barFill}
        height={height}
        opacity={0.95}
        rx={1}
        width={HANDLE_BAR_W}
        x={x - HANDLE_BAR_W / 2}
        y={0}
      />
      {/* Grip pill */}
      <rect
        fill={gripFill}
        height={HANDLE_GRIP_H}
        rx={4}
        stroke={gripStroke}
        strokeWidth={1.25}
        width={HANDLE_GRIP_W}
        x={gripX}
        y={gripY}
      />
      {/* Grip ridges */}
      {[0, 1, 2].map((i) => (
        <line
          key={i}
          stroke="color-mix(in srgb, var(--chart-background) 70%, transparent)"
          strokeLinecap="round"
          strokeWidth={1.5}
          x1={gripX + 4}
          x2={gripX + HANDLE_GRIP_W - 4}
          y1={gripY + 9 + i * 5}
          y2={gripY + 9 + i * 5}
        />
      ))}
      {/* Expanded hit target */}
      <rect
        fill="transparent"
        height={height}
        width={HANDLE_HIT_PX}
        x={x - HANDLE_HIT_PX / 2}
        y={0}
      />
    </g>
  );
}

export function ChartBrush({
  onSelectionChange,
  initialSelection,
  selection: controlledSelection,
  brushDirection = "horizontal",
  blurPx = 1.5,
  fadeOuterEdges = true,
  selectionPattern,
  useWindowMoveEvents = true,
  minSelectionMs = 60_000,
}: ChartBrushProps) {
  const {
    data,
    xScale,
    innerWidth,
    innerHeight,
    margin,
    xAccessor,
  } = useChartStable();
  const reactId = useId();
  const rootRef = useRef<SVGGElement | null>(null);
  const patternId = `chart-brush-pattern-${reactId}`;
  const leftFadeId = `chart-brush-fade-left-${reactId}`;
  const rightFadeId = `chart-brush-fade-right-${reactId}`;

  const trackExtent = useMemo(
    () => resolveBrushTrackXExtent(data, xAccessor) ?? resolveDataXExtent(data, xAccessor),
    [data, xAccessor]
  );

  const trackMs = useMemo(() => {
    if (!trackExtent) {
      return null;
    }
    return {
      min: trackExtent[0].getTime(),
      max: trackExtent[1].getTime(),
    };
  }, [trackExtent]);

  const [uncontrolled, setUncontrolled] = useState<ChartBrushSelection | null>(
    () => initialSelection ?? null
  );
  const isControlled = controlledSelection !== undefined;
  const activeSelection = isControlled
    ? controlledSelection ?? null
    : uncontrolled;

  const resolvedSelection = useMemo(() => {
    if (activeSelection) {
      return activeSelection;
    }
    if (!trackExtent) {
      return null;
    }
    return { start: trackExtent[0], end: trackExtent[1] };
  }, [activeSelection, trackExtent]);

  const dragRef = useRef<DragState | null>(null);
  const [, setDragTick] = useState(0);
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  const commitSelection = useCallback(
    (next: ChartBrushSelection) => {
      if (!isControlled) {
        setUncontrolled((prev) => (sameSelection(prev, next) ? prev : next));
      }
      onSelectionChangeRef.current?.(next);
    },
    [isControlled]
  );

  const clientXToChartX = useCallback(
    (clientX: number, svg: SVGSVGElement) => {
      const point = localPoint(svg, {
        clientX,
        clientY: 0,
      } as unknown as MouseEvent);
      if (!point) {
        return null;
      }
      return clamp(point.x - margin.left, 0, innerWidth);
    },
    [innerWidth, margin.left]
  );

  // Seed selection once track extent is known.
  useEffect(() => {
    if (!trackExtent || activeSelection) {
      return;
    }
    const seed = initialSelection ?? {
      start: trackExtent[0],
      end: trackExtent[1],
    };
    if (!isControlled) {
      setUncontrolled(seed);
    }
    onSelectionChangeRef.current?.(seed);
  }, [activeSelection, initialSelection, isControlled, trackExtent]);

  const xToMs = useCallback(
    (x: number) => {
      const date = xScale.invert(x);
      return date.getTime();
    },
    [xScale]
  );

  const msToX = useCallback(
    (ms: number) => xScale(new Date(ms)) ?? 0,
    [xScale]
  );

  const constrainSelection = useCallback(
    (startMs: number, endMs: number): ChartBrushSelection => {
      if (!trackMs) {
        return selectionFromMs(startMs, endMs);
      }
      let [start, end] = normalizeRange(startMs, endMs);
      const span = Math.max(minSelectionMs, end - start);
      const maxSpan = Math.max(minSelectionMs, trackMs.max - trackMs.min);
      const clampedSpan = Math.min(span, maxSpan);

      if (end - start < clampedSpan) {
        const mid = (start + end) / 2;
        start = mid - clampedSpan / 2;
        end = mid + clampedSpan / 2;
      }

      if (start < trackMs.min) {
        start = trackMs.min;
        end = start + clampedSpan;
      }
      if (end > trackMs.max) {
        end = trackMs.max;
        start = end - clampedSpan;
      }
      start = clamp(start, trackMs.min, trackMs.max);
      end = clamp(end, trackMs.min, trackMs.max);
      if (end - start < minSelectionMs && trackMs.max - trackMs.min >= minSelectionMs) {
        if (start <= trackMs.min) {
          end = start + minSelectionMs;
        } else {
          start = end - minSelectionMs;
        }
      }
      return selectionFromMs(start, end);
    },
    [minSelectionMs, trackMs]
  );

  const applyDrag = useCallback(
    (clientX: number, svg: SVGSVGElement) => {
      const drag = dragRef.current;
      if (!drag || !trackMs) {
        return;
      }
      const x = clientXToChartX(clientX, svg);
      if (x == null) {
        return;
      }
      const deltaX = x - drag.originX;
      const deltaMs = xToMs(drag.originX + deltaX) - xToMs(drag.originX);

      let next: ChartBrushSelection;
      if (drag.mode === "move") {
        const span = drag.endMs - drag.startMs;
        let start = drag.startMs + deltaMs;
        let end = drag.endMs + deltaMs;
        if (start < trackMs.min) {
          start = trackMs.min;
          end = start + span;
        }
        if (end > trackMs.max) {
          end = trackMs.max;
          start = end - span;
        }
        next = constrainSelection(start, end);
      } else if (drag.mode === "start") {
        next = constrainSelection(drag.startMs + deltaMs, drag.endMs);
      } else {
        next = constrainSelection(drag.startMs, drag.endMs + deltaMs);
      }
      commitSelection(next);
    },
    [clientXToChartX, commitSelection, constrainSelection, trackMs, xToMs]
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setDragTick((tick) => tick + 1);
  }, []);

  useEffect(() => {
    if (!useWindowMoveEvents) {
      return;
    }
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }
      const svg = rootRef.current?.ownerSVGElement;
      if (!svg) {
        return;
      }
      applyDrag(event.clientX, svg);
    };
    const onUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }
      endDrag();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [applyDrag, endDrag, useWindowMoveEvents]);

  const startDrag = useCallback(
    (mode: DragMode, event: ReactPointerEvent<SVGElement>) => {
      if (brushDirection === "vertical" || !resolvedSelection) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const svg = event.currentTarget.ownerSVGElement;
      if (!svg) {
        return;
      }
      const chartX = clientXToChartX(event.clientX, svg);
      if (chartX == null) {
        return;
      }
      dragRef.current = {
        mode,
        pointerId: event.pointerId,
        originX: chartX,
        startMs: resolvedSelection.start.getTime(),
        endMs: resolvedSelection.end.getTime(),
      };
      setDragTick((tick) => tick + 1);
      if (!useWindowMoveEvents) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    },
    [brushDirection, clientXToChartX, resolvedSelection, useWindowMoveEvents]
  );

  const onPointerMoveLocal = useCallback(
    (event: ReactPointerEvent<SVGRectElement>) => {
      if (useWindowMoveEvents || !dragRef.current) {
        return;
      }
      const svg = event.currentTarget.ownerSVGElement;
      if (!svg) {
        return;
      }
      applyDrag(event.clientX, svg);
    },
    [applyDrag, useWindowMoveEvents]
  );

  if (
    brushDirection === "vertical" ||
    !resolvedSelection ||
    !trackMs ||
    innerWidth <= 0 ||
    innerHeight <= 0
  ) {
    return null;
  }

  const startX = clamp(msToX(resolvedSelection.start.getTime()), 0, innerWidth);
  const endX = clamp(msToX(resolvedSelection.end.getTime()), 0, innerWidth);
  const left = Math.min(startX, endX);
  const right = Math.max(startX, endX);
  const width = Math.max(MIN_SELECTION_PX, right - left);
  const safeBlur = clamp(blurPx, 0, 5);
  const selectionFill = selectionPattern
    ? `url(#${patternId})`
    : "color-mix(in srgb, var(--chart-line-primary) 22%, transparent)";
  const dimFill = "color-mix(in srgb, var(--chart-background) 72%, transparent)";
  const isDragging = dragRef.current != null;
  const dragMode = dragRef.current?.mode ?? null;

  return (
    <g
      aria-label="Chart brush"
      ref={rootRef}
      style={{ pointerEvents: "all" }}
    >
      <defs>
        {selectionPattern
          ? renderPatternPreset(selectionPattern.preset, patternId, {
              color: selectionPattern.color ?? chartCssVars.linePrimary,
            })
          : null}
        {fadeOuterEdges ? (
          <>
            <linearGradient id={leftFadeId} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="white" stopOpacity="0" />
              <stop offset="35%" stopColor="white" stopOpacity="1" />
              <stop offset="100%" stopColor="white" stopOpacity="1" />
            </linearGradient>
            <linearGradient id={rightFadeId} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="65%" stopColor="white" stopOpacity="1" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <mask id={`${leftFadeId}-mask`}>
              <rect
                fill={`url(#${leftFadeId})`}
                height={innerHeight}
                width={Math.max(0, left)}
                x={0}
                y={0}
              />
            </mask>
            <mask id={`${rightFadeId}-mask`}>
              <rect
                fill={`url(#${rightFadeId})`}
                height={innerHeight}
                width={Math.max(0, innerWidth - right)}
                x={right}
                y={0}
              />
            </mask>
          </>
        ) : null}
      </defs>

      {/* Dimmed left */}
      {left > 0 ? (
        <rect
          fill={dimFill}
          height={innerHeight}
          mask={fadeOuterEdges ? `url(#${leftFadeId}-mask)` : undefined}
          style={safeBlur > 0 ? { backdropFilter: `blur(${safeBlur}px)` } : undefined}
          width={left}
          x={0}
          y={0}
        />
      ) : null}

      {/* Dimmed right */}
      {right < innerWidth ? (
        <rect
          fill={dimFill}
          height={innerHeight}
          mask={fadeOuterEdges ? `url(#${rightFadeId}-mask)` : undefined}
          style={safeBlur > 0 ? { backdropFilter: `blur(${safeBlur}px)` } : undefined}
          width={innerWidth - right}
          x={right}
          y={0}
        />
      ) : null}

      {/* Selection window */}
      <rect
        cursor={isDragging && dragMode === "move" ? "grabbing" : "grab"}
        fill={selectionFill}
        height={innerHeight}
        onPointerDown={(event) => startDrag("move", event)}
        onPointerMove={onPointerMoveLocal}
        onPointerUp={endDrag}
        stroke="color-mix(in srgb, var(--chart-line-primary) 70%, transparent)"
        strokeWidth={1.5}
        width={width}
        x={left}
        y={0}
      />
      {/* Top/bottom rails so the window reads as a band */}
      <line
        pointerEvents="none"
        stroke="color-mix(in srgb, var(--chart-line-primary) 55%, transparent)"
        strokeWidth={1}
        x1={left}
        x2={left + width}
        y1={0.5}
        y2={0.5}
      />
      <line
        pointerEvents="none"
        stroke="color-mix(in srgb, var(--chart-line-primary) 55%, transparent)"
        strokeWidth={1}
        x1={left}
        x2={left + width}
        y1={innerHeight - 0.5}
        y2={innerHeight - 0.5}
      />

      <BrushHandle
        active={dragMode === "start"}
        height={innerHeight}
        mode="start"
        onPointerDown={(event) => startDrag("start", event)}
        x={left}
      />
      <BrushHandle
        active={dragMode === "end"}
        height={innerHeight}
        mode="end"
        onPointerDown={(event) => startDrag("end", event)}
        x={right}
      />
    </g>
  );
}

ChartBrush.displayName = "ChartBrush";

export default ChartBrush;
