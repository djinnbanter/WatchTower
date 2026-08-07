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
export const TAGLINE = "What's happening on your Minecraft server, and what to do next.";

/** Source: PRODUCT.md Product Purpose, README.md. */
export const SUPPORT_LINE =
  'Local ops dashboard for a dedicated host. Watches while the game runs. Data stays on that machine.';

/** Hero welcome overview. Source: PRODUCT.md purpose + local-first host. */
export const HERO_OVERVIEW =
  'Local ops dashboard for a NeoForge dedicated server. Watches while the game runs, then tells you what to fix. No cloud account. Data stays on the host.';

/** Hero context strip. Source: PRODUCT.md local-first / dedicated host / no required cloud. */
export const HERO_CONTEXT =
  'Local-first · dedicated host · no cloud required';

/** Scroll cue into the Live dashboard beat. */
export const SCROLL_CUE = 'Scroll into Live';

/** Close CTA headline. */
export const CLOSE_HEADLINE = 'Open the demo, then grab the jar.';

/** Close CTA body. */
export const CLOSE_BODY =
  'The demo is the real dashboard on sample fixtures. Click around first if you want, then install from Modrinth.';

/** Footer product blurb. */
export const FOOTER_BLURB =
  'Local ops dashboard for Minecraft dedicated servers. Runs as a jar on the same machine as the game.';

/**
 * Feature-tour capability + brings for Shift Log product beats.
 * Left columns name what the surface shows; dashboard mocks hold fixtures (no proof field).
 */
export const TOUR = {
  live: {
    capability:
      'TPS, lag, memory, players, and host load on charts while the server runs. You do not need latest.log open for the basics.',
    note: 'dashboard · Live',
    /** Source: docs/wiki/Live-Charts.md */
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
      'Ranked inbox for live finds, scan results, boot problems, and crash pointers. Pick a row, see what to do.',
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
    capability: 'Crashes grouped by fingerprint, with Fix, Evidence, and Details tabs.',
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
      'First screen after login: health grade, needs-attention list, and jumps into the rest of the dashboard.',
    note: 'dashboard · Overview',
    /** Source: docs/wiki/Dashboard-Overview.md */
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
    capability:
      'Day and week views for busy hours, world pressure, storage trends, and a weekly digest.',
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
      'Health grade, live vitals, and restart advice. WatchTower never restarts anything for you.',
  },
  {
    q: 'What should I fix next?',
    detail:
      'Issues, crashes, mods, backups, and world pressure. Each row says what to do next.',
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
    body: "Files stay on your server. We don't upload logs by default. Anonymous diagnostics and Cloud sync are opt-in.",
  },
  {
    title: "You're in control",
    body: 'Network features are opt-in. Risky actions show a preview and an undo. Nothing quietly edits your mods or world.',
  },
  {
    title: 'Ops, not surveillance',
    body: "Helps you run the server. Does not track players like an analytics product.",
  },
  {
    title: 'Drop-in beside your host',
    body: 'A jar in mods/. Not a second control panel you have to keep running.',
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

export const FOOTNOTE =
  'Free forever on your machine. GPL-3.0-or-later. Runs where the server runs.';
