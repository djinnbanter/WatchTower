/**
 * How it works Shift Log meta.
 * Room names live in each entry h2 (railLabel kept for content audit).
 * No em-dashes in user-facing copy.
 */

import type { NightBand, NightLayout } from '@/content/night';

export type HowNightEntryId =
  | 'drop'
  | 'wizard'
  | 'loop'
  | 'disk'
  | 'desk'
  | 'cli'
  | 'close';

export type HowNightEntry = {
  id: HowNightEntryId;
  stamp: string | null;
  railLabel: string;
  temp: 'cool' | 'hot';
  band: NightBand;
  layout: NightLayout;
  sources: string[];
};

export const HOW_NIGHT: HowNightEntry[] = [
  {
    id: 'drop',
    stamp: null,
    railLabel: 'Drop',
    temp: 'cool',
    band: 'ink',
    layout: 'split',
    sources: ['HOW.drop', 'LINKS.modrinth', 'LINKS.wikiInstall', 'PRODUCT.md'],
  },
  {
    id: 'wizard',
    stamp: null,
    railLabel: 'First run',
    temp: 'cool',
    band: 'plate',
    layout: 'split',
    sources: ['HOW.wizard', 'PRODUCT.md'],
  },
  {
    id: 'loop',
    stamp: null,
    railLabel: 'Loop',
    temp: 'hot',
    band: 'ember',
    layout: 'split',
    sources: ['HOW.loop', 'READOUTS', 'DESK.issues.bands'],
  },
  {
    id: 'disk',
    stamp: null,
    railLabel: 'On disk',
    temp: 'cool',
    band: 'plate',
    layout: 'split',
    sources: ['HOW.disk', 'PRODUCT.md'],
  },
  {
    id: 'desk',
    stamp: null,
    railLabel: 'Desk',
    temp: 'cool',
    band: 'ink',
    layout: 'split',
    sources: ['HOW.desk', 'PRODUCT.md'],
  },
  {
    id: 'cli',
    stamp: null,
    railLabel: 'CLI',
    temp: 'cool',
    band: 'plate',
    layout: 'split',
    sources: ['HOW.cli', 'LINKS.wikiDisasterRecovery', 'docs/wiki/Disaster-Recovery.md'],
  },
  {
    id: 'close',
    stamp: null,
    railLabel: 'End of shift',
    temp: 'cool',
    band: 'ink',
    layout: 'close',
    sources: ['FOOTNOTE', 'CLOSE_HEADLINE', 'CLOSE_BODY', 'DEMO_URL', 'LINKS.modrinth'],
  },
];

export function howNightById(id: HowNightEntryId): HowNightEntry {
  const entry = HOW_NIGHT.find((e) => e.id === id);
  if (!entry) throw new Error(`Unknown how-night entry: ${id}`);
  return entry;
}
