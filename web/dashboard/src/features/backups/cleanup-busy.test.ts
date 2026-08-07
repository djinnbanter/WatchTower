import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isCleanupDisabled } from './cleanup-busy.ts';

describe('isCleanupDisabled', () => {
  it('disables while job is running', () => {
    assert.equal(
      isCleanupDisabled({ canWrite: true, cleanupPending: false, jobStatus: 'running' }),
      true,
    );
  });
  it('enables when idle and writable', () => {
    assert.equal(
      isCleanupDisabled({ canWrite: true, cleanupPending: false, jobStatus: 'ok' }),
      false,
    );
  });
  it('disables without write capability', () => {
    assert.equal(
      isCleanupDisabled({ canWrite: false, cleanupPending: false, jobStatus: 'ok' }),
      true,
    );
  });
});
