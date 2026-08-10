'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Hero right rail — sideways WatchTower wordmark.
 * Font size fills the rail height; column width follows the glyph.
 */
export function HeroSideRail() {
  const ref = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(64);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const h = el.clientHeight;
      if (h < 32) return;
      // 10 glyphs stacked; slight pad so ends stay inside the rail.
      setFontSize(h / 10.15);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="relative flex h-full min-h-[14rem] w-fit flex-1 items-center justify-center lg:min-h-0"
      aria-hidden
    >
      <p
        className="wt-display m-0 select-none whitespace-nowrap"
        style={{
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          fontSize,
          lineHeight: 1,
          letterSpacing: '-0.035em',
        }}
      >
        <span className="text-[color:var(--wt-text)]">WATCH</span>
        <span className="text-[color:var(--wt-accent)]">TOWER</span>
      </p>
    </div>
  );
}
