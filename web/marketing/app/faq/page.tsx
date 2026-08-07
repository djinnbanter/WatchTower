import type { Metadata } from 'next';
import { FaqFoot, FaqLedger } from '@/components/faq/faq-ledger';
import { MarginNote } from '@/components/type/margin-note';
import { FAQ_ITEMS } from '@/content/faq';

export const metadata: Metadata = { title: 'FAQ' };

export default function FaqPage() {
  const count = String(FAQ_ITEMS.length).padStart(2, '0');

  return (
    <main>
      <section className="mx-auto w-full max-w-[54rem] px-5 pb-10 pt-20 md:px-8 md:pb-12 md:pt-28">
        <MarginNote className="mb-5">{count} answers</MarginNote>
        <h1 className="wt-display-sm text-[color:var(--wt-text)] text-balance">FAQ</h1>
        <p className="mt-5 max-w-[48ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
          Scope, trust, and what sits on the host. Written for dedicated-server admins.
        </p>
      </section>

      <section
        aria-label="Frequently asked questions"
        className="mx-auto w-full max-w-[54rem] px-5 pb-12 md:px-8 md:pb-16"
      >
        <FaqLedger />
      </section>

      <section className="border-t border-[color:var(--wt-line)] py-12 md:py-16">
        <div className="mx-auto w-full max-w-[54rem] px-5 md:px-8">
          <FaqFoot />
        </div>
      </section>
    </main>
  );
}
