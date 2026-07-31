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

/** Single hero line. Product: local ops desk for dedicated MC servers (PRODUCT.md). */
export const TAGLINE = 'The ops desk for your Minecraft server.';

/** Source: PRODUCT.md Product Purpose, README.md. */
export const SUPPORT_LINE =
  'It watches the server while it runs, then tells you what to fix. Everything stays on the machine you already use.';

/** Hero welcome overview. Source: PRODUCT.md purpose + local-first host. */
export const HERO_OVERVIEW =
  'It watches the server while it runs, then tells you what to fix. Everything stays on the machine you already use.';

/** Hero context strip. Source: PRODUCT.md local-first / dedicated host / no required cloud. */
export const HERO_CONTEXT =
  'Local-first · dedicated host · no cloud required';

/** Scroll cue into the Live desk beat. */
export const SCROLL_CUE = 'Scroll the desk';

/** Close CTA headline. */
export const CLOSE_HEADLINE = 'Try the demo, then get it on Modrinth.';

/** Close CTA body. */
export const CLOSE_BODY =
  'The demo is the real dashboard on sample data. Click around before you install.';

/** Footer product blurb. */
export const FOOTER_BLURB =
  'A local ops desk for Minecraft dedicated servers. It runs on the machine your server already runs on.';

/**
 * Feature-tour capability + brings for Shift Log product beats.
 * Left columns teach features; desk mocks hold fixtures (no proof field).
 */
export const TOUR = {
  live: {
    capability:
      'See how healthy the server is right now - ticks, lag, memory, players, and the host PC - without digging through log files.',
    note: 'desk · Live',
    /** Source: docs/wiki/Live-Charts.md */
    brings: [
      {
        title: 'Game vitals',
        detail:
          'TPS (ticks per second), tick lag (MSPT), memory, and player count, colour-coded so problems stand out.',
      },
      {
        title: 'Host and storage',
        detail:
          'CPU, disk, and Java heap shown separately when free RAM on the host is messy.',
      },
      {
        title: 'Network, thermal, world jobs',
        detail:
          'Bandwidth, thermals, and background world work when those signals are available.',
      },
      {
        title: 'Windows you pick',
        detail:
          'History from 5 minutes to 30 days. Hover or drag for the exact time and value.',
      },
    ],
  },
  issues: {
    capability:
      'Your fix list: live finds, scan results, boot problems, and crash pointers in one place.',
    note: 'desk · Issues',
    /** Source: docs/wiki/Issues.md */
    brings: [
      {
        title: 'Active / Reviewed',
        detail:
          'Work the open list, then mark reviewed. That clears inbox state - it does not delete crash files or jars.',
      },
      {
        title: 'Severity bands',
        detail:
          'Critical, Warning, Info. Jar drift, world pressure, join clinic, and silent script fails land there by severity.',
      },
      {
        title: 'Fix and Details',
        detail:
          'Fix is the next step. Details holds the evidence. Links jump into Crashes, Mods, Live, or Sources.',
      },
      {
        title: 'Tools',
        detail:
          'Filters and inbox utilities. Boot filters help when Startup flagged config or launch problems.',
      },
    ],
  },
  crashes: {
    capability:
      'Crashes grouped by fingerprint, with Fix, Evidence, and Details side by side.',
    note: 'desk · Crashes',
    /** Source: docs/wiki/Crashes.md + PRODUCT.md advisory */
    brings: [
      {
        title: 'Fingerprint groups',
        detail:
          'Same crash shape stacks together so you are not re-reading every identical report.',
      },
      {
        title: 'Fix / Evidence / Details',
        detail:
          'Next steps first, then stacks and linked files, then fingerprint metadata when you need it.',
      },
      {
        title: 'Odd shutdowns',
        detail:
          'External kill and OOM cases still show up when latest.log just stops and there is no crash dump.',
      },
      {
        title: 'Reviewed stays on disk',
        detail:
          'Mark reviewed clears the Review queue. Files stay under crash-reports/ until you remove them.',
      },
    ],
  },
  overview: {
    capability:
      'Your home screen after login: a health grade, a short list of what needs attention, and links into the rest of the desk.',
    note: 'desk · Overview',
    /** Source: docs/wiki/Dashboard-Overview.md */
    brings: [
      {
        title: 'Health grade',
        detail:
          'A snapshot from WatchTower signals. Strong means keep the daily check short. Poor means treat it like an incident.',
      },
      {
        title: 'Needs attention',
        detail:
          'A queue of the next things to open - Issues, crashes, backups, and similar.',
      },
      {
        title: 'Restart advice',
        detail:
          'Safe, Caution, or Wait. Informational only. WatchTower never restarts the server for you.',
      },
      {
        title: 'Jump cards',
        detail:
          'Performance insight, weekly digest, storage, Spark, and boot profile when those signals exist.',
      },
    ],
  },
  insights: {
    capability:
      'Patterns over days and weeks, not the live second. Busy hours, world pressure, storage, and a weekly digest.',
    note: 'desk · Insights',
    /** Source: docs/wiki/Insights.md */
    brings: [
      {
        title: 'Schedule',
        detail:
          'Busy hours and quieter windows so restart advice has a clock behind it. Suggests a window; your panel still runs the restart.',
      },
      {
        title: 'World pressure',
        detail:
          'Live now vs busy-hours p95 and the peak minute in the 7d / 30d window.',
      },
      {
        title: 'Storage and digest',
        detail:
          'Disk trends on Storage. Weekly ops digest from data already on the host - no outbound mail.',
      },
      {
        title: 'Vs Live',
        detail:
          'Live answers what is happening now. Insights answers what keeps repeating.',
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
  license: 'https://github.com/djinnbanter/WatchTower/blob/main/LICENSE',
} as const;

export const FOOTNOTE = 'Free forever on your machine. GPL-3.0-or-later. Runs where the server runs.';
