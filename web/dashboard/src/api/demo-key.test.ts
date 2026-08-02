import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalKey } from './demo-key.mjs';

describe('canonicalKey', () => {
  it('uppercases method and sorts query params', () => {
    assert.equal(
      canonicalKey('get', '/api/samples', '?minutes=60&max_points=500'),
      'GET /api/samples?max_points=500&minutes=60',
    );
  });

  it('handles empty search', () => {
    assert.equal(canonicalKey('GET', '/api/live', ''), 'GET /api/live');
  });

  it('accepts search without leading ?', () => {
    assert.equal(
      canonicalKey('GET', '/api/spark/tree', 'path=abc&max_nodes=250000'),
      'GET /api/spark/tree?max_nodes=250000&path=abc',
    );
  });
});
