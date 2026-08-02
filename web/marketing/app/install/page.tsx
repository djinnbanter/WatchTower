import type { Metadata } from 'next';
import { InstallSecureNote, InstallSteps } from '@/components/install-steps';
import { MarginNote } from '@/components/type/margin-note';
import { LINKS } from '@/content/product';
import { getLatestReleaseTag } from '@/lib/release';

export const metadata: Metadata = { title: 'Install' };

export default async function InstallPage() {
  const release = await getLatestReleaseTag();
  return (
    <main>
      <section className="mx-auto w-full max-w-[54rem] px-5 pb-10 pt-20 md:px-8 md:pb-12 md:pt-28">
        <MarginNote className="mb-5">Three steps</MarginNote>
        <h1 className="wt-display-sm text-[color:var(--wt-text)] text-balance">Install</h1>
        <p className="mt-5 max-w-[48ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
          Drop the jar in{' '}
          <span className="font-mono text-[0.9375rem] text-[color:var(--wt-text)]">mods/</span>
          , restart, then open the dashboard. Longer notes are on the{' '}
          <a
            href={LINKS.wikiInstall}
            className="text-[color:var(--wt-text)] underline-offset-2 hover:underline"
          >
            Installation wiki
          </a>
          .
        </p>
      </section>

      <section
        aria-label="Install steps"
        className="mx-auto w-full max-w-[54rem] px-5 pb-10 md:px-8 md:pb-12"
      >
        <InstallSteps release={release} />
      </section>

      <section
        aria-label="Default login"
        className="mx-auto w-full max-w-[54rem] px-5 pb-16 md:px-8 md:pb-20"
      >
        <InstallSecureNote />
      </section>
    </main>
  );
}
