'use client';

import { useEffect } from 'react';
import { HomeAmbient } from '@/components/home/home-ambient';
import { HomeClose } from '@/components/home/close';
import { HomeHero } from '@/components/home/hero';
import { WhatIs } from '@/components/home/what-is';
import { ProofCrashes } from '@/components/home/proof-crashes';
import { ProofInsights } from '@/components/home/proof-insights';
import { ProofIssues } from '@/components/home/proof-issues';
import { ProofOverview } from '@/components/home/proof-overview';
import { LivePulseProvider } from '@/components/shift-log/live-pulse-context';
import { SparkProvider } from '@/components/motion/spark-context';

const SLIDE_MS = 700;
const COOLDOWN_MS = 380;

function panelList(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.wt-snap-panel'));
}

function panelIndexAtCenter(list: HTMLElement[]): number {
  const mid = window.innerHeight / 2;
  let best = 0;
  let bestDist = Infinity;
  list.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const c = r.top + r.height / 2;
    const d = Math.abs(c - mid);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

function centerScrollY(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  const absoluteTop = rect.top + window.scrollY;
  const y = absoluteTop + rect.height / 2 - window.innerHeight / 2;
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  return Math.max(0, Math.min(max, y));
}

/** If the wheel is over an inner scroller that can still move, let native scroll win. */
function canScrollInner(target: EventTarget | null, deltaY: number): boolean {
  if (!(target instanceof Element)) return false;
  let node: Element | null = target;
  while (node && node !== document.documentElement) {
    if (node instanceof HTMLElement) {
      const style = window.getComputedStyle(node);
      const oy = style.overflowY;
      if (
        (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
        node.scrollHeight > node.clientHeight + 1
      ) {
        const down = deltaY > 0;
        const atTop = node.scrollTop <= 1;
        const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
        if ((down && !atBottom) || (!down && !atTop)) return true;
      }
    }
    node = node.parentElement;
  }
  return false;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Full-bleed hero + board panels.
 * Desktop: one wheel notch → next/prev section, eased slide.
 * Phone: normal document scroll (no snap / no viewport lock).
 */
export function HomeBoard() {
  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = window.matchMedia('(min-width: 1024px)');

    let sliding = false;
    let coolUntil = 0;
    let animRaf = 0;
    let wheelBound = false;

    const cancelSlide = () => {
      if (animRaf) {
        window.cancelAnimationFrame(animRaf);
        animRaf = 0;
      }
      sliding = false;
    };

    const slideTo = (el: HTMLElement) => {
      cancelSlide();
      const targetY = centerScrollY(el);
      const startY = window.scrollY;
      const delta = targetY - startY;
      if (Math.abs(delta) < 2) return;

      sliding = true;
      coolUntil = Date.now() + COOLDOWN_MS;
      const t0 = performance.now();

      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / SLIDE_MS);
        window.scrollTo(0, startY + delta * easeOutCubic(p));
        if (p < 1) {
          animRaf = window.requestAnimationFrame(step);
        } else {
          animRaf = 0;
          sliding = false;
          window.scrollTo(0, targetY);
        }
      };
      animRaf = window.requestAnimationFrame(step);
    };

    const onWheel = (e: WheelEvent) => {
      if (!desktop.matches || reduce.matches) return;
      if (Math.abs(e.deltaY) < 8) return;

      if (sliding) {
        e.preventDefault();
        return;
      }

      if (Date.now() < coolUntil) return;
      if (canScrollInner(e.target, e.deltaY)) return;

      const list = panelList();
      if (list.length === 0) return;

      const idx = panelIndexAtCenter(list);
      const current = list[idx];
      if (!current) return;

      const nextIdx = Math.max(
        0,
        Math.min(list.length - 1, idx + (e.deltaY > 0 ? 1 : -1)),
      );
      const next = list[nextIdx];
      if (!next || next === current) return;

      e.preventDefault();
      slideTo(next);
    };

    const syncMode = () => {
      cancelSlide();
      if (reduce.matches || !desktop.matches) {
        root.classList.remove('wt-home-snap');
        if (wheelBound) {
          window.removeEventListener('wheel', onWheel);
          wheelBound = false;
        }
        return;
      }

      root.classList.add('wt-home-snap');
      if (!wheelBound) {
        window.addEventListener('wheel', onWheel, { passive: false });
        wheelBound = true;
      }
    };

    syncMode();
    desktop.addEventListener('change', syncMode);
    reduce.addEventListener('change', syncMode);

    return () => {
      root.classList.remove('wt-home-snap');
      cancelSlide();
      desktop.removeEventListener('change', syncMode);
      reduce.removeEventListener('change', syncMode);
      if (wheelBound) window.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <LivePulseProvider>
      <SparkProvider>
        <HomeAmbient />
        <div className="relative z-10">
          <HomeHero />
          {/* Match BoardFrame width; hero + close stay full-bleed. */}
          <div className="relative mx-auto w-full max-w-[1600px] px-4 md:px-8">
            <WhatIs />
            <ProofOverview />
            <ProofIssues />
            <ProofCrashes />
            <ProofInsights />
          </div>
          <HomeClose />
        </div>
      </SparkProvider>
    </LivePulseProvider>
  );
}
