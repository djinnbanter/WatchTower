/**
 * Marketing site copy — primary wording from the 2026 reword brief.
 * Display spelling: WatchTower
 */

/** Meta / SEO fallback (Home meta description is preferred where set). */
export const TAGLINE =
  'WatchTower keeps an eye on your NeoForge server while it\'s running, helps organize issues into easy-to-understand lists, and makes troubleshooting crashes and lag simpler—all without relying on cloud tracking or replacing your control panel.';

/** Home hero display title. */
export const HERO_DISPLAY = 'Minecraft Ops, Sorted!';

export const SUPPORT_LINE =
  'Just put the jar in the mods folder. It runs while your game is active and shows you a simple list of fixes on your computer.';

/** Home hero body. */
export const HERO_OVERVIEW =
  'I made WatchTower because I was tired of jumping between control panels, latest logs, and crash reports late at night. Just put the jar in the mods folder. It runs while your game is active and shows you a simple list of fixes on your computer. No need for a cloud account.';

/** Hero stamp / context. */
export const HERO_CONTEXT = 'Local Ops Desk';

export const HERO_PRIMARY_CTA = 'Get it on Modrinth';
export const HERO_SECONDARY_CTA = 'Try the live demo';

/** Hero status strip — dashboard V2 is in progress, not a ship date. */
export const HERO_V2_NOTE = 'V2 coming soon';
export const HERO_V2_DETAIL = 'New desk UI in the works — current build still ships today.';

/** Scroll cue into the next home board. */
export const HERO_SCROLL_CUE = 'Scroll for more';

/** Scroll cue into Issues. */
export const SCROLL_CUE = 'Check out the Fix inbox';

/** Product boundary / what-is section. */
export const WHAT_IS_LABEL = 'What WatchTower Is (and Isn\'t)';
export const WHAT_IS_TITLE = 'Your Operations Desk, Not a Replacement Panel';
export const WHAT_IS_LEAD =
  'WatchTower sits next to your main control panel, not on top of it. It doesn\'t start or stop your server, secretly delete mods, or keep an eye on your players. Instead, it watches your server\'s health, helps prioritize issues, and provides clear advice so you can make the best decisions.';

export const WHAT_IS_BODY = WHAT_IS_LEAD;

export const WHAT_IS_FACTS = [
  {
    label: 'Keeps Data Local and Private',
    detail: 'All information stays on your server—no cloud accounts or hidden tracking needed.',
  },
  {
    label: 'Offers Recommendations, Not Automatic Actions',
    detail:
      'WatchTower suggests when to restart and points out problematic mods. You or your control panel choose when to make changes—no automatic moves.',
  },
  {
    label: 'Helps Troubleshoot, Not Spy',
    detail:
      'Player lists help explain lag or connection issues—they aren\'t used to gather player data or monitor players.',
  },
] as const;

/** Overview / restart proof beat. */
export const HOME_OVERVIEW_LABEL = 'Live Status';
export const HOME_OVERVIEW_TITLE = 'Find out if it\'s safe to restart now.';
export const HOME_OVERVIEW_BODY =
  'Get an instant health update and advice on whether to restart before you hit reboot. WatchTower looks at busy times, how many players are online, and current server activity so you don\'t accidentally ruin a good session.';
export const HOME_OVERVIEW_CTA = 'See how restart advice works';

/** Legacy combined lead — prefer HOME_OVERVIEW_* / HOME_INSIGHTS_*. */
export const HOME_OVERVIEW_INSIGHTS_LEAD = HOME_OVERVIEW_BODY;

/** Insights / storage proof beat. */
export const HOME_INSIGHTS_LABEL = 'Long-Term Health';
export const HOME_INSIGHTS_TITLE = 'Check your disk space before it\'s all used up';
export const HOME_INSIGHTS_BODY =
  'Keep an eye on how your storage is growing, watch for sudden jumps in data, and see how much time you have before you run out of space. Know how many days you can store more data and find the best times for quiet maintenance.';
export const HOME_INSIGHTS_CTA = 'See Insights tools';

/** Close CTA. */
export const CLOSE_LABEL = 'Get Started';
export const CLOSE_HEADLINE = 'Ready to Make Your Server Run Smoother?';
export const CLOSE_BODY =
  'Just drop the file into the mods folder, restart your server once, and open port 8787. It\'s free, open for everyone, and made for NeoForge 1.21.x.';
export const CLOSE_PRIMARY_CTA = 'Download from Modrinth';
export const CLOSE_SECONDARY_CTA = 'View the Installation Guide';

/** Footer product blurb. */
export const FOOTER_BLURB =
  'WatchTower is a free, easy-to-use tool that helps manage your modded Minecraft server right from your computer. It\'s designed for server admins who want clear information without having to sift through complex logs.';

/**
 * Feature-tour capability + brings for home proof beats.
 */
export const TOUR = {
  live: {
    capability:
      'Shows real-time graphs of things like transaction speed, tick rate, memory usage, CPU load, disk activity, and background tasks. You can zoom in or out on the timeline from minutes to hours to find exactly when slowdowns happen.',
    note: 'dashboard · Live',
    brings: [
      {
        title: 'Game vitals',
        detail: 'TPS, MSPT, memory, and player count, with health colours on the numbers.',
      },
      {
        title: 'Host and storage',
        detail: 'CPU, disk, and Java heap as their own readouts.',
      },
      {
        title: 'Network, thermal, world jobs',
        detail: 'Bandwidth, thermals, and background world work when the server reports them.',
      },
      {
        title: 'Windows you pick',
        detail: 'From 5 minutes out to 30 days. Hover or drag for the exact time and value.',
      },
    ],
  },
  issues: {
    capability:
      'WatchTower checks your logs, scripts, and server performance every minute. If a KubeJS script runs into an issue, a client-only jar file gets added silently, or the server pauses temporarily, WatchTower creates a clear step-by-step guide to fix it.',
    note: 'Issues Inbox',
    title: 'Your organized list of problems on your server',
    cta: 'Check out the Fix inbox',
    brings: [
      {
        title: 'Active / Reviewed',
        detail:
          'Open queue and a reviewed state. Reviewed clears the inbox; crash files and jars stay on disk.',
      },
      {
        title: 'Severity bands',
        detail:
          'Critical, Warning, and Info. Jar drift, world pressure, join clinic, silent script fails, and more.',
      },
      {
        title: 'Fix and Details',
        detail:
          'Fix tab for the next step. Details for the evidence. Links into Crashes, Mods, Live, and Sources.',
      },
      {
        title: 'Tools',
        detail: 'Inbox filters, including boot filters from Startup.',
      },
    ],
  },
  crashes: {
    capability:
      'WatchTower groups similar crash details so you don\'t have to read the same report over and over. It points out the likely problem mod, shows the clues that led to that conclusion, and recognizes when the server was killed by the operating system without leaving a crash log.',
    note: 'Crashes',
    title: 'Crash Reports Made Easy',
    cta: 'Learn how crash grouping works',
    brings: [
      {
        title: 'Fingerprint groups',
        detail: 'Matching crash shapes stacked in one group.',
      },
      {
        title: 'Fix / Evidence / Details',
        detail: 'Next steps, linked stacks and files, then fingerprint metadata.',
      },
      {
        title: 'Odd shutdowns',
        detail: 'External kill and OOM entries when latest.log stops with no crash dump.',
      },
      {
        title: 'Reviewed stays on disk',
        detail: 'Mark reviewed clears the Review queue. Files stay under crash-reports/.',
      },
    ],
  },
  overview: {
    capability: HOME_OVERVIEW_BODY,
    note: HOME_OVERVIEW_LABEL,
    title: HOME_OVERVIEW_TITLE,
    brings: [
      {
        title: 'Health grade',
        detail: 'Letter grade from WatchTower signals, Strong through Poor.',
      },
      {
        title: 'Needs attention',
        detail: 'Short queue into Issues, crashes, backups, and related surfaces.',
      },
      {
        title: 'Restart advice',
        detail:
          'Safe, Caution, or Wait. Advisory only. WatchTower does not restart the server.',
      },
      {
        title: 'Jump cards',
        detail: 'Shortcuts into performance insight, weekly digest, storage, Spark, and boot profile.',
      },
    ],
  },
  insights: {
    capability: HOME_INSIGHTS_BODY,
    note: HOME_INSIGHTS_LABEL,
    title: HOME_INSIGHTS_TITLE,
    brings: [
      {
        title: 'Schedule',
        detail: 'Busy-hour and quiet-hour chart, plus a suggested restart window.',
      },
      {
        title: 'World pressure',
        detail: 'Live vs busy-hours p95, and the peak minute over 7d or 30d.',
      },
      {
        title: 'Storage and digest',
        detail: 'Disk trends on Storage, and a weekly ops digest from data already on the host.',
      },
      {
        title: 'Vs Live',
        detail: 'Live is the current second. Insights is the repeating pattern.',
      },
    ],
  },
} as const;

export const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL || '/demo';

export const TWO_QUESTIONS = [
  {
    q: 'Is the server okay right now?',
    detail:
      'Health grade, live vitals, and restart advice. WatchTower never restarts anything for you.',
  },
  {
    q: 'What should I fix next?',
    detail:
      'Issues, crashes, mods, backups, and world pressure. Each row says what to do next.',
  },
] as const;

export const READOUTS = [
  { label: 'Watching', value: 'while the game runs' },
  { label: 'Scanning', value: 'logs, mods, crashes, disk' },
  { label: 'Fix inbox', value: 'ranked, with next steps' },
] as const;

export const PROMISES = [
  {
    title: 'Keeps Data Local and Private',
    body: 'All information stays on your server—no cloud accounts or hidden tracking needed.',
  },
  {
    title: 'Offers Recommendations, Not Automatic Actions',
    body: 'WatchTower suggests when to restart and points out problematic mods. You or your control panel choose when to make changes—no automatic moves.',
  },
  {
    title: 'Helps Troubleshoot, Not Spy',
    body: 'Player lists help explain lag or connection issues—they aren\'t used to gather player data or monitor players.',
  },
  {
    title: 'Drop-in beside your host',
    body: 'A jar in mods/. Not a second control panel you have to keep running.',
  },
] as const;

export const NOT_OUR_JOB = [
  {
    weDont: 'Host panels',
    detail: 'Start, stop, files, console',
    useInstead: 'Pterodactyl, Crafty, AMP, bare metal',
  },
  {
    weDont: 'Player analytics',
    detail: 'Retention, GeoIP, leaderboards',
    useInstead: 'Plan and similar',
  },
  {
    weDont: 'Client GPU crash tooling',
    detail: 'Graphics driver and renderer faults',
    useInstead: 'Does not apply to headless dedicated servers',
  },
] as const;

export const LINKS = {
  modrinth: 'https://modrinth.com/mod/watchtower',
  github: 'https://github.com/djinnbanter/WatchTower',
  releasesLatest: 'https://github.com/djinnbanter/WatchTower/releases/latest',
  wiki: 'https://github.com/djinnbanter/WatchTower/wiki',
  wikiInstall: 'https://github.com/djinnbanter/WatchTower/wiki/Installation',
  wikiDisasterRecovery:
    'https://github.com/djinnbanter/WatchTower/wiki/Disaster-Recovery',
  wikiSecurity: 'https://github.com/djinnbanter/WatchTower/wiki/Security-and-Access',
  license: 'https://github.com/djinnbanter/WatchTower/blob/main/LICENSE',
} as const;

export const FOOTNOTE =
  'WatchTower is free and open-source software released under GPL-3.0. Minecraft is a registered trademark of Mojang Synergies AB. WatchTower is not affiliated with or endorsed by Mojang, Microsoft, or NeoForge.';

/** Page meta descriptions from the reword. */
export const PAGE_META = {
  home: {
    title: 'WatchTower — Local Dashboard for Minecraft Servers',
    description:
      'WatchTower keeps an eye on your NeoForge server while it\'s running, helps organize issues into easy-to-understand lists, and makes troubleshooting crashes and lag simpler—all without relying on cloud tracking or replacing your control panel.',
  },
  how: {
    title: 'How WatchTower Works — Continuous Monitoring & Troubleshooting',
    description:
      'Discover how WatchTower gathers real-time data, checks logs for problems, and creates clean support reports directly on your NeoForge server.',
  },
  features: {
    title: 'Features — WatchTower Minecraft Server Dashboard',
    description:
      'See all the tools WatchTower offers: live server stats, organized list of fixes, crash analysis, mod setup editor, disk usage estimates, and command-line recovery options.',
  },
  install: {
    title: 'Installation Guide — WatchTower',
    description:
      'Easy step-by-step instructions to set up WatchTower on your NeoForge 1.21.x dedicated server in less than two minutes.',
  },
  faq: {
    title: 'FAQ — WatchTower Server Dashboard',
    description:
      'Common questions answered about how WatchTower stores data locally, resource usage, compatible control panels, and security concerns.',
  },
  demo: {
    title: 'Interactive Demo — WatchTower Server Dashboard',
    description:
      'Try out WatchTower in your browser with live demo data, including server stats, crash reports, and troubleshooting tools.',
  },
} as const;
