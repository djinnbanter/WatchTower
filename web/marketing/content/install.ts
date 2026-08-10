/**
 * Install page — wording from the 2026 reword brief.
 */

export const INSTALL_PAGE = {
  label: 'Setup Guide',
  title: 'How to Install WatchTower on Your Server',
  body: 'Installing WatchTower is simple, just like adding any regular server tool. You don\'t need to set up cloud accounts, databases, or web hosting to get it working.',
} as const;

export const INSTALL_PREREQS = {
  label: 'What You Need',
  title: 'Things to Have Before Installing',
  items: [
    'A NeoForge 1.21.x dedicated server that is running Java 21.',
    'Access to your server\'s mods folder through your control panel\'s file manager, SFTP, or SSH.',
    'An open network port (usually 8787) or the ability to set up SSH tunneling.',
  ],
} as const;

export const INSTALL_STEPS = [
  {
    title: 'Download the Files',
    body: 'Get the main WatchTower file (and optionally the disaster recovery tool) from Modrinth or GitHub Releases.',
  },
  {
    title: 'Add to Your Server',
    body: 'Place the downloaded .jar file into the mods folder on your server.',
  },
  {
    title: 'Restart Your Server',
    body: 'Start or restart your server. WatchTower will create its settings files and open its web dashboard.',
  },
  {
    title: 'Access the Dashboard & Set Up',
    body: 'Open your web browser and go to http://<your-server-ip>:8787. Log in with username "watchtower" and password "password."',
  },
  {
    title: 'Complete the Setup',
    body: 'Change your admin password, set your server\'s name, and finish the initial setup wizard.',
  },
] as const;

export const INSTALL_SECURITY = {
  label: 'Security First',
  title: 'Suggested Security Setup',
  body: 'Don\'t leave port 8787 open to the public internet without a password. It\'s best to access the dashboard through your local computer, a private VPN (like Tailscale), or a secure SSH connection.',
  cta: 'Read our security tips for better protection',
} as const;

export const INSTALL_DR = {
  label: 'Proactive Operations',
  title: 'Keep the CLI jar file nearby',
  body: 'Save the watchtower-cli.jar file in your server folder today. If a damaged mod stops Minecraft from starting tomorrow, you can quickly run "java -jar watchtower-cli.jar" in the terminal to find out what caused the crash right away.',
} as const;

export const DEMO_PAGE = {
  label: 'Interactive Sandbox',
  title: 'Try Out WatchTower for Yourself',
  body: 'Experience the complete WatchTower dashboard with real-time fake server data. No need to install or sign up.',
  primaryCta: 'Start Live Demo',
  secondaryCta: 'Download on Modrinth',
  noticeLabel: 'Demo Environment',
  noticeTitle: 'Testing Area with Fake Data',
  noticeBody:
    'This demo uses pretend sample data that mimics an active modified NeoForge server. Any changes you make, problems you review, or settings you adjust in demo mode will not be saved or affect any real server.',
  highlights: [
    {
      title: 'Real Dashboard Look and Feel',
      body: 'See the same easy-to-use web interface you get when you\'re using WatchTower on your server.',
    },
    {
      title: 'Test Troubleshooting Tools',
      body: 'Check out example crash reports, try out the Fix inbox, sort through modification files, and look at charts showing storage trends.',
    },
  ],
} as const;
