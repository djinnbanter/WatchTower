/**
 * Roadmap showcase — poster-style layout matching docs/assets/roadmap-poster.html.
 * Content mirrors docs/ROADMAP.md (keep in sync when that doc changes).
 */
import { html } from '../../lib/preact.js';
import { Page } from '../../ui/patterns/index.js';
import { Icon } from '../../ui/icons.js';

const LEGEND = [
  { tone: 'ok', kicker: 'Works today', title: 'In the jar now', blurb: 'Already shipping — install and use' },
  { tone: 'sky', kicker: 'Coming next', title: 'On the workbench', blurb: 'Planned by real admin situations' },
  { tone: 'warn', kicker: 'Later', title: 'Bigger bets', blurb: 'Fleet, alerts, more platforms' },
  { tone: 'mid', kicker: 'Not our job', title: 'We stay focused', blurb: 'Panels & player analytics elsewhere' },
];

const WORKS_TODAY = [
  { icon: 'server', title: 'Live dashboard', blurb: 'TPS, MSPT, CPU, memory, players — while you watch' },
  { icon: 'bug', title: 'Crash intelligence', blurb: 'Likely mod + fix in plain English' },
  { icon: 'package', title: 'Smart mod list', blurb: 'Modrinth, deps, client-vs-server hints' },
  { icon: 'clipboard', title: 'Health reports', blurb: 'Scheduled or on demand · prioritized fixes' },
  { icon: 'activity', title: 'Performance Insights', blurb: 'Busy/quiet hours, sticky lag, heatmaps, CSV' },
  { icon: 'zap', title: 'Spark integration', blurb: 'Turn a profile into “what ate the tick”' },
  { icon: 'shield', title: 'Disaster recovery', blurb: 'CLI + browser viewer when it won’t boot' },
  { icon: 'folder', title: 'Ops extras', blurb: 'Backups, sessions, activity, logs, docs' },
  { icon: 'lock', title: 'Secure by default', blurb: 'Login, optional 2FA, honest panel metrics' },
];

const SITUATIONS = [
  {
    id: 'lag',
    tone: 'sky',
    icon: 'zap',
    title: 'When the server lags',
    pitch: 'Catch it · name it · separate farms from mods',
    items: [
      { title: 'Catch lag for you', blurb: 'auto-profile on TPS dips; name the culprit even if you weren’t watching' },
      { title: 'Spot farms & chunk loaders', blurb: 'world pressure (entities, chunks) separate from “a bad mod”' },
      { title: 'Notice when normal gets worse', blurb: 'baseline + sustained regression (“slower since Tuesday”)' },
    ],
  },
  {
    id: 'ram',
    tone: 'accent',
    icon: 'cpu',
    title: 'When you’re unsure about RAM or settings',
    pitch: 'Clear answers before you spend money',
    items: [
      { title: 'Do I need more RAM?', blurb: 'plain-English GC, heap, flags, Java version' },
      { title: 'Right-size memory', blurb: 'what you actually use vs idle headroom' },
      { title: 'Config coach', blurb: 'keep / tweak / why for properties & startup flags' },
      { title: 'Safe guided fixes', blurb: 'vetted settings with preview & undo' },
    ],
  },
  {
    id: 'restart',
    tone: 'ok',
    icon: 'check',
    title: 'When you need to trust a restart',
    pitch: 'Know it’s safe · understand what went wrong',
    items: [
      { title: 'Safe to restart?', blurb: 'backups, pregen, who’s online before /stop' },
      { title: 'One incident timeline', blurb: 'lag → crash → missed backup' },
      { title: 'Why it really died', blurb: 'mod crash vs OOM vs panel/watchdog' },
      { title: 'Weekly digest · disk runway · smarter restart advice', blurb: 'panel still owns the stop' },
    ],
  },
  {
    id: 'mods',
    tone: 'purple',
    icon: 'package',
    title: 'When mods need care',
    pitch: 'Quarantine · Safe updates · proof it helped',
    items: [
      { title: 'Jar quarantine', blurb: 'move aside (don’t delete) + Undo + restart reminder' },
      { title: 'Assisted Safe updates', blurb: 'verify, back up, swap; risky stays manual' },
      { title: 'Did that update help?', blurb: 'before/after performance' },
      { title: 'Tamper & secrets · CurseForge · shareable crash rules', blurb: '' },
    ],
  },
  {
    id: 'joins',
    tone: 'sky',
    icon: 'users',
    title: 'When players can’t join',
    pitch: 'Pack sync · first-hour confidence',
    items: [
      { title: 'Join clinic', blurb: 'failed join → exact mismatched jars → copy for Discord' },
      { title: 'Pin a known-good pack', blurb: 'freeze good list; banner + named diff on drift' },
      { title: 'First-hour sanity', blurb: 'Java, loader, client-only-on-server, deps — green/amber/red' },
    ],
  },
  {
    id: 'world',
    tone: 'warn',
    icon: 'map',
    title: 'When the world itself is the problem',
    pitch: 'Farms · corruption · silent scripts',
    items: [
      { title: 'Farm / item-storm storytelling', blurb: 'not “buy more RAM”' },
      { title: 'Corrupt chunk playbook', blurb: 'region hint → stop → backup → repair (no silent wipes)' },
      { title: 'Silent script failures', blurb: 'KubeJS / datapack errors raised as Issues' },
    ],
  },
  {
    id: 'act',
    tone: 'accent',
    icon: 'terminal',
    title: 'When you need to act or ask for help',
    pitch: 'Safe actions · clean support handoffs',
    items: [
      { title: 'Live command bridge', blurb: 'preview safe triage (e.g. pause Chunky); confirm first' },
      { title: 'Support pack export', blurb: 'one redacted zip for mod authors' },
      { title: 'Player-safe explain + ops context', blurb: 'short vs admin detail; lag vs timeout (not analytics)' },
    ],
  },
  {
    id: 'teams',
    tone: 'net',
    icon: 'users',
    title: 'For teams & checking in on the go',
    pitch: 'Co-admins · status · phone glance',
    items: [
      { title: 'Named admin accounts', blurb: 'per-person logins + who changed what' },
      { title: 'Public status page', blurb: '“are we up?” without exposing the dashboard' },
      { title: 'Copy for Discord · maintenance windows · mobile glance', blurb: '' },
    ],
  },
];

const LATER = [
  { title: 'Fleet view', blurb: 'TPS, crashes, backups across many servers — proxy-aware' },
  { title: 'Alerts that reach you', blurb: 'Discord / webhook for crashes, lag, stale backups, pregen stalls' },
  { title: 'More platforms', blurb: 'Fabric + NeoForge 1.20.x — same dashboard & workflow' },
];

const NOT_OUR_JOB = [
  { title: 'Host panels', blurb: 'Start/stop, files, console → Pterodactyl / Crafty / AMP' },
  { title: 'Player analytics', blurb: 'Retention, GeoIP, leaderboards → Plan & similar' },
  { title: 'Client GPU crashes', blurb: 'Doesn’t apply to headless dedicated servers' },
];

const PROMISES = [
  { title: 'Your data stays yours', blurb: 'Local-first · no telemetry · no log uploads by default' },
  { title: 'You’re in control', blurb: 'Opt-in network · preview & undo · no quiet world/mod edits' },
  { title: 'Ops, not surveillance', blurb: 'Run the server — don’t track players like analytics' },
  { title: 'Drop-in beside your host', blurb: 'A jar in mods/ — not a second control panel' },
];

function SituationPanel({ situation }) {
  return html`
    <section class=${`rm-panel rm-panel--${situation.tone} ui-instrument`} data-tone=${situation.tone}>
      <header class="rm-panel__head">
        <div class="rm-panel__icon" aria-hidden="true">
          <${Icon} name=${situation.icon} size=${18} />
        </div>
        <div class="rm-panel__titles">
          <h3 class="rm-panel__title">${situation.title}</h3>
          <p class="rm-panel__pitch">${situation.pitch}</p>
        </div>
      </header>
      <ul class="rm-panel__list">
        ${situation.items.map((item) => html`
          <li key=${item.title}>
            <span class="rm-panel__item">
              <strong>${item.title}</strong>
              ${item.blurb ? ` — ${item.blurb}` : ''}
            </span>
          </li>
        `)}
      </ul>
    </section>
  `;
}

export function PageView() {
  return html`
    <${Page}
      tour="roadmap"
      title="Roadmap"
      subtitle="What works today, what’s coming next, and what we’re not building"
    >
      <div class="ui-page__stack rm-page" data-tour="roadmap">

        <section class="rm-hero ui-instrument">
          <div class="rm-hero__sheen" aria-hidden="true"></div>
          <div class="rm-hero__glow" aria-hidden="true"></div>
          <div class="rm-hero__layout">
            <div class="rm-hero__content">
              <div class="rm-hero__badge">
                <${Icon} name="rocket" size=${14} />
                <span>Roadmap · plain English</span>
              </div>
              <h2 class="rm-hero__headline">What works today.<br />What’s coming next.</h2>
              <p class="rm-hero__tagline">
                Ops for modded Minecraft — a jar in <strong>mods/</strong>, dashboard on
                <strong> your</strong> server. No cloud account. Grouped by the problems
                every admin actually hits.
              </p>
            </div>
            <div class="rm-hero__aside">
              <div class="rm-status-chip">
                <span class="rm-chip__dot rm-chip__dot--ok"></span>
                <span><strong>Today:</strong> NeoForge 1.21.x</span>
              </div>
              <div class="rm-status-chip">
                <span class="rm-chip__dot rm-chip__dot--sky"></span>
                <span><strong>Later:</strong> Fabric · NeoForge 1.20.x</span>
              </div>
              <div class="rm-status-chip">
                <span class="rm-chip__dot rm-chip__dot--warn"></span>
                <span>Ships when ready — no fake dates</span>
              </div>
            </div>
          </div>
        </section>

        <div class="rm-legend">
          ${LEGEND.map((card) => html`
            <article class=${`rm-legend-card rm-legend-card--${card.tone}`} key=${card.kicker}>
              <div class="rm-legend-card__kicker">${card.kicker}</div>
              <h3 class="rm-legend-card__title">${card.title}</h3>
              <p class="rm-legend-card__blurb">${card.blurb}</p>
            </article>
          `)}
        </div>

        <section class="rm-shipped">
          <header class="rm-section-head">
            <div class="rm-section-head__label">
              <span class="rm-section-head__pulse" aria-hidden="true"></span>
              Works today
            </div>
          </header>
          <div class="rm-today-grid">
            ${WORKS_TODAY.map((item) => html`
              <article class="rm-today-item ui-instrument ui-lift" key=${item.title}>
                <div class="rm-today-item__icon" aria-hidden="true">
                  <${Icon} name=${item.icon} size=${16} />
                </div>
                <div class="rm-today-item__body">
                  <h3 class="rm-today-item__title">${item.title}</h3>
                  <p class="rm-today-item__blurb">${item.blurb}</p>
                </div>
              </article>
            `)}
          </div>
        </section>

        <section class="rm-coming">
          <header class="rm-section-head rm-section-head--coming">
            <div class="rm-section-head__label rm-section-head__label--spark">
              <${Icon} name="sparkles" size=${14} />
              Coming next — by situation
            </div>
            <p class="rm-section-head__sub">Problems every modded-server admin hits — not internal version numbers.</p>
          </header>
          <div class="rm-situation-grid">
            ${SITUATIONS.map((s) => html`<${SituationPanel} key=${s.id} situation=${s} />`)}
          </div>
        </section>

        <div class="rm-bottom">
          <section class="rm-panel rm-panel--warn ui-instrument">
            <header class="rm-panel__head">
              <div class="rm-panel__icon" aria-hidden="true">
                <${Icon} name="rocket" size=${18} />
              </div>
              <div class="rm-panel__titles">
                <h3 class="rm-panel__title">Later — bigger bets</h3>
                <p class="rm-panel__pitch">After the day-to-day ops line</p>
              </div>
            </header>
            <ul class="rm-stack-list">
              ${LATER.map((item) => html`
                <li key=${item.title}>
                  <strong>${item.title}</strong>
                  <span>${item.blurb}</span>
                </li>
              `)}
            </ul>
          </section>

          <section class="rm-panel rm-panel--mid ui-instrument">
            <header class="rm-panel__head">
              <div class="rm-panel__icon" aria-hidden="true">
                <${Icon} name="x" size=${18} />
              </div>
              <div class="rm-panel__titles">
                <h3 class="rm-panel__title">Not our job</h3>
                <p class="rm-panel__pitch">We stay out of the way</p>
              </div>
            </header>
            <ul class="rm-stack-list">
              ${NOT_OUR_JOB.map((item) => html`
                <li key=${item.title}>
                  <strong>${item.title}</strong>
                  <span>${item.blurb}</span>
                </li>
              `)}
            </ul>
          </section>

          <section class="rm-panel rm-panel--sky ui-instrument">
            <header class="rm-panel__head">
              <div class="rm-panel__icon" aria-hidden="true">
                <${Icon} name="shield" size=${18} />
              </div>
              <div class="rm-panel__titles">
                <h3 class="rm-panel__title">Promises that don’t change</h3>
                <p class="rm-panel__pitch">True no matter what ships</p>
              </div>
            </header>
            <ul class="rm-stack-list">
              ${PROMISES.map((item) => html`
                <li key=${item.title}>
                  <strong>${item.title}</strong>
                  <span>${item.blurb}</span>
                </li>
              `)}
            </ul>
          </section>
        </div>

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
            <${Icon} name="rocket" size=${14} />
            Vote on GitHub Issues
          </a>
        </section>

      </div>
    <//>
  `;
}
