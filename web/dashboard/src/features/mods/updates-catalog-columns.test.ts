import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  updatesImpactSummary,
  updatesImpactVerdict,
  updatesModrinthUrl,
  updatesVersionSides,
} from './updates-catalog-columns';

describe('updates-catalog-columns', () => {
  it('reads version sides from update row', () => {
    assert.deepEqual(
      updatesVersionSides({ current_version: '6.0.6', latest_compatible: '6.1.0' }),
      { current: '6.0.6', latest: '6.1.0' },
    );
    assert.deepEqual(updatesVersionSides({}), {});
    assert.deepEqual(updatesVersionSides(null), {});
  });

  it('returns empty impact summary when missing (no placeholder)', () => {
    assert.equal(updatesImpactSummary({ impact_summary: 'Needs Flywheel' }), 'Needs Flywheel');
    assert.equal(updatesImpactSummary({ impact_summary: '  ' }), '');
    assert.equal(updatesImpactSummary({}), '');
  });

  it('defaults verdict to unknown', () => {
    assert.equal(updatesImpactVerdict({ impact_verdict: 'caution' }), 'caution');
    assert.equal(updatesImpactVerdict({}), 'unknown');
  });

  it('prefers update-row Modrinth URL then mod fields', () => {
    assert.equal(
      updatesModrinthUrl(
        { modrinth_compatible_url: 'https://modrinth.com/a' },
        { modrinth_compatible_url: 'https://modrinth.com/b' },
      ),
      'https://modrinth.com/a',
    );
    assert.equal(
      updatesModrinthUrl({ modrinth_cta_url: 'https://modrinth.com/cta' }, {}),
      'https://modrinth.com/cta',
    );
    assert.equal(
      updatesModrinthUrl(null, {
        modrinth_compatible_url: 'https://modrinth.com/mod',
        modrinth_cta_url: 'https://modrinth.com/cta2',
      }),
      'https://modrinth.com/mod',
    );
    assert.equal(updatesModrinthUrl(null, {}), '');
  });
});
