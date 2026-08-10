export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'default';
export type IssueSeverity = 'critical' | 'warning' | 'info';

export type Vital = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  hint: string;
  tone: Tone;
  /** 0–1 samples for spark bars */
  spark: number[];
};

export type IssueRow = {
  id: string;
  title: string;
  detail: string;
  severity: IssueSeverity;
  band: string;
  age: string;
  next: string;
  /** Plain-English fix steps for the case file */
  steps: string[];
  /** Short evidence lines (log / metric crumbs) */
  evidence: string[];
  firstSeen: string;
  reviewed?: boolean;
};

export type PlayerRow = {
  name: string;
  ping: number;
  dim: string;
};

export type HourLoad = {
  hour: string;
  load: number; // 0–1
};

export const OVERVIEW = {
  stamp: 'Overview · watching',
  serverName: 'create-smp',
  host: 'create-smp · NeoForge 1.21.1',
  endpoint: 'localhost:8787',
  identity: [
    { label: 'MC', value: '1.21.1' },
    { label: 'Java', value: '21' },
    { label: 'Loader', value: 'NeoForge 21.1.172' },
    { label: 'Host', value: 'Bare-metal · Win' },
  ],
  grade: 'B',
  gradeLabel: 'Needs attention',
  gradeTone: 'warn' as Tone,
  headline: 'Playable, but the desk has open work.',
  sub: '12 low-TPS minutes (24h). MSPT p95 86ms. 2 warnings still open.',
  gradeReasons: [
    'Disk runway under 14 days (critical)',
    'MSPT p95 86ms with evening player load',
  ],
  advice: 'Restart window Tue 05:00 - quietest slot this week.',
  watching: true,
  uptime: '2d 14h 22m',
  lastScan: '38s ago',
  modsLoaded: 186,
  nestedJars: 24,
  spark: 'companion · connected',
  sessionAdmin: 'djinn',
  role: 'Owner',
};

export const RESTART = {
  verdict: 'Caution' as const,
  tone: 'warn' as Tone,
  summary:
    '12 players online and Chunky pregen still running. Prefer the Tue 05:00 window unless you need it now.',
  reasons: [
    { label: 'Players online', detail: '12 / 40 connected' },
    { label: 'Pregen active', detail: '/chunky continue (overworld)' },
    { label: 'Quiet slot', detail: 'Tue 05:00-06:00' },
  ],
};

/** Live “right now” signals — current desk state, not the Fix queue. */
export type RightNowSignal = {
  id: string;
  label: string;
  detail: string;
  severity: IssueSeverity;
  /** Nav target when the page exists in the POC */
  tab: 'issues' | 'live' | 'backups' | 'startup' | 'insights' | 'spark' | 'session' | 'mods';
};

export const RIGHT_NOW: RightNowSignal[] = [
  {
    id: 'rn-players',
    label: '12 players online',
    detail: 'Peak today 18 · evening climb in progress',
    severity: 'info',
    tab: 'live',
  },
  {
    id: 'rn-pregen',
    label: 'Chunky pregen paused',
    detail: '/chunky continue last seen near spawn',
    severity: 'info',
    tab: 'insights',
  },
  {
    id: 'rn-backup',
    label: 'No backup job running',
    detail: 'Newest archive 6h ago · 51.2 GB',
    severity: 'info',
    tab: 'backups',
  },
  {
    id: 'rn-spark',
    label: 'Spark companion connected',
    detail: 'Last capture during critical lag · sable 21%',
    severity: 'info',
    tab: 'spark',
  },
];

/** Collapsible instrument plates — prod Overview right column. */
export type InstrumentPlate = {
  id: string;
  label: string;
  title: string;
  detail: string;
  tab: RightNowSignal['tab'];
  tone: Tone;
};

export const INSTRUMENTS: InstrumentPlate[] = [
  {
    id: 'insight',
    label: 'Performance',
    title: 'Sticky lag after players left',
    detail: 'MSPT stayed elevated 45 min after peak (p95 86ms).',
    tab: 'insights',
    tone: 'warn',
  },
  {
    id: 'spark',
    label: 'Spark',
    title: 'sable 21% of Server thread',
    detail: 'Last critical-lag capture · companion connected.',
    tab: 'spark',
    tone: 'warn',
  },
  {
    id: 'boot',
    label: 'Boot',
    title: '187s · Warnings',
    detail: '4.8s slower than last · datapack/loot 54.8s.',
    tab: 'startup',
    tone: 'warn',
  },
  {
    id: 'storage',
    label: 'Storage',
    title: 'Disk 71% · runway ~11d',
    detail: 'world/ + backups growing ~2.1 GB / day.',
    tab: 'backups',
    tone: 'danger',
  },
  {
    id: 'pregen',
    label: 'Pregen',
    title: 'Chunky overworld paused',
    detail: '~44% · resume off-peak after spawn clears.',
    tab: 'insights',
    tone: 'default',
  },
];

export const VITALS: Vital[] = [
  {
    key: 'tps',
    label: 'TPS',
    value: '19.4',
    hint: 'target 20 · p95 17.1',
    tone: 'ok',
    spark: [0.98, 0.97, 0.99, 0.94, 0.88, 0.91, 0.96, 0.97, 0.95, 0.97],
  },
  {
    key: 'mspt',
    label: 'MSPT',
    value: '48',
    unit: 'ms',
    hint: 'p95 86 · tick budget 50',
    tone: 'warn',
    spark: [0.35, 0.4, 0.38, 0.55, 0.72, 0.68, 0.5, 0.45, 0.52, 0.48],
  },
  {
    key: 'players',
    label: 'Players',
    value: '12',
    unit: '/ 40',
    hint: 'peak today 18',
    tone: 'default',
    spark: [0.2, 0.25, 0.35, 0.4, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3],
  },
  {
    key: 'heap',
    label: 'Heap',
    value: '61',
    unit: '%',
    hint: '7.3G / 12G',
    tone: 'default',
    spark: [0.5, 0.52, 0.54, 0.55, 0.58, 0.6, 0.59, 0.61, 0.6, 0.61],
  },
  {
    key: 'cpu',
    label: 'CPU',
    value: '44',
    unit: '%',
    hint: 'host avg 15m',
    tone: 'default',
    spark: [0.25, 0.3, 0.35, 0.5, 0.55, 0.48, 0.42, 0.4, 0.45, 0.44],
  },
  {
    key: 'disk',
    label: 'Disk',
    value: '71',
    unit: '%',
    hint: '412G free · runway ~11d',
    tone: 'warn',
    spark: [0.62, 0.63, 0.65, 0.66, 0.67, 0.68, 0.69, 0.7, 0.7, 0.71],
  },
];

export const ISSUES: IssueRow[] = [
  {
    id: 'iss-disk',
    title: 'Disk runway under 14 days',
    detail:
      'world/ + backups growing ~2.1 GB / day. At this rate free space lasts ~11 days. Friday peak will hurt if the volume fills.',
    severity: 'critical',
    band: 'Storage',
    age: '2h',
    firstSeen: 'Today 17:12',
    next: 'Trim old backups or expand the volume before Friday peak.',
    steps: [
      'List backups older than 14 days under the backup root.',
      'Delete or offload one full archive if you still have a newer good copy.',
      'Confirm free space climbs above ~20% before Fri evening.',
    ],
    evidence: [
      'disk 71% · 412G free · runway ~11d',
      'growth ~2.1 GB/day (world + backups)',
      'last backup 6h ago · 51 GB',
    ],
  },
  {
    id: 'iss-entity',
    title: 'Entity spike near spawn',
    detail:
      'MSPT climbed past 50 for 8 minutes with 12 players online. Chunky was paused mid-run near spawn.',
    severity: 'warning',
    band: 'Performance',
    age: '46m',
    firstSeen: 'Today 19:02',
    next: 'Check spawn claim entities; resume pregen off-peak.',
    steps: [
      'Stand at spawn and check entity count (or Spark entities view if connected).',
      'Clear leftover drops / farms in the claim if they spiked.',
      'Resume Chunky only after Tue 05:00 quiet window if you need the reboot clear.',
    ],
    evidence: [
      'MSPT p95 86ms · spike window 8 min',
      'players 12 · dimension overworld',
      'chunky: paused (/chunky continue last seen)',
    ],
  },
  {
    id: 'iss-create',
    title: 'create - 14 log errors (missing item)',
    detail: 'Repeated missing item id in create recipes since last pack bump.',
    severity: 'warning',
    band: 'Mods',
    age: '3h',
    firstSeen: 'Today 16:40',
    next: 'Open Mods - sample lines; confirm recipe pack vs jar version.',
    steps: [
      'Open the Create mod card and read the sample error lines.',
      'Confirm the recipe datapack matches Create 6.0.4.',
      'If it is noise only, mark reviewed after the next calm boot.',
    ],
    evidence: [
      '14 error lines since boot',
      'missing item id in create recipes',
      'jar: create-6.0.4',
    ],
  },
  {
    id: 'iss-join',
    title: '2 pack sync join failures',
    detail: 'Clients rejected: missing Create 6.0.4 on two joins this evening.',
    severity: 'warning',
    band: 'Session',
    age: '1h',
    firstSeen: 'Today 18:51',
    next: 'Open Session - Join clinic; send pack list to those players.',
    steps: [
      'Open Session and find the rejected joins.',
      'Send those players the current pack list / Create 6.0.4 jar note.',
      'Watch the next join - if it clears, mark reviewed.',
    ],
    evidence: [
      'rejects: NotchFan42, FridayGuest',
      'reason: missing client jar Create 6.0.4',
      'join clinic: 2 open',
    ],
  },
  {
    id: 'iss-modrinth',
    title: 'Mod update hint: Create',
    detail:
      'Installed 6.0.4 · Modrinth shows 6.0.6 (lookup only - WatchTower does not download jars).',
    severity: 'info',
    band: 'Mods',
    age: '6h',
    firstSeen: 'Today 13:20',
    next: 'Review changelog on Modrinth when you plan a pack bump.',
    steps: [
      'Read the 6.0.6 changelog on Modrinth.',
      'Schedule the bump with a quiet restart window.',
      'Do not expect WatchTower to fetch the jar for you.',
    ],
    evidence: ['installed 6.0.4', 'Modrinth latest 6.0.6', 'hint only - no download'],
  },
  {
    id: 'iss-crash',
    title: 'Crash group quiet for 3 days',
    detail: 'Last group: mixin conflict · Create + Flywheel · marked reviewed.',
    severity: 'info',
    band: 'Crashes',
    age: '3d',
    firstSeen: '3 days ago',
    reviewed: true,
    next: 'No action unless it returns after the next Create bump.',
    steps: ['Leave reviewed unless a new fingerprint appears.', 'Re-open Crashes if Create bumps again.'],
    evidence: ['fingerprint: create+flywheel mixin', 'last occurrence: 3d ago', 'status: reviewed'],
  },
  {
    id: 'iss-ae2',
    title: 'ae2 - 6 log errors (recipe compat)',
    detail: 'Recipe compatibility errors after the pack update - quieter than Create but still noisy.',
    severity: 'info',
    band: 'Mods',
    age: '5h',
    firstSeen: 'Today 14:05',
    reviewed: true,
    next: 'Ignore unless players report missing AE2 recipes.',
    steps: ['Skim sample lines once.', 'Mark stays reviewed if no player reports.'],
    evidence: ['6 error lines since boot', 'ae2 recipe compat'],
  },
];

export const PLAYERS: PlayerRow[] = [
  { name: 'djinn', ping: 18, dim: 'overworld' },
  { name: 'mica', ping: 42, dim: 'overworld' },
  { name: 'oreo_', ping: 67, dim: 'nether' },
  { name: 'sable', ping: 31, dim: 'overworld' },
  { name: 'volt', ping: 88, dim: 'end' },
  { name: 'nimbus', ping: 24, dim: 'overworld' },
];

/** 24h load samples for a compact strip (evening-weighted). */
export const LOAD_24H: HourLoad[] = [
  { hour: '00', load: 0.12 },
  { hour: '01', load: 0.08 },
  { hour: '02', load: 0.06 },
  { hour: '03', load: 0.05 },
  { hour: '04', load: 0.07 },
  { hour: '05', load: 0.09 },
  { hour: '06', load: 0.14 },
  { hour: '07', load: 0.18 },
  { hour: '08', load: 0.22 },
  { hour: '09', load: 0.28 },
  { hour: '10', load: 0.35 },
  { hour: '11', load: 0.42 },
  { hour: '12', load: 0.55 },
  { hour: '13', load: 0.58 },
  { hour: '14', load: 0.52 },
  { hour: '15', load: 0.48 },
  { hour: '16', load: 0.62 },
  { hour: '17', load: 0.74 },
  { hour: '18', load: 0.88 },
  { hour: '19', load: 0.95 },
  { hour: '20', load: 0.9 },
  { hour: '21', load: 0.78 },
  { hour: '22', load: 0.55 },
  { hour: '23', load: 0.32 },
];

export const SCHEDULE = {
  peak: 'Fri 19:00',
  quiet: 'Tue 05:00',
  note: 'Evening climb weekdays · Fri/Sat hottest · restart into the Tue quiet slot.',
};

export const WORLD = {
  overworldSize: '48.2 GB',
  entities: '14.2k',
  chunks: '8.4k loaded',
  backupAge: '6h ago',
  backupSize: '51 GB',
};

export type LiveWindowId = '15m' | '1h' | '6h';

export type LiveSeries = {
  id: string;
  label: string;
  /** 0–1 normalized for charting */
  series: number[];
  tone: Tone;
  /** Optional explicit ink (thermal heat/cool, etc.) */
  ink?: string;
};

export type LiveMetric = {
  id: string;
  /** Matches dashboard LIVE_SERIES_KEYS / Live chart titles where possible */
  label: string;
  group: 'game' | 'host' | 'network' | 'thermal';
  unit: string;
  value: string;
  tone: Tone;
  hint: string;
  /** Show in top KPI strip */
  kpi?: boolean;
  series: LiveSeries[];
};

function seriesFrom(seed: number[], wobble = 0.04): number[] {
  const out: number[] = [];
  for (let i = 0; i < 72; i++) {
    const base = seed[i % seed.length] ?? 0.5;
    const wave = Math.sin(i / 7) * wobble;
    out.push(Math.min(1, Math.max(0.02, base + wave)));
  }
  return out;
}

function metric(
  partial: Omit<LiveMetric, 'series'> & {
    series: number[] | LiveSeries[];
    /** Chart ink for single-series metrics */
    ink?: string;
  },
): LiveMetric {
  const { ink, ...rest } = partial;
  const series: LiveSeries[] =
    Array.isArray(partial.series) &&
    partial.series.length > 0 &&
    typeof partial.series[0] === 'object'
      ? (partial.series as LiveSeries[])
      : [
          {
            id: partial.id,
            label: partial.label,
            series: partial.series as number[],
            tone: partial.tone,
            ink,
          },
        ];
  return { ...rest, series };
}

/**
 * Live fixtures aligned with dashboard `LIVE_SERIES_KEYS` + sample extras
 * (entities/chunks from WatchtowerSample; heap pressure / GC from live UI).
 */
export const LIVE = {
  sampleAge: '3s ago',
  pollEvery: '~5s',
  playersOnline: 12,
  verdict: 'Tick is fine',
  verdictTone: 'ok' as Tone,
  verdictDetail:
    'TPS is holding near 20. MSPT is warm from evening play and paused Chunky — not a stall.',
  windows: [
    { id: '15m' as const, label: '15m', points: 18 },
    { id: '1h' as const, label: '1h', points: 36 },
    { id: '6h' as const, label: '6h', points: 72 },
  ],
  metrics: [
    metric({
      id: 'tps',
      label: 'TPS',
      group: 'game',
      unit: '',
      value: '19.4',
      tone: 'ok',
      hint: 'target 20',
      kpi: true,
      ink: '#6FBF73',
      series: seriesFrom([0.97, 0.98, 0.96, 0.94, 0.88, 0.91, 0.95, 0.97, 0.96, 0.97], 0.02),
    }),
    metric({
      id: 'mspt',
      label: 'MSPT',
      group: 'game',
      unit: 'ms',
      value: '48',
      tone: 'warn',
      hint: 'budget 50',
      kpi: true,
      ink: '#E8910C',
      series: seriesFrom([0.35, 0.4, 0.42, 0.55, 0.72, 0.68, 0.5, 0.48, 0.52, 0.48], 0.05),
    }),
    metric({
      id: 'players',
      label: 'Players',
      group: 'game',
      unit: '',
      value: '12',
      tone: 'default',
      hint: 'of 40',
      kpi: true,
      ink: '#6B8CAE',
      series: seriesFrom([0.15, 0.2, 0.25, 0.35, 0.45, 0.5, 0.48, 0.4, 0.35, 0.3], 0.03),
    }),
    metric({
      id: 'heap_mb',
      label: 'Heap',
      group: 'game',
      unit: 'MB',
      value: '7340',
      tone: 'default',
      hint: 'of 12288 max',
      kpi: true,
      ink: '#C9A227',
      series: seriesFrom([0.5, 0.52, 0.54, 0.56, 0.58, 0.59, 0.6, 0.61, 0.6, 0.61], 0.015),
    }),
    metric({
      id: 'gc_pause_pct',
      label: 'GC pause',
      group: 'game',
      unit: '%',
      value: '3.2',
      tone: 'ok',
      hint: 'wall time',
      ink: '#5FB3A8',
      series: seriesFrom([0.08, 0.1, 0.09, 0.12, 0.15, 0.11, 0.1, 0.09, 0.1, 0.08], 0.02),
    }),
    metric({
      id: 'heap_pressure_pct',
      label: 'Heap pressure',
      group: 'game',
      unit: '%',
      value: '61',
      tone: 'default',
      hint: 'used / max',
      ink: '#D08B5B',
      series: seriesFrom([0.5, 0.52, 0.54, 0.56, 0.58, 0.59, 0.6, 0.61, 0.6, 0.61], 0.015),
    }),
    metric({
      id: 'entities',
      label: 'Entities',
      group: 'game',
      unit: '',
      value: '14.2k',
      tone: 'default',
      hint: 'loaded',
      ink: '#A67C52',
      series: seriesFrom([0.4, 0.42, 0.45, 0.5, 0.55, 0.58, 0.52, 0.48, 0.5, 0.51], 0.03),
    }),
    metric({
      id: 'chunks',
      label: 'Chunks',
      group: 'game',
      unit: '',
      value: '8.4k',
      tone: 'default',
      hint: 'loaded',
      ink: '#7D8F9C',
      series: seriesFrom([0.35, 0.36, 0.38, 0.4, 0.42, 0.44, 0.43, 0.41, 0.4, 0.4], 0.02),
    }),
    metric({
      id: 'host_cpu',
      label: 'Host CPU',
      group: 'host',
      unit: '%',
      value: '44',
      tone: 'default',
      hint: '15m avg',
      kpi: true,
      ink: '#C45C4A',
      series: seriesFrom([0.25, 0.3, 0.35, 0.48, 0.55, 0.5, 0.42, 0.4, 0.44, 0.44], 0.04),
    }),
    metric({
      id: 'mem_used_gb',
      label: 'RAM used',
      group: 'host',
      unit: 'GB',
      value: '18.4',
      tone: 'default',
      hint: 'of 32 total',
      ink: '#5B8FD4',
      series: seriesFrom([0.5, 0.52, 0.53, 0.55, 0.56, 0.57, 0.57, 0.58, 0.57, 0.57], 0.01),
    }),
    metric({
      id: 'disk_use_pct',
      label: 'Disk use',
      group: 'host',
      unit: '%',
      value: '71',
      tone: 'warn',
      hint: 'runway ~11d',
      kpi: true,
      ink: '#E6B422',
      series: seriesFrom([0.66, 0.67, 0.68, 0.69, 0.7, 0.7, 0.71, 0.71, 0.71, 0.71], 0.01),
    }),
    metric({
      id: 'disk_io',
      label: 'Disk R/W',
      group: 'host',
      unit: 'MB/s',
      value: '12 / 4',
      tone: 'default',
      hint: 'read / write',
      series: [
        {
          id: 'disk_read_mb_s',
          label: 'Read',
          tone: 'ok',
          ink: '#3D9B8F',
          series: seriesFrom([0.2, 0.35, 0.5, 0.4, 0.25, 0.3, 0.45, 0.55, 0.3, 0.25], 0.06),
        },
        {
          id: 'disk_write_mb_s',
          label: 'Write',
          tone: 'warn',
          ink: '#B85C38',
          series: seriesFrom([0.1, 0.15, 0.2, 0.35, 0.4, 0.25, 0.2, 0.3, 0.22, 0.18], 0.05),
        },
      ],
    }),
    metric({
      id: 'net_rx_mbps',
      label: 'Net RX',
      group: 'network',
      unit: 'Mbps',
      value: '8.4',
      tone: 'ok',
      hint: 'inbound',
      series: [
        {
          id: 'net_rx_mbps',
          label: 'RX',
          tone: 'ok',
          ink: '#4C8EC7',
          series: seriesFrom([0.35, 0.4, 0.45, 0.7, 0.85, 0.75, 0.55, 0.5, 0.48, 0.52], 0.04),
        },
      ],
    }),
    metric({
      id: 'net_tx_mbps',
      label: 'Net TX',
      group: 'network',
      unit: 'Mbps',
      value: '2.1',
      tone: 'default',
      hint: 'outbound',
      series: [
        {
          id: 'net_tx_mbps',
          label: 'TX',
          tone: 'default',
          ink: '#C47A2C',
          series: seriesFrom([0.25, 0.3, 0.35, 0.55, 0.7, 0.6, 0.45, 0.4, 0.38, 0.42], 0.03),
        },
      ],
    }),
    metric({
      id: 'thermal_package',
      label: 'Package',
      group: 'thermal',
      unit: '°C',
      value: '68',
      tone: 'warn',
      hint: 'Hot path · chip die',
      series: [
        {
          id: 'thermal_package',
          label: 'Package',
          tone: 'warn',
          ink: '#E05A3C',
          series: seriesFrom([0.55, 0.58, 0.6, 0.65, 0.7, 0.68, 0.64, 0.62, 0.63, 0.64], 0.03),
        },
      ],
    }),
    metric({
      id: 'thermal_ambient',
      label: 'Ambient',
      group: 'thermal',
      unit: '°C',
      value: '32',
      tone: 'ok',
      hint: 'Room air · intake',
      series: [
        {
          id: 'thermal_ambient',
          label: 'Ambient',
          tone: 'ok',
          ink: '#6A9A8B',
          series: seriesFrom([0.28, 0.29, 0.3, 0.3, 0.31, 0.31, 0.3, 0.3, 0.29, 0.3], 0.01),
        },
      ],
    }),
  ] satisfies LiveMetric[],
  signals: [
    {
      id: 'sig-mspt',
      tone: 'warn' as Tone,
      title: 'MSPT warm',
      detail: 'Near budget with 12 players. Entity spike case is still open in Issues.',
    },
    {
      id: 'sig-disk',
      tone: 'danger' as Tone,
      title: 'Disk runway',
      detail: '71% used · ~11 days left at current growth. Critical in the Fix queue.',
    },
    {
      id: 'sig-tps',
      tone: 'ok' as Tone,
      title: 'TPS holding',
      detail: 'No sustained sub-18 dip in the last hour. Safe to keep the evening session.',
    },
  ],
  jobs: [
    { name: 'Chunky overworld', status: 'Paused', detail: '/chunky continue last seen' },
    { name: 'Distant Horizons', status: 'Idle', detail: 'No active pregen' },
    { name: 'Backup full', status: 'Idle', detail: 'Last run 6h ago · 51 GB' },
  ],
};

/** @deprecated alias — Overview still uses VITALS; Live uses LIVE.metrics */
export type LiveChannel = LiveMetric;

export type StartupPhase = {
  id: string;
  label: string;
  sec: number;
  ink: string;
};

export type StartupWarning = {
  id: string;
  title: string;
  detail: string;
  sample: string | null;
  link: 'logs' | 'mods' | 'configs';
  modId: string | null;
};

export type StartupError = {
  modId: string;
  kind: string;
  blocking: boolean;
  title: string;
  detail: string;
};

export type StartupHistoryEntry = {
  doneAt: string;
  totalSec: number;
  status: string;
  phases: { id: string; sec: number }[];
};

/** Last-boot triage desk — mirrors ops-cache `startup_profile` + config audit. */
export const STARTUP = {
  status: 'warnings' as const,
  statusWord: 'Warnings',
  totalSec: 187.4,
  totalSource: 'Full load (ModernFix)',
  vanillaDoneSec: 142.1,
  doneAtLabel: 'Today 18:42',
  doneAgo: '6h ago',
  cleanShutdown: true,
  updateAvailable: false,
  compare: { direction: 'slower' as 'faster' | 'slower' | 'same', deltaSec: 12.4 },
  phases: [
    { id: 'mod_construct', label: 'Mod construct', sec: 48.2, ink: '#C45C4A' },
    { id: 'registry_freeze', label: 'Registry freeze', sec: 22.1, ink: '#C9A227' },
    { id: 'common_setup', label: 'Common setup', sec: 31.6, ink: '#6B8CAE' },
    { id: 'datapack_loot', label: 'Datapack / loot', sec: 54.8, ink: '#D08B5B' },
    { id: 'server_start', label: 'Server start', sec: 30.7, ink: '#5B8FD4' },
  ] satisfies StartupPhase[],
  slowest: [
    { phase: 'Datapack / loot', sec: 54.8 },
    { phase: 'Mod construct', sec: 48.2 },
    { phase: 'Common setup', sec: 31.6 },
  ],
  warningEventCount: 14,
  warnings: [
    {
      id: 'recipe_parse',
      title: 'Recipe parse failure',
      detail: 'A recipe failed to load during boot - often a datapack or mod recipe JSON issue.',
      sample: 'create:crushing/obsidian',
      link: 'mods' as const,
      modId: 'create',
    },
    {
      id: 'registry_missing',
      title: 'Missing registry entry',
      detail:
        'Something referenced an item, block, or entity that is not registered (missing mod or bad datapack).',
      sample: 'farmersdelight:rope',
      link: 'mods' as const,
      modId: 'farmersdelight',
    },
    {
      id: 'postprocessing_spam',
      title: 'World post-processing spam',
      detail:
        'The server repeatedly tried to mark chunks for post-processing - usually noisy, rarely fatal.',
      sample: null,
      link: 'logs' as const,
      modId: null,
    },
  ] satisfies StartupWarning[],
  errors: [
    {
      modId: 'oculus',
      kind: 'client_on_server',
      blocking: false,
      title: 'Client class on dedicated server',
      detail: 'Non-blocking - the server still reached Done!.',
    },
    {
      modId: 'jade',
      kind: 'mod_runtime',
      blocking: false,
      title: 'Runtime mod failure',
      detail: 'Non-blocking - the server still reached Done!.',
    },
  ] satisfies StartupError[],
  configAudit: {
    status: 'consider',
    summary: { fine: 12, consider: 3, missing: 1 },
    properties: [
      { key: 'view-distance', verdict: 'consider', title: 'View distance is high for this RAM' },
      { key: 'simulation-distance', verdict: 'consider', title: 'Simulation distance matches view' },
      { key: 'max-tick-time', verdict: 'missing', title: 'max-tick-time not set' },
    ],
    jvmName: 'Aikar-ish flags',
  },
  history: [
    {
      doneAt: 'Mon 12:08',
      totalSec: 168.2,
      status: 'ok',
      phases: [
        { id: 'mod_construct', sec: 44 },
        { id: 'registry_freeze', sec: 20 },
        { id: 'common_setup', sec: 28 },
        { id: 'datapack_loot', sec: 46 },
        { id: 'server_start', sec: 30 },
      ],
    },
    {
      doneAt: 'Wed 09:14',
      totalSec: 175.0,
      status: 'ok',
      phases: [
        { id: 'mod_construct', sec: 46 },
        { id: 'registry_freeze', sec: 21 },
        { id: 'common_setup', sec: 29 },
        { id: 'datapack_loot', sec: 49 },
        { id: 'server_start', sec: 30 },
      ],
    },
    {
      doneAt: 'Fri 18:42',
      totalSec: 187.4,
      status: 'warnings',
      phases: [
        { id: 'mod_construct', sec: 48.2 },
        { id: 'registry_freeze', sec: 22.1 },
        { id: 'common_setup', sec: 31.6 },
        { id: 'datapack_loot', sec: 54.8 },
        { id: 'server_start', sec: 30.7 },
      ],
    },
  ] satisfies StartupHistoryEntry[],
};

export const ISSUE_COUNTS = {
  critical: ISSUES.filter((i) => i.severity === 'critical' && !i.reviewed).length,
  warning: ISSUES.filter((i) => i.severity === 'warning' && !i.reviewed).length,
  info: ISSUES.filter((i) => i.severity === 'info' && !i.reviewed).length,
  open: ISSUES.filter((i) => !i.reviewed).length,
  reviewed: ISSUES.filter((i) => i.reviewed).length,
};

/** Rail destinations — `ready` pages are clickable in the POC. */
export const NAV = [
  { id: 'overview', label: 'Overview', group: 'Monitor', badge: null as string | null, ready: true },
  { id: 'live', label: 'Live', group: 'Monitor', badge: null, ready: true },
  { id: 'startup', label: 'Startup', group: 'Monitor', badge: 'warn', ready: true },
  { id: 'insights', label: 'Insights', group: 'Monitor', badge: null, ready: false },
  { id: 'session', label: 'Session', group: 'Monitor', badge: '2', ready: false },
  { id: 'issues', label: 'Issues', group: 'Triage', badge: String(ISSUE_COUNTS.open), ready: true },
  { id: 'crashes', label: 'Crashes', group: 'Triage', badge: '0', ready: false },
  { id: 'spark', label: 'Spark', group: 'Triage', badge: null, ready: false },
  { id: 'backups', label: 'Backups', group: 'Ops', badge: null, ready: true },
  { id: 'mods', label: 'Mods', group: 'Ops', badge: null, ready: false },
  { id: 'activity', label: 'Activity', group: 'Ops', badge: null, ready: false },
  { id: 'settings', label: 'Settings', group: 'Ops', badge: null, ready: false },
  { id: 'kit', label: 'Kit', group: 'Lab', badge: null, ready: true },
] as const;

export type BackupFreshness = 'fresh' | 'aging' | 'stale';
export type BackupVerifyStatus = 'verified' | 'suspicious' | 'broken' | 'unchecked';

export type BackupArchive = {
  id: string;
  file: string;
  path: string;
  sizeGb: number;
  ageHours: number;
  mtimeLabel: string;
  freshness: BackupFreshness;
  verify: BackupVerifyStatus;
  findings: string[];
  newest?: boolean;
};

/** Local-first backup desk — mirrors ops-cache `backups_live` + settings checklist. */
export const BACKUPS = {
  status: 'fresh' as BackupFreshness,
  statusWord: 'Fresh',
  scannedAt: '3m ago',
  staleHours: 24,
  lastBackup: {
    file: 'world-2026-08-09-1842.zip',
    ageHours: 6,
    ageLabel: '6h ago',
    mtimeLabel: 'Today 18:42',
    sizeGb: 51.2,
  },
  summary: {
    fileCount: 8,
    totalGb: 312.4,
    listed: 8,
  },
  tracking: {
    enabled: true,
    mode: 'local',
    primary: 'D:/servers/smp/backups',
    paths: [
      { path: 'D:/servers/smp/backups', primary: true },
      { path: '\\\\nas\\minecraft\\smp-backups', primary: false },
    ],
    externalConfigured: false,
    webhookEnabled: false,
    suppressLocalMissing: false,
  },
  checklist: [
    {
      id: 'tracking',
      label: 'Local tracking enabled',
      done: true,
      hint: 'WatchTower scans configured folders after each scan pass.',
    },
    {
      id: 'dir',
      label: 'Backup directory configured',
      done: true,
      hint: 'Primary path is set and readable.',
    },
    {
      id: 'external',
      label: 'External storage configured',
      done: false,
      hint: 'Offsite so freshness is not local-only.',
    },
    {
      id: 'webhook',
      label: 'Webhook notifications',
      done: false,
      hint: 'Alert when backups go stale or verify fails.',
    },
    {
      id: 'suppress',
      label: 'Suppress local-missing warnings',
      done: false,
      hint: 'Only if you intentionally keep archives off-box.',
    },
  ],
  archives: [
    {
      id: 'a1',
      file: 'world-2026-08-09-1842.zip',
      path: 'D:/servers/smp/backups/world-2026-08-09-1842.zip',
      sizeGb: 51.2,
      ageHours: 6,
      mtimeLabel: 'Today 18:42',
      freshness: 'fresh',
      verify: 'verified',
      findings: ['Archive opens', 'World metadata present', 'Region chunks present'],
      newest: true,
    },
    {
      id: 'a2',
      file: 'world-2026-08-08-0600.zip',
      path: 'D:/servers/smp/backups/world-2026-08-08-0600.zip',
      sizeGb: 50.8,
      ageHours: 42,
      mtimeLabel: 'Sat 06:00',
      freshness: 'aging',
      verify: 'verified',
      findings: ['Archive opens', 'World metadata present', 'Region chunks present'],
    },
    {
      id: 'a3',
      file: 'world-2026-08-07-0600.zip',
      path: '\\\\nas\\minecraft\\smp-backups/world-2026-08-07-0600.zip',
      sizeGb: 49.1,
      ageHours: 66,
      mtimeLabel: 'Fri 06:00',
      freshness: 'stale',
      verify: 'suspicious',
      findings: ['Archive opens', 'World metadata present', 'No region/*.mca'],
    },
    {
      id: 'a4',
      file: 'world-2026-08-05-0600.zip',
      path: 'D:/servers/smp/backups/world-2026-08-05-0600.zip',
      sizeGb: 48.4,
      ageHours: 114,
      mtimeLabel: 'Wed 06:00',
      freshness: 'stale',
      verify: 'broken',
      findings: ["Can't open archive", 'truncated or unreadable'],
    },
    {
      id: 'a5',
      file: 'world-2026-08-03-0600.zip',
      path: 'D:/servers/smp/backups/world-2026-08-03-0600.zip',
      sizeGb: 47.2,
      ageHours: 162,
      mtimeLabel: 'Mon 06:00',
      freshness: 'stale',
      verify: 'unchecked',
      findings: [],
    },
    {
      id: 'a6',
      file: 'world-2026-08-01-0600.zip',
      path: '\\\\nas\\minecraft\\smp-backups/world-2026-08-01-0600.zip',
      sizeGb: 46.0,
      ageHours: 210,
      mtimeLabel: 'Sat 06:00',
      freshness: 'stale',
      verify: 'verified',
      findings: ['Archive opens', 'World metadata present', 'Region chunks present'],
    },
    {
      id: 'a7',
      file: 'world-2026-07-28-0600.zip',
      path: 'D:/servers/smp/backups/world-2026-07-28-0600.zip',
      sizeGb: 44.8,
      ageHours: 306,
      mtimeLabel: 'Jul 28',
      freshness: 'stale',
      verify: 'unchecked',
      findings: [],
    },
    {
      id: 'a8',
      file: 'pre-update-2026-07-20.zip',
      path: 'D:/servers/smp/backups/pre-update-2026-07-20.zip',
      sizeGb: 43.9,
      ageHours: 498,
      mtimeLabel: 'Jul 20',
      freshness: 'stale',
      verify: 'suspicious',
      findings: ['Archive opens', 'Missing level.dat'],
    },
  ] satisfies BackupArchive[],
};
