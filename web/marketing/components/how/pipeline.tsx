'use client';

import { Fragment, useRef, type ReactNode } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { ProductDesk } from '@/components/desk/product-desk';
import {
  PipelineAdviseHead,
  PipelineHub,
  PipelineNodeCard,
} from '@/components/how/pipeline-node';
import { PipelineConnector } from '@/components/how/pipeline-connector';
import { PipelineFan } from '@/components/how/pipeline-fan';
import { SupportPeek } from '@/components/how/support-peek';
import { COLLECT_NODES, ADVISE_NODES, UNDERSTAND_COPY, UNDERSTAND_LABEL } from '@/content/how';
import type { DeskCut, DeskChrome } from '@/components/desk/product-desk';
import type { DeskSurface } from '@/content/baked/desk';

const STAGGER_S = 0.08;
const FAN_IN_DELAY_S = COLLECT_NODES.length * STAGGER_S + 0.15;
const FAN_OUT_DELAY_S = FAN_IN_DELAY_S + 0.9;

const ADVISE_PEEK: Record<
  string,
  | { kind: 'desk'; surface: DeskSurface; cut: DeskCut; chrome: DeskChrome; compact?: boolean }
  | { kind: 'support' }
> = {
  'fix-inbox': { kind: 'desk', surface: 'issues', cut: 'bands', chrome: 'bare', compact: true },
  overview: { kind: 'desk', surface: 'overview', cut: 'grade', chrome: 'bare', compact: true },
  insights: { kind: 'desk', surface: 'insights', cut: 'list', chrome: 'bare', compact: true },
  support: { kind: 'support' },
};

/** Board compartment stamp — page h1 owns display weight. */
function StageTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2
      id={id}
      className="wt-meta border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] px-3 py-2 text-center text-[color:var(--wt-accent)] md:text-left"
    >
      {`[ ${children.toUpperCase()} ]`}
    </h2>
  );
}

function Stage({
  id,
  title,
  children,
  showTitle = true,
}: {
  id: string;
  title: string;
  children: ReactNode;
  showTitle?: boolean;
}) {
  return (
    <section
      aria-labelledby={showTitle ? id : undefined}
      aria-label={showTitle ? undefined : title}
      className="flex flex-col gap-3 border border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] p-4 md:gap-4 md:p-5"
    >
      {showTitle ? <StageTitle id={id}>{title}</StageTitle> : null}
      {children}
    </section>
  );
}

function FlowRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:flex-nowrap sm:items-stretch sm:gap-0">
      {children}
    </div>
  );
}

export function Pipeline() {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, amount: 0.15 });
  const active = reduce ? true : inView;

  return (
    <div ref={rootRef} className="flex flex-col gap-5 md:gap-7">
      <Stage id="how-collect" title="Collect">
        <FlowRow>
          {COLLECT_NODES.map((node, i) => (
            <Fragment key={node.id}>
              <div className="min-w-0 flex-1">
                <PipelineNodeCard node={node} index={i} active={active} />
              </div>
              {i < COLLECT_NODES.length - 1 ? (
                <>
                  <div className="hidden sm:flex">
                    <PipelineConnector
                      mark="plus"
                      orientation="horizontal"
                      active={active}
                      delay={reduce ? 0 : i * STAGGER_S}
                    />
                  </div>
                  <div className="flex justify-center py-0.5 sm:hidden">
                    <PipelineConnector
                      mark="plus"
                      active={active}
                      delay={reduce ? 0 : i * STAGGER_S}
                    />
                  </div>
                </>
              ) : null}
            </Fragment>
          ))}
        </FlowRow>
      </Stage>

      <PipelineFan
        mode="in"
        from={COLLECT_NODES.length}
        to={1}
        active={active}
        delay={reduce ? 0 : FAN_IN_DELAY_S}
      />
      <div className="flex justify-center lg:hidden">
        <PipelineConnector active={active} delay={reduce ? 0 : FAN_IN_DELAY_S} />
      </div>

      <Stage id="how-understand" title="Understand" showTitle={false}>
        <PipelineHub label={UNDERSTAND_LABEL} detail={UNDERSTAND_COPY} active={active} />
      </Stage>

      <PipelineFan
        mode="out"
        from={1}
        to={ADVISE_NODES.length}
        active={active}
        delay={reduce ? 0 : FAN_OUT_DELAY_S}
      />
      <div className="flex justify-center lg:hidden">
        <PipelineConnector active={active} delay={reduce ? 0 : FAN_OUT_DELAY_S} />
      </div>

      <Stage id="how-advise" title="Advise">
        <div className="grid grid-cols-1 items-stretch gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {ADVISE_NODES.map((node, i) => {
            const peek = ADVISE_PEEK[node.id];
            return (
              <div key={node.id} className="flex min-w-0 flex-col gap-3">
                <PipelineAdviseHead node={node} index={i} active={active} />
                {peek?.kind === 'desk' ? (
                  <ProductDesk
                    surface={peek.surface}
                    cut={peek.cut}
                    chrome={peek.chrome}
                    compact={peek.compact}
                    className="flex-1 h-full w-full"
                  />
                ) : null}
                {peek?.kind === 'support' ? (
                  <SupportPeek className="h-full w-full flex-1" />
                ) : null}
              </div>
            );
          })}
        </div>
      </Stage>
    </div>
  );
}
