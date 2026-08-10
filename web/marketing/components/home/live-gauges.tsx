'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { DeskRadialGauge } from '@/components/poc-charts';
import { DESK } from '@/content/baked/desk';

function readVital(label: string, fallback: number) {
  const baked = DESK.live.vitals.find((v) => v.label === label);
  if (!baked) return fallback;
  const n = Number(baked.value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

type LiveVitals = {
  tps: number;
  mspt: number;
  players: number;
  heap: number;
  cpu: number;
  disk: number;
};

/** Product instrument channel inks — one hue per vital. */
const CH = {
  tps: 'var(--wt-ch-tps)',
  mspt: 'var(--wt-ch-mspt)',
  players: 'var(--wt-ch-players)',
  heap: 'var(--wt-ch-heap)',
  cpu: 'var(--wt-ch-cpu)',
  disk: 'var(--wt-ch-disk)',
} as const;

function readBaseVitals(): LiveVitals {
  return {
    tps: readVital('TPS', 19.4),
    mspt: readVital('MSPT', 48),
    players: readVital('Players', 12),
    heap: readVital('Heap', 61),
    cpu: readVital('CPU', 44),
    disk: readVital('Disk', 71),
  };
}

function nextTargets(base: LiveVitals): LiveVitals {
  return {
    tps: clamp(base.tps + (Math.random() - 0.5) * 0.25, 18.8, 19.9),
    mspt: clamp(base.mspt + (Math.random() - 0.5) * 6, 38, 72),
    players:
      Math.random() < 0.75
        ? base.players
        : clamp(base.players + (Math.random() < 0.5 ? -1 : 1), 8, 18),
    heap: clamp(base.heap + (Math.random() - 0.5) * 3, 55, 68),
    cpu: clamp(base.cpu + (Math.random() - 0.5) * 8, 32, 58),
    disk: clamp(base.disk + (Math.random() - 0.5) * 0.4, 69, 73),
  };
}

function stepToward(current: number, target: number, ease: number, jitter: number) {
  return current + (target - current) * ease + (Math.random() - 0.5) * jitter;
}

/** Live vitals — matched horseshoe dials, one channel colour each. */
export function LiveGauges({
  alive,
  large = false,
  fill = false,
}: {
  alive: boolean;
  large?: boolean;
  fill?: boolean;
}) {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(3);
  const base = useRef(readBaseVitals()).current;
  const targetsRef = useRef<LiveVitals>({ ...base });
  const [vitals, setVitals] = useState<LiveVitals>(base);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w >= 720) setCols(6);
      else if (w >= 380) setCols(3);
      else setCols(2);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [large, fill]);

  useEffect(() => {
    if (!alive || reduce) {
      targetsRef.current = { ...base };
      setVitals(base);
      return;
    }

    const id = window.setInterval(() => {
      if (Math.random() < 0.4) {
        targetsRef.current = nextTargets(base);
      }
      const t = targetsRef.current;
      setVitals((v) => ({
        tps: Number(clamp(stepToward(v.tps, t.tps, 0.35, 0.02), 18.6, 20).toFixed(1)),
        mspt: Number(clamp(stepToward(v.mspt, t.mspt, 0.28, 0.4), 36, 86).toFixed(0)),
        players: Math.round(clamp(stepToward(v.players, t.players, 0.4, 0), 8, 18)),
        heap: Math.round(clamp(stepToward(v.heap, t.heap, 0.2, 0.25), 54, 70)),
        cpu: Math.round(clamp(stepToward(v.cpu, t.cpu, 0.26, 0.6), 30, 60)),
        disk: Math.round(clamp(stepToward(v.disk, t.disk, 0.1, 0.05), 68, 74)),
      }));
    }, 1600);

    return () => window.clearInterval(id);
  }, [alive, reduce, base]);

  const colClass = cols >= 6 ? 'grid-cols-6' : cols >= 3 ? 'grid-cols-3' : 'grid-cols-2';
  const gaugeClass =
    large || fill
      ? 'w-full max-w-[11rem] max-h-44'
      : cols <= 2
        ? 'w-full max-w-none max-h-24'
        : 'w-full max-w-[8.5rem] max-h-28';

  return (
    <div
      ref={wrapRef}
      className={`grid w-full place-items-center gap-3 sm:gap-4 ${colClass} ${
        fill ? 'h-full min-h-0 max-w-none content-center' : 'max-w-[1400px]'
      }`}
      aria-label="Live vitals"
    >
      <DeskRadialGauge
        value={vitals.tps}
        max={20}
        label="TPS"
        color={CH.tps}
        className={gaugeClass}
      />
      {/* 50ms = one tick budget — ~48 MSPT reads near-full / hot */}
      <DeskRadialGauge
        value={vitals.mspt}
        max={50}
        label="MSPT"
        color={CH.mspt}
        className={gaugeClass}
      />
      <DeskRadialGauge
        value={vitals.players}
        max={20}
        label="Players"
        color={CH.players}
        className={gaugeClass}
      />
      <DeskRadialGauge
        value={vitals.heap}
        max={100}
        label="Heap"
        unit="%"
        color={CH.heap}
        className={gaugeClass}
      />
      <DeskRadialGauge
        value={vitals.cpu}
        max={100}
        label="CPU"
        unit="%"
        color={CH.cpu}
        className={gaugeClass}
      />
      <DeskRadialGauge
        value={vitals.disk}
        max={100}
        label="Disk"
        unit="%"
        color={CH.disk}
        className={gaugeClass}
      />
    </div>
  );
}
