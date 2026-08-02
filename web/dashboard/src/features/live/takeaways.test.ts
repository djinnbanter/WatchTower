import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filterLiveTakeaways, openLiveIssueTakeaways } from './takeaways.ts';

describe('filterLiveTakeaways', () => {
  const signals = [
    { type: 'lag', label: '1 active lag incident' },
    { type: 'mod_errors', label: '6 mod log errors' },
    { type: 'log_stale', label: 'Log output stale' },
    { type: 'backup_job', label: 'Backup in progress' },
  ];

  const ops = {
    lag_issues: {
      entries: [{ incident_id: 'inc-1', id: 'LAG-1' }],
    },
    mod_issues: {
      entries: [{ mod_id: 'create' }, { mod_id: 'kubejs' }],
    },
    log_stale: { active: true },
  };

  it('keeps issue-backed signals when not reviewed', () => {
    const out = filterLiveTakeaways(signals, {}, ops);
    assert.equal(out.length, 4);
  });

  it('drops lag / mod / log_stale after review', () => {
    const acks = {
      'lag:inc-1': { at: '2026-07-26T12:00:00Z' },
      'mod:create': { at: '2026-07-26T12:00:00Z' },
      'mod:kubejs': { at: '2026-07-26T12:00:00Z' },
      log_stale: { at: '2026-07-26T12:00:00Z' },
    };
    const out = filterLiveTakeaways(signals, acks, ops);
    assert.deepEqual(
      out.map((s) => s.type),
      ['backup_job'],
    );
  });

  it('keeps mod_errors while any mod issue remains open', () => {
    const acks = { 'mod:create': { at: '2026-07-26T12:00:00Z' } };
    const out = filterLiveTakeaways(signals, acks, ops);
    assert.ok(out.some((s) => s.type === 'mod_errors'));
  });
});

describe('openLiveIssueTakeaways', () => {
  it('excludes reviewed and non-open ledger rows', () => {
    const ops = {
      issues_live: [
        { id: 'DISK_HIGH', key: 'DISK_HIGH', status: 'open', message: 'Disk high' },
        { id: 'OLD', key: 'OLD', status: 'reviewed', message: 'Old' },
        { id: 'ACKED', key: 'ACKED', status: 'open', message: 'Acked' },
      ],
    };
    const acks = { 'issue:ACKED': { at: '2026-07-26T12:00:00Z' } };
    const out = openLiveIssueTakeaways(ops, acks);
    assert.equal(out.length, 1);
    assert.equal(out[0].id, 'DISK_HIGH');
  });
});
