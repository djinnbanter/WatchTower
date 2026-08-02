import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalKey } from './demo-key.mjs';

describe('static demo routing helpers', () => {
  it('canonicalKey matches bake manifest style keys', () => {
    assert.equal(
      canonicalKey('GET', '/api/performance/rollups', 'hours=24'),
      'GET /api/performance/rollups?hours=24',
    );
  });

  it('documents POST stub shape', () => {
    const stub = { ok: true, preview: true };
    assert.deepEqual(stub, { ok: true, preview: true });
  });
});
