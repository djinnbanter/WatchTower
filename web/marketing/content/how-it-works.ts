/**
 * How it works operating-model tour copy.
 * Sources: PRODUCT.md, docs/wiki/Installation, Disaster-Recovery, README.
 * Hyphens only. No Fabric shipping claims. No promises / not-our-job.
 */

export type HowBring = {
  title: string;
  detail: string;
};

export const HOW = {
  drop: {
    title: 'Drop',
    capability:
      'Drop the jar in mods/. Restart the server once. That is the install.',
    brings: [
      {
        title: 'Jar in mods/',
        detail: 'Put the WatchTower jar next to your other mods on the dedicated host.',
      },
      {
        title: 'Full steps',
        detail: 'Need credentials, ports, or troubleshooting? Use the Install page and wiki.',
      },
      {
        title: 'Get the jar',
        detail: 'Download from Modrinth or GitHub Releases. Match the release to your Minecraft line.',
      },
    ] as const satisfies readonly HowBring[],
    note: 'host · mods/',
  },
  wizard: {
    title: 'First run',
    capability:
      'On first open, a short wizard sets the account, options, Initial discovery, backups, and security.',
    brings: [
      {
        title: 'Account',
        detail: 'Create the dashboard login. Change the default watchtower / password pair.',
      },
      {
        title: 'Options',
        detail: 'Pick the monitoring basics so Watching starts with the right switches.',
      },
      {
        title: 'Initial discovery',
        detail: 'WatchTower scans the host once so Issues and Overview have something real to show.',
      },
      {
        title: 'Backups',
        detail: 'Point at backup paths so disk and restore checks know where your saves live.',
      },
      {
        title: 'Security',
        detail: 'Lock down access. Prefer localhost or an SSH tunnel for the dashboard port.',
      },
    ] as const satisfies readonly HowBring[],
    note: 'desk · first run',
  },
  loop: {
    title: 'Loop',
    capability:
      'While the game runs, WatchTower watches, scans, and fills a fix inbox with next steps. No giant scheduled audit to sit through.',
    brings: [
      {
        title: 'Watching',
        detail: 'Vitals and host signals keep updating while Minecraft is up.',
      },
      {
        title: 'Scanning',
        detail: 'Logs, mods, crashes, and disk get checked into the ops cache on the host.',
      },
      {
        title: 'Fix inbox',
        detail: 'Issues land ranked with a plain next step. You decide what to do.',
      },
    ] as const satisfies readonly HowBring[],
    note: 'desk · continuous',
  },
  disk: {
    title: 'On disk',
    capability:
      'Runtime data lives under the server watchtower/ folder. Files stay on the host unless you opt into a network feature.',
    brings: [
      {
        title: 'ops-cache',
        detail: 'Working cache for scans and live status.',
      },
      {
        title: 'state',
        detail: 'Dashboard and session state for this host.',
      },
      {
        title: 'Spark / support',
        detail: 'Optional Spark uploads and support zips you build to share evidence.',
      },
    ] as const satisfies readonly HowBring[],
    note: 'host · watchtower/',
  },
  desk: {
    title: 'Desk',
    capability:
      'Open the embedded dashboard on port 8787. Prefer localhost or an SSH tunnel. Do not expose it to the open internet.',
    brings: [
      {
        title: 'Port 8787',
        detail: 'Default dashboard port on the machine that runs the game.',
      },
      {
        title: 'Localhost / SSH',
        detail: 'Reach it from the host itself or through a tunnel. Keep it off the public internet.',
      },
      {
        title: 'Change the login',
        detail: 'Default is watchtower / password. Change it on first run.',
      },
    ] as const satisfies readonly HowBring[],
    note: 'desk · :8787',
  },
  cli: {
    title: 'CLI',
    capability:
      'If Minecraft will not boot, use the optional disaster-recovery CLI. It is separate from the live dashboard.',
    brings: [
      {
        title: 'When to use it',
        detail: 'Game process will not stay up. The live desk cannot help until the server starts again.',
      },
      {
        title: 'Command',
        detail: 'Run java -jar watchtower-cli-<version>.jar dr. Match the jar version from Releases.',
      },
      {
        title: 'Wiki',
        detail: 'Full flags and bundle steps live on the Disaster Recovery wiki page.',
      },
    ] as const satisfies readonly HowBring[],
    note: 'host · DR CLI',
  },
} as const;
