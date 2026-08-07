import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultSafeSelection, selectionHasNonSafe } from './batch-selection';

describe('defaultSafeSelection', () => {
  it('selects Safe rows only', () => {
    const ids = defaultSafeSelection([
      { mod_id: 'a', impact_verdict: 'safe' },
      { mod_id: 'b', impact_verdict: 'caution' },
      { mod_id: 'c', impact_verdict: 'break' },
      { id: 'd', impact_verdict: 'safe' },
      { mod_id: 'e', impact_verdict: 'unknown' },
    ]);
    assert.deepEqual(ids, ['a', 'd']);
  });

  it('skips rows without an id', () => {
    assert.deepEqual(defaultSafeSelection([{ impact_verdict: 'safe' }]), []);
  });
});

describe('selectionHasNonSafe', () => {
  const rows = [
    { mod_id: 'a', impact_verdict: 'safe' },
    { mod_id: 'b', impact_verdict: 'caution' },
  ];

  it('is false when only Safe ids are selected', () => {
    assert.equal(selectionHasNonSafe(['a'], rows), false);
  });

  it('is true when a Caution/Break id is selected', () => {
    assert.equal(selectionHasNonSafe(['a', 'b'], rows), true);
  });
});
