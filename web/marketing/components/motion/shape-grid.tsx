'use client';

import { useEffect, useRef } from 'react';
import './shape-grid.css';

export type ShapeGridDirection = 'diagonal' | 'up' | 'right' | 'down' | 'left';
export type ShapeGridShape = 'square' | 'hexagon' | 'circle' | 'triangle';

export type ShapeGridProps = {
  direction?: ShapeGridDirection;
  speed?: number;
  borderColor?: string;
  squareSize?: number;
  hoverFillColor?: string;
  shape?: ShapeGridShape;
  hoverTrailAmount?: number;
  /** When true, freezes drift (reduced motion / off-screen). */
  pause?: boolean;
  className?: string;
};

/**
 * React Bits ShapeGrid (canvas), adapted for WatchTower marketing.
 * Theme colors come from props. Pause freezes drift without tearing down the canvas.
 */
export function ShapeGrid({
  direction = 'diagonal',
  speed = 0.45,
  borderColor = '#999',
  squareSize = 40,
  hoverFillColor = '#222',
  shape = 'square',
  hoverTrailAmount = 2,
  pause = false,
  className = '',
}: ShapeGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef(0);
  const gridOffset = useRef({ x: 0, y: 0 });
  const hoveredSquare = useRef<{ x: number; y: number } | null>(null);
  const trailCells = useRef<Array<{ x: number; y: number }>>([]);
  const cellOpacities = useRef(new Map<string, number>());
  const pauseRef = useRef(pause);
  const propsRef = useRef({
    direction,
    speed,
    borderColor,
    squareSize,
    hoverFillColor,
    shape,
    hoverTrailAmount,
  });

  useEffect(() => {
    pauseRef.current = pause;
  }, [pause]);

  useEffect(() => {
    propsRef.current = {
      direction,
      speed,
      borderColor,
      squareSize,
      hoverFillColor,
      shape,
      hoverTrailAmount,
    };
  }, [
    direction,
    speed,
    borderColor,
    squareSize,
    hoverFillColor,
    shape,
    hoverTrailAmount,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, parent.clientWidth);
      const h = Math.max(1, parent.clientHeight);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawHex = (cx: number, cy: number, size: number) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const vx = cx + size * Math.cos(angle);
        const vy = cy + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();
    };

    const drawCircle = (cx: number, cy: number, size: number) => {
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.closePath();
    };

    const drawTriangle = (cx: number, cy: number, size: number, flip: boolean) => {
      ctx.beginPath();
      if (flip) {
        ctx.moveTo(cx, cy + size / 2);
        ctx.lineTo(cx + size / 2, cy - size / 2);
        ctx.lineTo(cx - size / 2, cy - size / 2);
      } else {
        ctx.moveTo(cx, cy - size / 2);
        ctx.lineTo(cx + size / 2, cy + size / 2);
        ctx.lineTo(cx - size / 2, cy + size / 2);
      }
      ctx.closePath();
    };

    const updateCellOpacities = () => {
      const { hoverTrailAmount: trailN } = propsRef.current;
      const targets = new Map<string, number>();

      if (hoveredSquare.current) {
        targets.set(`${hoveredSquare.current.x},${hoveredSquare.current.y}`, 1);
      }

      if (trailN > 0) {
        for (let i = 0; i < trailCells.current.length; i++) {
          const t = trailCells.current[i]!;
          const key = `${t.x},${t.y}`;
          if (!targets.has(key)) {
            targets.set(key, (trailCells.current.length - i) / (trailCells.current.length + 1));
          }
        }
      }

      for (const [key] of targets) {
        if (!cellOpacities.current.has(key)) cellOpacities.current.set(key, 0);
      }

      for (const [key, opacity] of cellOpacities.current) {
        const target = targets.get(key) || 0;
        const next = opacity + (target - opacity) * 0.15;
        if (next < 0.005) cellOpacities.current.delete(key);
        else cellOpacities.current.set(key, next);
      }
    };

    const drawGrid = () => {
      const {
        borderColor: stroke,
        hoverFillColor: fill,
        squareSize: cell,
        shape: kind,
      } = propsRef.current;
      const cssW = parent.clientWidth;
      const cssH = parent.clientHeight;
      ctx.clearRect(0, 0, cssW, cssH);

      const isHex = kind === 'hexagon';
      const isTri = kind === 'triangle';
      const hexHoriz = cell * 1.5;
      const hexVert = cell * Math.sqrt(3);

      if (isHex) {
        const colShift = Math.floor(gridOffset.current.x / hexHoriz);
        const offsetX = ((gridOffset.current.x % hexHoriz) + hexHoriz) % hexHoriz;
        const offsetY = ((gridOffset.current.y % hexVert) + hexVert) % hexVert;
        const cols = Math.ceil(cssW / hexHoriz) + 3;
        const rows = Math.ceil(cssH / hexVert) + 3;

        for (let col = -2; col < cols; col++) {
          for (let row = -2; row < rows; row++) {
            const cx = col * hexHoriz + offsetX;
            const cy =
              row * hexVert + ((col + colShift) % 2 !== 0 ? hexVert / 2 : 0) + offsetY;
            const cellKey = `${col},${row}`;
            const alpha = cellOpacities.current.get(cellKey);
            if (alpha) {
              ctx.globalAlpha = alpha;
              drawHex(cx, cy, cell);
              ctx.fillStyle = fill;
              ctx.fill();
              ctx.globalAlpha = 1;
            }
            drawHex(cx, cy, cell);
            ctx.strokeStyle = stroke;
            ctx.stroke();
          }
        }
      } else if (isTri) {
        const halfW = cell / 2;
        const colShift = Math.floor(gridOffset.current.x / halfW);
        const rowShift = Math.floor(gridOffset.current.y / cell);
        const offsetX = ((gridOffset.current.x % halfW) + halfW) % halfW;
        const offsetY = ((gridOffset.current.y % cell) + cell) % cell;
        const cols = Math.ceil(cssW / halfW) + 4;
        const rows = Math.ceil(cssH / cell) + 4;

        for (let col = -2; col < cols; col++) {
          for (let row = -2; row < rows; row++) {
            const cx = col * halfW + offsetX;
            const cy = row * cell + cell / 2 + offsetY;
            const flip = ((col + colShift + row + rowShift) % 2 + 2) % 2 !== 0;
            const cellKey = `${col},${row}`;
            const alpha = cellOpacities.current.get(cellKey);
            if (alpha) {
              ctx.globalAlpha = alpha;
              drawTriangle(cx, cy, cell, flip);
              ctx.fillStyle = fill;
              ctx.fill();
              ctx.globalAlpha = 1;
            }
            drawTriangle(cx, cy, cell, flip);
            ctx.strokeStyle = stroke;
            ctx.stroke();
          }
        }
      } else if (kind === 'circle') {
        const offsetX = ((gridOffset.current.x % cell) + cell) % cell;
        const offsetY = ((gridOffset.current.y % cell) + cell) % cell;
        const cols = Math.ceil(cssW / cell) + 3;
        const rows = Math.ceil(cssH / cell) + 3;

        for (let col = -2; col < cols; col++) {
          for (let row = -2; row < rows; row++) {
            const cx = col * cell + cell / 2 + offsetX;
            const cy = row * cell + cell / 2 + offsetY;
            const cellKey = `${col},${row}`;
            const alpha = cellOpacities.current.get(cellKey);
            if (alpha) {
              ctx.globalAlpha = alpha;
              drawCircle(cx, cy, cell);
              ctx.fillStyle = fill;
              ctx.fill();
              ctx.globalAlpha = 1;
            }
            drawCircle(cx, cy, cell);
            ctx.strokeStyle = stroke;
            ctx.stroke();
          }
        }
      } else {
        const offsetX = ((gridOffset.current.x % cell) + cell) % cell;
        const offsetY = ((gridOffset.current.y % cell) + cell) % cell;
        const cols = Math.ceil(cssW / cell) + 3;
        const rows = Math.ceil(cssH / cell) + 3;

        for (let col = -2; col < cols; col++) {
          for (let row = -2; row < rows; row++) {
            const sx = col * cell + offsetX;
            const sy = row * cell + offsetY;
            const cellKey = `${col},${row}`;
            const alpha = cellOpacities.current.get(cellKey);
            if (alpha) {
              ctx.globalAlpha = alpha;
              ctx.fillStyle = fill;
              ctx.fillRect(sx, sy, cell, cell);
              ctx.globalAlpha = 1;
            }
            ctx.strokeStyle = stroke;
            ctx.strokeRect(sx, sy, cell, cell);
          }
        }
      }
    };

    const updateAnimation = () => {
      requestRef.current = requestAnimationFrame(updateAnimation);
      const {
        direction: dir,
        speed: spd,
        squareSize: cell,
        shape: kind,
      } = propsRef.current;

      if (!pauseRef.current) {
        const effectiveSpeed = Math.max(spd, 0.1);
        const isHex = kind === 'hexagon';
        const isTri = kind === 'triangle';
        const hexHoriz = cell * 1.5;
        const hexVert = cell * Math.sqrt(3);
        const wrapX = isHex ? hexHoriz * 2 : cell;
        const wrapY = isHex ? hexVert : isTri ? cell * 2 : cell;

        switch (dir) {
          case 'right':
            gridOffset.current.x = (gridOffset.current.x - effectiveSpeed + wrapX) % wrapX;
            break;
          case 'left':
            gridOffset.current.x = (gridOffset.current.x + effectiveSpeed + wrapX) % wrapX;
            break;
          case 'up':
            gridOffset.current.y = (gridOffset.current.y + effectiveSpeed + wrapY) % wrapY;
            break;
          case 'down':
            gridOffset.current.y = (gridOffset.current.y - effectiveSpeed + wrapY) % wrapY;
            break;
          case 'diagonal':
            gridOffset.current.x = (gridOffset.current.x - effectiveSpeed + wrapX) % wrapX;
            gridOffset.current.y = (gridOffset.current.y - effectiveSpeed + wrapY) % wrapY;
            break;
          default:
            break;
        }
      }

      updateCellOpacities();
      drawGrid();
    };

    const pushTrail = () => {
      const { hoverTrailAmount: trailN } = propsRef.current;
      if (hoveredSquare.current && trailN > 0) {
        trailCells.current.unshift({ ...hoveredSquare.current });
        if (trailCells.current.length > trailN) trailCells.current.length = trailN;
      }
    };

    // Window tracking so trails keep working under z-[1] copy / CTAs
    // (ambient wrappers are pointer-events-none).
    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        if (hoveredSquare.current) {
          pushTrail();
          hoveredSquare.current = null;
        }
        return;
      }

      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const { squareSize: cell, shape: kind } = propsRef.current;
      const isHex = kind === 'hexagon';
      const isTri = kind === 'triangle';
      const hexHoriz = cell * 1.5;
      const hexVert = cell * Math.sqrt(3);

      let col = 0;
      let row = 0;

      if (isHex) {
        const colShift = Math.floor(gridOffset.current.x / hexHoriz);
        const offsetX = ((gridOffset.current.x % hexHoriz) + hexHoriz) % hexHoriz;
        const offsetY = ((gridOffset.current.y % hexVert) + hexVert) % hexVert;
        const adjustedX = mouseX - offsetX;
        const adjustedY = mouseY - offsetY;
        col = Math.round(adjustedX / hexHoriz);
        const rowOffset = (col + colShift) % 2 !== 0 ? hexVert / 2 : 0;
        row = Math.round((adjustedY - rowOffset) / hexVert);
      } else if (isTri) {
        const halfW = cell / 2;
        const offsetX = ((gridOffset.current.x % halfW) + halfW) % halfW;
        const offsetY = ((gridOffset.current.y % cell) + cell) % cell;
        col = Math.round((mouseX - offsetX) / halfW);
        row = Math.floor((mouseY - offsetY) / cell);
      } else if (kind === 'circle') {
        const offsetX = ((gridOffset.current.x % cell) + cell) % cell;
        const offsetY = ((gridOffset.current.y % cell) + cell) % cell;
        col = Math.round((mouseX - offsetX) / cell);
        row = Math.round((mouseY - offsetY) / cell);
      } else {
        const offsetX = ((gridOffset.current.x % cell) + cell) % cell;
        const offsetY = ((gridOffset.current.y % cell) + cell) % cell;
        col = Math.floor((mouseX - offsetX) / cell);
        row = Math.floor((mouseY - offsetY) / cell);
      }

      if (
        !hoveredSquare.current ||
        hoveredSquare.current.x !== col ||
        hoveredSquare.current.y !== row
      ) {
        pushTrail();
        hoveredSquare.current = { x: col, y: row };
      }
    };

    const handlePointerLeaveWindow = () => {
      pushTrail();
      hoveredSquare.current = null;
    };

    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(parent);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeaveWindow);
    requestRef.current = requestAnimationFrame(updateAnimation);

    return () => {
      cancelAnimationFrame(requestRef.current);
      ro.disconnect();
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeaveWindow);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`shapegrid-canvas pointer-events-none ${className}`.trim()}
    />
  );
}
