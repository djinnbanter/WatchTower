import Link from 'next/link';
import { BoardSection } from '@/components/board';
import { StorageRunwayReadout } from '@/components/storage-runway-readout';
import {
  HOME_INSIGHTS_BODY,
  HOME_INSIGHTS_CTA,
  HOME_INSIGHTS_LABEL,
  HOME_INSIGHTS_TITLE,
} from '@/content/product';

export function ProofInsights() {
  return (
    <BoardSection
      id="insights"
      index={5}
      label={HOME_INSIGHTS_LABEL}
      title={HOME_INSIGHTS_TITLE}
      metaRight="storage · runway"
      lead={HOME_INSIGHTS_BODY}
      fullViewport
    >
      <div className="hidden min-h-0 flex-1 flex-col justify-center p-3 md:p-5 lg:flex">
        <p className="wt-meta mb-2 text-[color:var(--wt-text-low)] md:mb-3">Storage runway</p>
        <StorageRunwayReadout />
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[color:var(--wt-line)] px-4 py-2.5 md:px-6 md:py-3">
        <p className="wt-meta text-[color:var(--wt-text-low)]">{HOME_INSIGHTS_CTA}</p>
        <Link
          href="#close"
          className="wt-meta inline-flex min-h-11 items-center gap-2 text-[color:var(--wt-accent)] no-underline hover:text-[color:var(--wt-text)]"
        >
          Get Started
          <span aria-hidden>↓</span>
        </Link>
      </div>
    </BoardSection>
  );
}
