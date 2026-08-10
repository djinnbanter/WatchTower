import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ISSUE_COUNTS, NAV, OVERVIEW } from '../../fixtures';
import { useNav } from '../../nav';

export function SiteHeader() {
  const { page } = useNav();
  const item = NAV.find((n) => n.id === page);
  const title = item?.label ?? 'Overview';
  const group = item?.group ?? 'Monitor';

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background">
      <div className="flex w-full items-center gap-2 px-3 lg:px-4">
        <SidebarTrigger className="-ml-0.5 rounded-none" />
        <Separator orientation="vertical" className="mx-1 data-vertical:h-4 data-vertical:self-auto" />
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <p className="wt-meta text-muted-foreground">{group}</p>
          <h1 className="truncate font-mono text-sm font-medium text-foreground">{title}</h1>
        </div>
        <p className="wt-meta hidden shrink-0 items-center gap-2 text-muted-foreground sm:inline-flex">
          <span
            aria-hidden
            className={`inline-block h-2 w-2 ${
              OVERVIEW.watching ? 'bg-[color:var(--wt-ok)]' : 'bg-muted-foreground'
            }`}
          />
          Watching · {ISSUE_COUNTS.open} open
        </p>
      </div>
    </header>
  );
}
