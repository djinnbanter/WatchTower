import Link from 'next/link';
import { BoardSection } from '@/components/board';
import { HeroReadout } from '@/components/hero-readout';
import {
  HOME_OVERVIEW_BODY,
  HOME_OVERVIEW_CTA,
  HOME_OVERVIEW_LABEL,
  HOME_OVERVIEW_TITLE,
} from '@/content/product';

export function ProofOverview() {
  return (
    <BoardSection
      id="overview"
      index={2}
      label={HOME_OVERVIEW_LABEL}
      title={HOME_OVERVIEW_TITLE}
      metaRight="grade · restart"
      lead={HOME_OVERVIEW_BODY}
      fullViewport
    >
      <div className="hidden min-h-0 flex-1 flex-col justify-center p-3 md:p-5 lg:flex">
        <p className="wt-meta mb-2 text-[color:var(--wt-text-low)] md:mb-3">Grade · restart advice</p>
        <HeroReadout />
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[color:var(--wt-line)] px-4 py-2.5 md:px-6 md:py-3">
        <p className="wt-meta text-[color:var(--wt-text-low)]">{HOME_OVERVIEW_CTA}</p>
        <Link
          href="#issues"
          className="wt-meta inline-flex min-h-11 items-center gap-2 text-[color:var(--wt-accent)] no-underline hover:text-[color:var(--wt-text)]"
        >
          Check out the Fix inbox
          <span aria-hidden>↓</span>
        </Link>
      </div>
    </BoardSection>
  );
}
