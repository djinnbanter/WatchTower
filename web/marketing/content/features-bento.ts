/**
 * Features bento — one grid per section (Monitor / Triage / Operations / System).
 * Copy comes from FEATURE_GROUPS / FEATURE_CAPABILITIES; this file owns layout + peek ids.
 */

export type BentoMedia = 'stack' | 'overlay' | 'strip' | 'chart' | 'side';

/** Desktop span classes (see capability-catalog.css). */
export type SectionSpan =
  | 'tall-left'
  | 'mid-top'
  | 'tall-right'
  | 'mid-strip'
  | 'wide-bottom'
  | 'stamp'
  | 'rules'
  | 'more-one'
  | 'more-two'
  | 'more-half'
  | 'lead-wide'
  | 'lead-tall'
  | 'full';

export type SectionBentoCell = {
  /** Peek id in bento-peeks.tsx */
  id: string;
  title: string;
  body: string;
  media: BentoMedia;
  span: SectionSpan;
  alpha?: boolean;
};

export type FeatureBentoSection = {
  label: string;
  cells: SectionBentoCell[];
};

/**
 * Section bentos sized for mock fixtures.
 * Monitor uses equal-height rows (Option B); other sections use denser spans.
 */
export const FEATURE_BENTO_SECTIONS: FeatureBentoSection[] = [
  {
    label: 'Monitor',
    cells: [
      {
        id: 'health-grade',
        title: 'Overview',
        body: 'Think of this as the main control center for your server. It shows how healthy your server is, ranging from Strong to Poor. It also highlights current issues, shows live stats like performance, and gives simple advice on whether to restart, wait, or proceed with caution.',
        media: 'overlay',
        span: 'more-one',
      },
      {
        id: 'live-vitals',
        title: 'Live Console',
        body: 'Shows real-time graphs of things like transaction speed, tick rate, memory usage, CPU load, disk activity, and background tasks. You can zoom in or out on the timeline from minutes to hours to find exactly when slowdowns happen.',
        media: 'overlay',
        span: 'more-one',
      },
      {
        id: 'world-pressure',
        title: 'Insights',
        body: 'Provides long-term data and planning information across eight different views: Schedule, Load, Incidents, Configs, Mod Changes, World Pressure, Storage Runway, and Weekly Digest — so you can plan restarts and cleanup without guessing from one bad evening.',
        media: 'overlay',
        span: 'more-one',
      },
      {
        id: 'join-clinic',
        title: 'Session & Join Clinic',
        body: "See who's currently playing, review past peak times, and check playtime details. The Join Clinic helps diagnose why players might have trouble connecting, like mismatched mods or missing game files.",
        media: 'overlay',
        span: 'more-half',
      },
      {
        id: 'schedule-load',
        title: 'Schedule + Load',
        body: 'Finds the busiest times for players to help decide the best times to restart the server. Shows CPU and memory performance over days or weeks.',
        media: 'overlay',
        span: 'more-half',
      },
      {
        id: 'storage-runway',
        title: 'Storage Runway',
        body: 'Predicts how much disk space is left and shows detailed usage with interactive maps.',
        media: 'overlay',
        span: 'more-half',
      },
      {
        id: 'startup',
        title: 'Startup Analyzer',
        body: 'Examines the server startup process, including boot times, launch steps, and warnings. It connects any startup errors directly to specific issues that can be fixed, making troubleshooting easier.',
        media: 'overlay',
        span: 'more-half',
      },
    ],
  },
  {
    label: 'Triage',
    cells: [
      {
        id: 'fix-inbox',
        title: 'Issues (Fix Inbox)',
        body: 'A sorted list of problems, ranked by how serious they are (Critical, Warning, Info). It automatically sorts issues like lag spikes, pauses, jar drift, misplaced client mods, script errors (KubeJS/CraftTweaker), world pressure, and backup warnings, along with simple steps to fix them.',
        media: 'overlay',
        span: 'lead-tall',
      },
      {
        id: 'crash-fingerprints',
        title: 'Crash Center',
        body: 'Combines similar error reports into one easy-to-understand card. Shows likely causes from mods, full error details, and detects cases where the system was unexpectedly shut down due to running out of memory, even if no standard crash report was made.',
        media: 'overlay',
        span: 'lead-tall',
      },
      {
        id: 'spark',
        title: 'Spark Workspace (Alpha)',
        body: 'Lets you import Spark profile links or files to analyze detailed performance data. It creates easy-to-read summaries, shows sources of lag, and traces what caused delays, all within the dashboard.',
        media: 'overlay',
        span: 'more-half',
        alpha: true,
      },
      {
        id: 'logs',
        title: 'Log Viewer',
        body: "An in-game log viewer that helps you quickly search, filter, and highlight important information in your latest log files, so you don't have to use a terminal or FTP tools.",
        media: 'overlay',
        span: 'more-half',
      },
    ],
  },
  {
    label: 'Operations',
    cells: [
      {
        id: 'mods-modrinth',
        title: 'Mod Manager & Forensics',
        body: 'Easily manage and monitor your mods: Library, Updates, Conflicts, Jar Drift Detection, Enable/Disable, and Config Editor — with safety ratings, world-risk warnings, previews, backups, and undo.',
        media: 'overlay',
        span: 'lead-wide',
      },
      {
        id: 'jar-drift',
        title: 'Jar Drift Detection',
        body: 'Find mods that have been changed or replaced quietly while keeping the same file name.',
        media: 'overlay',
        span: 'more-one',
      },
      {
        id: 'backups',
        title: 'Backup Tracker',
        body: 'Keep an eye on your backup folders or external signals to make sure backups are fresh. It warns you if backups stop working or take too long. (Panel and Cloud monitoring are still being tested.)',
        media: 'overlay',
        span: 'more-half',
      },
      {
        id: 'activity',
        title: 'Activity Timeline',
        body: 'See a combined timeline of important events like players joining, admin commands, lag spikes, and background tasks. It helps answer questions like "What happened just before the game crashed?"',
        media: 'overlay',
        span: 'more-half',
      },
      {
        id: 'sources',
        title: 'Source Diagnostics',
        body: 'A built-in checker that makes sure background tools like WatchTower, file watchers, and scans are working properly.',
        media: 'overlay',
        span: 'more-half',
      },
      {
        id: 'mod-configs',
        title: 'Config Editor',
        body: 'Edit mod settings stored in JSON or TOML files easily, see real-time previews, make automatic backups, and undo changes with one click.',
        media: 'overlay',
        span: 'more-half',
      },
    ],
  },
  {
    label: 'System & Sharing',
    cells: [
      {
        id: 'support-pack',
        title: 'Support Pack Generator',
        body: 'Quickly create a zip file with important logs, crash reports, and setup details that have been cleaned of private info. Share these files easily with mod developers or support communities.',
        media: 'overlay',
        span: 'more-half',
      },
      {
        id: 'accounts',
        title: 'Accounts & Audit Logging',
        body: 'Set who can do what with permissions for Owners, Admins, and Viewers. Manage user preferences, enable optional two-factor authentication, connect player skins, and view a permanent record of all actions taken by operators.',
        media: 'overlay',
        span: 'more-half',
      },
      {
        id: 'help',
        title: 'Help Center',
        body: 'Easily find and search through guides and troubleshooting tips right from the dashboard sidebar.',
        media: 'overlay',
        span: 'more-one',
      },
      {
        id: 'auth',
        title: 'Security Posture',
        body: 'Keep your dashboard safe with password protection, secure connections through localhost or SSH tunnels, and protected API access.',
        media: 'overlay',
        span: 'more-one',
      },
      {
        id: 'roadmap',
        title: 'In-App Roadmap',
        body: "See what's coming next and what's being worked on directly inside the admin settings, in real time.",
        media: 'overlay',
        span: 'more-one',
      },
      {
        id: 'cli-dr',
        title: 'CLI Disaster Recovery',
        body: "Use a simple command-line tool included with WatchTower. If Minecraft won't start at all, run this tool over SSH to gather crash details and view logs in a standalone browser window for troubleshooting.",
        media: 'overlay',
        span: 'full',
      },
    ],
  },
];

/** Legacy exports kept for any leftover imports. */
export type BentoSpan =
  | 'tall-left'
  | 'mid-top'
  | 'tall-right'
  | 'mid-strip'
  | 'wide-bottom'
  | 'stamp'
  | 'rules';

export type FeatureBentoCell = {
  id: string;
  span: BentoSpan;
  media: BentoMedia;
};

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

export const FEATURE_BENTO_MORE: FeatureBentoMoreCell[] = [];
