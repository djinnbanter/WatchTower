import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { acksMapFromResponse, isIssueAcked } from './helpers.ts';

describe('acksMapFromResponse', () => {
  it('unwraps acknowledged_issues from GET/POST payloads', () => {
    const nested = {
      acknowledged_issues: {
        'issue:DISK_HIGH': { ackedAt: '2026-07-26T12:00:00Z', by: 'dashboard' },
      },
    };
    const acks = acksMapFromResponse(nested);
    assert.equal(isIssueAcked(acks, 'issue:DISK_HIGH'), true);
    assert.equal(isIssueAcked(acks, 'DISK_HIGH'), false);
    assert.equal(isIssueAcked(acks, 'acknowledged_issues'), false);
  });

  it('returns empty map when acknowledged_issues is empty', () => {
    const acks = acksMapFromResponse({ acknowledged_issues: {} });
    assert.deepEqual(acks, {});
    assert.equal(isIssueAcked(acks, 'issue:DISK_HIGH'), false);
  });

  it('accepts a flat map for legacy/fixture shapes', () => {
    const flat = { 'lag:inc-1': { at: '2026-07-26T12:00:00Z' } };
    const acks = acksMapFromResponse(flat);
    assert.equal(isIssueAcked(acks, 'lag:inc-1'), true);
  });
});
