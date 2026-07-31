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

/**
 * 2x3 Live dial grid from DESK.live.vitals (TPS, MSPT, Players, Heap, CPU, Disk).
 * Dial size tracks the column width so the grid fills the room.
 */
function LiveGauges({ alive }: { alive: boolean }) {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dial, setDial] = useState(170);
  const baseTps = readVital('TPS', 19.99);
  const baseMspt = readVital('MSPT', 4.7);
  const players = readVital('Players', 1);
  const heap = readVital('Heap', 79);
  const cpu = readVital('CPU', 19);
  const disk = readVital('Disk', 41);
  const [tps, setTps] = useState(baseTps);
  const [mspt, setMspt] = useState(baseMspt);

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
      setTps(baseTps);
      setMspt(baseMspt);
      return;
    }
    const id = window.setInterval(() => {
      setTps(Number((baseTps + (Math.random() - 0.5) * 0.06).toFixed(2)));
      setMspt(Number((baseMspt + (Math.random() - 0.5) * 0.35).toFixed(1)));
    }, 2200);
    return () => window.clearInterval(id);
  }, [alive, reduce, baseTps, baseMspt]);

  return (
    <div
      ref={wrapRef}
      className="grid w-full grid-cols-2 gap-x-2 gap-y-1 sm:gap-x-3 sm:gap-y-1.5"
      aria-label="Live vitals"
    >
      <div className="flex justify-center">
        <DeskDial label="TPS" value={tps} max={20} tone="tps" size={dial} decimals={1} />
      </div>
      <div className="flex justify-center">
        <DeskDial label="MSPT" value={mspt} max={50} suffix="ms" tone="mspt" size={dial} decimals={1} />
      </div>
      <div className="flex justify-center">
        <DeskDial label="Players" value={players} max={20} tone="players" size={dial} decimals={0} />
      </div>
      <div className="flex justify-center">
        <DeskDial label="Heap" value={heap} max={100} suffix="%" tone="heap" size={dial} decimals={0} />
      </div>
      <div className="flex justify-center">
        <DeskDial label="CPU" value={cpu} max={100} suffix="%" tone="cpu" size={dial} decimals={0} />
      </div>
      <div className="flex justify-center">
        <DeskDial label="Disk" value={disk} max={100} suffix="%" tone="disk" size={dial} decimals={0} />
      </div>
    </div>
  );
}

export function LiveEntry() {
  const { alive } = useLivePulse();

  return (
    <ShiftEntry {...meta}>
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-8 xl:gap-10">
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
