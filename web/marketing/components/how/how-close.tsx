import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { Cta } from '@/components/cta';
import { CLOSE_BODY, CLOSE_HEADLINE, FOOTNOTE, LINKS, DEMO_URL } from '@/content/product';

export function HowClose() {
  return (
    <div className="grid gap-px border-t border-[color:var(--wt-line)] bg-[color:var(--wt-line)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <div className="space-y-4 bg-[color:var(--wt-bg1)] p-6 md:p-8">
        <p className="wt-meta text-[color:var(--wt-accent)]">[ Close ]</p>
        <h2 className="wt-display max-w-[16ch] text-[clamp(2rem,5vw,3.5rem)] text-[color:var(--wt-text)]">
          {CLOSE_HEADLINE}
        </h2>
      </div>
      <div className="flex flex-col justify-between gap-6 bg-[color:var(--wt-bg0)] p-6 md:p-8">
        <p className="max-w-[40ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
          {CLOSE_BODY}
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          <Cta
            href={LINKS.modrinth}
            withArrow
            leading={<ModrinthMark className="h-3.5 w-3.5" />}
          >
            Download from Modrinth
          </Cta>
          <Cta href={DEMO_URL} variant="ghost" newTab>
            Try the live demo
          </Cta>
        </div>
        <p className="wt-meta max-w-[46ch] text-[color:var(--wt-text-low)]">{FOOTNOTE}</p>
      </div>
    </div>
  );
}
