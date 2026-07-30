import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { craftheadAvatarUrl } from './player-avatar';

describe('craftheadAvatarUrl', () => {
  it('builds a Crafthead avatar URL for the given size', () => {
    assert.equal(
      craftheadAvatarUrl('069a79f4-44e9-4726-a5be-fca90e38aaf5', 24),
      'https://crafthead.net/avatar/069a79f4-44e9-4726-a5be-fca90e38aaf5/24',
    );
  });
});
