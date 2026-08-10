import { BoardSection } from '@/components/board';
import { EveningChart } from '@/components/evening-chart';
import { HeroReadout } from '@/components/hero-readout';
import { HOME_OVERVIEW_INSIGHTS_LEAD } from '@/content/product';

export function ProofOverviewInsights() {
  return (
    <BoardSection
      id="overview"
      index={4}
      label="Overview + Insights"
      metaRight="grade · schedule"
      lead={HOME_OVERVIEW_INSIGHTS_LEAD}
      fullViewport
    >
      <div className="grid gap-px bg-[color:var(--wt-line)] lg:grid-cols-2">
        <div className="bg-[color:var(--wt-bg0)] p-4 md:p-5">
          <p className="wt-meta mb-3 text-[color:var(--wt-text-low)]">Grade · restart advice</p>
          <HeroReadout />
        </div>
        <div className="bg-[color:var(--wt-bg0)] p-4 md:p-5">
          <p className="wt-meta mb-3 text-[color:var(--wt-text-low)]">Insights schedule</p>
          <EveningChart variant="panel" />
        </div>
      </div>
    </BoardSection>
  );
}
