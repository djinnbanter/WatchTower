import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { incidentStoryBlurb, incidentStoryTitle } from './incident-story-title.ts';

describe('incidentStoryTitle', () => {
  it('builds an arrow chain from domains', () => {
    assert.equal(
      incidentStoryTitle({ domains: ['lag', 'crash', 'backup'] }),
      'Lag → Crash → Backup',
    );
  });

  it('handles a single domain', () => {
    assert.equal(incidentStoryTitle({ domains: ['crash'] }), 'Crash');
  });

  it('falls back to narrative when domains are empty', () => {
    assert.equal(
      incidentStoryTitle({ narrative: 'Lag spike at 22:56 preceded a Create NPE.' }),
      'Lag spike at 22:56 preceded a Create NPE',
    );
  });

  it('never returns the raw story id', () => {
    assert.equal(
      incidentStoryTitle({ id: 'story-2026-07-19T22-56-59Z' }),
      'Correlated incident',
    );
  });
});

describe('incidentStoryBlurb', () => {
  it('clamps long narratives', () => {
    const long = 'A'.repeat(200);
    const blurb = incidentStoryBlurb({ narrative: long }, 40);
    assert.equal(blurb.length, 40);
    assert.ok(blurb.endsWith('…'));
  });
});
