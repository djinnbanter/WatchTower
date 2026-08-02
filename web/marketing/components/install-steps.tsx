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
                  Download the {release.label} release from Modrinth or GitHub. Prefer Modrinth, or
                  open the repo and grab the jar from Releases.
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
                  Once the server is up, open the dashboard on the host. Stay on localhost or an SSH
                  tunnel. Don&apos;t put port 8787 on the open internet.
                </p>
                <div className="install-url">
                  <p className="install-url__label">Local dashboard</p>
                  <p className="install-url__value">http://127.0.0.1:8787</p>
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
            <p className="install-secure__note">Ships with these defaults. Change them on first open.</p>
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
