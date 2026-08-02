'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { FaultyTerminal } from '@/components/motion/faulty-terminal';
import { useTheme } from '@/components/theme-provider';
import './desk-faulty-terminal.css';

/**
 * Welcome ambient: quiet FaultyTerminal field.
 * Soft left fade keeps copy readable; theme tint stays subtle in both modes.
 */
export function DeskFaultyTerminal({ className = '' }: { className?: string }) {
  const { theme } = useTheme();
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const dark = theme === 'dark';
  // Night needs more luminance to read on ink; paper stays quieter.
  const tint = dark ? '#a8c4ff' : '#3a5f9a';
  const brightness = dark ? 0.88 : 0.35;

  return (
    <div
      ref={rootRef}
      className={`wt-mkt-faulty-ambient absolute inset-0 ${className}`.trim()}
      data-theme-mode={dark ? 'dark' : 'light'}
      aria-hidden
    >
      <FaultyTerminal
        scale={dark ? 1.55 : 1.75}
        gridMul={[2, 1]}
        digitSize={dark ? 1.15 : 1.05}
        timeScale={reduce ? 0 : 0.28}
        pause={Boolean(reduce) || !visible}
        scanlineIntensity={dark ? 0.28 : 0.18}
        glitchAmount={0.3}
        flickerAmount={reduce ? 0 : dark ? 0.28 : 0.18}
        noiseAmp={dark ? 0.55 : 0.35}
        chromaticAberration={0}
        dither={0}
        curvature={0.04}
        tint={tint}
        mouseReact={!reduce}
        mouseStrength={dark ? 0.35 : 0.22}
        pageLoadAnimation={false}
        brightness={brightness}
      />
    </div>
  );
}
