import type { Metadata } from 'next';
import '@/styles/globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { ThemeProvider } from '@/components/theme-provider';
import { PAGE_META } from '@/content/product';
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  ...(process.env.NEXT_PUBLIC_SITE_URL
    ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) }
    : {}),
  title: {
    default: 'WatchTower',
    template: '%s · WatchTower',
  },
  description: PAGE_META.home.description,
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
          THESIS: The home page is a feature-first Shift Log — named WatchTower
            surfaces in order. Left columns teach features; compartment mocks hold
            the sample fixtures.
          OWN-WORLD: Industrial Ops Print at marketing scale. Flat ink/paper plates,
            1px ruled grid, zero radius everywhere. Hazard red for CTAs; lantern
            amber for brand warmth only. Archivo Black for display titles; Inter
            for body/UI; JetBrains Mono for meta, ports, and system chrome.
          STORY: Welcome, Live vitals, Issues Fix inbox, Crashes / OOM review, Overview
            grade, Insights schedule, demo.
          FIRST VIEWPORT: Brand-first Welcome. Tagline, overview, CTAs. Scroll cue into
            Live gauges. No glow orbs. No centered SaaS stack.
          FORM: Ordered Shift Log entries (no timeline rail). Feature names live in each h2.
          FINISH: anti-slop negative list + silhouette check before done.
        -->`,
          }}
        />
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-[color:var(--wt-accent)] focus:px-3 focus:py-2 focus:text-[color:var(--wt-accent-ink)]"
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
        <Analytics />
      </body>
    </html>
  );
}
