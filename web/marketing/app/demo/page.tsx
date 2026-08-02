import type { Metadata } from 'next';
import { Cta } from '@/components/cta';
import { DEMO_URL, LINKS } from '@/content/product';

export const metadata: Metadata = { title: 'Demo' };

export default function DemoPage() {
  const demoConfigured = Boolean(process.env.NEXT_PUBLIC_DEMO_URL);

  return (
    <main className="mx-auto max-w-[48rem] px-5 py-16 lg:px-8 lg:py-24">
      <h1 className="wt-display-sm text-[color:var(--wt-text)]">Try the interactive demo</h1>
      <p className="wt-lead mt-4">
        This is the real WatchTower dashboard UI, filled with sample data. You can open every tab.
        Changes are not saved. Buttons still click; the demo just does not keep what you do.
      </p>

      <ul className="mt-10 space-y-4 border-t border-[color:var(--wt-line)] pt-8 text-sm text-[color:var(--wt-text-mid)]">
        <li className="flex gap-3">
          <span className="wt-label shrink-0 pt-0.5">Data</span>
          <span>Sample fixtures only. Not your server.</span>
        </li>
        <li className="flex gap-3">
          <span className="wt-label shrink-0 pt-0.5">Tabs</span>
          <span>Every surface is openable.</span>
        </li>
        <li className="flex gap-3">
          <span className="wt-label shrink-0 pt-0.5">Live</span>
          <span>Does not connect to a live Minecraft process.</span>
        </li>
      </ul>

      <div className="mt-10 flex flex-wrap gap-3">
        {demoConfigured ? (
          <Cta href={DEMO_URL} newTab>
            Open the demo
          </Cta>
        ) : (
          <p className="text-sm leading-relaxed text-[color:var(--wt-text-mid)]">
            Demo hosting is not configured yet (`NEXT_PUBLIC_DEMO_URL`). That should be the
            static demo origin (`npm run build:demo` → `dist-demo/`), not the fixture preview on
            :8081. Until then, grab the jar from{' '}
            <a href={LINKS.modrinth} className="text-[color:var(--wt-text)] underline-offset-2 hover:underline">
              Modrinth
            </a>{' '}
            or{' '}
            <a
              href={LINKS.releasesLatest}
              className="text-[color:var(--wt-text)] underline-offset-2 hover:underline"
            >
              GitHub Releases
            </a>
            , or run the local dashboard preview.
          </p>
        )}
        <Cta href={LINKS.modrinth} variant="ghost">
          Get it on Modrinth
        </Cta>
      </div>
    </main>
  );
}
