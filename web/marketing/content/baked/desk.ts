/**
 * Slim static bake for marketing desk cards.
 * Sourced from web/dashboard/data/* (overview-meta, issues-peek, live-envelope, performance-dashboard).
 * Do not invent metrics; sanitize em-dashes for marketing copy.
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
  serverName: 'Example Server',
  identity: [
    { label: 'MC', value: '1.21.1' },
    { label: 'Java', value: '21' },
    { label: 'Host', value: 'Bare-metal' },
  ],
  overview: {
    letter: 'D',
    word: 'Critical',
    tone: 'danger' as const,
    headline: 'Needs attention',
    sub: '38 low-TPS minutes (24h). MSPT p95 134ms. Restart with caution.',
    restart: {
      verdict: 'Caution',
      summary: 'Players online and pregen active. Wait for a quieter window if you can.',
    },
    attention: [
      {
        label: 'Lag spike - MSPT 118ms / TPS 8.4',
        detail: 'World pregen was active. Last command: /chunky continue.',
        severity: 'critical',
      },
      {
        label: 'Killed by the OS out-of-memory killer',
        detail: 'External kill evidence in the last scan window.',
        severity: 'critical',
      },
      {
        label: 'create - 14 log errors (missing item)',
        detail: 'Check Mods for sample lines and next steps.',
        severity: 'warning',
      },
      {
        label: '3 recent pack sync join failures',
        detail: 'Open Session - Join clinic.',
        severity: 'warning',
      },
    ] satisfies DeskAttention[],
    vitals: [
      {
        label: 'TPS',
        value: '8.4',
        channel: 'tps',
        tone: 'danger',
        spark: [0.95, 0.92, 0.88, 0.7, 0.45, 0.35, 0.42, 0.38, 0.4, 0.36],
      },
      {
        label: 'MSPT',
        value: '118',
        unit: 'ms',
        channel: 'mspt',
        tone: 'danger',
        spark: [0.2, 0.25, 0.3, 0.45, 0.7, 0.95, 0.88, 0.9, 0.85, 0.92],
      },
      {
        label: 'Players',
        value: '4',
        channel: 'players',
        tone: 'default',
        spark: [0.2, 0.3, 0.4, 0.5, 0.6, 0.55, 0.5, 0.45, 0.4, 0.4],
      },
      {
        label: 'Heap',
        value: '79',
        unit: '%',
        channel: 'heap',
        tone: 'warn',
        spark: [0.55, 0.58, 0.6, 0.62, 0.65, 0.7, 0.72, 0.74, 0.76, 0.79],
      },
      {
        label: 'CPU',
        value: '68',
        unit: '%',
        channel: 'cpu',
        tone: 'warn',
        spark: [0.3, 0.35, 0.4, 0.55, 0.7, 0.65, 0.6, 0.68, 0.72, 0.68],
      },
    ] satisfies DeskVital[],
  },
  live: {
    caption: 'Live while the ticks land',
    vitals: [
      {
        label: 'TPS',
        value: '19.99',
        channel: 'tps',
        tone: 'ok',
        spark: [0.98, 0.99, 1, 0.99, 0.98, 1, 0.99, 1, 0.98, 1],
      },
      {
        label: 'MSPT',
        value: '4.7',
        unit: 'ms',
        channel: 'mspt',
        tone: 'ok',
        spark: [0.2, 0.22, 0.18, 0.25, 0.3, 0.22, 0.2, 0.24, 0.19, 0.21],
      },
      {
        label: 'Players',
        value: '1',
        channel: 'players',
        tone: 'default',
        spark: [0.1, 0.1, 0.2, 0.2, 0.1, 0.1, 0.1, 0.2, 0.1, 0.1],
      },
      {
        label: 'Heap',
        value: '79',
        unit: '%',
        channel: 'heap',
        tone: 'default',
        spark: [0.7, 0.71, 0.72, 0.73, 0.74, 0.76, 0.77, 0.78, 0.78, 0.79],
      },
      {
        label: 'CPU',
        value: '19',
        unit: '%',
        channel: 'cpu',
        tone: 'ok',
        spark: [0.15, 0.18, 0.2, 0.22, 0.19, 0.17, 0.2, 0.21, 0.18, 0.19],
      },
      {
        label: 'Disk',
        value: '41',
        unit: '%',
        channel: 'disk',
        tone: 'ok',
        spark: [0.38, 0.39, 0.39, 0.4, 0.4, 0.41, 0.41, 0.41, 0.41, 0.41],
      },
    ] satisfies DeskVital[],
    series: [
      4.2, 5.1, 4.8, 6.2, 8.4, 12.1, 18.5, 24.0, 19.2, 11.4, 7.2, 5.5, 4.9, 5.1, 4.7, 4.6, 5.0, 4.8,
      4.7, 4.9, 5.2, 4.6, 4.5, 4.7,
    ],
  },
  issues: {
    bands: [
      {
        key: 'critical',
        label: 'Critical',
        count: 2,
        items: [
          {
            title: 'Lag spike - MSPT 118ms / TPS 8.4',
            narrative:
              'MSPT hit 118ms with TPS 8.4 and 4 players online. World pregen was active.',
            severity: 'critical',
            band: 'critical',
          },
          {
            title: 'External kill - out-of-memory',
            narrative: 'Host OOM killer evidence in the last scan window.',
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
            title: 'create - 14 log errors (missing item)',
            narrative: 'create logged 14 error lines in the scan window.',
            severity: 'warning',
            band: 'warning',
          },
          {
            title: 'ae2 - 6 log errors (recipe compat)',
            narrative: 'Recipe compatibility errors after the pack update.',
            severity: 'warning',
            band: 'warning',
          },
          {
            title: '3 recent pack sync join failures',
            narrative: 'NotchFan42 / BuilderBob / FridayGuest failed client pack sync.',
            severity: 'warning',
            band: 'warning',
          },
        ] satisfies DeskIssue[],
      },
    ],
  },
  crashes: {
    unreviewed: 12,
    needsReview: 11,
    /** Flat list kept for compact desk cuts elsewhere. */
    items: [
      {
        title: 'Create contraption collision',
        file: 'crash-2026-06-22_14-33-07-server.txt',
        when: '49m ago',
        kind: 'Mod',
        confidence: 'Medium',
        summary:
          'Create contraption collision (create) - stop the stuck assembly so the world can load, then update Create if needed.',
        active: true,
        steps: [
          'Stop the stuck assembly first so the world can load again.',
          'Download a matching Create jar and replace the broken one.',
          'Find the contraption controller / bearing that null-pathed.',
          'Mark reviewed when the crash is fixed.',
        ],
      },
      {
        title: 'Create crashed while ticking',
        file: 'crash-2026-06-22_08-11-02-server.txt',
        when: '6h ago',
        kind: 'Mod',
        confidence: 'Medium',
        summary:
          'Create crashed during play (create) - inspect the stack and update Create or matching addons.',
      },
      {
        title: 'Corrupt world data',
        file: 'crash-2026-06-21_20-04-18-server.txt',
        when: '18h ago',
        kind: 'Host',
        confidence: 'High',
        summary:
          'World or chunk NBT data looks corrupt (ZLIB/EOF while loading). Restore the affected region from a backup.',
      },
      {
        title: 'Watchdog timeout - server stopped responding',
        file: 'crash-2026-06-22_11.58.03-server.txt',
        when: '2d ago',
        kind: 'Hang',
        confidence: 'High',
        summary: 'Server tick watchdog fired - the main thread stopped responding.',
      },
      {
        title: 'Out of memory - heap',
        file: 'crash-2026-06-18_08-12-44-server.txt',
        when: 'Unreviewed',
        kind: 'Host',
        confidence: 'High',
        summary: 'Host OOM-killer evidence when the JVM never wrote a crash log.',
      },
    ] satisfies DeskCrash[],
    days: [
      {
        label: 'Today',
        open: 3,
        items: [
          {
            title: 'Create contraption collision',
            file: 'crash-2026-06-22_14-33-07-server.txt',
            when: '49m ago',
            kind: 'Mod',
            confidence: 'Medium',
            summary:
              'Create contraption collision (create) - stop the stuck assembly so the world can load, then update Create if needed.',
            active: true,
            steps: [
              'Stop the stuck assembly first so the world can load again.',
              'Download a matching Create jar and replace the broken one.',
              'Find the contraption controller / bearing that null-pathed.',
              'Mark reviewed when the crash is fixed.',
            ],
          },
          {
            title: 'Create crashed while ticking',
            file: 'crash-2026-06-22_08-11-02-server.txt',
            when: '6h ago',
            kind: 'Mod',
            confidence: 'Medium',
            summary:
              'Create crashed during play (create) - inspect the stack and update Create or matching addons.',
          },
          {
            title: 'Corrupt world data',
            file: 'crash-2026-06-21_20-04-18-server.txt',
            when: '18h ago',
            kind: 'Host',
            confidence: 'High',
            summary:
              'World or chunk NBT data looks corrupt (ZLIB/EOF while loading). Restore the affected region from a backup.',
          },
        ],
      },
      { label: 'Mon, Jul 27', open: 1, items: [] },
      { label: 'Sun, Jul 26', open: 2, items: [] },
    ] satisfies DeskCrashDay[],
  },
  insights: {
    window: '7d',
    stickyLag: 'Sticky lag after players left - MSPT stayed hot for 45 min (peak 72 ms).',
    busy: [
      { label: '20:00-21:00 UTC', avgPlayers: 7.7, avgMspt: 24.9 },
      { label: '21:00-22:00 UTC', avgPlayers: 7.1, avgMspt: 23.6 },
      { label: '19:00-20:00 UTC', avgPlayers: 5.8, avgMspt: 19.1 },
    ] satisfies DeskBusyHour[],
    quiet: [
      { label: '05:00-06:00 UTC', avgPlayers: 0.2, avgMspt: 5.4 },
      { label: '06:00-07:00 UTC', avgPlayers: 0.3, avgMspt: 5.7 },
    ] satisfies DeskBusyHour[],
    /**
     * Evening climb for Entry 1 chart — hourly averages from
     * performance-dashboard-30d hour_of_week (UTC). Peaks at 19–21 match busy[].
     */
    evening: [
      { label: '15:00', avgPlayers: 2.63, avgMspt: 13.11 },
      { label: '16:00', avgPlayers: 3.09, avgMspt: 14.63 },
      { label: '17:00', avgPlayers: 4.51, avgMspt: 16.47 },
      { label: '18:00', avgPlayers: 4.8, avgMspt: 17.1 },
      { label: '19:00', avgPlayers: 5.8, avgMspt: 19.1 },
      { label: '20:00', avgPlayers: 7.7, avgMspt: 24.9 },
      { label: '21:00', avgPlayers: 7.1, avgMspt: 23.6 },
      { label: '22:00', avgPlayers: 5.1, avgMspt: 17.7 },
      { label: '23:00', avgPlayers: 1.8, avgMspt: 10.76 },
    ] satisfies DeskBusyHour[],
    storageHint: 'Disk use rose 6.2% since last check (12.4 GB less free).',
  },
  mods: {
    running: 58,
    rows: [
      { name: 'create', detail: '14 log errors (missing item)', severity: 'warning' as const },
      { name: 'ae2', detail: '6 log errors (recipe compat)', severity: 'warning' as const },
      { name: 'sable', detail: '3 log errors', severity: 'info' as const },
      { name: 'spark', detail: 'Optional lag proof companion', severity: 'info' as const },
    ],
  },
  backups: {
    rows: [
      { name: 'world-daily', status: 'Healthy', detail: 'Last run 3h ago' },
      { name: 'Crafty auto', status: 'In progress', detail: 'Backup job running' },
      { name: 'mods-snapshot', status: 'Stale', detail: 'No run in 9 days' },
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
