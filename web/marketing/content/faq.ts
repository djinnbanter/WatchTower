/**
 * FAQ — wording from the 2026 reword brief.
 */

export type FaqItem = { q: string; a: string };

export type FaqGroup = {
  label: string;
  blurb: string;
  items: FaqItem[];
};

export const FAQ_PAGE = {
  label: 'Got Questions?',
  title: 'Frequently Asked Questions',
  body: 'All the information you need about WatchTower, how it works, and how it uses your data.',
} as const;

export const FAQ_GROUPS: FaqGroup[] = [
  {
    label: 'Got Questions?',
    blurb: 'All the information you need about WatchTower, how it works, and how it uses your data.',
    items: [
      {
        q: 'Does WatchTower replace Pterodactyl, Crafty, or AMP?',
        a: 'No. WatchTower is a tool that helps you monitor your server\'s health. It doesn\'t manage the server itself. You still use your usual server control panel to start, stop, or update your server. WatchTower works alongside it to help you figure out why your server might be running slowly or crashing.',
      },
      {
        q: 'Will WatchTower restart my server automatically?',
        a: 'No. WatchTower can tell you if restarting might help and whether a reboot is recommended. It also warns if rebooting could affect players, but it doesn\'t automatically restart your server for you.',
      },
      {
        q: 'Does WatchTower send my server logs or data to the cloud?',
        a: 'No. Everything stays on your server. All monitoring data, crash reports, logs, and settings are stored locally on your machine in a folder called watchtower/. You don\'t need an internet connection or cloud account to use it.',
      },
      {
        q: 'How much CPU and memory does WatchTower use?',
        a: 'It uses very little. It runs background scans about once a minute, and the way it collects data is designed to have minimal impact on your server\'s performance.',
      },
      {
        q: 'Is WatchTower a tool for tracking player behavior?',
        a: 'No. It only shows which players are connected to help you see if lag is caused by players or to troubleshoot join issues. It doesn\'t collect data about what players do, where they are, or keep leaderboards.',
      },
      {
        q: 'What versions of Minecraft and loaders does it support?',
        a: 'Right now, it supports NeoForge 1.21.x with Java 21. Support for other Minecraft versions and loaders like Fabric is planned for future updates.',
      },
      {
        q: 'Is WatchTower free?',
        a: 'Yes. It\'s open source, licensed under GPL-3.0, and completely free to use on your own server.',
      },
      {
        q: 'What if my server doesn\'t start at all?',
        a: 'If Minecraft doesn\'t launch, the WatchTower dashboard won\'t load. You can run the included recovery tool by opening your terminal and typing `java -jar watchtower-cli.jar`. This will help diagnose the problem and generate a report you can view in your browser.',
      },
    ],
  },
];

export const FAQ_ITEMS: FaqItem[] = FAQ_GROUPS.flatMap((g) => g.items);
