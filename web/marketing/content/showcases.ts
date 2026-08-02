/**
 * Home bento highlights. Hero rotates Overview / Mods / Backups cuts.
 * These tiles cover Live / Issues / Crashes / Insights so the page does not repeat.
 * Visuals: content/baked/desk.ts from dashboard fixtures.
 */

import type { DeskSurface } from '@/content/baked/desk';

export type Showcase = {
  id: DeskSurface;
  title: string;
  blurb: string;
  readout: string;
};

export const HOME_SHOWCASES: Showcase[] = [
  {
    id: 'live',
    title: 'Charts while the ticks land',
    blurb:
      'Live charts for TPS, lag, and memory. Calm readouts first. Being right beats looking flashy.',
    readout: 'tps / mspt / heap',
  },
  {
    id: 'crashes',
    title: 'Crash logs in plain English',
    blurb:
      "Crash reports grouped and explained with nearby log context, so you're not grepping latest.log at two in the morning.",
    readout: 'grouped / explained',
  },
  {
    id: 'issues',
    title: 'A fix inbox, not homework',
    blurb:
      'Issues ranks what watching and scanning already found, with a plain next step on each one. No giant audit dump you have to remember to run.',
    readout: 'ranked / actionable',
  },
  {
    id: 'insights',
    title: 'Patterns across the week',
    blurb:
      'Schedule pressure, load, world pressure, storage, and a weekly digest. Handy after the bad minute has already passed.',
    readout: 'schedule / load / storage / digest',
  },
];
