/**
 * Per-page docs diagrams — Lantern remake of legacy wiki-widgets.js.
 */
import { html } from '../../lib/preact.js';
import { Icon } from '../../ui/icons.js';
import { Badge } from '../../ui/primitives/index.js';

function DataSourcesFlow() {
  const steps = [
    { kind: 'live', tone: 'ok', label: 'Live', sub: 'Charts while you watch', icon: 'zap' },
    { kind: 'scanned', tone: 'info', label: 'Scanned', sub: 'Logs & crashes', icon: 'eye' },
    { kind: 'report', tone: 'info', label: 'Report', sub: 'Full health check', icon: 'clipboard' },
  ];
  return html`
    <div class="docs-widget docs-widget--flow" aria-hidden="true">
      ${steps.map((s, i) => html`
        <div key=${s.kind} class=${`docs-widget-flow__node docs-widget-flow__node--${s.kind}`}>
          <span class="docs-widget-flow__icon"><${Icon} name=${s.icon} size=${18} /></span>
          <${Badge} tone=${s.tone}>${s.label}</${Badge}>
          <span class="docs-widget-flow__sub">${s.sub}</span>
        </div>
        ${i < steps.length - 1 ? html`<span class="docs-widget-flow__arrow" aria-hidden="true">→</span>` : null}
      `)}
    </div>
  `;
}

function FreshnessSample() {
  const cards = [
    { kind: 'live', tone: 'ok', icon: 'activity', label: 'Live charts', value: 'Just now', hint: 'Updates while dashboard is open' },
    { kind: 'scanned', tone: 'info', icon: 'eye', label: 'Background scan', value: '42s ago', hint: 'About once a minute on the server' },
    { kind: 'report', tone: 'info', icon: 'clipboard', label: 'Full report', value: '3h ago', hint: 'Your latest health check' },
    { kind: 'neutral', tone: 'neutral', icon: 'clock', label: 'Next scheduled', value: 'In 4h', hint: 'From Settings schedule', muted: true },
  ];
  return html`
    <div class="docs-widget docs-widget--freshness">
      <p class="docs-widget__caption">Example — open the <strong>Sources</strong> tab for real times on your server</p>
      <div class="docs-widget-freshness">
        ${cards.map((c) => html`
          <article key=${c.label} class=${`docs-widget-freshness__card docs-widget-freshness__card--${c.kind}`}>
            <div class="docs-widget-freshness__top">
              <span class="docs-widget-freshness__icon"><${Icon} name=${c.icon} size=${18} /></span>
              ${!c.muted ? html`<${Badge} tone=${c.tone}>${c.kind === 'live' ? 'Live' : c.kind === 'scanned' ? 'Scanned' : 'Report'}</${Badge}>` : null}
            </div>
            <span class="docs-widget-freshness__label">${c.label}</span>
            <span class="docs-widget-freshness__value">${c.value}</span>
            <span class="docs-widget-freshness__hint">${c.hint}</span>
          </article>
        `)}
      </div>
    </div>
  `;
}

function RailDiagram() {
  const groups = [
    { label: 'Monitor', tabs: ['Overview', 'Live', 'Insights', 'Session', 'Sources'] },
    { label: 'Triage', tabs: ['Issues', 'Crashes', 'Spark'] },
    { label: 'Ops', tabs: ['Mods', 'Backups', 'Activity'] },
  ];
  return html`
    <div class="docs-widget docs-widget--rail" aria-hidden="true">
      ${groups.map((g) => html`
        <div key=${g.label} class="docs-widget-rail__group">
          <span class="docs-widget-rail__label">${g.label}</span>
          <div class="docs-widget-rail__tabs">
            ${g.tabs.map((t) => html`<span key=${t} class="docs-widget-rail__tab">${t}</span>`)}
          </div>
        </div>
      `)}
    </div>
  `;
}

function ConfigCompare() {
  return html`
    <div class="docs-widget docs-widget--config">
      <article class="docs-widget-config__card">
        <div class="docs-widget-config__head">
          <${Icon} name="server" size=${16} />
          <code>config/watchtower-server.toml</code>
        </div>
        <p><strong>Needs a server restart.</strong> Dashboard port and how often live charts refresh.</p>
        <ul>
          <li>dashboardBindHost</li>
          <li>liveSampleIntervalSeconds</li>
          <li>liveRetentionHours</li>
        </ul>
      </article>
      <article class="docs-widget-config__card">
        <div class="docs-widget-config__head">
          <${Icon} name="sliders" size=${16} />
          <code>watchtower/watchtower.conf</code>
        </div>
        <p><strong>Change in Settings — no restart.</strong> Report schedule, warning levels, backup paths.</p>
        <ul>
          <li>REPORT_INTERVAL_MINUTES</li>
          <li>OPS_LOG_SCAN_SEC</li>
          <li>BACKUP_DIRS</li>
        </ul>
      </article>
    </div>
  `;
}

function SecuritySteps() {
  const steps = [
    { icon: 'key', title: 'Sign in', body: html`First time: <code>watchtower</code> / <code>password</code> — you will be asked to pick a new password.` },
    { icon: 'shield', title: 'Turn on 2FA', body: html`<strong>Settings → Security</strong> — scan the QR code with an authenticator app on your phone.` },
    { icon: 'wifi', title: 'Public server?', body: 'Do not expose the dashboard to the internet. Use localhost plus a secure tunnel (SSH) instead.' },
  ];
  return html`
    <div class="docs-widget docs-widget--steps">
      ${steps.map((s, i) => html`
        <div key=${s.title} class="docs-widget-step">
          <span class="docs-widget-step__num">${i + 1}</span>
          <div class="docs-widget-step__body">
            <h4 class="docs-widget-step__title">
              <${Icon} name=${s.icon} size=${14} />
              ${s.title}
            </h4>
            <p>${s.body}</p>
          </div>
        </div>
      `)}
    </div>
  `;
}

function DrFlow() {
  const nodes = [
    { icon: 'bug', label: 'Server will not start' },
    { icon: 'terminal', label: 'Run recovery tool' },
    { icon: 'archive', label: 'Get a zip bundle' },
    { icon: 'book', label: 'Open in your browser' },
  ];
  return html`
    <div class="docs-widget docs-widget--dr" aria-hidden="true">
      ${nodes.map((n, i) => html`
        <div key=${n.label} class="docs-widget-dr__node">
          <${Icon} name=${n.icon} size=${18} />
          <span>${n.label}</span>
        </div>
        ${i < nodes.length - 1 ? html`<span class="docs-widget-dr__arrow">→</span>` : null}
      `)}
    </div>
  `;
}

function HomeFeatures() {
  const items = [
    { icon: 'clipboard', title: 'Health reports', sub: 'Checks logs, crashes, mods, and backups on your server' },
    { icon: 'activity', title: 'Live dashboard', sub: 'See speed, lag, CPU, and memory — with history' },
    { icon: 'inbox', title: 'Fix list', sub: 'What to tackle first, from your latest report' },
    { icon: 'shield', title: 'Recovery help', sub: 'Tools when the server will not boot' },
  ];
  return html`
    <div class="docs-widget docs-widget--features">
      ${items.map((it) => html`
        <article key=${it.title} class="docs-widget-feature">
          <span class="docs-widget-feature__icon"><${Icon} name=${it.icon} size=${20} /></span>
          <h4 class="docs-widget-feature__title">${it.title}</h4>
          <p class="docs-widget-feature__sub">${it.sub}</p>
        </article>
      `)}
    </div>
  `;
}

function TipCallout({ children }) {
  return html`
    <div class="docs-widget docs-widget-callout docs-widget-callout--tip">
      <${Icon} name="check" size=${18} />
      <div class="docs-widget-callout__body">${children}</div>
    </div>
  `;
}

function InfoCallout({ children }) {
  return html`
    <div class="docs-widget docs-widget-callout docs-widget-callout--info">
      <${Icon} name="info" size=${18} />
      <div class="docs-widget-callout__body">${children}</div>
    </div>
  `;
}

/**
 * @param {string} slug
 * @returns {import('preact').VNode | null}
 */
export function widgetsFor(slug) {
  switch (slug) {
    case 'Home':
      return html`<${HomeFeatures} />`;
    case 'Understanding-Data-Sources':
      return html`
        <${DataSourcesFlow} />
        <${FreshnessSample} />
      `;
    case 'Dashboard-Overview':
    case 'Dashboard-Tabs':
      return html`<${RailDiagram} />`;
    case 'Configuration':
      return html`<${ConfigCompare} />`;
    case 'Security-and-Access':
      return html`<${SecuritySteps} />`;
    case 'Disaster-Recovery':
      return html`<${DrFlow} />`;
    case 'Quick-Start-Checklist':
      return html`
        <${TipCallout}>
          <p>Work through the list below in order — about <strong>15 minutes</strong> for a solid start. Checkboxes are for your notes (they are not saved).</p>
        </${TipCallout}>
      `;
    case 'Live-Charts':
      return html`
        <${InfoCallout}>
          <p><strong>Tip:</strong> On <strong>Live</strong>, the vitals range goes from <strong>1 min</strong> up to <strong>90 days</strong> (within saved history). <strong>Overview</strong> uses a quick <strong>1h / 6h / 24h</strong> picker — both stay in sync.</p>
        </${InfoCallout}>
      `;
    case 'HTTP-API':
      return html`
        <${InfoCallout}>
          <p><strong>For developers.</strong> Most endpoints need you to be logged in. Base URL: <code>http://&lt;your-server&gt;:8787</code></p>
        </${InfoCallout}>
      `;
    default:
      return null;
  }
}

export default widgetsFor;
