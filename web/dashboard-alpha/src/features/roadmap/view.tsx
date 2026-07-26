import type { ComponentType } from 'react';
import {
  Activity,
  Archive,
  Bug,
  CheckCircle2,
  Compass,
  Database,
  ExternalLink,
  Gauge,
  HardDrive,
  LifeBuoy,
  MinusCircle,
  Package,
  Rocket,
  Shield,
  Sparkles,
  Telescope,
  Users,
  Wrench,
  Zap,
} from '@/ui/icons';
import { navigate, type RouteState } from '@/app/router';
import { PageEnter, Stagger } from '@/ui/motion';
import { Button, Section, StatusPill } from '@/ui/patterns';
import './roadmap.css';

type Icon = ComponentType<{ size?: number; className?: string }>;

type Feature = {
  title: string;
  body: string;
  Icon: Icon;
};

type ThemeGroup = {
  theme: string;
  Icon: Icon;
  items: string[];
};

const WORKS_TODAY: Feature[] = [
  {
    Icon: Activity,
    title: 'Live dashboard',
    body: 'TPS, tick lag, CPU, memory, and players updating while you watch.',
  },
  {
    Icon: Database,
    title: 'Watching + Scanning',
    body: 'Charts and Issues stay current without homework every visit.',
  },
  {
    Icon: CheckCircle2,
    title: 'Fix inbox',
    body: 'Prioritized problems from continuous Scanning — what to tackle next.',
  },
  {
    Icon: Bug,
    title: 'Crash intelligence',
    body: 'Groups crashes, names the likely mod, and points at a plain-English fix.',
  },
  {
    Icon: Package,
    title: 'Smart mod list',
    body: 'Inventory, updates, conflicts, Modrinth lookups, client-vs-server hints.',
  },
  {
    Icon: Gauge,
    title: 'Performance Insights',
    body: 'Busy vs quiet hours, storage trends, and config health over a window.',
  },
  {
    Icon: Zap,
    title: 'Spark integration',
    body: 'Turn a profiler capture into “what ate the tick.”',
  },
  {
    Icon: Compass,
    title: 'Sources',
    body: 'Poller freshness and next pulls — is Watchtower working?',
  },
  {
    Icon: Archive,
    title: 'Ops extras',
    body: 'Backups, Session, Activity, Logs, Startup, and Help Center.',
  },
  {
    Icon: LifeBuoy,
    title: 'Support packs',
    body: 'A redacted zip when you need to share with a host or mod author.',
  },
  {
    Icon: Shield,
    title: 'Secure by default',
    body: 'Sign-in, optional 2FA, honest metrics on hosted panels.',
  },
  {
    Icon: Wrench,
    title: 'Disaster recovery',
    body: 'CLI + browser path when the server will not boot.',
  },
];

const COMING_NEXT: ThemeGroup[] = [
  {
    theme: 'When the server lags',
    Icon: Zap,
    items: [
      'Catch lag for you — auto-profile when TPS dips and name the culprit mod',
      'Spot farms and chunk loaders — separate world pressure from “a bad mod”',
      'Notice when “normal” gets worse — flag a sustained regression against your baseline',
    ],
  },
  {
    theme: 'When you’re unsure about RAM or settings',
    Icon: HardDrive,
    items: [
      'GC / JVM health advisor — heap-bound vs GC-bound vs tick/mod advice',
      'Do I need more RAM? — right-size card comparing heap peak vs -Xmx',
      'Config coach — review server.properties and startup flags',
      'Safe guided fixes — apply vetted settings with preview and undo',
    ],
  },
  {
    theme: 'When you need to trust a restart',
    Icon: Shield,
    items: [
      'Safe to restart? — check backups, pregen, and who’s online first',
      'One incident timeline — lag → crash → missed backup in a single story',
      'Weekly digest — grade, crashes, disk trend, and one useful next action',
      'Disk runway — days left, not just percent full',
    ],
  },
  {
    theme: 'When mods need care',
    Icon: Package,
    items: [
      'Jar quarantine — move a bad or client-only jar aside, with undo',
      'Assisted safe updates — download, verify, back up, swap',
      'Did that update help? — before/after performance comparison',
      'Tamper & secrets warnings for jars and configs',
    ],
  },
];

const LATER: Feature[] = [
  {
    Icon: Users,
    title: 'Fleet view',
    body: 'TPS, crashes, and backups across many servers — local hub first.',
  },
  {
    Icon: Telescope,
    title: 'Watchtower Cloud',
    body: 'Optional paid remote ops desk. Local stays free forever.',
  },
  {
    Icon: Sparkles,
    title: 'Alerts that reach you',
    body: 'Discord / webhook for crashes, lag, and stale backups.',
  },
  {
    Icon: Rocket,
    title: 'More platforms',
    body: 'Fabric and NeoForge 1.20.x — same dashboard and workflow.',
  },
];

const NOT_OUR_JOB: Feature[] = [
  {
    Icon: MinusCircle,
    title: 'Host panels',
    body: 'Start/stop, files, and console stay with Pterodactyl, Crafty, AMP, …',
  },
  {
    Icon: Users,
    title: 'Player analytics',
    body: 'Retention, GeoIP, leaderboards — use Plan and similar.',
  },
  {
    Icon: Gauge,
    title: 'Generic APM',
    body: 'Watchtower is opinionated about Minecraft server ops — not a log warehouse.',
  },
];

const PROMISES = [
  'Your data stays yours',
  'You’re in control',
  'Ops, not surveillance',
  'Drop-in beside your host',
];

function FeatureTile({ Icon, title, body }: Feature) {
  return (
    <div className="roadmap-tile">
      <span className="roadmap-tile__icon">
        <Icon size={18} />
      </span>
      <strong className="roadmap-tile__title">{title}</strong>
      <p className="roadmap-tile__body">{body}</p>
    </div>
  );
}

export function PageView({ route: _route }: { route: RouteState }) {
  return (
    <PageEnter className="roadmap space-y-10">
      <div className="roadmap-plate overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex flex-wrap items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-wt-accent/15 text-wt-accent">
              <Compass size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-wt-text-low">
                Product roadmap
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Ops software for modded Minecraft servers</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <StatusPill tone="ok">NeoForge 1.21.x</StatusPill>
              <StatusPill tone="neutral">Local-first</StatusPill>
            </div>
          </div>

          <p className="mt-3 max-w-2xl text-sm text-wt-text-mid">
            Drop a jar in <code className="rounded bg-wt-bg3 px-1 py-0.5 font-mono text-xs">mods/</code>, open
            the dashboard on your machine, and see what to fix. No cloud account. Nothing leaves your host unless
            you choose to share it. Releases ship when they’re ready — no fake dates.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button kind="primary" onClick={() => navigate({ tab: 'docs', wiki: 'Roadmap' })}>
              <LifeBuoy size={14} />
              Read the full story
            </Button>
            <Button kind="default" onClick={() => navigate({ tab: 'docs', wiki: 'Quick-Start-Checklist' })}>
              Quick start
            </Button>
            <a
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-wt-text-mid hover:bg-wt-accent-soft/50 hover:text-wt-accent"
              href="https://github.com/djinnbanter/WatchTower/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              Suggest a feature
              <ExternalLink size={13} />
            </a>
          </div>

          <div className="mt-5 flex flex-wrap gap-1.5 border-t border-wt-line/80 pt-4">
            <StatusPill tone="ok">Works today</StatusPill>
            <StatusPill tone="info">Coming next</StatusPill>
            <StatusPill tone="neutral">Later</StatusPill>
            <StatusPill tone="neutral">Not our job</StatusPill>
          </div>
        </div>
      </div>

      <Section title="Works today" icon={CheckCircle2} hint="Already in the jar you can download.">
        <Stagger className="roadmap-grid">
          {WORKS_TODAY.map((item) => (
            <FeatureTile key={item.title} {...item} />
          ))}
        </Stagger>
      </Section>

      <Section title="Coming next" icon={Rocket} hint="Planned work, grouped by the problem it solves for you.">
        <div className="roadmap-themes">
          {COMING_NEXT.map((group) => (
            <div key={group.theme} className="roadmap-plate h-full">
              <div className="flex h-full flex-col gap-3 p-4 md:p-5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-wt-accent/12 text-wt-accent">
                    <group.Icon size={16} />
                  </span>
                  <h3 className="text-sm font-semibold tracking-tight">{group.theme}</h3>
                </div>
                <ul className="space-y-2 text-sm text-wt-text-mid">
                  {group.items.map((it) => (
                    <li key={it} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-wt-accent" />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Later" icon={Telescope} hint="Bigger bets once the single-server experience is rock solid.">
        <Stagger className="roadmap-grid roadmap-grid--2">
          {LATER.map((item) => (
            <FeatureTile key={item.title} {...item} />
          ))}
        </Stagger>
      </Section>

      <Section title="Not our job" icon={MinusCircle} hint="Things other tools do better — we stay out of the way.">
        <Stagger className="roadmap-grid roadmap-grid--3">
          {NOT_OUR_JOB.map((item) => (
            <FeatureTile key={item.title} {...item} />
          ))}
        </Stagger>
        <div className="mt-3">
          <StatusPill tone="neutral">Loud community requests move up the list</StatusPill>
        </div>
      </Section>

      <div className="roadmap-plate">
        <div className="p-4 md:p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-wt-text-low">
            Promises that don’t change
          </div>
          <Stagger className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {PROMISES.map((p) => (
              <div
                key={p}
                className="flex items-center gap-2 rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 px-3 py-2.5 text-sm"
              >
                <CheckCircle2 size={14} className="shrink-0 text-wt-ok" />
                {p}
              </div>
            ))}
          </Stagger>
        </div>
      </div>
    </PageEnter>
  );
}
