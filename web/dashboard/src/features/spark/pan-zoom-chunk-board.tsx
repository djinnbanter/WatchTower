import {
  useEffect,
  useRef,
  useState,
  type JSX,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  hotspotFitBBox,
  hotspotHeatIntensity,
  numeric,
  text,
  type UnknownRecord,
} from './model';

const MIN_SCALE = 4;
const MAX_SCALE = 48;
const DEFAULT_SCALE = 16;
const FIT_PADDING_CHUNKS = 2;

type Camera = { x: number; z: number; scale: number };

export type PanZoomChunkBoardProps = {
  hotspots: UnknownRecord[];
  onInspect: (hotspot: UnknownRecord) => void;
};

/** Stable identity for fit-camera; ignores array reference churn. */
function hotspotsFitKey(hotspots: UnknownRecord[]): string {
  return hotspots
    .map(
      (row) =>
        `${text(row.dimension)}:${numeric(row.chunk_x)}:${numeric(row.chunk_z)}:${numeric(row.total_entities)}`,
    )
    .join('|');
}

function fitCamera(hotspots: UnknownRecord[], width: number, height: number): Camera {
  const bbox = hotspotFitBBox(hotspots);
  if (!bbox || width <= 0 || height <= 0) {
    return { x: 0, z: 0, scale: DEFAULT_SCALE };
  }
  const spanX = bbox.maxX - bbox.minX + 1 + FIT_PADDING_CHUNKS * 2;
  const spanZ = bbox.maxZ - bbox.minZ + 1 + FIT_PADDING_CHUNKS * 2;
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(width / spanX, height / spanZ)));
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cz = (bbox.minZ + bbox.maxZ) / 2;
  return { x: cx, z: cz, scale };
}

function chunkToScreen(
  chunkX: number,
  chunkZ: number,
  cam: Camera,
  w: number,
  h: number,
): { sx: number; sy: number } {
  const sx = (chunkX - cam.x) * cam.scale + w / 2 - cam.scale / 2;
  const sy = (chunkZ - cam.z) * cam.scale + h / 2 - cam.scale / 2;
  return { sx, sy };
}

function hotspotAtChunk(hotspots: UnknownRecord[], chunkX: number, chunkZ: number): UnknownRecord | null {
  const ix = Math.floor(chunkX);
  const iz = Math.floor(chunkZ);
  for (const row of hotspots) {
    if (numeric(row.chunk_x) === ix && numeric(row.chunk_z) === iz) {
      return row;
    }
  }
  return null;
}

function cellButtonFromTarget(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) return null;
  const button = target.closest('.sp-map-board__cell');
  return button instanceof HTMLButtonElement ? button : null;
}

function visibleChunkRange(cam: Camera, w: number, h: number): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  const halfW = w / 2;
  const halfH = h / 2;
  return {
    minX: Math.floor(cam.x - halfW / cam.scale) - 1,
    maxX: Math.ceil(cam.x + halfW / cam.scale) + 1,
    minZ: Math.floor(cam.z - halfH / cam.scale) - 1,
    maxZ: Math.ceil(cam.z + halfH / cam.scale) + 1,
  };
}

export function PanZoomChunkBoard({ hotspots, onInspect }: PanZoomChunkBoardProps): JSX.Element {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, z: 0, scale: DEFAULT_SCALE });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originX: number;
    originZ: number;
    moved: boolean;
  } | null>(null);
  const fitKey = hotspotsFitKey(hotspots);
  const hotspotsRef = useRef(hotspots);
  hotspotsRef.current = hotspots;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;

    const applyFit = () => {
      const rect = el.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      setSize({ w, h });
      setCamera(fitCamera(hotspotsRef.current, w, h));
    };

    applyFit();
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      setSize({ w, h });
      setCamera(fitCamera(hotspotsRef.current, w, h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitKey]);

  const { w, h } = size;
  const maxEntities = hotspots.reduce((m, row) => Math.max(m, numeric(row.total_entities)), 0);
  const cellSize = Math.max(1, camera.scale - 1);
  const lookChunkX = Math.round(camera.x);
  const lookChunkZ = Math.round(camera.z);
  const blockX0 = lookChunkX * 16;
  const blockZ0 = lookChunkZ * 16;
  const chunksAcross = w > 0 && camera.scale > 0 ? Math.max(1, Math.round(w / camera.scale)) : 0;
  const chunksTall = h > 0 && camera.scale > 0 ? Math.max(1, Math.round(h / camera.scale)) : 0;

  const latticeLines: Array<{ key: string; x1: number; y1: number; x2: number; y2: number }> = [];
  const axisTicks: Array<{ key: string; left: string; top: string; label: string; edge: 'top' | 'left' }> = [];
  if (camera.scale >= 10 && w > 0 && h > 0) {
    const range = visibleChunkRange(camera, w, h);
    const labelStep = camera.scale >= 28 ? 1 : camera.scale >= 16 ? 2 : 4;
    for (let x = range.minX; x <= range.maxX; x += 1) {
      const sx = (x - camera.x) * camera.scale + w / 2;
      latticeLines.push({ key: `vx:${x}`, x1: sx, y1: 0, x2: sx, y2: h });
      if (x % labelStep === 0 && sx > 28 && sx < w - 28) {
        axisTicks.push({ key: `tx:${x}`, left: `${sx}px`, top: '0.35rem', label: String(x), edge: 'top' });
      }
    }
    for (let z = range.minZ; z <= range.maxZ; z += 1) {
      const sy = (z - camera.z) * camera.scale + h / 2;
      latticeLines.push({ key: `hz:${z}`, x1: 0, y1: sy, x2: w, y2: sy });
      if (z % labelStep === 0 && sy > 28 && sy < h - 36) {
        axisTicks.push({ key: `tz:${z}`, left: '0.35rem', top: `${sy}px`, label: String(z), edge: 'left' });
      }
    }
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originX: camera.x,
      originZ: camera.z,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    setCamera((cam) => ({
      ...cam,
      x: drag.originX - dx / cam.scale,
      z: drag.originZ - dy / cam.scale,
    }));
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (drag.moved) return;

    const cell = cellButtonFromTarget(e.target);
    if (cell) {
      const index = Number(cell.dataset.hotspotIndex);
      if (Number.isFinite(index) && hotspots[index]) {
        onInspect(hotspots[index]);
        return;
      }
    }

    const el = viewportRef.current;
    if (!el || w <= 0 || h <= 0) return;
    const rect = el.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const chunkX = camera.x + (localX - w / 2) / camera.scale;
    const chunkZ = camera.z + (localY - h / 2) / camera.scale;
    const hit = hotspotAtChunk(hotspots, chunkX, chunkZ);
    if (hit) onInspect(hit);
  }

  function handlePointerCancel(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  return (
    <div
      ref={viewportRef}
      className="sp-map-board"
      role="application"
      aria-label={`Chunk heat map, looking at chunk ${lookChunkX}, ${lookChunkZ}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onWheel={(e) => {
        e.preventDefault();
        const el = viewportRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        setCamera((cam) => {
          const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, cam.scale * factor));
          const localX = e.clientX - rect.left;
          const localY = e.clientY - rect.top;
          const wx = cam.x + (localX - rect.width / 2) / cam.scale;
          const wz = cam.z + (localY - rect.height / 2) / cam.scale;
          const x = wx - (localX - rect.width / 2) / nextScale;
          const z = wz - (localY - rect.height / 2) / nextScale;
          return { x, z, scale: nextScale };
        });
      }}
    >
      <div className="sp-map-board__world">
        {latticeLines.length ? (
          <svg
            className="sp-map-board__lattice"
            aria-hidden="true"
            width={w}
            height={h}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            {latticeLines.map((line) => (
              <line
                key={line.key}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="color-mix(in oklab, var(--wt-line) 45%, transparent)"
                strokeWidth={1}
              />
            ))}
          </svg>
        ) : null}
        {axisTicks.map((tick) => (
          <span
            key={tick.key}
            className={`sp-map-board__tick sp-map-board__tick--${tick.edge}`}
            style={{ left: tick.left, top: tick.top }}
            aria-hidden="true"
          >
            {tick.label}
          </span>
        ))}
        {hotspots.map((row, index) => {
          const chunkX = numeric(row.chunk_x);
          const chunkZ = numeric(row.chunk_z);
          const intensity = hotspotHeatIntensity(numeric(row.total_entities), maxEntities);
          const key = `${text(row.dimension)}:${chunkX}:${chunkZ}`;
          const { sx, sy } = chunkToScreen(chunkX, chunkZ, camera, w, h);
          const showLabel = camera.scale >= 22;
          return (
            <button
              key={key}
              type="button"
              className="sp-map-board__cell"
              data-hotspot-index={index}
              style={{
                left: `${sx}px`,
                top: `${sy}px`,
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                ['--sp-map-heat' as string]: String(intensity),
              }}
              aria-label={`Chunk ${chunkX}, ${chunkZ}, ${numeric(row.total_entities)} entities`}
              tabIndex={-1}
            >
              {showLabel ? (
                <span className="sp-map-board__cell-label" aria-hidden="true">
                  {chunkX},{chunkZ}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="sp-map-board__crosshair" aria-hidden="true" />

      <div className="sp-map-board__axes" aria-hidden="true">
        <span className="sp-map-board__axis sp-map-board__axis--n">−Z · north</span>
        <span className="sp-map-board__axis sp-map-board__axis--s">+Z · south</span>
        <span className="sp-map-board__axis sp-map-board__axis--w">−X · west</span>
        <span className="sp-map-board__axis sp-map-board__axis--e">+X · east</span>
      </div>

      <div className="sp-map-board__hud">
        <div className="sp-map-board__hud-main">
          <span className="sp-map-board__hud-kicker">Looking at</span>
          <strong>
            chunk {lookChunkX}, {lookChunkZ}
          </strong>
          <span className="sp-map-board__hud-blocks">
            blocks ~{blockX0}…{blockX0 + 15}, {blockZ0}…{blockZ0 + 15}
          </span>
        </div>
        <div className="sp-map-board__hud-meta">
          <span>1 square = 1 chunk (16×16)</span>
          <span>
            view ~{chunksAcross}×{chunksTall} chunks
          </span>
          <button
            type="button"
            className="sp-map-board__reset"
            onClick={(e) => {
              e.stopPropagation();
              const el = viewportRef.current;
              if (!el) return;
              const rect = el.getBoundingClientRect();
              setCamera(fitCamera(hotspots, rect.width, rect.height));
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            Reset view
          </button>
        </div>
      </div>
    </div>
  );
}
