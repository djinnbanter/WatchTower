import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { expandOnlyYDomains } from './y-domain-utils.ts';

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
