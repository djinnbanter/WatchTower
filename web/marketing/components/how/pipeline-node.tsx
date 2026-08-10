'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { PipelineNode } from '@/content/how';

const STAGGER_S = 0.08;

function stepLabel(index: number) {
  return String(index + 1).padStart(2, '0');
}

/** Collect / peer diagram node - equal-height instrument tile. */
export function PipelineNodeCard({
  node,
  index = 0,
  active,
}: {
  node: PipelineNode;
  index?: number;
  active: boolean;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={active || reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      transition={{
        duration: 0.4,
        delay: reduce ? 0 : index * STAGGER_S,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="flex h-full min-h-[4.75rem] flex-col justify-center gap-1 border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] px-3.5 py-3"
    >
      <span className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--wt-text-low)]">
        {stepLabel(index)}
      </span>
      <span className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--wt-text)]">
        {node.label}
      </span>
      {node.detail ? (
        <span className="text-[0.8125rem] leading-snug text-[color:var(--wt-text-mid)]">
          {node.detail}
        </span>
      ) : null}
    </motion.div>
  );
}

export { PipelineEngine as PipelineHub } from '@/components/how/pipeline-engine';

/** Advise column caption - no second plate above the desk peek. */
export function PipelineAdviseHead({
  node,
  index = 0,
  active,
}: {
  node: PipelineNode;
  index?: number;
  active: boolean;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={active || reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
      transition={{
        duration: 0.35,
        delay: reduce ? 0 : index * STAGGER_S,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="flex flex-col gap-1 border-b border-[color:var(--wt-line)] px-0.5 pb-2"
    >
      <span className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--wt-text-low)]">
        {stepLabel(index)}
      </span>
      <span className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--wt-text)]">
        {node.label}
      </span>
      {node.detail ? (
        <span className="text-[0.8125rem] leading-snug text-[color:var(--wt-text-mid)]">
          {node.detail}
        </span>
      ) : null}
    </motion.div>
  );
}
