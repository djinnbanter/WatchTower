'use client';

import { motion, useReducedMotion } from 'motion/react';

/**
 * Flowchart edge between two nodes.
 * mark: 'arrow' for directional flow; 'plus' for additive Collect joins.
 */
export function PipelineConnector({
  active,
  delay = 0,
  orientation = 'vertical',
  mark = 'arrow',
}: {
  active: boolean;
  delay?: number;
  orientation?: 'vertical' | 'horizontal';
  mark?: 'arrow' | 'plus';
}) {
  const reduce = useReducedMotion();
  const horizontal = orientation === 'horizontal';
  const plus = mark === 'plus';

  if (plus) {
    return (
      <div
        aria-hidden
        className={
          horizontal
            ? 'mx-1 flex w-6 shrink-0 items-center justify-center self-center lg:mx-2 lg:w-8'
            : 'mx-auto flex h-10 w-6 shrink-0 items-center justify-center'
        }
      >
        <motion.span
          className="font-mono text-[1.125rem] font-semibold leading-none text-[color:var(--wt-text-low)]"
          initial={reduce ? false : { opacity: 0, scale: 0.7 }}
          animate={active || reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
          transition={{
            duration: 0.35,
            delay: reduce ? 0 : delay,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          +
        </motion.span>
      </div>
    );
  }

  return (
    <div
      aria-hidden
      className={
        horizontal
          ? 'relative mx-1 flex h-auto w-6 shrink-0 items-center self-center lg:mx-2 lg:w-8'
          : 'relative mx-auto flex h-12 w-6 shrink-0 flex-col items-center justify-center'
      }
    >
      <div
        className={
          horizontal
            ? 'relative h-px w-full bg-[color:var(--wt-line)]'
            : 'relative h-full w-px bg-[color:var(--wt-line)]'
        }
      >
        {!reduce ? (
          <motion.span
            className={
              horizontal
                ? 'absolute inset-0 origin-left bg-[color:var(--wt-accent)]'
                : 'absolute inset-0 origin-top bg-[color:var(--wt-accent)]'
            }
            initial={{ scale: 0, opacity: 1 }}
            animate={
              active
                ? { scale: [0, 1, 1], opacity: [1, 1, 0] }
                : { scale: 0, opacity: 0 }
            }
            transition={{
              duration: 0.7,
              delay,
              times: [0, 0.55, 1],
              ease: [0.16, 1, 0.3, 1],
            }}
            style={horizontal ? { transformOrigin: 'left center' } : { transformOrigin: 'center top' }}
          />
        ) : null}
      </div>
      <span
        className={
          horizontal
            ? 'absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[4px] border-l-[6px] border-y-transparent border-l-[color:var(--wt-text-low)]'
            : 'absolute bottom-0 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[4px] border-t-[6px] border-x-transparent border-t-[color:var(--wt-text-low)]'
        }
      />
    </div>
  );
}
