import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { updateDetailRelatedTarget } from './update-detail-nav';

describe('updateDetailRelatedTarget', () => {
  it('stays on updates when related mod has an update row', () => {
    assert.deepEqual(
      updateDetailRelatedTarget('flywheel', new Set(['create', 'flywheel'])),
      { view: 'updates', mod: 'flywheel' },
    );
  });

  it('opens library project when related mod has no update', () => {
    assert.deepEqual(
      updateDetailRelatedTarget('jei', new Set(['create'])),
      { view: 'overview', mod: 'jei' },
    );
  });
});
