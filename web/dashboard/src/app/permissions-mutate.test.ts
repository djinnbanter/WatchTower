import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canMutateMods } from './permissions';

describe('canMutateMods', () => {
  it('allows owner even without an explicit flag', () => {
    assert.equal(canMutateMods({ role: 'owner' }), true);
  });

  it('allows when can_mutate_mods is true', () => {
    assert.equal(canMutateMods({ role: 'admin', can_mutate_mods: true }), true);
  });

  it('allows when capabilities include mods.mutate', () => {
    assert.equal(
      canMutateMods({ role: 'admin', capabilities: ['mods.mutate'] }),
      true,
    );
  });

  it('denies admin/viewer without the capability', () => {
    assert.equal(canMutateMods({ role: 'admin' }), false);
    assert.equal(canMutateMods({ role: 'viewer', capabilities: [] }), false);
    assert.equal(canMutateMods(null), false);
  });
});
