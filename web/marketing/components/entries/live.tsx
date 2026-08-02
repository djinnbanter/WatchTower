'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { DeskDial } from '@/components/desk/desk-dial';
import '@/components/desk/desk.css';
import { InstrumentPlate } from '@/components/instrument-plate';
import { MarginNote } from '@/components/type/margin-note';
import { TourBrings } from '@/components/type/tour-brings';
import { DeskSpotlight } from '@/components/motion/desk-spotlight';
import { Reveal } from '@/components/reveal';
import { ShiftEntry } from '@/components/shift-log/entry';
import { useLivePulse } from '@/components/shift-log/live-pulse-context';
import { DESK } from '@/content/baked/desk';
import { nightById } from '@/content/night';
import { TOUR } from '@/content/product';

const meta = nightById('live');

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

function readBaseVitals(): LiveVitals {
  return {
    tps: readVital('TPS', 19.99),
    mspt: readVital('MSPT', 4.7),
    players: readVital('Players', 1),
    heap: readVital('Heap', 79),
    cpu: readVital('CPU', 19),
    disk: readVital('Disk', 41),
  };
}

/** Slow healthy-band targets - small drifts, not chaos. */
function nextTargets(base: LiveVitals): LiveVitals {
  return {
    tps: clamp(base.tps + (Math.random() - 0.5) * 0.12, 19.7, 20),
    mspt: clamp(base.mspt + (Math.random() - 0.5) * 2.2, 3.2, 8.5),
    players: Math.random() < 0.82 ? base.players : clamp(base.players + (Math.random() < 0.5 ? -1 : 1), 0, 3),
    heap: clamp(base.heap + (Math.random() - 0.5) * 6, 72, 88),
    cpu: clamp(base.cpu + (Math.random() - 0.5) * 14, 10, 38),
    disk: clamp(base.disk + (Math.random() - 0.5) * 1.2, 39, 44),
  };
}

function stepToward(current: number, target: number, ease: number, jitter: number) {
  return current + (target - current) * ease + (Math.random() - 0.5) * jitter;
}

/**
 * 2x3 Live dial grid from DESK.live.vitals (TPS, MSPT, Players, Heap, CPU, Disk).
 * Dial size tracks the column width so the grid fills the room.
 */
function LiveGauges({ alive }: { alive: boolean }) {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dial, setDial] = useState(170);
  const base = useRef(readBaseVitals()).current;
  const targetsRef = useRef<LiveVitals>({ ...base });
  const [vitals, setVitals] = useState<LiveVitals>(base);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const next = Math.round(Math.min(200, Math.max(140, (w - 12) / 2 - 10)));
      setDial(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
        tps: Number(clamp(stepToward(v.tps, t.tps, 0.35, 0.015), 19.65, 20).toFixed(2)),
        mspt: Number(clamp(stepToward(v.mspt, t.mspt, 0.3, 0.12), 3, 10).toFixed(1)),
        players: Math.round(clamp(stepToward(v.players, t.players, 0.45, 0), 0, 3)),
        heap: Math.round(clamp(stepToward(v.heap, t.heap, 0.22, 0.35), 70, 90)),
        cpu: Math.round(clamp(stepToward(v.cpu, t.cpu, 0.28, 0.8), 8, 42)),
        disk: Math.round(clamp(stepToward(v.disk, t.disk, 0.12, 0.08), 38, 45)),
      }));
    }, 1600);

    return () => window.clearInterval(id);
  }, [alive, reduce, base]);

  return (
    <div
      ref={wrapRef}
      className="grid w-full grid-cols-2 gap-x-2 gap-y-1 sm:gap-x-3 sm:gap-y-1.5"
      aria-label="Live vitals"
    >
      <div className="flex justify-center">
        <DeskDial label="TPS" value={vitals.tps} max={20} tone="tps" size={dial} decimals={1} />
      </div>
      <div className="flex justify-center">
        <DeskDial label="MSPT" value={vitals.mspt} max={50} suffix="ms" tone="mspt" size={dial} decimals={1} />
      </div>
      <div className="flex justify-center">
        <DeskDial label="Players" value={vitals.players} max={20} tone="players" size={dial} decimals={0} />
      </div>
      <div className="flex justify-center">
        <DeskDial label="Heap" value={vitals.heap} max={100} suffix="%" tone="heap" size={dial} decimals={0} />
      </div>
      <div className="flex justify-center">
        <DeskDial label="CPU" value={vitals.cpu} max={100} suffix="%" tone="cpu" size={dial} decimals={0} />
      </div>
      <div className="flex justify-center">
        <DeskDial label="Disk" value={vitals.disk} max={100} suffix="%" tone="disk" size={dial} decimals={0} />
      </div>
    </div>
  );
}

export function LiveEntry() {
  const { alive } = useLivePulse();

  return (
    <ShiftEntry {...meta}>
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-8 xl:gap-10">
        <div className="min-w-0">
          <Reveal>
            <h2 className="wt-entry text-[color:var(--wt-text)]">Live</h2>
            <p className="mt-4 max-w-[48ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
              {TOUR.live.capability}
            </p>
          </Reveal>
          <TourBrings items={TOUR.live.brings} />
          <MarginNote className="mt-5">{TOUR.live.note}</MarginNote>
        </div>

        <div className="min-w-0 lg:sticky lg:top-24">
          <DeskSpotlight tone="accent">
            <InstrumentPlate>
              <div className="desk-surface p-3 sm:p-4">
                <LiveGauges alive={alive} />
              </div>
            </InstrumentPlate>
          </DeskSpotlight>
          <MarginNote className="mt-4 text-center">Live vitals · healthy band</MarginNote>
        </div>
      </div>
    </ShiftEntry>
  );
}
