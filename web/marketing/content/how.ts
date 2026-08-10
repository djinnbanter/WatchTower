/**
 * How it works — wording from the 2026 reword brief.
 */

export type PipelineNode = {
  id: string;
  label: string;
  detail?: string;
};

export const HOW_PAGE = {
  label: 'Behind the Scenes',
  title: 'How WatchTower Helps Keep Your Desk Organized',
  body: 'WatchTower is a simple tool that works quietly inside your NeoForge server. It keeps an eye on your server\'s health, checks for problems in the background, and provides an easy-to-use web dashboard right on your computer.',
  cta: 'See how to set it up',
} as const;

export const HOW_LEDE = HOW_PAGE.body;

export const HOW_LAYERS = [
  {
    id: 'watching',
    label: 'Layer 1',
    title: 'Watching: Live stats while the game is running.',
    body: 'While Minecraft is running, WatchTower keeps an eye on things like how smoothly the game is working, how long each tick takes, how much memory and CPU the game uses, available disk space, and how many players are online. It also saves past data so you can see if current lag issues are worse than usual, even if you\'re not looking at it.',
    note: 'Designed to use very little resources and collect information quietly in the background.',
  },
  {
    id: 'scanning',
    label: 'Layer 2',
    title: 'Background Checks Every Minute',
    body: 'About once a minute, WatchTower reviews logs, crash reports, mod lists, and game performance. It automatically sorts this information into helpful cards in your Fix inbox, easily spotting script mistakes, duplicate files, and players who couldn\'t join.',
    note: 'It continuously monitors everything quietly in the background, unlike manual checks that take more time.',
  },
  {
    id: 'support',
    label: 'Layer 3',
    title: 'Support Packs: Ready-to-Use Redacted Snapshots',
    body: 'Need help from a mod creator or community Discord? With just one click, you can package your logs, crash reports, and system details into a secure, redacted zip file. Sensitive information like passwords, IP addresses, and tokens are automatically removed before you download or share it.',
    note: 'Focuses on safety and making it simple to get support from others.',
  },
] as const;

export const HOW_FIRST_RUN = {
  label: 'First Time Use',
  title: 'Get Started in Less Than Two Minutes',
  body: 'When you turn it on for the first time, just go to http://your-ip:8787 in your web browser. A helpful step-by-step guide will show you how to set your admin password, make sure your server is found correctly, check your backup locations, and set up recommended security features.',
  cta: 'Read the setup guide',
} as const;

export const HOW_COMPANIONS = {
  label: 'Integrations',
  title: 'Works smoothly with your favorite tools.',
  body: 'WatchTower improves your current server setup without making you change how you do things.',
  items: [
    {
      title: 'Spark Integration',
      body: 'Reads .sparkprofile files and helps turn complicated CPU slowdown reports into simple steps you can take.',
    },
    {
      title: 'Modrinth Lookups',
      body: 'Optional checks that compare your installed mods with available updates, check for conflicts, and show safety ratings.',
    },
  ],
} as const;

export const HOW_SAFETY = {
  label: 'How We Think About Things',
  title: 'Your Server. Your Choices.',
  body: 'WatchTower is here to help you. It suggests when to restart your server, points out settings that might cause problems, and warns you about risky updates to mods. But it will never make changes or take actions unless you give it the okay first.',
} as const;

/** Pipeline nodes kept for the existing Pipeline visual (mapped to reword layers). */
export const COLLECT_NODES: readonly PipelineNode[] = [
  { id: 'vitals', label: 'Vitals', detail: 'TPS, MSPT, heap, CPU, disk' },
  { id: 'logs', label: 'Logs', detail: 'latest.log tail, crash reports' },
  { id: 'mods', label: 'Mods', detail: 'Jar inventory, checksums' },
  { id: 'world', label: 'World', detail: 'Chunk load, entity and item counts' },
  { id: 'backups', label: 'Backups', detail: 'Presence, age' },
] as const;

export const UNDERSTAND_LABEL = 'Background Checks Every Minute';

export const UNDERSTAND_COPY =
  'About once a minute, WatchTower reviews logs, crash reports, mod lists, and game performance. It automatically sorts this information into helpful cards in your Fix inbox.';

export const ADVISE_NODES: readonly PipelineNode[] = [
  { id: 'fix-inbox', label: 'Fix inbox', detail: 'Ranked issues, one next step each' },
  { id: 'overview', label: 'Overview grade', detail: 'Health grade, needs-attention list' },
  { id: 'insights', label: 'Insights trends', detail: 'Schedule, load, and storage over time' },
  { id: 'support', label: 'Support pack', detail: 'Redacted bundle to share' },
] as const;
