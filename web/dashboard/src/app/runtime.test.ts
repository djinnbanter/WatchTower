import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('isStaticDemo', () => {
  it('is exported and returns boolean', async () => {
    const mod = await import('./runtime.ts');
    assert.equal(typeof mod.isStaticDemo, 'function');
    assert.equal(typeof mod.isStaticDemo(), 'boolean');
  });

  it('exports isFixturePreview that returns boolean', async () => {
    const mod = await import('./runtime.ts');
    assert.equal(typeof mod.isFixturePreview, 'function');
    assert.equal(typeof mod.isFixturePreview(), 'boolean');
  });
});
