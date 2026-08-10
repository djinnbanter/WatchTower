import type { Metadata } from 'next';
import { BoardFrame, BoardPageHeader } from '@/components/board';
import { Cta } from '@/components/cta';
import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { GithubMark } from '@/components/brand/github-mark';
import { Reveal } from '@/components/reveal';
import {
  INSTALL_DR,
  INSTALL_PAGE,
  INSTALL_PREREQS,
  INSTALL_SECURITY,
  INSTALL_STEPS,
} from '@/content/install';
import { LINKS, PAGE_META } from '@/content/product';
import { getLatestReleaseTag } from '@/lib/release';
import '@/components/install-procedure.css';

export const metadata: Metadata = {
  title: { absolute: PAGE_META.install.title },
  description: PAGE_META.install.description,
};

export default async function InstallPage() {
  const release = await getLatestReleaseTag();
  const prereqBadges = ['JAVA 21', 'ACCESS', 'NETWORK'];

  return (
    <main>
      <BoardFrame ariaLabel="Install board">
        <BoardPageHeader
          meta={`WatchTower · ${INSTALL_PAGE.label}`}
          title={INSTALL_PAGE.title}
          lead={
            <div className="space-y-4">
              <p>{INSTALL_PAGE.body}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {[
                  { label: 'Prerequisites', id: 'prereqs' },
                  { label: 'Quick Start', id: 'steps' },
                  { label: 'Security Posture', id: 'security' },
                  { label: 'CLI Recovery', id: 'dr-recovery' },
                ].map(({ label, id }) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    className="inline-flex items-center gap-1.5 border border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] px-2.5 py-1 font-mono text-[0.75rem] uppercase tracking-[0.1em] text-[color:var(--wt-text-mid)] no-underline transition-colors duration-200 hover:border-[color:var(--wt-accent)] hover:text-[color:var(--wt-accent)]"
                  >
                    <span>{label}</span>
                    <span aria-hidden className="text-[color:var(--wt-accent)]">
                      ↓
                    </span>
                  </a>
                ))}
              </div>
            </div>
          }
          right={
            <div className="flex flex-col justify-between gap-5 h-full">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-3.5">
                  <p className="wt-meta text-[color:var(--wt-accent)]">Target Platform</p>
                  <p className="mt-1 font-display text-lg leading-tight text-[color:var(--wt-text)] sm:text-xl">
                    NeoForge 1.21.x
                  </p>
                </div>
                <div className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-3.5">
                  <p className="wt-meta text-[color:var(--wt-ok)]">Build Version</p>
                  <p className="mt-1 font-mono text-base font-semibold leading-tight text-[color:var(--wt-text)] truncate sm:text-lg">
                    {release.tag}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Cta
                  href={LINKS.modrinth}
                  leading={<ModrinthMark className="h-3.5 w-3.5" />}
                  withArrow
                  className="flex-1 min-w-[130px]"
                >
                  Modrinth
                </Cta>
                <Cta
                  href={LINKS.github}
                  variant="ghost"
                  leading={<GithubMark className="h-3.5 w-3.5" />}
                  className="flex-1 min-w-[130px]"
                >
                  GitHub
                </Cta>
              </div>
            </div>
          }
        />

        {/* Prerequisites Section */}
        <section id="prereqs" className="border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] p-5 md:p-8">
          <div className="flex items-center justify-between border-b border-[color:var(--wt-line)] pb-3">
            <div>
              <p className="wt-meta text-[color:var(--wt-accent)]">{INSTALL_PREREQS.label}</p>
              <h2 className="mt-1 wt-display max-w-[22ch] text-[clamp(1.5rem,3vw,2rem)] text-[color:var(--wt-text)]">
                {INSTALL_PREREQS.title}
              </h2>
            </div>
            <span className="hidden font-mono text-xs uppercase tracking-widest text-[color:var(--wt-text-low)] md:inline-block">
              [ MINIMUM REQUIREMENTS ]
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {INSTALL_PREREQS.items.map((item, idx) => (
              <div
                key={item}
                className="flex flex-col justify-between border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-5 transition-colors duration-200 hover:bg-[color:var(--wt-bg0)]"
              >
                <div>
                  <div className="flex items-center justify-between pb-3">
                    <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[color:var(--wt-accent)]">
                      {prereqBadges[idx] || `REQ 0${idx + 1}`}
                    </span>
                    <span className="font-mono text-xs font-bold text-[color:var(--wt-text-low)]">
                      0{idx + 1}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-[color:var(--wt-text-mid)]">
                    {item}
                  </p>
                </div>
                <div className="mt-4 border-t border-[color:var(--wt-line)] pt-2 text-[0.75rem] font-mono text-[color:var(--wt-ok)]">
                  ✓ Ready to configure
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Start Procedure */}
        <section id="steps" className="border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] p-5 md:p-8">
          <p className="wt-meta text-[color:var(--wt-accent)]">Step by Step</p>
          <h2 className="mt-2 mb-6 wt-display max-w-[18ch] text-[clamp(1.5rem,3vw,2rem)] text-[color:var(--wt-text)]">
            Quick Start Guide
          </h2>
          <ol className="install-procedure">
            {INSTALL_STEPS.map((step, i) => (
              <li key={step.title}>
                <Reveal className="install-step" delay={i * 0.05} kind="rise">
                  <div className="install-step__spine" aria-hidden>
                    <span className="install-step__index">{String(i + 1).padStart(2, '0')}</span>
                    <span className="install-step__rail" />
                  </div>
                  <div className="install-step__body">
                    <div className="install-step__plate">
                      <div className="p-5 md:p-6">
                        <h3 className="install-step__title">{step.title}</h3>
                        <p className="install-step__copy">{step.body}</p>
                        {i === 0 ? (
                          <div className="install-step__actions">
                            <Cta
                              href={LINKS.modrinth}
                              leading={<ModrinthMark className="h-3.5 w-3.5" />}
                              withArrow
                              size="sm"
                            >
                              Get it on Modrinth
                            </Cta>
                            <Cta
                              href={LINKS.github}
                              variant="ghost"
                              leading={<GithubMark className="h-3.5 w-3.5" />}
                              size="sm"
                            >
                              GitHub Releases
                            </Cta>
                          </div>
                        ) : null}
                        {i === 1 ? (
                          <div className="mt-3 border border-[color:var(--wt-line)] bg-[color:var(--wt-bg2)] p-3 font-mono text-xs text-[color:var(--wt-text-mid)]">
                            <span className="text-[color:var(--wt-text-low)]">DESTINATION PATH:</span>
                            <br />
                            <code className="text-[color:var(--wt-text)]">/your-server-root/mods/watchtower-neoforge-1.21.x.jar</code>
                          </div>
                        ) : null}
                        {i === 3 ? (
                          <div className="install-url mt-4" role="group" aria-label="Dashboard address">
                            <div className="install-url__chrome" aria-hidden>
                              <span />
                              <span />
                              <span />
                              <em>WatchTower Dashboard</em>
                            </div>
                            <div className="install-url__address">
                              <p className="install-url__value">http://&lt;your-server-ip&gt;:8787</p>
                            </div>
                            <div className="px-3 pb-3 font-mono text-xs text-[color:var(--wt-text-mid)]">
                              Default Login: <code className="text-[color:var(--wt-accent)]">watchtower</code> / <code className="text-[color:var(--wt-accent)]">password</code>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        {/* Security Posture Section */}
        <section id="security" className="border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-5 md:p-8">
          <div className="max-w-3xl">
            <span className="wt-meta text-[color:var(--wt-accent)]">{INSTALL_SECURITY.label}</span>
            <h2 className="mt-2 wt-display text-[clamp(1.5rem,3vw,2rem)] text-[color:var(--wt-text)]">
              {INSTALL_SECURITY.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--wt-text-mid)]">
              {INSTALL_SECURITY.body}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3 font-mono text-xs">
              <div className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] p-3">
                <span className="text-[color:var(--wt-ok)]">✓ OPTION 1</span>
                <p className="mt-1 font-semibold text-[color:var(--wt-text)]">Localhost / SSH Tunnel</p>
                <p className="mt-1 text-[0.75rem] text-[color:var(--wt-text-low)]">Highest security posture</p>
              </div>
              <div className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] p-3">
                <span className="text-[color:var(--wt-ok)]">✓ OPTION 2</span>
                <p className="mt-1 font-semibold text-[color:var(--wt-text)]">Private WireGuard / Tailscale</p>
                <p className="mt-1 text-[0.75rem] text-[color:var(--wt-text-low)]">Private network access</p>
              </div>
              <div className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] p-3">
                <span className="text-[color:var(--wt-warn)]">! OPTION 3</span>
                <p className="mt-1 font-semibold text-[color:var(--wt-text)]">Direct Port 8787</p>
                <p className="mt-1 text-[0.75rem] text-[color:var(--wt-text-low)]">Requires strong password</p>
              </div>
            </div>

            <div className="mt-5">
              <Cta href={LINKS.wikiSecurity} variant="ghost" newTab size="sm">
                {INSTALL_SECURITY.cta}
              </Cta>
            </div>
          </div>
        </section>

        {/* Disaster Recovery Section */}
        <section id="dr-recovery" className="border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] p-5 md:p-8">
          <div className="max-w-3xl">
            <span className="wt-meta text-[color:var(--wt-accent)]">{INSTALL_DR.label}</span>
            <h2 className="mt-2 wt-display text-[clamp(1.5rem,3vw,2rem)] text-[color:var(--wt-text)]">
              {INSTALL_DR.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--wt-text-mid)]">
              {INSTALL_DR.body}
            </p>

            <div className="mt-5 border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-4 font-mono text-xs">
              <div className="mb-2 flex items-center justify-between text-[color:var(--wt-text-low)]">
                <span>TERMINAL COMMAND (STANDALONE DR MODE)</span>
                <span className="text-[color:var(--wt-accent)]">NO MINECRAFT NEEDED</span>
              </div>
              <div className="flex items-center gap-2 text-[color:var(--wt-text)]">
                <span className="text-[color:var(--wt-accent)]">$</span>
                <code>java -jar watchtower-cli.jar</code>
              </div>
            </div>
          </div>
        </section>
      </BoardFrame>
    </main>
  );
}
