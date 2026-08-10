'use client';

import { useState } from 'react';
import { FAQ_ITEMS } from '@/content/faq';
import '@/components/faq/faq-ledger.css';

const TAGS = ['All', 'Data & Privacy', 'Restarts', 'Compatibility', 'Performance', 'CLI'];

function matchTag(q: string, a: string, tag: string): boolean {
  if (tag === 'All') return true;
  const text = (q + ' ' + a).toLowerCase();
  if (tag === 'Data & Privacy')
    return (
      text.includes('cloud') ||
      text.includes('data') ||
      text.includes('log') ||
      text.includes('private')
    );
  if (tag === 'Restarts') return text.includes('restart') || text.includes('reboot');
  if (tag === 'Compatibility')
    return (
      text.includes('pterodactyl') ||
      text.includes('neoforge') ||
      text.includes('fabric') ||
      text.includes('player')
    );
  if (tag === 'Performance')
    return (
      text.includes('cpu') ||
      text.includes('memory') ||
      text.includes('scan') ||
      text.includes('free')
    );
  if (tag === 'CLI')
    return text.includes('cli') || text.includes('start') || text.includes('recovery');
  return true;
}

export function FaqLedger() {
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState('All');

  const filtered = FAQ_ITEMS.filter((item) => {
    const matchesQuery =
      !query ||
      item.q.toLowerCase().includes(query.toLowerCase()) ||
      item.a.toLowerCase().includes(query.toLowerCase());
    const matchesFilterTag = matchTag(item.q, item.a, activeTag);
    return matchesQuery && matchesFilterTag;
  });

  return (
    <div className="space-y-6">
      {/* Search & Topic Filters */}
      <div className="flex flex-col gap-4 border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions (e.g. cloud, restart, memory)..."
            className="w-full border border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] px-3.5 py-2 font-mono text-xs text-[color:var(--wt-text)] placeholder-[color:var(--wt-text-low)] outline-none transition-colors duration-200 focus:border-[color:var(--wt-accent)]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-[color:var(--wt-text-low)] hover:text-[color:var(--wt-text)]"
            >
              ✕
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className={`border px-2.5 py-1 font-mono text-[0.75rem] uppercase tracking-wider transition-colors duration-200 ${
                activeTag === tag
                  ? 'border-[color:var(--wt-accent)] bg-[color:var(--wt-accent)] text-[color:var(--wt-accent-ink)] font-semibold'
                  : 'border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] text-[color:var(--wt-text-mid)] hover:border-[color:var(--wt-text)] hover:text-[color:var(--wt-text)]'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Questions Ledger */}
      <div className="faq-plate">
        {filtered.length > 0 ? (
          <dl className="m-0">
            {filtered.map((item, i) => {
              const index = String(i + 1).padStart(2, '0');
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
        ) : (
          <div className="p-8 text-center font-mono text-xs text-[color:var(--wt-text-low)]">
            No questions match &quot;{query}&quot;. Try resetting your search filter.
          </div>
        )}
      </div>
    </div>
  );
}

export function FaqFoot() {
  return (
    <div className="flex flex-col gap-2">
      <span className="wt-meta text-[color:var(--wt-accent)]">Need More Detail?</span>
      <h3 className="font-display text-xl uppercase tracking-tight text-[color:var(--wt-text)]">
        Community &amp; Documentation
      </h3>
      <p className="max-w-[42ch] text-sm leading-relaxed text-[color:var(--wt-text-mid)]">
        Full technical specifications and setup guides live on the wiki. For feature requests and bug reports, join us on GitHub Issues.
      </p>
    </div>
  );
}
