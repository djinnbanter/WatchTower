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
    title: 'Charts while ticks land',
    blurb: 'TPS, lag, and memory while the server runs. Numbers first, decoration second.',
    readout: 'tps / mspt / heap',
  },
  {
    id: 'crashes',
    title: 'Crash reports, grouped',
    blurb:
      'Matching crashes stacked together with nearby log context, so you are not grepping latest.log at 2am.',
    readout: 'grouped / explained',
  },
  {
    id: 'issues',
    title: 'A fix inbox',
    blurb:
      'Watching and scanning already found these. Each row has a next step. No daily audit report to remember to run.',
    readout: 'ranked / next step',
  },
  {
    id: 'insights',
    title: 'Week patterns',
    blurb:
      'Busy hours, load, world pressure, storage, and a weekly digest. Useful after the bad minute is over.',
    readout: 'schedule / load / storage / digest',
  },
];
