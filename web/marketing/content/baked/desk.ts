/**
 * Slim static bake for marketing desk cards.
 * Aligned with dashboard-poc create-smp fixtures (Industrial Ops Print).
 * Do not invent metrics; keep numbers coherent across home + features peeks.
 */

export type DeskVital = {
  label: string;
  value: string;
  unit?: string;
  channel: 'tps' | 'mspt' | 'players' | 'heap' | 'cpu' | 'disk';
  tone: 'ok' | 'warn' | 'danger' | 'default';
  /** Tiny spark samples 0-1 for SVG path. */
  spark: number[];
};

export type DeskAttention = {
  label: string;
  detail?: string;
  severity: 'critical' | 'warning' | 'info';
};

export type DeskIssue = {
  title: string;
  narrative: string;
  severity: 'critical' | 'warning' | 'info';
  band: string;
};

export type DeskCrash = {
  title: string;
  file: string;
  when: string;
  /** Kind chip on the real Crashes inbox (Mod / Hang / Host). */
  kind: 'Mod' | 'Hang' | 'Host';
  confidence: 'High' | 'Medium' | 'Low';
  /** One-line plain-English lead under the title. */
  summary: string;
  /** Selected group shows the Fix panel on the marketing desk mock. */
  active?: boolean;
  /** Short Fix steps for the active group only. */
  steps?: readonly string[];
};

export type DeskCrashDay = {
  label: string;
  open: number;
  /** When empty, day renders collapsed (label + open badge only). */
  items: readonly DeskCrash[];
};

export type DeskBusyHour = {
  label: string;
  avgPlayers: number;
  avgMspt: number;
};

export const DESK = {
  serverName: 'create-smp',
  identity: [
    { label: 'MC', value: '1.21.1' },
    { label: 'Java', value: '21' },
    { label: 'Loader', value: 'NeoForge 21.1.172' },
    { label: 'Host', value: 'Bare-metal · Win' },
  ],
  overview: {
    letter: 'B',
    word: 'Needs attention',
    tone: 'warn' as const,
    headline: 'Playable, but the desk has open work.',
    sub: '12 low-TPS minutes (24h). MSPT p95 86ms. Disk runway under 14 days.',
    restart: {
      verdict: 'Caution',
      summary:
        '12 players online and Chunky pregen still running. Prefer the Tue 05:00 window unless you need it now.',
    },
    attention: [
      {
        label: 'Disk runway under 14 days',
        detail: 'world/ + backups growing ~2.1 GB/day. Free space lasts ~11 days.',
        severity: 'critical',
      },
      {
        label: 'MSPT p95 86ms with evening player load',
        detail: 'Entity spike near spawn · Chunky paused mid-run.',
        severity: 'warning',
      },
      {
        label: 'create - 14 log errors (missing item)',
        detail: 'Check Mods for sample lines and next steps.',
        severity: 'warning',
      },
      {
        label: '2 pack sync join failures',
        detail: 'Open Session - Join clinic.',
        severity: 'warning',
      },
    ] satisfies DeskAttention[],
    vitals: [
      {
        label: 'TPS',
        value: '19.4',
        channel: 'tps',
        tone: 'ok',
        spark: [0.98, 0.97, 0.99, 0.94, 0.88, 0.91, 0.96, 0.97, 0.95, 0.97],
      },
      {
        label: 'MSPT',
        value: '48',
        unit: 'ms',
        channel: 'mspt',
        tone: 'warn',
        spark: [0.35, 0.4, 0.38, 0.55, 0.72, 0.68, 0.5, 0.45, 0.52, 0.48],
      },
      {
        label: 'Players',
        value: '12',
        unit: '/ 40',
        channel: 'players',
        tone: 'default',
        spark: [0.2, 0.25, 0.35, 0.4, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3],
      },
      {
        label: 'Heap',
        value: '61',
        unit: '%',
        channel: 'heap',
        tone: 'default',
        spark: [0.5, 0.52, 0.54, 0.55, 0.58, 0.6, 0.59, 0.61, 0.6, 0.61],
      },
      {
        label: 'CPU',
        value: '44',
        unit: '%',
        channel: 'cpu',
        tone: 'default',
        spark: [0.25, 0.3, 0.35, 0.5, 0.55, 0.48, 0.42, 0.4, 0.45, 0.44],
      },
      {
        label: 'Disk',
        value: '71',
        unit: '%',
        channel: 'disk',
        tone: 'warn',
        spark: [0.62, 0.63, 0.65, 0.66, 0.67, 0.68, 0.69, 0.7, 0.7, 0.71],
      },
    ] satisfies DeskVital[],
  },
  live: {
    caption: 'Live while the ticks land',
    vitals: [
      {
        label: 'TPS',
        value: '19.4',
        channel: 'tps',
        tone: 'ok',
        spark: [0.98, 0.97, 0.99, 0.94, 0.88, 0.91, 0.96, 0.97, 0.95, 0.97],
      },
      {
        label: 'MSPT',
        value: '48',
        unit: 'ms',
        channel: 'mspt',
        tone: 'warn',
        spark: [0.35, 0.4, 0.38, 0.55, 0.72, 0.68, 0.5, 0.45, 0.52, 0.48],
      },
      {
        label: 'Players',
        value: '12',
        unit: '/ 40',
        channel: 'players',
        tone: 'default',
        spark: [0.2, 0.25, 0.35, 0.4, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3],
      },
      {
        label: 'Heap',
        value: '61',
        unit: '%',
        channel: 'heap',
        tone: 'default',
        spark: [0.5, 0.52, 0.54, 0.55, 0.58, 0.6, 0.59, 0.61, 0.6, 0.61],
      },
      {
        label: 'CPU',
        value: '44',
        unit: '%',
        channel: 'cpu',
        tone: 'default',
        spark: [0.25, 0.3, 0.35, 0.5, 0.55, 0.48, 0.42, 0.4, 0.45, 0.44],
      },
      {
        label: 'Disk',
        value: '71',
        unit: '%',
        channel: 'disk',
        tone: 'warn',
        spark: [0.62, 0.63, 0.65, 0.66, 0.67, 0.68, 0.69, 0.7, 0.7, 0.71],
      },
    ] satisfies DeskVital[],
    /** MSPT sample window - evening climb, still playable. */
    series: [
      32, 34, 36, 38, 41, 44, 48, 52, 58, 64, 72, 86, 78, 68, 55, 50, 48, 46, 48, 49, 47, 48, 46, 48,
    ],
  },
  issues: {
    bands: [
      {
        key: 'critical',
        label: 'Critical',
        count: 1,
        items: [
          {
            title: 'Disk runway under 14 days',
            narrative:
              'world/ + backups growing ~2.1 GB/day. At this rate free space lasts ~11 days.',
            severity: 'critical',
            band: 'critical',
          },
        ] satisfies DeskIssue[],
      },
      {
        key: 'warning',
        label: 'Warning',
        count: 3,
        items: [
          {
            title: 'Entity spike near spawn',
            narrative:
              'MSPT climbed past 50 for 8 minutes with 12 players online. Chunky was paused mid-run.',
            severity: 'warning',
            band: 'warning',
          },
          {
            title: 'create - 14 log errors (missing item)',
            narrative: 'Repeated missing item id in create recipes since last pack bump.',
            severity: 'warning',
            band: 'warning',
          },
          {
            title: '2 pack sync join failures',
            narrative: 'Clients rejected: missing Create 6.0.4 on two joins this evening.',
            severity: 'warning',
            band: 'warning',
          },
        ] satisfies DeskIssue[],
      },
      {
        key: 'info',
        label: 'Info',
        count: 1,
        items: [
          {
            title: 'Mod update hint: Create',
            narrative:
              'Installed 6.0.4 · Modrinth shows 6.0.6 (lookup only - WatchTower does not download jars).',
            severity: 'info',
            band: 'info',
          },
        ] satisfies DeskIssue[],
      },
    ],
  },
  crashes: {
    unreviewed: 1,
    needsReview: 1,
    /** Flat list kept for compact desk cuts elsewhere. */
    items: [
      {
        title: 'Create + Flywheel mixin conflict',
        file: 'crash-2026-08-07_21-14-02-server.txt',
        when: '3d ago',
        kind: 'Mod',
        confidence: 'High',
        summary:
          'Mixin conflict between Create and Flywheel - quiet for 3 days after review.',
        active: true,
        steps: [
          'Confirm Create and Flywheel versions still match the pack.',
          'Leave reviewed unless a new fingerprint appears after a Create bump.',
          'Mark reviewed when the stack stays quiet.',
        ],
      },
      {
        title: 'Watchdog timeout - server stopped responding',
        file: 'crash-2026-08-05_11.58.03-server.txt',
        when: '5d ago',
        kind: 'Hang',
        confidence: 'High',
        summary: 'Server tick watchdog fired during evening peak - reviewed.',
      },
      {
        title: 'Out of memory - heap',
        file: 'crash-2026-07-28_08-12-44-server.txt',
        when: '2w ago',
        kind: 'Host',
        confidence: 'High',
        summary: 'Host OOM-killer evidence when the JVM never wrote a crash log.',
      },
    ] satisfies DeskCrash[],
    days: [
      {
        label: 'Today',
        open: 0,
        items: [],
      },
      {
        label: '3 days ago',
        open: 1,
        items: [
          {
            title: 'Create + Flywheel mixin conflict',
            file: 'crash-2026-08-07_21-14-02-server.txt',
            when: '3d ago',
            kind: 'Mod',
            confidence: 'High',
            summary:
              'Mixin conflict between Create and Flywheel - quiet for 3 days after review.',
            active: true,
            steps: [
              'Confirm Create and Flywheel versions still match the pack.',
              'Leave reviewed unless a new fingerprint appears after a Create bump.',
              'Mark reviewed when the stack stays quiet.',
            ],
          },
        ],
      },
      { label: 'Earlier', open: 2, items: [] },
    ] satisfies DeskCrashDay[],
  },
  insights: {
    window: '7d',
    stickyLag:
      'Sticky lag after players left - MSPT stayed elevated 45 min after peak (p95 86ms).',
    busy: [
      { label: '20:00-21:00 UTC', avgPlayers: 16.2, avgMspt: 62.4 },
      { label: '21:00-22:00 UTC', avgPlayers: 14.8, avgMspt: 58.1 },
      { label: '19:00-20:00 UTC', avgPlayers: 12.1, avgMspt: 48.2 },
    ] satisfies DeskBusyHour[],
    quiet: [
      { label: '05:00-06:00 UTC', avgPlayers: 0.4, avgMspt: 18.2 },
      { label: '06:00-07:00 UTC', avgPlayers: 0.6, avgMspt: 19.1 },
    ] satisfies DeskBusyHour[],
    evening: [
      { label: '15:00', avgPlayers: 4.2, avgMspt: 28.1 },
      { label: '16:00', avgPlayers: 5.8, avgMspt: 32.4 },
      { label: '17:00', avgPlayers: 7.4, avgMspt: 38.2 },
      { label: '18:00', avgPlayers: 9.1, avgMspt: 42.6 },
      { label: '19:00', avgPlayers: 12.1, avgMspt: 48.2 },
      { label: '20:00', avgPlayers: 16.2, avgMspt: 62.4 },
      { label: '21:00', avgPlayers: 14.8, avgMspt: 58.1 },
      { label: '22:00', avgPlayers: 10.2, avgMspt: 44.8 },
      { label: '23:00', avgPlayers: 6.1, avgMspt: 34.2 },
    ] satisfies DeskBusyHour[],
    storageHint: 'Disk 71% · 412G free · runway ~11d at ~2.1 GB/day growth.',
    storage: {
      daysLeft: 11,
      usedPct: 71,
      fillPerDayPct: 1.9,
      freeGb: 412,
      totalGb: 1420,
      dims: [
        { label: 'Overworld', pct: 58, gb: '612 GB' },
        { label: 'Nether', pct: 22, gb: '148 GB' },
        { label: 'End', pct: 12, gb: '86 GB' },
        { label: 'Backups', pct: 8, gb: '312 GB' },
      ],
      trend: [58, 60, 61, 63, 64, 66, 67, 68, 69, 70, 70, 71],
    },
  },
  mods: {
    running: 186,
    rows: [
      { name: 'create', detail: '14 log errors (missing item)', severity: 'warning' as const },
      { name: 'create', detail: 'Modrinth hint 6.0.6 (installed 6.0.4)', severity: 'info' as const },
      { name: 'ae2', detail: '6 log errors (recipe compat)', severity: 'info' as const },
      { name: 'spark', detail: 'Companion · connected', severity: 'info' as const },
    ],
  },
  backups: {
    rows: [
      {
        name: 'world-2026-08-09-1842.zip',
        status: 'Fresh',
        detail: '6h ago · 51.2 GB · verified',
      },
      {
        name: 'world-2026-08-08-0600.zip',
        status: 'Aging',
        detail: '42h ago · 50.8 GB',
      },
      {
        name: 'Offsite / NAS',
        status: 'Missing',
        detail: 'External path not configured',
      },
    ],
  },
} as const;

export type DeskSurface =
  | 'overview'
  | 'live'
  | 'issues'
  | 'crashes'
  | 'insights'
  | 'mods'
  | 'backups';
