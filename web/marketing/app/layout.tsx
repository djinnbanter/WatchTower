import type { Metadata } from 'next';
import '@/styles/globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { ThemeProvider } from '@/components/theme-provider';
import { HERO_OVERVIEW, TAGLINE } from '@/content/product';

export const metadata: Metadata = {
  ...(process.env.NEXT_PUBLIC_SITE_URL
    ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) }
    : {}),
  title: {
    default: 'WatchTower',
    template: '%s · WatchTower',
  },
  description: `${TAGLINE} ${HERO_OVERVIEW}`,
  icons: {
    // Same mark as the static demo (watchtower-icon-simple → favicon.ico).
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/brand/watchtower-icon-simple.png', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/brand/watchtower-icon-simple.png',
  },
};

const THEME_BOOT = `(function(){try{var k='wt-marketing-theme';var p=localStorage.getItem(k);var t=(p==='light'||p==='dark')?p:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=t;document.documentElement.classList.toggle('dark',t==='dark')}catch(e){document.documentElement.dataset.theme='dark';document.documentElement.classList.add('dark')}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-theme="dark" className="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-[100dvh] antialiased">
        <div
          dangerouslySetInnerHTML={{
            __html: `<!--
          THESIS: The home page is a feature-first Shift Log desk tour - named
            WatchTower surfaces in order. Left columns teach features; desk mocks
            hold the sample fixtures.
          OWN-WORLD: Night Watch Desk at marketing scale. Tonal plates, hairlines only,
            tight 2/4/6px corners, Signal Blue scarce, Lantern Amber as the sole light
            source (rail fill). Paper light theme. Geist display, JetBrains Mono for
            numerals and system chrome. 12px label floor.
          STORY: Welcome, Live vitals, Issues Fix inbox, Crashes / OOM review, Overview
            grade, Insights schedule, demo.
          FIRST VIEWPORT: Brand-first Welcome. Tagline, overview, CTAs. Scroll cue into
            Live gauges. No glow orbs. No centered SaaS stack.
          FORM: Ordered desk tour entries (no timeline rail). Feature names live in each h2.
          FINISH: anti-slop negative list + silhouette check before done.
        -->`,
          }}
        />
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--wt-radius-md)] focus:bg-[color:var(--wt-accent)] focus:px-3 focus:py-2 focus:text-[color:var(--wt-accent-ink)]"
          >
            Skip to content
          </a>
          <div className="relative z-10 flex min-h-[100dvh] flex-col">
            <SiteHeader />
            <div id="main" className="flex-1">
              {children}
            </div>
            <SiteFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
