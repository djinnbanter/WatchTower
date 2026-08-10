import Link from 'next/link';
import { BoardSection } from '@/components/board';
import { ProductDesk } from '@/components/desk/product-desk';
import { TOUR } from '@/content/product';

export function ProofCrashes() {
  return (
    <BoardSection
      id="crashes"
      index={4}
      label="Crashes"
      title={TOUR.crashes.title}
      metaRight={TOUR.crashes.note}
      lead={TOUR.crashes.capability}
      fullViewport
    >
      <div className="hidden min-h-0 flex-1 flex-col justify-center p-3 md:p-5 lg:flex">
        <p className="wt-meta mb-2 text-[color:var(--wt-text-low)] md:mb-3">Crashes</p>
        <ProductDesk surface="crashes" cut="list" chrome="bare" compact className="w-full" />
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[color:var(--wt-line)] px-4 py-2.5 md:px-6 md:py-3">
        <p className="wt-meta text-[color:var(--wt-text-low)]">{TOUR.crashes.cta}</p>
        <Link
          href="#insights"
          className="wt-meta inline-flex min-h-11 items-center gap-2 text-[color:var(--wt-accent)] no-underline hover:text-[color:var(--wt-text)]"
        >
          Find the problematic mod in seconds.
          <span aria-hidden>↓</span>
        </Link>
      </div>
    </BoardSection>
  );
}
