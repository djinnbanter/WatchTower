/**
 * Features page — wording from the 2026 reword brief.
 * Capability ids stay stable for bento peeks where used.
 */

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
  tag: string;
  weight: 'lead' | 'standard';
  tone: FeatureTone;
  alpha?: boolean;
};

export const FEATURE_PAGE = {
  label: 'Feature List',
  title: 'All the tools on your operations desk',
  body: 'Whether it\'s watching live updates, saving game settings, or fixing problems after a crash, here\'s everything WatchTower offers right in your browser.',
} as const;

export const FEATURE_LEDE = FEATURE_PAGE.body;

export type FeatureGroup = {
  label: string;
  features: { title: string; body: string; alpha?: boolean }[];
};

/** Categorized Features page copy (word-for-word primary). */
export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    label: 'Monitor',
    features: [
      {
        title: 'Overview',
        body: 'Think of this as the main control center for your server. It shows how healthy your server is, ranging from Strong to Poor. It also highlights current issues, shows live stats like performance, and gives simple advice on whether to restart, wait, or proceed with caution.',
      },
      {
        title: 'Live Console',
        body: 'Shows real-time graphs of things like transaction speed, tick rate, memory usage, CPU load, disk activity, and background tasks. You can zoom in or out on the timeline from minutes to hours to find exactly when slowdowns happen.',
      },
      {
        title: 'Insights',
        body: 'Provides long-term data and planning information across eight different views:\n\n- Schedule: Finds the busiest times for players to help decide the best times to restart the server.\n\n- Load: Shows CPU and memory performance over days or weeks.\n\n- Incidents: Visualizes patterns of crashes or lag happening repeatedly.\n\n- Configs: Checks server settings and flags to suggest safe memory use and spot any bad configurations.\n\n- Mod Changes: Tracks when mods are added, removed, or updated.\n\n- World Pressure: Identifies issues with loading chunks or too many entities causing lag.\n\n- Storage Runway: Predicts how much disk space is left and shows detailed usage with interactive maps.\n\n- Weekly Digest: Automatically creates a weekly summary of crashes, uptime, and performance metrics right on your server.',
      },
      {
        title: 'Session & Join Clinic',
        body: 'See who\'s currently playing, review past peak times, and check playtime details. The Join Clinic helps diagnose why players might have trouble connecting, like mismatched mods or missing game files.',
      },
      {
        title: 'Startup Analyzer',
        body: 'Examines the server startup process, including boot times, launch steps, and warnings. It connects any startup errors directly to specific issues that can be fixed, making troubleshooting easier.',
      },
    ],
  },
  {
    label: 'Triage',
    features: [
      {
        title: 'Issues (Fix Inbox)',
        body: 'A sorted list of problems, ranked by how serious they are (Critical, Warning, Info). It automatically sorts issues like lag spikes, pauses, jar drift, misplaced client mods, script errors (KubeJS/CraftTweaker), world pressure, and backup warnings, along with simple steps to fix them.',
      },
      {
        title: 'Crash Center',
        body: 'Combines similar error reports into one easy-to-understand card. Shows likely causes from mods, full error details, and detects cases where the system was unexpectedly shut down due to running out of memory, even if no standard crash report was made.',
      },
      {
        title: 'Spark Workspace (Alpha)',
        body: 'Lets you import Spark profile links or files to analyze detailed performance data. It creates easy-to-read summaries, shows sources of lag, and traces what caused delays, all within the dashboard.',
        alpha: true,
      },
      {
        title: 'Log Viewer',
        body: 'An in-game log viewer that helps you quickly search, filter, and highlight important information in your latest log files, so you don\'t have to use a terminal or FTP tools.',
      },
    ],
  },
  {
    label: 'Operations',
    features: [
      {
        title: 'Mod Manager & Forensics',
        body: 'Easily manage and monitor your mods:\n\n- Library: Browse and filter all your mods and related files, whether on your computer or server.\n\n- Updates: Check if your mods are up-to-date and see how safe they are—safe, cautious, or potentially breaking.\n\n- Conflicts: Get alerts if different mods clash or if some needed files are missing.\n\n- Jar Drift Detection: Find mods that have been changed or replaced quietly while keeping the same file name.\n\n- Enable/Disable: Turn mods on or off smoothly by adding or removing a simple label, with safety warnings about your world.\n\n- Config Editor: Edit mod settings stored in JSON or TOML files easily, see real-time previews, make automatic backups, and undo changes with one click.',
      },
      {
        title: 'Backup Tracker',
        body: 'Keep an eye on your backup folders or external signals to make sure backups are fresh. It warns you if backups stop working or take too long. (Panel and Cloud monitoring are still being tested.)',
      },
      {
        title: 'Activity Timeline',
        body: 'See a combined timeline of important events like players joining, admin commands, lag spikes, and background tasks. It helps answer questions like "What happened just before the game crashed?"',
      },
      {
        title: 'Source Diagnostics',
        body: 'A built-in checker that makes sure background tools like WatchTower, file watchers, and scans are working properly.',
      },
    ],
  },
  {
    label: 'System & Sharing',
    features: [
      {
        title: 'Help Center',
        body: 'Easily find and search through guides and troubleshooting tips right from the dashboard sidebar.',
      },
      {
        title: 'Accounts & Audit Logging',
        body: 'Set who can do what with permissions for Owners, Admins, and Viewers. Manage user preferences, enable optional two-factor authentication, connect player skins, and view a permanent record of all actions taken by operators.',
      },
      {
        title: 'Support Pack Generator',
        body: 'Quickly create a zip file with important logs, crash reports, and setup details that have been cleaned of private info. Share these files easily with mod developers or support communities.',
      },
      {
        title: 'Security Posture',
        body: 'Keep your dashboard safe with password protection, secure connections through localhost or SSH tunnels, and protected API access.',
      },
      {
        title: 'CLI Disaster Recovery',
        body: 'Use a simple command-line tool included with WatchTower. If Minecraft won\'t start at all, run this tool over SSH to gather crash details and view logs in a standalone browser window for troubleshooting.',
      },
      {
        title: 'In-App Roadmap',
        body: 'See what\'s coming next and what\'s being worked on directly inside the admin settings, in real time.',
      },
    ],
  },
];

/** Kept for bento peeks — titles/blurbs aligned to reword where they map. */
export const FEATURE_CAPABILITIES: FeatureCapability[] = [
  {
    id: 'health-grade',
    title: 'Overview',
    blurb:
      'Think of this as the main control center for your server. It shows how healthy your server is, ranging from Strong to Poor. It also highlights current issues, shows live stats like performance, and gives simple advice on whether to restart, wait, or proceed with caution.',
    tag: 'Monitor',
    weight: 'lead',
    tone: 'danger',
  },
  {
    id: 'fix-inbox',
    title: 'Issues (Fix Inbox)',
    blurb:
      'A sorted list of problems, ranked by how serious they are (Critical, Warning, Info). It automatically sorts issues like lag spikes, pauses, jar drift, misplaced client mods, script errors (KubeJS/CraftTweaker), world pressure, and backup warnings, along with simple steps to fix them.',
    tag: 'Triage',
    weight: 'lead',
    tone: 'danger',
  },
  {
    id: 'join-clinic',
    title: 'Session & Join Clinic',
    blurb:
      'See who\'s currently playing, review past peak times, and check playtime details. The Join Clinic helps diagnose why players might have trouble connecting, like mismatched mods or missing game files.',
    tag: 'Monitor',
    weight: 'lead',
    tone: 'accent',
  },
  {
    id: 'world-pressure',
    title: 'World Pressure',
    blurb: 'Identifies issues with loading chunks or too many entities causing lag.',
    tag: 'Insights',
    weight: 'lead',
    tone: 'mspt',
  },
  {
    id: 'support-pack',
    title: 'Support Pack Generator',
    blurb:
      'Quickly create a zip file with important logs, crash reports, and setup details that have been cleaned of private info. Share these files easily with mod developers or support communities.',
    tag: 'System & Sharing',
    weight: 'lead',
    tone: 'ok',
  },
  {
    id: 'live-vitals',
    title: 'Live Console',
    blurb:
      'Shows real-time graphs of things like transaction speed, tick rate, memory usage, CPU load, disk activity, and background tasks. You can zoom in or out on the timeline from minutes to hours to find exactly when slowdowns happen.',
    tag: 'Monitor',
    weight: 'standard',
    tone: 'tps',
  },
  {
    id: 'gc-ram',
    title: 'GC / JVM + RAM advice',
    blurb:
      'Checks server settings and flags to suggest safe memory use and spot any bad configurations.',
    tag: 'Insights',
    weight: 'standard',
    tone: 'heap',
  },
  {
    id: 'crash-fingerprints',
    title: 'Crash Center',
    blurb:
      'Combines similar error reports into one easy-to-understand card. Shows likely causes from mods, full error details, and detects cases where the system was unexpectedly shut down due to running out of memory, even if no standard crash report was made.',
    tag: 'Triage',
    weight: 'standard',
    tone: 'danger',
  },
  {
    id: 'external-kill',
    title: 'External kill / OOM',
    blurb:
      'Detects cases where the system was unexpectedly shut down due to running out of memory, even if no standard crash report was made.',
    tag: 'Triage',
    weight: 'standard',
    tone: 'danger',
  },
  {
    id: 'silent-fails',
    title: 'Silent script fails',
    blurb: 'Script errors (KubeJS/CraftTweaker) that never crash still show up in the Fix inbox.',
    tag: 'Triage',
    weight: 'standard',
    tone: 'warn',
  },
  {
    id: 'mods-modrinth',
    title: 'Mod Manager & Forensics',
    blurb:
      'Easily manage and monitor your mods: Library, Updates, Conflicts, Jar Drift Detection, Enable/Disable, and Config Editor.',
    tag: 'Operations',
    weight: 'standard',
    tone: 'accent',
  },
  {
    id: 'jar-drift',
    title: 'Jar Drift Detection',
    blurb: 'Find mods that have been changed or replaced quietly while keeping the same file name.',
    tag: 'Operations',
    weight: 'standard',
    tone: 'warn',
  },
  {
    id: 'jar-disable',
    title: 'Enable/Disable',
    blurb:
      'Turn mods on or off smoothly by adding or removing a simple label, with safety warnings about your world.',
    tag: 'Operations',
    weight: 'standard',
    tone: 'warn',
  },
  {
    id: 'mod-configs',
    title: 'Config Editor',
    blurb:
      'Edit mod settings stored in JSON or TOML files easily, see real-time previews, make automatic backups, and undo changes with one click.',
    tag: 'Operations',
    weight: 'standard',
    tone: 'accent',
  },
  {
    id: 'schedule-load',
    title: 'Schedule + Load',
    blurb:
      'Finds the busiest times for players to help decide the best times to restart the server. Shows CPU and memory performance over days or weeks.',
    tag: 'Insights',
    weight: 'standard',
    tone: 'players',
  },
  {
    id: 'storage-runway',
    title: 'Storage Runway',
    blurb: 'Predicts how much disk space is left and shows detailed usage with interactive maps.',
    tag: 'Insights',
    weight: 'standard',
    tone: 'disk',
  },
  {
    id: 'storage-space-map',
    title: 'Storage space map',
    blurb: 'Predicts how much disk space is left and shows detailed usage with interactive maps.',
    tag: 'Insights',
    weight: 'standard',
    tone: 'disk',
  },
  {
    id: 'weekly-digest',
    title: 'Weekly Digest',
    blurb:
      'Automatically creates a weekly summary of crashes, uptime, and performance metrics right on your server.',
    tag: 'Insights',
    weight: 'standard',
    tone: 'lantern',
  },
  {
    id: 'config-audit',
    title: 'Configs',
    blurb:
      'Checks server settings and flags to suggest safe memory use and spot any bad configurations.',
    tag: 'Insights',
    weight: 'standard',
    tone: 'info',
  },
  {
    id: 'spark',
    title: 'Spark Workspace (Alpha)',
    blurb:
      'Lets you import Spark profile links or files to analyze detailed performance data. It creates easy-to-read summaries, shows sources of lag, and traces what caused delays, all within the dashboard.',
    tag: 'Triage',
    weight: 'standard',
    tone: 'lantern',
    alpha: true,
  },
  {
    id: 'spark-map',
    title: 'Spark Map',
    blurb: 'Shows sources of lag and traces what caused delays, all within the dashboard.',
    tag: 'Triage',
    weight: 'standard',
    tone: 'lantern',
  },
  {
    id: 'backups',
    title: 'Backup Tracker',
    blurb:
      'Keep an eye on your backup folders or external signals to make sure backups are fresh. It warns you if backups stop working or take too long. (Panel and Cloud monitoring are still being tested.)',
    tag: 'Operations',
    weight: 'standard',
    tone: 'ok',
  },
  {
    id: 'activity',
    title: 'Activity Timeline',
    blurb:
      'See a combined timeline of important events like players joining, admin commands, lag spikes, and background tasks. It helps answer questions like "What happened just before the game crashed?"',
    tag: 'Operations',
    weight: 'standard',
    tone: 'mspt',
  },
  {
    id: 'logs',
    title: 'Log Viewer',
    blurb:
      'An in-game log viewer that helps you quickly search, filter, and highlight important information in your latest log files, so you don\'t have to use a terminal or FTP tools.',
    tag: 'Triage',
    weight: 'standard',
    tone: 'info',
  },
  {
    id: 'startup',
    title: 'Startup Analyzer',
    blurb:
      'Examines the server startup process, including boot times, launch steps, and warnings. It connects any startup errors directly to specific issues that can be fixed, making troubleshooting easier.',
    tag: 'Monitor',
    weight: 'standard',
    tone: 'accent',
  },
  {
    id: 'sources',
    title: 'Source Diagnostics',
    blurb:
      'A built-in checker that makes sure background tools like WatchTower, file watchers, and scans are working properly.',
    tag: 'Operations',
    weight: 'standard',
    tone: 'tps',
  },
  {
    id: 'accounts',
    title: 'Accounts & Audit Logging',
    blurb:
      'Set who can do what with permissions for Owners, Admins, and Viewers. Manage user preferences, enable optional two-factor authentication, connect player skins, and view a permanent record of all actions taken by operators.',
    tag: 'System & Sharing',
    weight: 'standard',
    tone: 'accent',
  },
  {
    id: 'theme-accent',
    title: 'Theme + accent',
    blurb: 'Manage user preferences from the dashboard.',
    tag: 'System & Sharing',
    weight: 'standard',
    tone: 'info',
  },
  {
    id: 'auth',
    title: 'Security Posture',
    blurb:
      'Keep your dashboard safe with password protection, secure connections through localhost or SSH tunnels, and protected API access.',
    tag: 'System & Sharing',
    weight: 'standard',
    tone: 'ok',
  },
  {
    id: 'help',
    title: 'Help Center',
    blurb:
      'Easily find and search through guides and troubleshooting tips right from the dashboard sidebar.',
    tag: 'System & Sharing',
    weight: 'standard',
    tone: 'info',
  },
  {
    id: 'cli-dr',
    title: 'CLI Disaster Recovery',
    blurb:
      'Use a simple command-line tool included with WatchTower. If Minecraft won\'t start at all, run this tool over SSH to gather crash details and view logs in a standalone browser window for troubleshooting.',
    tag: 'System & Sharing',
    weight: 'standard',
    tone: 'warn',
  },
];
