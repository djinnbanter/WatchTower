/**
 * FAQ answers must stay inside PRODUCT.md / README.md / docs/ROADMAP.md truth.
 * Voice: plain ops English for dedicated-server admins. No invented features.
 */

export type FaqItem = { q: string; a: string };

export type FaqGroup = {
  /** Mono eyebrow for the group plate */
  label: string;
  /** One-line group job */
  blurb: string;
  items: FaqItem[];
};

export const FAQ_GROUPS: FaqGroup[] = [
  {
    label: 'Scope',
    blurb: 'What WatchTower is, and what it leaves alone.',
    items: [
      {
        q: 'Is WatchTower a host panel?',
        a: "No. It won't start or stop the server, manage files, or replace the console. Keep Pterodactyl, Crafty, AMP, or bare metal for that. WatchTower sits beside them.",
      },
      {
        q: 'Is this player analytics?',
        a: "No. No retention, GeoIP, or leaderboards. Seeing who's online during lag or a crash is ops triage, not player tracking.",
      },
      {
        q: 'Does it support Fabric?',
        a: 'Right now it ships for NeoForge 1.21.x on Java 21. Fabric is on the roadmap. We are not claiming Fabric support yet.',
      },
      {
        q: 'Do I need Spark?',
        a: 'No. Spark is optional. Install it when you want lag profiles broken into next steps. The deep Spark workspace is still alpha.',
      },
      {
        q: 'Does Modrinth download jars for me?',
        a: 'No. Modrinth is lookup and hints only. WatchTower never downloads mod jars for you.',
      },
    ],
  },
  {
    label: 'Trust',
    blurb: 'Control, data, and money.',
    items: [
      {
        q: 'Do I need a cloud account?',
        a: 'No. WatchTower is local-first. Watchtower Cloud is a future paid option and is not required for the dashboard on your host.',
      },
      {
        q: 'Does it upload my logs?',
        a: 'Not by default. No telemetry either. Data stays on the host. Anything that talks to the network is opt-in.',
      },
      {
        q: 'Will it restart my server?',
        a: 'No. Overview can say Safe, Caution, or Wait. WatchTower only advises. It never restarts the server for you and never quietly edits mods or the world.',
      },
      {
        q: 'Is it free?',
        a: 'The local dashboard stays free forever under GPL-3.0-or-later. Get the jar from Modrinth or GitHub Releases.',
      },
    ],
  },
  {
    label: 'On the host',
    blurb: 'Port, login, disk, and when the game will not boot.',
    items: [
      {
        q: 'How do I open the dashboard safely?',
        a: "After install it listens on port 8787. Prefer localhost or an SSH tunnel. Don't expose 8787 to the open internet. Default login is watchtower / password. Change it on first open.",
      },
      {
        q: 'Where does my data live?',
        a: 'On the server, under the watchtower/ folder (ops-cache, state, Spark uploads, support zips). Nothing leaves the host unless you choose to share it.',
      },
      {
        q: "What if Minecraft won't boot?",
        a: 'Keep the matching CLI jar next to WatchTower in mods/. Run it with java -jar over SSH to build a local disaster-recovery bundle. It is not loaded as a Minecraft mod.',
      },
    ],
  },
];

/** Flat list for anything that still wants a linear FAQ. */
export const FAQ_ITEMS: FaqItem[] = FAQ_GROUPS.flatMap((g) => g.items);
