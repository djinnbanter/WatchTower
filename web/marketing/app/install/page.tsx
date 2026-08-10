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
  return (
    <main>
      <BoardFrame ariaLabel="Install board">
        <BoardPageHeader
          meta={`WatchTower · ${INSTALL_PAGE.label}`}
          title={INSTALL_PAGE.title}
          lead={INSTALL_PAGE.body}
          right={
            release.tag !== 'latest' ? (
              <div className="space-y-2">
                <p className="wt-meta text-[color:var(--wt-text-low)]">Release</p>
                <p className="font-mono text-sm text-[color:var(--wt-text)]">{release.tag}</p>
                <p className="text-sm text-[color:var(--wt-text-mid)]">{release.label}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="wt-meta text-[color:var(--wt-text-low)]">Release</p>
                <p className="font-mono text-sm text-[color:var(--wt-text)]">latest</p>
              </div>
            )
          }
        />

        <section className="border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] p-5 md:p-8">
          <p className="wt-meta text-[color:var(--wt-accent)]">{INSTALL_PREREQS.label}</p>
          <h2 className="mt-3 wt-display max-w-[22ch] text-[clamp(1.5rem,3vw,2rem)] text-[color:var(--wt-text)]">
            {INSTALL_PREREQS.title}
          </h2>
          <ul className="mt-5 m-0 list-none space-y-3 p-0">
            {INSTALL_PREREQS.items.map((item) => (
              <li
                key={item}
                className="border-l-2 border-[color:var(--wt-text)] pl-3 text-sm leading-relaxed text-[color:var(--wt-text-mid)]"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] p-5 md:p-8">
          <p className="wt-meta text-[color:var(--wt-accent)]">Step by Step</p>
          <h2 className="mt-3 mb-6 wt-display max-w-[18ch] text-[clamp(1.5rem,3vw,2rem)] text-[color:var(--wt-text)]">
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
                            >
                              Get it on Modrinth
                            </Cta>
                            <Cta
                              href={LINKS.github}
                              variant="ghost"
                              leading={<GithubMark className="h-3.5 w-3.5" />}
                            >
                              GitHub
                            </Cta>
                          </div>
                        ) : null}
                        {i === 3 ? (
                          <div className="install-url mt-4" role="group" aria-label="Dashboard address">
                            <div className="install-url__chrome" aria-hidden>
                              <span />
                              <span />
                              <span />
                              <em>Dashboard</em>
                            </div>
                            <div className="install-url__address">
                              <p className="install-url__value">http://&lt;your-server-ip&gt;:8787</p>
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

        <section className="border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-5 md:p-8">
          <p className="wt-meta text-[color:var(--wt-accent)]">{INSTALL_SECURITY.label}</p>
          <h2 className="mt-3 wt-display max-w-[20ch] text-[clamp(1.5rem,3vw,2rem)] text-[color:var(--wt-text)]">
            {INSTALL_SECURITY.title}
          </h2>
          <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-[color:var(--wt-text-mid)]">
            {INSTALL_SECURITY.body}
          </p>
          <a
            href={LINKS.wikiSecurity}
            className="wt-meta mt-5 inline-flex text-[color:var(--wt-accent)] no-underline hover:text-[color:var(--wt-text)]"
          >
            {INSTALL_SECURITY.cta}
          </a>
        </section>

        <section className="border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] p-5 md:p-8">
          <p className="wt-meta text-[color:var(--wt-accent)]">{INSTALL_DR.label}</p>
          <h2 className="mt-3 wt-display max-w-[20ch] text-[clamp(1.5rem,3vw,2rem)] text-[color:var(--wt-text)]">
            {INSTALL_DR.title}
          </h2>
          <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-[color:var(--wt-text-mid)]">
            {INSTALL_DR.body}
          </p>
        </section>
      </BoardFrame>
    </main>
  );
}
