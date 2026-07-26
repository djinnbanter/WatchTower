import { Fragment, type ReactNode } from 'react';
import {
  Activity,
  Archive,
  BookOpen,
  Bug,
  Check,
  ClipboardList,
  Clock,
  Database,
  Download,
  Info,
  ServerCog,
  Shield,
  SlidersHorizontal,
  Terminal,
  Zap,
} from '@/ui/icons';
import { StatusPill } from '@/ui/patterns';

function TipCallout({ children }: { children: ReactNode }) {
  return (
    <div className="docs-widget docs-widget-callout docs-widget-callout--tip">
      <Check size={18} />
      <div className="docs-widget-callout__body">{children}</div>
    </div>
  );
}

function InfoCallout({ children }: { children: ReactNode }) {
  return (
    <div className="docs-widget docs-widget-callout docs-widget-callout--info">
      <Info size={18} />
      <div className="docs-widget-callout__body">{children}</div>
    </div>
  );
}

function DataSourcesFlow() {
  const steps = [
    { kind: 'live', tone: 'ok' as const, label: 'Watching', sub: 'Charts while you watch', Icon: Zap },
    { kind: 'scanned', tone: 'info' as const, label: 'Scanning', sub: 'Logs, Issues, crashes', Icon: Database },
    { kind: 'report', tone: 'info' as const, label: 'Support', sub: 'Zip when you ask', Icon: ClipboardList },
  ];
  return (
    <div className="docs-widget docs-widget--flow" aria-hidden>
      {steps.map((s, i) => (
        <Fragment key={s.kind}>
          <div className={`docs-widget-flow__node docs-widget-flow__node--${s.kind}`}>
            <span className="docs-widget-flow__icon">
              <s.Icon size={18} />
            </span>
            <StatusPill tone={s.tone}>{s.label}</StatusPill>
            <span className="docs-widget-flow__sub">{s.sub}</span>
          </div>
          {i < steps.length - 1 ? (
            <span className="docs-widget-flow__arrow" aria-hidden>
              →
            </span>
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}

function FreshnessSample() {
  const cards = [
    {
      kind: 'live',
      tone: 'ok' as const,
      Icon: Activity,
      label: 'Watching',
      value: 'Just now',
      hint: 'Charts while the server runs',
    },
    {
      kind: 'scanned',
      tone: 'info' as const,
      Icon: Database,
      label: 'Scanning',
      value: '42s ago',
      hint: 'About once a minute on the server',
    },
    {
      kind: 'report',
      tone: 'info' as const,
      Icon: ClipboardList,
      label: 'Support compose',
      value: 'On demand',
      hint: 'Rail Build support pack, Overview, or Help Center',
    },
    {
      kind: 'neutral',
      tone: 'neutral' as const,
      Icon: Clock,
      label: 'Optional schedule',
      value: 'Off',
      hint: 'watchtower.conf /watchtower schedule',
      muted: true,
    },
  ];
  return (
    <div className="docs-widget docs-widget--freshness">
      <p className="docs-widget__caption">
        Example — open the <strong>Sources</strong> tab for real times on your server
      </p>
      <div className="docs-widget-freshness">
        {cards.map((c) => (
          <article key={c.label} className={`docs-widget-freshness__card docs-widget-freshness__card--${c.kind}`}>
            <div className="docs-widget-freshness__top">
              <span className="docs-widget-freshness__icon">
                <c.Icon size={18} />
              </span>
              {!c.muted ? (
                <StatusPill tone={c.tone}>
                  {c.kind === 'live' ? 'Watching' : c.kind === 'scanned' ? 'Scanning' : 'Support'}
                </StatusPill>
              ) : null}
            </div>
            <span className="docs-widget-freshness__label">{c.label}</span>
            <span className="docs-widget-freshness__value">{c.value}</span>
            <span className="docs-widget-freshness__hint">{c.hint}</span>
          </article>
        ))}
      </div>
    </div>
  );
}

function RailDiagram() {
  const groups = [
    { label: 'Monitor', tabs: ['Overview', 'Live', 'Insights', 'Session', 'Startup'] },
    { label: 'Triage', tabs: ['Issues', 'Crashes', 'Logs', 'Spark'] },
    { label: 'Ops', tabs: ['Mods', 'Backups', 'Activity', 'Sources'] },
    { label: 'System', tabs: ['Help Center', 'Settings', 'Theme', 'Collapse'] },
  ];
  return (
    <div className="docs-widget docs-widget--rail" aria-hidden>
      {groups.map((g) => (
        <div key={g.label} className="docs-widget-rail__group">
          <span className="docs-widget-rail__label">{g.label}</span>
          <div className="docs-widget-rail__tabs">
            {g.tabs.map((t) => (
              <span key={t} className="docs-widget-rail__tab">
                {t}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConfigCompare() {
  return (
    <div className="docs-widget docs-widget--config">
      <article className="docs-widget-config__card">
        <div className="docs-widget-config__head">
          <ServerCog size={16} />
          <code>config/watchtower-server.toml</code>
        </div>
        <p>
          <strong>Needs a server restart.</strong> Dashboard port and how often live charts refresh.
        </p>
        <ul>
          <li>dashboardBindHost</li>
          <li>liveSampleIntervalSeconds</li>
          <li>liveRetentionHours</li>
        </ul>
      </article>
      <article className="docs-widget-config__card">
        <div className="docs-widget-config__head">
          <SlidersHorizontal size={16} />
          <code>watchtower/watchtower.conf</code>
        </div>
        <p>
          <strong>Change in Settings — no restart.</strong> Warning levels, backup paths, and related
          conf keys.
        </p>
        <ul>
          <li>REPORT_INTERVAL_MINUTES</li>
          <li>OPS_LOG_SCAN_SEC</li>
          <li>BACKUP_DIRS</li>
        </ul>
      </article>
    </div>
  );
}

function SecuritySteps() {
  const steps = [
    {
      Icon: Shield,
      title: 'Sign in',
      body: (
        <>
          First time: <code>watchtower</code> / <code>password</code> — you will be asked to pick a
          new password.
        </>
      ),
    },
    {
      Icon: Shield,
      title: 'Turn on 2FA',
      body: (
        <>
          <strong>Settings → Security</strong> — scan the QR code with an authenticator app on your
          phone.
        </>
      ),
    },
    {
      Icon: ServerCog,
      title: 'Public server?',
      body: 'Do not expose the dashboard to the internet. Use localhost plus a secure tunnel (SSH) instead.',
    },
  ];
  return (
    <div className="docs-widget docs-widget--steps">
      {steps.map((s, i) => (
        <div key={s.title} className="docs-widget-step">
          <span className="docs-widget-step__num">{i + 1}</span>
          <div className="docs-widget-step__body">
            <h4 className="docs-widget-step__title">
              <s.Icon size={14} />
              {s.title}
            </h4>
            <p>{s.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function DrFlow() {
  const nodes = [
    { Icon: Bug, label: 'Server will not start' },
    { Icon: Terminal, label: 'Run recovery tool' },
    { Icon: Archive, label: 'Get a zip bundle' },
    { Icon: BookOpen, label: 'Open in your browser' },
  ];
  return (
    <div className="docs-widget docs-widget--dr" aria-hidden>
      {nodes.map((n, i) => (
        <Fragment key={n.label}>
          <div className="docs-widget-dr__node">
            <n.Icon size={18} />
            <span>{n.label}</span>
          </div>
          {i < nodes.length - 1 ? <span className="docs-widget-dr__arrow">→</span> : null}
        </Fragment>
      ))}
    </div>
  );
}

function HomeFeatures() {
  const items = [
    { Icon: Database, title: 'Watching + Scanning', sub: 'Charts and continuous Issues without homework' },
    { Icon: Activity, title: 'Live dashboard', sub: 'See speed, lag, CPU, and memory — with history' },
    { Icon: ClipboardList, title: 'Fix list', sub: 'What to tackle first from continuous Scanning' },
    { Icon: Download, title: 'Support compose', sub: 'Zip when you need to share with your host' },
  ];
  return (
    <div className="docs-widget docs-widget--features">
      {items.map((it) => (
        <article key={it.title} className="docs-widget-feature">
          <span className="docs-widget-feature__icon">
            <it.Icon size={20} />
          </span>
          <h4 className="docs-widget-feature__title">{it.title}</h4>
          <p className="docs-widget-feature__sub">{it.sub}</p>
        </article>
      ))}
    </div>
  );
}

export function widgetsFor(slug: string): ReactNode {
  switch (slug) {
    case 'Home':
      return <HomeFeatures />;
    case 'Understanding-Data-Sources':
      return (
        <>
          <DataSourcesFlow />
          <FreshnessSample />
        </>
      );
    case 'Dashboard-Overview':
    case 'Dashboard-Tabs':
      return <RailDiagram />;
    case 'Configuration':
      return <ConfigCompare />;
    case 'Security-and-Access':
      return <SecuritySteps />;
    case 'Disaster-Recovery':
      return <DrFlow />;
    case 'Quick-Start-Checklist':
      return (
        <TipCallout>
          <p>
            Work through the list below in order — about <strong>15 minutes</strong> for a solid
            start. Checkboxes are for your notes (they are not saved).
          </p>
        </TipCallout>
      );
    case 'Live-Charts':
      return (
        <InfoCallout>
          <p>
            <strong>Tip:</strong> On <strong>Live</strong>, the vitals range goes from{' '}
            <strong>5 minutes</strong> up to <strong>30 days</strong> (within saved history).{' '}
            <strong>Overview</strong> uses a quick <strong>1h / 6h / 24h</strong> picker.
          </p>
        </InfoCallout>
      );
    case 'Sources':
      return <FreshnessSample />;
    case 'HTTP-API':
      return (
        <InfoCallout>
          <p>
            <strong>For developers.</strong> Most endpoints need you to be logged in. Base URL:{' '}
            <code>http://&lt;your-server&gt;:8787</code>
          </p>
        </InfoCallout>
      );
    default:
      return null;
  }
}
