/**
 * Features page: capability catalog (insides), not dashboard rooms.
 * Sources: docs/ROADMAP.md Works today, README.md, PRODUCT.md.
 * Hyphens only. No Fabric shipping claims. No promises / not-our-job.
 */

/** Desk status / channel tone for the instrument mark. */
export type FeatureTone =
  | 'accent'
  | 'lantern'
  | 'danger'
  | 'warn'
  | 'ok'
  | 'info'
  | 'tps'
  | 'mspt'
  | 'disk'
  | 'heap'
  | 'players';

export type FeatureCapability = {
  id: string;
  title: string;
  blurb: string;
  /** Parent room label for wayfinding only. */
  tag: string;
  weight: 'lead' | 'standard';
  tone: FeatureTone;
  alpha?: boolean;
};

export const FEATURE_LEDE =
  'What ships under Overview, Live, Issues, and the rest. This is the catalog, not another walk through the home screens.';

export const FEATURE_CAPABILITIES: FeatureCapability[] = [
  {
    id: 'health-grade',
    title: 'Health grade + restart advice',
    blurb:
      'Letter grade, reasons when it is not Strong, and Safe / Caution / Wait for a restart. Long uptime plus worse GC can point at a quiet maintenance window. WatchTower does not restart the server for you.',
    tag: 'Overview',
    weight: 'lead',
    tone: 'danger',
  },
  {
    id: 'fix-inbox',
    title: 'Fix inbox ranking',
    blurb:
      'Watching and Scanning fill a ranked inbox. Each issue has a next step. You do not run a big scheduled audit to keep it useful.',
    tag: 'Issues',
    weight: 'lead',
    tone: 'danger',
  },
  {
    id: 'join-clinic',
    title: 'Join / pack sync clinic',
    blurb:
      'Failed joins map to named mod diffs on Session. Player-safe copy of the fix. Read-only. No jar downloads.',
    tag: 'Session',
    weight: 'lead',
    tone: 'accent',
  },
  {
    id: 'world-pressure',
    title: 'World pressure',
    blurb:
      'Entity, item, and chunk census for item storms, mob spikes, and unattended loaders.',
    tag: 'Insights',
    weight: 'lead',
    tone: 'mspt',
  },
  {
    id: 'support-pack',
    title: 'Support pack redaction',
    blurb:
      'Build a redacted zip (facts, brief, evidence) for a helper or mod author. Discord copy presets match the pack.',
    tag: 'Support',
    weight: 'lead',
    tone: 'ok',
  },
  {
    id: 'live-vitals',
    title: 'Live vitals charts',
    blurb:
      'TPS, MSPT, players, heap, CPU, and host charts while you watch. Hosted-panel metrics stay honest about what they can see.',
    tag: 'Live',
    weight: 'standard',
    tone: 'tps',
  },
  {
    id: 'gc-ram',
    title: 'GC / JVM + RAM advice',
    blurb:
      'GC pause share of wall time, JVM flags profile, and RAM advice that uses your host or container memory limit. Not a one-size guess.',
    tag: 'Live',
    weight: 'standard',
    tone: 'heap',
  },
  {
    id: 'crash-fingerprints',
    title: 'Crash fingerprints',
    blurb: 'Crash reports grouped and explained in plain English, with nearby log lines for context.',
    tag: 'Crashes',
    weight: 'standard',
    tone: 'danger',
  },
  {
    id: 'external-kill',
    title: 'External kill / OOM',
    blurb:
      'Host OOM killer vs panel force-kill when there is no crash report, plus which fix path to take.',
    tag: 'Crashes',
    weight: 'standard',
    tone: 'danger',
  },
  {
    id: 'silent-fails',
    title: 'Silent script fails',
    blurb: 'KubeJS, CraftTweaker, datapack, and /reload errors that never crash still show up as Issues.',
    tag: 'Issues',
    weight: 'standard',
    tone: 'warn',
  },
  {
    id: 'mods-modrinth',
    title: 'Mod inventory + Modrinth hints',
    blurb:
      'Installed jars, conflicts, Modrinth lookup hints, and mod log errors with Active / Reviewed. Modrinth never downloads jars for you.',
    tag: 'Mods',
    weight: 'standard',
    tone: 'accent',
  },
  {
    id: 'jar-drift',
    title: 'Pack / jar drift',
    blurb: 'Checksum baseline drift and high-confidence client-only jars land on Issues.',
    tag: 'Mods',
    weight: 'standard',
    tone: 'warn',
  },
  {
    id: 'jar-disable',
    title: 'Soft jar disable / enable',
    blurb:
      'Rename a mod jar to `*.jar.disabled` so it skips the next boot (or rename it back). Filter All / Enabled / Disabled. High world risk asks you to confirm first. Admins only. No delete.',
    tag: 'Mods',
    weight: 'standard',
    tone: 'warn',
  },
  {
    id: 'mod-configs',
    title: 'Mods → Configs',
    blurb:
      'Edit files under the server `config/` folder from the dashboard. TOML gets a form when WatchTower can parse it; otherwise you edit the raw text. Saves create a backup and support undo. Admins only.',
    tag: 'Mods',
    weight: 'standard',
    tone: 'accent',
  },
  {
    id: 'schedule-load',
    title: 'Schedule + load trends',
    blurb:
      'Busy vs quiet hours so you plan restarts around actual load. Times follow the timezone you set in the dashboard.',
    tag: 'Insights',
    weight: 'standard',
    tone: 'players',
  },
  {
    id: 'storage-runway',
    title: 'Storage + disk runway',
    blurb: 'Dimension storage scan, plus roughly how many days of disk left. More than a percent-full bar.',
    tag: 'Insights',
    weight: 'standard',
    tone: 'disk',
  },
  {
    id: 'storage-space-map',
    title: 'Storage space map',
    blurb: 'Treemap of what is using disk. Drill into World, Logs, Mods, or Backups.',
    tag: 'Insights',
    weight: 'standard',
    tone: 'disk',
  },
  {
    id: 'weekly-digest',
    title: 'Weekly ops digest',
    blurb: 'Local rollup of grade, crashes, disk, and MSPT trend with one next action. Stays on your host.',
    tag: 'Insights',
    weight: 'standard',
    tone: 'lantern',
  },
  {
    id: 'config-audit',
    title: 'Config audit',
    blurb: 'Read-only keep / tweak / why for server.properties and startup flags.',
    tag: 'Insights',
    weight: 'standard',
    tone: 'info',
  },
  {
    id: 'spark',
    title: 'Spark lag proof',
    blurb: 'Optional Spark companion turns a profile into what ate the tick. Deep Spark workspace is alpha.',
    tag: 'Spark',
    weight: 'standard',
    tone: 'lantern',
    alpha: true,
  },
  {
    id: 'spark-map',
    title: 'Spark Map',
    blurb: 'Pan and zoom chunk heat from the selected Spark profile. Click a chunk for details.',
    tag: 'Spark',
    weight: 'standard',
    tone: 'lantern',
  },
  {
    id: 'backups',
    title: 'Backup health',
    blurb:
      'See whether local backups look present and fresh, then verify zip/tar.gz integrity. Optional test restore only under `watchtower/restore-verify/`. Never into the live world.',
    tag: 'Backups',
    weight: 'standard',
    tone: 'ok',
  },
  {
    id: 'activity',
    title: 'Activity / incident stories',
    blurb: 'Lag spikes, crashes, and missed backups pulled into one incident thread you can read.',
    tag: 'Activity',
    weight: 'standard',
    tone: 'mspt',
  },
  {
    id: 'logs',
    title: 'Log tail',
    blurb: 'latest.log triage in the dashboard so you are not jumping to the host panel for every line.',
    tag: 'Logs',
    weight: 'standard',
    tone: 'info',
  },
  {
    id: 'startup',
    title: 'Startup watch',
    blurb: 'First minutes and boot health when the process comes up.',
    tag: 'Startup',
    weight: 'standard',
    tone: 'accent',
  },
  {
    id: 'sources',
    title: 'Sources freshness',
    blurb: 'Poller freshness and which data pull is next, so you know if Watching is current.',
    tag: 'Sources',
    weight: 'standard',
    tone: 'tps',
  },
  {
    id: 'accounts',
    title: 'Named accounts + audit log',
    blurb:
      'Owner / admin / viewer logins, optional Minecraft player link on the side rail, Sign out, and a Settings audit log of account and settings changes.',
    tag: 'Settings',
    weight: 'standard',
    tone: 'accent',
  },
  {
    id: 'theme-accent',
    title: 'Theme + accent',
    blurb: 'Light, Dark, Black, or System, plus an accent color. Saved per signed-in account.',
    tag: 'Settings',
    weight: 'standard',
    tone: 'info',
  },
  {
    id: 'auth',
    title: 'Secure login + optional 2FA',
    blurb: 'Login required by default. Optional 2FA for the dashboard.',
    tag: 'Settings',
    weight: 'standard',
    tone: 'ok',
  },
  {
    id: 'help',
    title: 'Help Center',
    blurb: 'In-app wiki with the same guides as the public GitHub wiki.',
    tag: 'Help',
    weight: 'standard',
    tone: 'info',
  },
  {
    id: 'cli-dr',
    title: 'Disaster-recovery CLI + viewer',
    blurb: 'Matching CLI jar and browser viewer when Minecraft will not stay up.',
    tag: 'CLI',
    weight: 'standard',
    tone: 'warn',
  },
];
