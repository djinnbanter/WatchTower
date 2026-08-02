/**
 * Features bento layout — one interlocking grid (hero cells, then secondary spans).
 * Copy stays in FEATURE_CAPABILITIES; this only picks ids + composition.
 */

export type BentoSpan =
  | 'tall-left'
  | 'mid-top'
  | 'tall-right'
  | 'mid-strip'
  | 'wide-bottom'
  | 'stamp'
  | 'rules';

export type BentoMedia = 'stack' | 'overlay' | 'strip' | 'chart' | 'side';

export type FeatureBentoCell = {
  id: string;
  span: BentoSpan;
  media: BentoMedia;
};

/** Seven showcase cells that tessellate on desktop. */
export const FEATURE_BENTO_SHOWCASE: FeatureBentoCell[] = [
  { id: 'health-grade', span: 'tall-left', media: 'overlay' },
  { id: 'fix-inbox', span: 'mid-top', media: 'overlay' },
  { id: 'world-pressure', span: 'tall-right', media: 'overlay' },
  { id: 'join-clinic', span: 'mid-strip', media: 'strip' },
  { id: 'live-vitals', span: 'wide-bottom', media: 'chart' },
  { id: 'support-pack', span: 'stamp', media: 'side' },
  { id: 'spark', span: 'rules', media: 'overlay' },
];

export const FEATURE_BENTO_SHOWCASE_IDS = new Set(FEATURE_BENTO_SHOWCASE.map((c) => c.id));

export type MoreSpan = 'one' | 'two' | 'half';

export type FeatureBentoMoreCell = {
  id: string;
  media: BentoMedia;
  span: MoreSpan;
};

/**
 * Ordered so every desktop row fills all six columns.
 * `half` = 3/6 (equal pair), `one` = 2/6, `two` = 4/6.
 */
export const FEATURE_BENTO_MORE: FeatureBentoMoreCell[] = [
  { id: 'gc-ram', media: 'chart', span: 'half' },
  { id: 'crash-fingerprints', media: 'overlay', span: 'half' },

  { id: 'mods-modrinth', media: 'overlay', span: 'two' },
  { id: 'jar-drift', media: 'overlay', span: 'one' },

  { id: 'external-kill', media: 'overlay', span: 'one' },
  { id: 'silent-fails', media: 'overlay', span: 'one' },
  { id: 'logs', media: 'overlay', span: 'one' },

  { id: 'schedule-load', media: 'chart', span: 'one' },
  { id: 'storage-runway', media: 'chart', span: 'two' },

  { id: 'activity', media: 'overlay', span: 'two' },
  { id: 'weekly-digest', media: 'overlay', span: 'one' },

  { id: 'config-audit', media: 'overlay', span: 'one' },
  { id: 'backups', media: 'overlay', span: 'two' },

  { id: 'startup', media: 'overlay', span: 'one' },
  { id: 'sources', media: 'overlay', span: 'one' },
  { id: 'accounts', media: 'overlay', span: 'one' },

  { id: 'auth', media: 'overlay', span: 'one' },
  { id: 'help', media: 'overlay', span: 'one' },
  { id: 'cli-dr', media: 'overlay', span: 'one' },
];
