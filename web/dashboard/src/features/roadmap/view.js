/**
 * Roadmap showcase — marketing-style vision page.
 * Content mirrors docs/ROADMAP.md (keep in sync when that doc changes).
 */
import { html } from '../../lib/preact.js';
import { Page } from '../../ui/patterns/index.js';
import { Icon } from '../../ui/icons.js';

const LIVE_TODAY = [
  { icon: 'layout-dashboard', title: 'Live dashboard', blurb: 'TPS, MSPT, CPU, memory, and players — second by second.' },
  { icon: 'bug', title: 'Crash intelligence', blurb: 'Names the mod at fault and the fix in plain English.' },
  { icon: 'package', title: 'Smart mod list', blurb: 'Modrinth lookups, dependency trees, client-vs-server detection.' },
  { icon: 'trending-up', title: 'Performance Insights', blurb: 'Busy vs quiet hours, sticky lag, heatmaps, CSV export.' },
  { icon: 'zap', title: 'Spark integration', blurb: 'Turn a profile into per-mod “what ate the tick” answers.' },
  { icon: 'shield', title: 'Disaster recovery', blurb: 'CLI + browser viewer when a server won’t boot.' },
];

const THEMES = [
  {
    id: 'lag',
    tone: 'sky',
    icon: 'zap',
    title: 'Never get caught off guard by lag again',
    pitch: 'Your server tells you what’s wrong before you even go looking.',
    features: [
      { icon: 'flame', title: 'Lag auto-forensics', blurb: 'The instant it stutters, Watchtower captures a profile and names the culprit mod — even when you’re offline.' },
      { icon: 'map', title: 'Entity & chunk hotspot radar', blurb: 'Spot farms, chunk loaders, and grinders driving lag — separate from mod-attributed lag.' },
      { icon: 'trending-up', title: 'Baseline & regression alerts', blurb: 'Learns your “normal,” then pings: “You’re running 15% slower — and it started Tuesday.”' },
    ],
  },
  {
    id: 'ram',
    tone: 'accent',
    icon: 'cpu',
    title: 'Stop guessing about RAM and settings',
    pitch: 'Save real money and real headaches.',
    features: [
      { icon: 'gauge', title: 'Do I actually need more RAM?', blurb: 'A plain-English read on GC, heap, JVM flags, and Java version — before you waste money.' },
      { icon: 'sliders', title: 'RAM right-sizing', blurb: 'See what you really use and stop paying for headroom you never touch.' },
      { icon: 'file-text', title: 'Launch & config coach', blurb: 'Friendly review of server.properties and startup flags: keep this, tweak that, here’s why.' },
      { icon: 'wrench', title: 'Guided one-click fixes', blurb: 'Safe settings only — preview, apply, and undo from the dashboard. No terminal, no fear.' },
    ],
  },
  {
    id: 'confidence',
    tone: 'ok',
    icon: 'check',
    title: 'One glance, total confidence',
    pitch: 'Less clicking around, more knowing.',
    features: [
      { icon: 'play', title: 'Safe to restart?', blurb: 'One check before /stop — backups, pregen, and who’s mid-adventure.' },
      { icon: 'activity', title: 'The incident story', blurb: 'One timeline: lag spike → crash → missed backup — instead of four tabs at 2 AM.' },
      { icon: 'heart-pulse', title: 'Know why it really died', blurb: 'Tell a mod crash apart from an OOM kill or panel watchdog timeout.' },
      { icon: 'coffee', title: 'Weekly digest', blurb: 'Grade, crashes, disk trend, and the single most useful next action.' },
      { icon: 'hard-drive', title: 'Disk runway', blurb: 'Not just “82% full” — “about 12 days left,” with the dimension eating it.' },
    ],
  },
  {
    id: 'mods',
    tone: 'purple',
    icon: 'package',
    title: 'Keep your mods healthy',
    pitch: 'Your modpack, under control.',
    features: [
      { icon: 'git-compare', title: 'Did that update help or hurt?', blurb: 'Before/after performance on every mod change — so you know if it was worth it.' },
      { icon: 'alert-triangle', title: 'Tamper & corruption detection', blurb: 'Catch a jar that quietly changed without a version bump.' },
      { icon: 'layers', title: 'Bigger mod brain', blurb: 'CurseForge lookups joining Modrinth for even better coverage.' },
      { icon: 'external-link', title: 'Shareable crash-rule packs', blurb: 'Export your hard-won fixes and swap them with admins on the same pack.' },
    ],
  },
  {
    id: 'teams',
    tone: 'net',
    icon: 'users',
    title: 'Built for teams and communities',
    pitch: 'Because most servers aren’t a one-person show.',
    features: [
      { icon: 'key', title: 'Real admin accounts', blurb: 'Named logins per co-admin, plus a log of who changed what.' },
      { icon: 'radio', title: 'Public status page', blurb: 'Drop an “are we up?” link in Discord — without exposing the dashboard.' },
      { icon: 'copy', title: 'Copy for Discord', blurb: 'A tidy, auto-redacted summary for support channels in ten seconds.' },
      { icon: 'clock', title: 'Maintenance windows', blurb: 'Scheduled restarts stop looking like scary unexpected outages.' },
    ],
  },
  {
    id: 'mobile',
    tone: 'warn',
    icon: 'wifi',
    title: 'Check in from anywhere',
    pitch: 'Peace of mind from the bus stop.',
    features: [
      { icon: 'wifi', title: 'Mobile glance view', blurb: 'A fast, phone-friendly health check you can pin to your home screen.' },
    ],
  },
];

const HORIZONS = [
  { icon: 'server', title: 'Fleet command', blurb: 'TPS, crashes, and backups across your whole network — proxy-aware for Velocity/Bungee backends.' },
  { icon: 'bell', title: 'Alerts that reach you', blurb: 'Discord and webhook pings for crashes, lag, stale backups, and pregen stalls.' },
  { icon: 'layers', title: 'More platforms', blurb: 'Fabric and NeoForge 1.20.x builds — same dashboard and workflow, more packs welcome.' },
];

const TRUST = [
  { icon: 'lock', title: 'Your data stays yours', blurb: 'Everything runs on your server. No telemetry, no log uploads.' },
  { icon: 'sliders', title: 'You’re in control', blurb: 'Network features are opt-in. Fixes are previewed and undoable.' },
  { icon: 'eye', title: 'Ops, not surveillance', blurb: 'We help you run the server — not track players like an analytics product.' },
];

function FeatureTile({ feature, live = false }) {
  return html`
    <article class="rm-feature ui-instrument ui-lift ui-pressable">
      <div class="rm-feature__icon" aria-hidden="true">
        <${Icon} name=${feature.icon} size=${18} />
      </div>
      <div class="rm-feature__body">
        <h3 class="rm-feature__title">
          ${live ? html`<span class="rm-feature__live ui-live-pulse" aria-hidden="true"></span>` : null}
          ${feature.title}
        </h3>
        <p class="rm-feature__blurb">${feature.blurb}</p>
      </div>
    </article>
  `;
}

function ThemeSection({ theme }) {
  return html`
    <section class=${`rm-theme rm-theme--${theme.tone} ui-instrument`} data-tone=${theme.tone}>
      <header class="rm-theme__header">
        <div class="rm-theme__icon" aria-hidden="true">
          <${Icon} name=${theme.icon} size=${22} />
        </div>
        <div class="rm-theme__titles">
          <h2 class="rm-theme__title">${theme.title}</h2>
          <p class="rm-theme__pitch">${theme.pitch}</p>
        </div>
      </header>
      <div class="rm-feature-grid">
        ${theme.features.map((f) => html`<${FeatureTile} key=${f.title} feature=${f} />`)}
      </div>
    </section>
  `;
}

export function PageView() {
  return html`
    <${Page}
      tour="roadmap"
      title="Roadmap"
      subtitle="What’s shipping next — the vision for server ops that feel alive"
    >
      <div class="ui-page__stack rm-page" data-tour="roadmap">

        <section class="rm-hero ui-instrument">
          <div class="rm-hero__sheen" aria-hidden="true"></div>
          <div class="rm-hero__glow" aria-hidden="true"></div>
          <div class="rm-hero__content">
            <div class="rm-hero__badge">
              <${Icon} name="rocket" size=${14} />
              <span>On the workbench</span>
            </div>
            <h2 class="rm-hero__headline">The road ahead</h2>
            <p class="rm-hero__tagline">
              Know what’s happening on your server — and exactly what to do next.
              Everything below builds on the ops toolkit you already have, and stays
              <strong> on your machine</strong>.
            </p>
            <div class="rm-hero__chips">
              <span class="rm-chip"><span class="rm-chip__dot rm-chip__dot--ok"></span> Runs on your machine</span>
              <span class="rm-chip"><span class="rm-chip__dot rm-chip__dot--sky"></span> No cloud account</span>
              <span class="rm-chip"><span class="rm-chip__dot rm-chip__dot--warn"></span> NeoForge 1.21.x · Fabric &amp; 1.20.x coming</span>
            </div>
          </div>
        </section>

        <section class="rm-shipped">
          <header class="rm-section-head">
            <div class="rm-section-head__label">
              <span class="rm-section-head__pulse ui-live-pulse" aria-hidden="true"></span>
              Live today
            </div>
            <p class="rm-section-head__sub">Already packing the dashboard — maturity first, then the fun stuff.</p>
          </header>
          <div class="rm-feature-grid rm-feature-grid--shipped">
            ${LIVE_TODAY.map((f) => html`<${FeatureTile} key=${f.title} feature=${f} live=${true} />`)}
          </div>
        </section>

        <header class="rm-section-head rm-section-head--coming">
          <div class="rm-section-head__label rm-section-head__label--spark">
            <${Icon} name="sparkles" size=${14} />
            Coming next — the vision
          </div>
          <p class="rm-section-head__sub">Grouped by what it does for you — the person keeping the server alive.</p>
        </header>

        ${THEMES.map((t) => html`<${ThemeSection} key=${t.id} theme=${t} />`)}

        <section class="rm-horizons ui-instrument">
          <div class="rm-hero__sheen" aria-hidden="true"></div>
          <header class="rm-horizons__header">
            <div class="rm-horizons__icon" aria-hidden="true">
              <${Icon} name="rocket" size=${22} />
            </div>
            <div>
              <h2 class="rm-horizons__title">Bigger horizons</h2>
              <p class="rm-horizons__pitch">The larger bets we’re building toward.</p>
            </div>
          </header>
          <div class="rm-horizons__grid">
            ${HORIZONS.map((h) => html`
              <article class="rm-horizon-card ui-lift" key=${h.title}>
                <div class="rm-feature__icon" aria-hidden="true">
                  <${Icon} name=${h.icon} size=${18} />
                </div>
                <h3 class="rm-feature__title">${h.title}</h3>
                <p class="rm-feature__blurb">${h.blurb}</p>
              </article>
            `)}
          </div>
        </section>

        <section class="rm-trust">
          <header class="rm-section-head">
            <div class="rm-section-head__label">Always true</div>
            <p class="rm-section-head__sub">No matter what ships — these don’t change.</p>
          </header>
          <div class="rm-trust__grid">
            ${TRUST.map((t) => html`
              <article class="rm-trust-card ui-instrument ui-lift" key=${t.title}>
                <div class="rm-feature__icon" aria-hidden="true">
                  <${Icon} name=${t.icon} size=${18} />
                </div>
                <h3 class="rm-feature__title">${t.title}</h3>
                <p class="rm-feature__blurb">${t.blurb}</p>
              </article>
            `)}
          </div>
        </section>

        <section class="rm-cta ui-instrument-surface">
          <div class="rm-cta__copy">
            <h2 class="rm-cta__title">Help shape it</h2>
            <p class="rm-cta__blurb">
              Loudest ideas ship first — vote on GitHub. No fake dates, no vaporware.
            </p>
          </div>
          <a
            class="rm-cta__btn"
            href="https://github.com/djinnbanter/WatchTower/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            <${Icon} name="external-link" size=${14} />
            Vote on GitHub Issues
          </a>
        </section>

      </div>
    <//>
  `;
}
