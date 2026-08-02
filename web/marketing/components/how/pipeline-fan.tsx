'use client';

import { motion, useReducedMotion } from 'motion/react';

/**
 * SVG fan: many paths converging to one (in) or one splitting to many (out).
 * Orthogonal elbows. Desktop only; mobile uses PipelineConnector instead.
 * Lines use non-scaling-stroke (uniform 2px). Arrowheads are CSS overlays so
 * preserveAspectRatio=none does not squash them.
 */
export function PipelineFan({
  mode,
  from,
  to,
  active,
  delay = 0,
}: {
  mode: 'in' | 'out';
  from: number;
  to: number;
  active: boolean;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const sources = mode === 'in' ? from : 1;
  const targets = mode === 'in' ? 1 : to;
  const paths: string[] = [];

  if (mode === 'in') {
    for (let i = 0; i < sources; i++) {
      const x0 = ((i + 0.5) / sources) * 100;
      const x1 = 50;
      paths.push(`M ${x0} 0 L ${x0} 50 L ${x1} 50 L ${x1} 100`);
    }
  } else {
    for (let i = 0; i < targets; i++) {
      const x0 = 50;
      const x1 = ((i + 0.5) / targets) * 100;
      paths.push(`M ${x0} 0 L ${x0} 50 L ${x1} 50 L ${x1} 100`);
    }
  }

  const arrowCount = mode === 'in' ? 1 : targets;
  const arrowLeft = (i: number) =>
    mode === 'in' ? '50%' : `${((i + 0.5) / targets) * 100}%`;

  return (
    <div aria-hidden className="relative mx-auto hidden h-10 w-full max-w-[84rem] lg:block lg:h-12">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
      >
        {paths.map((d, i) => (
          <g key={i}>
            <path
              d={d}
              fill="none"
              stroke="var(--wt-text-mid)"
              strokeWidth="2"
              strokeLinecap="square"
              strokeLinejoin="miter"
              vectorEffect="non-scaling-stroke"
            />
            {!reduce ? (
              <motion.path
                d={d}
                fill="none"
                stroke="var(--wt-accent)"
                strokeWidth="2"
                strokeLinecap="square"
                strokeLinejoin="miter"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={
                  active
                    ? { pathLength: [0, 1, 1], opacity: [0, 1, 0] }
                    : { pathLength: 0, opacity: 0 }
                }
                transition={{
                  duration: 0.85,
                  delay: delay + i * 0.05,
                  times: [0, 0.6, 1],
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
            ) : null}
          </g>
        ))}
      </svg>

      {Array.from({ length: arrowCount }, (_, i) => (
        <span
          key={i}
          className="pointer-events-none absolute bottom-0 h-0 w-0 -translate-x-1/2 translate-y-[1px] border-x-[5px] border-t-[7px] border-x-transparent border-t-[color:var(--wt-text-mid)]"
          style={{ left: arrowLeft(i) }}
        />
      ))}
    </div>
  );
}
