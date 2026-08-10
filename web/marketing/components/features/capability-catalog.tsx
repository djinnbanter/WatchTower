'use client';

import type { ReactNode } from 'react';
import { featurePeek } from '@/components/features/bento-peeks';
import {
  FEATURE_BENTO_SECTIONS,
  type BentoMedia,
  type SectionSpan,
} from '@/content/features-bento';
import './capability-catalog.css';

function spanClass(span: SectionSpan): string {
  return `cap-span--${span}`;
}

function sectionGridClass(label: string): string {
  if (label === 'Monitor') return 'cap-grid cap-grid--monitor';
  if (label === 'Triage') return 'cap-grid cap-grid--triage';
  if (label === 'Operations') return 'cap-grid cap-grid--ops';
  return 'cap-grid cap-grid--system';
}

function CardBody({
  meta,
  title,
  body,
  media,
  visual,
  alpha,
}: {
  meta: string;
  title: string;
  body: string;
  media: BentoMedia;
  visual: ReactNode;
  alpha?: boolean;
}) {
  const copy = (
    <div className="cap-card__content">
      <p className="cap-card__label">
        {meta}
        {alpha ? <span className="cap-card__alpha"> · Alpha</span> : null}
      </p>
      <h3 className="cap-card__title">{title}</h3>
      <p className="cap-card__description">{body}</p>
    </div>
  );

  const visualEl = <div className="cap-card__visual">{visual}</div>;

  if (media === 'side') {
    return (
      <div className="cap-card__split">
        {visualEl}
        {copy}
      </div>
    );
  }

  if (media === 'stack') {
    return (
      <>
        {visualEl}
        {copy}
      </>
    );
  }

  return (
    <>
      {copy}
      {visualEl}
    </>
  );
}

/**
 * Sectioned capability catalog — bento grid + mock peeks per product group.
 */
export function CapabilityCatalog() {
  return (
    <div className="cap-sections">
      {FEATURE_BENTO_SECTIONS.map((section) => (
        <section
          key={section.label}
          id={section.label.toLowerCase().replace(/[^a-z]+/g, '-')}
          className="cap-section"
          data-section={section.label.toLowerCase().replace(/[^a-z]+/g, '-')}
          aria-label={section.label}
        >
          <header className="cap-section__head">
            <p className="cap-section__label">{section.label}</p>
          </header>
          <div className={sectionGridClass(section.label)} aria-label={`${section.label} capability grid`}>
            {section.cells.map((cell) => (
              <article
                key={`${section.label}-${cell.id}-${cell.title}`}
                className={`cap-card ${spanClass(cell.span)} cap-card--media-${cell.media}`}
              >
                <div className="cap-card__inner">
                  <CardBody
                    meta={section.label}
                    title={cell.title}
                    body={cell.body}
                    media={cell.media}
                    alpha={cell.alpha}
                    visual={featurePeek(cell.id)}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
