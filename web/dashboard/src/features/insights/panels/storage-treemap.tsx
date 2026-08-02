import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ParentSize } from '@visx/responsive';
import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from 'd3-hierarchy';
import { formatPct } from '@/domain/formats';
import { formatTreemapSize } from './storage-treemap-format';
import type { StorageTreemapNode, StorageTreemapTone } from './storage-treemap-tree';

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/** Stronger fills so categories (especially Mods) read clearly on the map. */
function toneFill(tone: StorageTreemapTone): string {
  if (tone === 'info') {
    // Mods — purple heap series, not the muted --wt-info gray-blue.
    return 'color-mix(in srgb, var(--wt-ch-heap, #9B8BD9) 78%, transparent)';
  }
  if (tone === 'warn') return 'color-mix(in srgb, var(--wt-warn) 72%, transparent)';
  if (tone === 'neutral') return 'color-mix(in srgb, var(--wt-text-low) 42%, transparent)';
  if (tone === 'ok') return 'color-mix(in srgb, var(--wt-ok) 70%, transparent)';
  return 'color-mix(in srgb, var(--wt-accent) 72%, transparent)';
}

function findNode(root: StorageTreemapNode, idPath: string[]): StorageTreemapNode | null {
  if (!idPath.length || idPath[0] !== root.id) return null;
  let cur: StorageTreemapNode = root;
  for (let i = 1; i < idPath.length; i++) {
    const next = cur.children?.find((c) => c.id === idPath[i]);
    if (!next) return null;
    cur = next;
  }
  return cur;
}

function crumbTrail(root: StorageTreemapNode, idPath: string[]): StorageTreemapNode[] {
  const out: StorageTreemapNode[] = [];
  let cur: StorageTreemapNode | undefined = root;
  for (let i = 0; i < idPath.length; i++) {
    if (!cur || cur.id !== idPath[i]) break;
    out.push(cur);
    if (i + 1 >= idPath.length) break;
    cur = cur.children?.find((c) => c.id === idPath[i + 1]);
  }
  return out;
}

type LayoutTile = {
  node: StorageTreemapNode;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  zoomable: boolean;
};

function layoutImmediateChildren(
  zoomRoot: StorageTreemapNode,
  width: number,
  height: number,
): LayoutTile[] {
  const children = zoomRoot.children ?? [];
  if (!children.length) {
    return [
      {
        node: zoomRoot,
        x0: 0,
        y0: 0,
        x1: width,
        y1: height,
        zoomable: false,
      },
    ];
  }

  const shallow: StorageTreemapNode = {
    ...zoomRoot,
    children: children.map((c) => ({ ...c, children: undefined })),
  };

  const root = hierarchy(shallow)
    // Only leaf values participate in the layout. Counting zoomRoot.valueGb as
    // well would double-count the total and leave an unallocated gray region.
    .sum((d) => (d.children?.length ? 0 : d.valueGb))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const laidOut = treemap<StorageTreemapNode>()
    .tile(treemapSquarify)
    .size([width, height])
    .paddingInner(2)
    .paddingOuter(2)(root) as HierarchyRectangularNode<StorageTreemapNode>;

  return (laidOut.children ?? []).map((leaf) => {
    const original = children.find((c) => c.id === leaf.data.id) ?? leaf.data;
    return {
      node: original,
      x0: leaf.x0,
      y0: leaf.y0,
      x1: leaf.x1,
      y1: leaf.y1,
      zoomable: Boolean(original.children?.length),
    };
  });
}

type HoverState = {
  node: StorageTreemapNode;
  x: number;
  y: number;
  sharePct: number;
};

type ZoomDir = 'in' | 'out';

type ZoomOrigin = {
  xPct: number;
  yPct: number;
};

type StageMotion = {
  dir: ZoomDir;
  origin: ZoomOrigin;
};

const CENTER_ORIGIN: ZoomOrigin = { xPct: 50, yPct: 50 };

function tileOrigin(tile: LayoutTile, width: number, height: number): ZoomOrigin {
  return {
    xPct: width > 0 ? (((tile.x0 + tile.x1) / 2) / width) * 100 : 50,
    yPct: height > 0 ? (((tile.y0 + tile.y1) / 2) / height) * 100 : 50,
  };
}

function boundedLabelSizes(width: number, height: number): {
  labelPx: number;
  sizePx: number;
} {
  const areaScale = Math.sqrt(Math.max(0, width * height)) / 12;
  const labelPx = Math.min(18, Math.max(11, areaScale));
  return {
    labelPx: Math.round(labelPx * 10) / 10,
    sizePx: Math.round(Math.min(14, Math.max(10, labelPx - 2)) * 10) / 10,
  };
}

const stageVariants = {
  enter: ({ dir, origin }: StageMotion) => ({
    opacity: 0,
    scale: dir === 'in' ? 0.92 : 1.18,
    transformOrigin: `${origin.xPct}% ${origin.yPct}%`,
  }),
  center: ({ origin }: StageMotion) => ({
    opacity: 1,
    scale: 1,
    transformOrigin: `${origin.xPct}% ${origin.yPct}%`,
  }),
  exit: ({ dir, origin }: StageMotion) => ({
    opacity: 0,
    scale: dir === 'in' ? 1.18 : 0.92,
    transformOrigin: `${origin.xPct}% ${origin.yPct}%`,
  }),
};

function TreemapSvg({
  zoomRoot,
  width,
  height,
  zoomKey,
  zoomDir,
  zoomOrigin,
  reduceMotion,
  onZoomInto,
}: {
  zoomRoot: StorageTreemapNode;
  width: number;
  height: number;
  zoomKey: string;
  zoomDir: ZoomDir;
  zoomOrigin: ZoomOrigin;
  reduceMotion: boolean;
  onZoomInto: (node: StorageTreemapNode, origin: ZoomOrigin) => void;
}) {
  const clipPrefix = useId().replace(/:/g, '');
  const [hover, setHover] = useState<HoverState | null>(null);
  const tiles = useMemo(
    () => (width >= 10 && height >= 10 ? layoutImmediateChildren(zoomRoot, width, height) : []),
    [zoomRoot, width, height],
  );
  const zoomRootGb = zoomRoot.valueGb || 0.01;

  useEffect(() => {
    setHover(null);
  }, [zoomKey]);

  const onTileKeyDown = useCallback(
    (e: KeyboardEvent, tile: LayoutTile) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (tile.zoomable) onZoomInto(tile.node, tileOrigin(tile, width, height));
      }
    },
    [height, onZoomInto, width],
  );

  const onTileMove = useCallback(
    (e: MouseEvent<SVGRectElement>, tile: LayoutTile) => {
      const host = e.currentTarget.ownerSVGElement?.parentElement;
      const rect = host?.getBoundingClientRect();
      if (!rect) return;
      setHover({
        node: tile.node,
        x: Math.min(e.clientX - rect.left + 12, Math.max(8, rect.width - 180)),
        y: Math.min(e.clientY - rect.top + 12, Math.max(8, rect.height - 72)),
        sharePct: (tile.node.valueGb / zoomRootGb) * 100,
      });
    },
    [zoomRootGb],
  );

  const ariaSummary = tiles
    .slice(0, 4)
    .map((t) => `${t.node.label} ${formatTreemapSize(t.node.valueGb)}`)
    .join(', ');

  const stageMotion = useMemo<StageMotion>(
    () => ({ dir: zoomDir, origin: zoomOrigin }),
    [zoomDir, zoomOrigin],
  );

  return (
    <AnimatePresence mode="sync" initial={false} custom={stageMotion}>
      <motion.div
        key={zoomKey}
        className="in-storage-treemap__stage"
        custom={stageMotion}
        variants={stageVariants}
        initial={reduceMotion ? false : 'enter'}
        animate="center"
        exit={reduceMotion ? undefined : 'exit'}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Space map: ${ariaSummary || zoomRoot.label}`}
        >
          {tiles.map((tile) => {
            const w = tile.x1 - tile.x0;
            const h = tile.y1 - tile.y0;
            const pad = 2;
            const innerW = Math.max(0, w - pad * 2);
            const innerH = Math.max(0, h - pad * 2);
            const { labelPx, sizePx } = boundedLabelSizes(innerW, innerH);
            const showLabel = innerW >= 36 && innerH >= labelPx + 6;
            const showSize = innerW >= 48 && innerH >= labelPx + sizePx + 12;
            const fill = toneFill(tile.node.tone);
            const clipId = `${clipPrefix}-${sanitizeId(tile.node.id)}`;
            const labelStyle = {
              '--in-storage-label-size': `${labelPx}px`,
              '--in-storage-size-size': `${sizePx}px`,
            } as CSSProperties;
            return (
              <g key={tile.node.id}>
                <defs>
                  <clipPath id={clipId}>
                    <rect
                      x={tile.x0}
                      y={tile.y0}
                      width={Math.max(0, w)}
                      height={Math.max(0, h)}
                    />
                  </clipPath>
                </defs>
                <g clipPath={`url(#${clipId})`}>
                  <rect
                    className={
                      tile.zoomable
                        ? 'in-storage-treemap__tile in-storage-treemap__tile--zoomable'
                        : 'in-storage-treemap__tile'
                    }
                    data-tone={tile.node.tone}
                    x={tile.x0}
                    y={tile.y0}
                    width={Math.max(0, w)}
                    height={Math.max(0, h)}
                    fill={fill}
                    tabIndex={0}
                    role="button"
                    aria-label={`${tile.node.label}, ${formatTreemapSize(tile.node.valueGb)}${tile.zoomable ? ', zoom in' : ''}`}
                    onClick={() =>
                      tile.zoomable &&
                      onZoomInto(tile.node, tileOrigin(tile, width, height))
                    }
                    onKeyDown={(e) => onTileKeyDown(e, tile)}
                    onMouseMove={(e) => onTileMove(e, tile)}
                    onMouseLeave={() => setHover(null)}
                  />
                  {showLabel ? (
                    <foreignObject
                      x={tile.x0 + pad}
                      y={tile.y0 + pad}
                      width={innerW}
                      height={innerH}
                      className="in-storage-treemap__label-fo"
                      pointerEvents="none"
                    >
                      <div
                        className="in-storage-treemap__label-box"
                        style={labelStyle}
                      >
                        <div className="in-storage-treemap__label-text">{tile.node.label}</div>
                        {showSize ? (
                          <div className="in-storage-treemap__label-size">
                            {formatTreemapSize(tile.node.valueGb)}
                          </div>
                        ) : null}
                      </div>
                    </foreignObject>
                  ) : null}
                </g>
              </g>
            );
          })}
        </svg>
        {hover ? (
          <div
            className="in-storage-treemap__tooltip"
            style={{ left: hover.x, top: hover.y }}
            role="tooltip"
          >
            <div className="font-medium text-wt-text">{hover.node.label}</div>
            <div className="font-mono text-wt-text-low">{hover.node.path}</div>
            <div className="font-mono">
              {formatTreemapSize(hover.node.valueGb)} · {formatPct(hover.sharePct)}
            </div>
          </div>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}

export function StorageTreemap({ tree }: { tree: StorageTreemapNode }) {
  const reduceMotion = useReducedMotion() === true;
  const [zoomPath, setZoomPath] = useState<string[]>(['server']);
  const [zoomDir, setZoomDir] = useState<ZoomDir>('in');
  const [zoomOrigin, setZoomOrigin] = useState<ZoomOrigin>(CENTER_ORIGIN);
  const [originStack, setOriginStack] = useState<ZoomOrigin[]>([]);

  useEffect(() => {
    setZoomPath(['server']);
    setZoomDir('in');
    setZoomOrigin(CENTER_ORIGIN);
    setOriginStack([]);
  }, [tree]);

  const zoomRoot = useMemo(() => findNode(tree, zoomPath) ?? tree, [tree, zoomPath]);
  const crumbs = useMemo(() => crumbTrail(tree, zoomPath), [tree, zoomPath]);
  const zoomKey = zoomPath.join('/');

  const zoomInto = useCallback(
    (node: StorageTreemapNode, origin: ZoomOrigin) => {
      if (!node.children?.length) return;
      setZoomDir('in');
      setZoomOrigin(origin);
      setOriginStack((prev) => [...prev, origin]);
      // Let the current stage receive the new direction/origin before it exits.
      requestAnimationFrame(() => {
        setZoomPath((prev) => [...prev, node.id]);
      });
    },
    [],
  );

  const zoomToCrumb = useCallback(
    (index: number) => {
      const returnOrigin = originStack[index] ?? originStack.at(-1) ?? CENTER_ORIGIN;
      setZoomDir('out');
      setZoomOrigin(returnOrigin);
      setOriginStack((prev) => prev.slice(0, index));
      requestAnimationFrame(() => {
        setZoomPath((prev) => prev.slice(0, index + 1));
      });
    },
    [originStack],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && zoomPath.length > 1) {
        e.preventDefault();
        const returnOrigin = originStack.at(-1) ?? CENTER_ORIGIN;
        setZoomDir('out');
        setZoomOrigin(returnOrigin);
        setOriginStack((prev) => prev.slice(0, -1));
        requestAnimationFrame(() => {
          setZoomPath((prev) => prev.slice(0, -1));
        });
      }
    },
    [originStack, zoomPath.length],
  );

  return (
    <div className="in-storage-treemap" onKeyDown={onKeyDown}>
      <nav className="in-storage-treemap__crumbs" aria-label="Space map location">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={`${c.id}-${i}`} className="inline-flex items-center gap-1">
              {i > 0 ? <span aria-hidden="true">›</span> : null}
              {isLast ? (
                <span className="in-storage-treemap__crumb" aria-current="page">
                  {c.label}
                </span>
              ) : (
                <button
                  type="button"
                  className="in-storage-treemap__crumb"
                  onClick={() => zoomToCrumb(i)}
                >
                  {c.label}
                </button>
              )}
            </span>
          );
        })}
      </nav>
      <div className="in-storage-treemap__viewport">
        <ParentSize className="in-storage-treemap__parent" debounceTime={50}>
          {({ width, height }) => (
            <TreemapSvg
              zoomRoot={zoomRoot}
              width={Math.max(0, width)}
              height={Math.max(0, height)}
              zoomKey={zoomKey}
              zoomDir={zoomDir}
              zoomOrigin={zoomOrigin}
              reduceMotion={reduceMotion}
              onZoomInto={zoomInto}
            />
          )}
        </ParentSize>
      </div>
    </div>
  );
}
