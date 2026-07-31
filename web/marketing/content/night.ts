/**
 * Desk tour: eight entries in order.
 * Surface names live in each entry h2 (railLabel kept for content audit / meta).
 * Left columns teach features; fixtures stay on desk mocks.
 * Every fixture fact must trace to content/baked/desk.ts (sources field).
 * No weekday claims. No em-dashes in user-facing copy.
 */

export type NightEntryId =
  | 'welcome'
  | 'live'
  | 'issues'
  | 'crashes'
  | 'overview'
  | 'insights'
  | 'orders'
  | 'close';

export type NightLayout = 'split' | 'bleed' | 'ledger' | 'close';

/** Full-bleed tonal band so each entry reads as its own room. */
export type NightBand = 'ink' | 'plate' | 'ember';

export type NightEntry = {
  id: NightEntryId;
  /** Clock stamp for fixture binding, or null. */
  stamp: string | null;
  /** Surface name (also used as the entry h2). */
  railLabel: string;
  temp: 'cool' | 'hot';
  band: NightBand;
  layout: NightLayout;
  /** DESK / product.ts paths this entry is allowed to cite. */
  sources: string[];
};

export const NIGHT: NightEntry[] = [
  {
    id: 'welcome',
    stamp: null,
    railLabel: 'Welcome',
    temp: 'cool',
    band: 'ink',
    layout: 'split',
    sources: ['TAGLINE', 'HERO_OVERVIEW', 'HERO_CONTEXT', 'PRODUCT.md'],
  },
  {
    id: 'live',
    stamp: null,
    railLabel: 'Live',
    temp: 'cool',
    band: 'plate',
    layout: 'split',
    sources: ['TOUR.live', 'DESK.live.vitals'],
  },
  {
    id: 'issues',
    stamp: null,
    railLabel: 'Issues',
    temp: 'hot',
    band: 'ember',
    layout: 'split',
    sources: ['TOUR.issues', 'DESK.issues.bands'],
  },
  {
    id: 'crashes',
    stamp: null,
    railLabel: 'Crashes',
    temp: 'hot',
    band: 'ember',
    layout: 'split',
    sources: ['TOUR.crashes', 'DESK.crashes'],
  },
  {
    id: 'overview',
    stamp: null,
    railLabel: 'Overview',
    temp: 'cool',
    band: 'plate',
    layout: 'split',
    sources: ['TOUR.overview', 'DESK.overview'],
  },
  {
    id: 'insights',
    stamp: null,
    railLabel: 'Insights',
    temp: 'cool',
    band: 'ink',
    layout: 'split',
    sources: ['TOUR.insights', 'DESK.insights.*', 'DESK.backups.rows'],
  },
  {
    id: 'orders',
    stamp: null,
    railLabel: 'Standing orders',
    temp: 'cool',
    band: 'plate',
    layout: 'ledger',
    sources: ['PROMISES', 'NOT_OUR_JOB'],
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
] as const;

export function nightById(id: NightEntryId): NightEntry {
  const entry = NIGHT.find((e) => e.id === id);
  if (!entry) throw new Error(`Unknown night entry: ${id}`);
  return entry;
}
