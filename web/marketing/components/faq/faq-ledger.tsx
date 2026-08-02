'use client';

import { InstrumentPlate } from '@/components/instrument-plate';
import { MarginNote } from '@/components/type/margin-note';
import { Reveal } from '@/components/reveal';
import { FAQ_GROUPS } from '@/content/faq';
import { LINKS } from '@/content/product';
import '@/components/faq/faq-ledger.css';

function padIndex(n: number) {
  return String(n).padStart(2, '0');
}

export function FaqLedger() {
  let n = 0;

  return (
    <div className="faq-ledger">
      {FAQ_GROUPS.map((group, gi) => (
        <section key={group.label} className="faq-group" aria-label={group.label}>
          <Reveal kind="lift" delay={gi * 0.04}>
            <div className="faq-group__head">
              <MarginNote>{group.label}</MarginNote>
              <p className="faq-group__blurb">{group.blurb}</p>
            </div>
          </Reveal>

          <Reveal kind="rise" delay={0.05 + gi * 0.04}>
            <InstrumentPlate>
              <dl className="m-0">
                {group.items.map((item) => {
                  n += 1;
                  const index = padIndex(n);
                  return (
                    <div key={item.q} className="faq-row">
                      <span className="faq-row__index" aria-hidden>
                        {index}
                      </span>
                      <div className="faq-row__body">
                        <dt className="faq-row__q">{item.q}</dt>
                        <dd className="faq-row__a">{item.a}</dd>
                      </div>
                    </div>
                  );
                })}
              </dl>
            </InstrumentPlate>
          </Reveal>
        </section>
      ))}
    </div>
  );
}

export function FaqFoot() {
  return (
    <Reveal delay={0.08}>
      <div className="faq-foot">
        <p className="faq-foot__copy">Need more detail, or want to vote on what ships next?</p>
        <div className="faq-foot__links">
          <a href={LINKS.wiki}>Wiki</a>
          <a href={`${LINKS.github}/issues`}>GitHub Issues</a>
          <a href="/install">Install</a>
        </div>
      </div>
    </Reveal>
  );
}
