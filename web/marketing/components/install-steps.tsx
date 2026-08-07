'use client';

import { InstrumentPlate } from '@/components/instrument-plate';
import { Cta } from '@/components/cta';
import { Reveal } from '@/components/reveal';
import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { GithubMark } from '@/components/brand/github-mark';
import { LINKS } from '@/content/product';
import type { ReleaseInfo } from '@/lib/release';
import '@/components/install-procedure.css';

const REQS = [
  { label: 'Loader', value: 'NeoForge 1.21.x' },
  { label: 'Java', value: '21' },
  { label: 'Host', value: 'Linux dedicated' },
] as const;

export function InstallSteps({ release }: { release: ReleaseInfo }) {
  return (
    <ol className="install-procedure">
      <li>
        <Reveal className="install-step" kind="rise">
          <div className="install-step__spine" aria-hidden>
            <span className="install-step__index">01</span>
            <span className="install-step__rail" />
          </div>
          <div className="install-step__body">
            <InstrumentPlate>
              <div className="p-5 md:p-6">
                <h2 className="install-step__title">Get the jar</h2>
                <p className="install-step__copy">
                  Download the {release.label} release from Modrinth or GitHub Releases.
                </p>
                {release.tag !== 'latest' ? (
                  <p className="install-meta">
                    published as <code>{release.tag}</code>
                  </p>
                ) : null}
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
              </div>
            </InstrumentPlate>
          </div>
        </Reveal>
      </li>

      <li>
        <Reveal className="install-step" delay={0.06} kind="rise">
          <div className="install-step__spine" aria-hidden>
            <span className="install-step__index">02</span>
            <span className="install-step__rail" />
          </div>
          <div className="install-step__body">
            <InstrumentPlate>
              <div className="p-5 md:p-6">
                <h2 className="install-step__title">Drop it in mods/</h2>
                <p className="install-step__copy">
                  Put the jar with your other server mods, then restart so NeoForge picks it up.
                </p>
                <div className="install-req" role="list" aria-label="Requirements">
                  {REQS.map((r) => (
                    <span key={r.label} className="install-req__chip" role="listitem">
                      <strong>{r.label}</strong> {r.value}
                    </span>
                  ))}
                </div>
                <div className="install-path">
                  <p className="install-path__label">Server path</p>
                  <p className="install-path__value">mods/watchtower-….jar</p>
                </div>
              </div>
            </InstrumentPlate>
          </div>
        </Reveal>
      </li>

      <li>
        <Reveal className="install-step" delay={0.12} kind="rise">
          <div className="install-step__spine" aria-hidden>
            <span className="install-step__index">03</span>
            <span className="install-step__rail" />
          </div>
          <div className="install-step__body">
            <InstrumentPlate>
              <div className="p-5 md:p-6">
                <h2 className="install-step__title">Open the dashboard</h2>
                <p className="install-step__copy">
                  Once the server is up, open the dashboard. Prefer localhost or an SSH tunnel.
                  Don&apos;t expose port 8787 to the open internet.
                </p>
                <div className="install-url" role="group" aria-label="Local dashboard address">
                  <div className="install-url__chrome" aria-hidden>
                    <span />
                    <span />
                    <span />
                    <em>Local dashboard</em>
                  </div>
                  <div className="install-url__address">
                    <span className="install-url__lock" aria-hidden>
                      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden>
                        <rect x="3.5" y="7" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
                        <path
                          d="M5.5 7V5.25a2.5 2.5 0 0 1 5 0V7"
                          stroke="currentColor"
                          strokeWidth="1.25"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <p className="install-url__value">http://127.0.0.1:8787</p>
                  </div>
                  <p className="install-url__hint">
                    Change the default login when you first open it. Defaults are listed below.
                  </p>
                </div>
              </div>
            </InstrumentPlate>
          </div>
        </Reveal>
      </li>
    </ol>
  );
}

export function InstallSecureNote() {
  return (
    <Reveal delay={0.08}>
      <InstrumentPlate className="install-secure">
        <div className="install-secure__inner">
          <div className="install-secure__head">
            <span className="install-secure__badge">First login</span>
            <p className="install-secure__note">Default login. Change it the first time you open the dashboard.</p>
          </div>
          <dl className="install-secure__fields">
            <div className="install-secure__field">
              <dt>User</dt>
              <dd>
                <code>watchtower</code>
              </dd>
            </div>
            <div className="install-secure__field">
              <dt>Password</dt>
              <dd>
                <code>password</code>
              </dd>
            </div>
          </dl>
        </div>
      </InstrumentPlate>
    </Reveal>
  );
}
