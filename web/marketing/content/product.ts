/**
 * Claim sources (do not invent beyond these):
 * - Tagline + two questions: README.md, PRODUCT.md
 * - Local-first / no required cloud / no telemetry by default: PRODUCT.md, docs/ROADMAP.md Promises
 * - Advisory only (no restart, no quiet mod/world edits): README.md, PRODUCT.md
 * - Modrinth never downloads jars: PRODUCT.md / wiki Mods
 * - Not host panel / not player analytics / not client GPU: docs/ROADMAP.md "Not our job"
 * - License GPL-3.0-or-later; local dashboard free forever: README.md, PRODUCT.md
 * - NeoForge 1.21.x, Java 21, Linux dedicated common: README.md
 * Display spelling: WatchTower (DESIGN.md / PRODUCT.md)
 */

/** Single hero line. Product: local ops dashboard for dedicated MC servers (PRODUCT.md). */
export const TAGLINE = 'The ops dashboard for your Minecraft server.';

/** Source: PRODUCT.md Product Purpose, README.md. */
export const SUPPORT_LINE =
  'It watches the server while it runs, then tells you what to fix. Everything stays on the machine you already use.';

/** Hero welcome overview. Source: PRODUCT.md purpose + local-first host. */
export const HERO_OVERVIEW =
  'It watches the server while it runs, then tells you what to fix. Everything stays on the machine you already use.';

/** Hero context strip. Source: PRODUCT.md local-first / dedicated host / no required cloud. */
export const HERO_CONTEXT =
  'NeoForge · dedicated host · no cloud required';

/** Scroll cue into the Live dashboard beat. */
export const SCROLL_CUE = 'Scroll the dashboard';

/** Close CTA headline. */
export const CLOSE_HEADLINE = 'Try the demo, then get it on Modrinth.';

/** Close CTA body. */
export const CLOSE_BODY =
  'The demo is the real dashboard on sample data. Click around before you install.';

/** Footer product blurb. */
export const FOOTER_BLURB =
  'A local ops dashboard for Minecraft dedicated servers. It runs on the machine your server already runs on.';

/**
 * Feature-tour capability + brings for Shift Log product beats.
 * Left columns name what the surface shows; dashboard mocks hold fixtures (no proof field).
 */
export const TOUR = {
  live: {
    capability:
      'Live charts for ticks, lag, memory, players, and host load - no need to open latest.log.',
    note: 'dashboard · Live',
    /** Source: docs/wiki/Live-Charts.md */
    brings: [
      {
        title: 'Game vitals',
        detail: 'TPS (ticks per second), tick lag (MSPT), memory, and player count with health colours.',
      },
      {
        title: 'Host and storage',
        detail: 'CPU, disk, and Java heap as separate readouts.',
      },
      {
        title: 'Network, thermal, world jobs',
        detail: 'Bandwidth, thermals, and background world work when the server reports them.',
      },
      {
        title: 'Windows you pick',
        detail: 'Ranges from 5 minutes to 30 days. Hover or drag for the exact time and value.',
      },
    ],
  },
  issues: {
    capability:
      'A ranked fix inbox for live finds, scan results, boot problems, and crash pointers.',
    note: 'dashboard · Issues',
    /** Source: docs/wiki/Issues.md */
    brings: [
      {
        title: 'Active / Reviewed',
        detail:
          'Open queue and a reviewed state. Reviewed clears the inbox; crash files and jars stay on disk.',
      },
      {
        title: 'Severity bands',
        detail:
          'Critical, Warning, and Info. Covers jar drift, world pressure, join clinic, silent script fails, and more.',
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
    capability: 'Fingerprint-grouped crashes with Fix, Evidence, and Details tabs.',
    note: 'dashboard · Crashes',
    /** Source: docs/wiki/Crashes.md + PRODUCT.md advisory */
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
    capability:
      'Home screen after login: health grade, needs-attention list, and jump links into the dashboard.',
    note: 'dashboard · Overview',
    /** Source: docs/wiki/Dashboard-Overview.md */
    brings: [
      {
        title: 'Health grade',
        detail: 'Letter grade from WatchTower signals, from Strong through Poor.',
      },
      {
        title: 'Needs attention',
        detail: 'Short queue into Issues, crashes, backups, and related surfaces.',
      },
      {
        title: 'Restart advice',
        detail:
          'Safe, Caution, or Wait labels. Advisory only - WatchTower does not restart the server.',
      },
      {
        title: 'Jump cards',
        detail: 'Cards into performance insight, weekly digest, storage, Spark, and boot profile.',
      },
    ],
  },
  insights: {
    capability:
      'Day-and-week views: busy hours, world pressure, storage trends, and a weekly digest.',
    note: 'dashboard · Insights',
    /** Source: docs/wiki/Insights.md */
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
      'A health grade, live vitals, and restart advice. WatchTower never restarts anything for you.',
  },
  {
    q: 'What should I fix next?',
    detail:
      'Issues, crashes, mods, backups, and world pressure. Each one has a plain next step.',
  },
] as const;

/**
 * Instrument captions for the loop band. These describe what the product does.
 * They are not measured performance claims and no numbers are invented here.
 */
export const READOUTS = [
  { label: 'Watching', value: 'while the game runs' },
  { label: 'Scanning', value: 'logs, mods, crashes, disk' },
  { label: 'Fix inbox', value: 'ranked, with next steps' },
] as const;

/** Source: docs/ROADMAP.md "## Promises that don't change" */
export const PROMISES = [
  {
    title: 'Your data stays yours',
    body: "Your files stay on your server. We don't upload logs by default. Anonymous diagnostics and Cloud sync are opt-in.",
  },
  {
    title: "You're in control",
    body: 'Network features are opt-in. Risky actions show a preview and an undo. Nothing quietly edits your mods or world.',
  },
  {
    title: 'Ops, not surveillance',
    body: "It helps you run the server. It doesn't track players like an analytics product.",
  },
  {
    title: 'Drop-in beside your host',
    body: "A jar in mods/. Not a second control panel you have to keep running.",
  },
] as const;

/** Source: docs/ROADMAP.md "## Not our job" */
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
  license: 'https://github.com/djinnbanter/WatchTower/blob/main/LICENSE',
} as const;

export const FOOTNOTE = 'Free forever on your machine. GPL-3.0-or-later. Runs where the server runs.';
