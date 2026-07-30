import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldEnterSetupWizard } from './persist';

describe('shouldEnterSetupWizard', () => {
  it('blocks admin and viewer even when wizard storage is empty', () => {
    assert.equal(shouldEnterSetupWizard('admin', null), false);
    assert.equal(shouldEnterSetupWizard('viewer', null), false);
  });

  it('allows owner when wizard has never started', () => {
    assert.equal(shouldEnterSetupWizard('owner', null), true);
  });

  it('skips owner when wizard is already completed', () => {
    assert.equal(shouldEnterSetupWizard('owner', { completed: true }), false);
  });
});
