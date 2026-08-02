import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { expandOnlyYDomains, expandOnlyYDomainsWithRecover } from './y-domain-utils.ts';

describe('expandOnlyYDomains', () => {
  it('expands max/min but never shrinks within a lock', () => {
    const prev = { left: [0, 22] as [number, number] };
    const next = { left: [0, 18] as [number, number] };
    assert.deepEqual(expandOnlyYDomains(prev, next), { left: [0, 22] });

    const spike = { left: [0, 40] as [number, number] };
    assert.deepEqual(expandOnlyYDomains(prev, spike), { left: [0, 40] });
  });

  it('merges axes present on either side', () => {
    const prev = { left: [0, 10] as [number, number] };
    const next = {
      left: [0, 12] as [number, number],
      right: [-5, 5] as [number, number],
    };
    assert.deepEqual(expandOnlyYDomains(prev, next), {
      left: [0, 12],
      right: [-5, 5],
    });
  });
});

describe('expandOnlyYDomainsWithRecover', () => {
  it('stays expand-only until recover window elapses', () => {
    const prev = { left: [0, 100] as [number, number] };
    const calm = { left: [0, 20] as [number, number] };
    const state = { belowSinceMs: null as number | null };
    const first = expandOnlyYDomainsWithRecover(prev, calm, state, 1_000);
    assert.deepEqual(first, { left: [0, 100] });
    assert.equal(state.belowSinceMs, 1_000);

    const mid = expandOnlyYDomainsWithRecover(first, calm, state, 5_000);
    assert.deepEqual(mid, { left: [0, 100] });

    const recovered = expandOnlyYDomainsWithRecover(mid, calm, state, 10_000);
    assert.deepEqual(recovered, calm);
    assert.equal(state.belowSinceMs, null);
  });

  it('resets the recover timer when the next domain is no longer well below', () => {
    const prev = { left: [0, 100] as [number, number] };
    const calm = { left: [0, 20] as [number, number] };
    const near = { left: [0, 90] as [number, number] };
    const state = { belowSinceMs: null as number | null };
    expandOnlyYDomainsWithRecover(prev, calm, state, 1_000);
    assert.equal(state.belowSinceMs, 1_000);
    const back = expandOnlyYDomainsWithRecover(prev, near, state, 5_000);
    assert.deepEqual(back, { left: [0, 100] });
    assert.equal(state.belowSinceMs, null);
  });
});
