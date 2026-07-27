/**
 * Node built-in test for backupDriver live-vs-facts semantics.
 * Run: node --test src/domain/health-backup.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { backupDriver, buildActionQueue, opsCanDriveActionQueue } from './health.js';

describe('backupDriver', () => {
  it('maps warn-stale to Backup is stale, not failure', () => {
    const facts = {
      optional: { last_backup: { status: 'stale', stale: true, age_days: 10 } },
    };
    const d = backupDriver(facts, null);
    assert.equal(d.id, 'BACKUP_STALE');
    assert.equal(d.title, 'Backup is stale');
  });

  it('maps not_found to Backup failure', () => {
    const facts = {
      optional: { last_backup: { status: 'not_found' } },
    };
    const d = backupDriver(facts, null);
    assert.equal(d.id, 'BACKUP_NOT_FOUND');
    assert.equal(d.title, 'Backup failure');
  });

  it('prefers live success over facts stale', () => {
    const facts = {
      optional: { last_backup: { status: 'stale', stale: true, age_days: 10 } },
      issues: [{ id: 'BACKUP_STALE', severity: 'warning', message: 'stale' }],
    };
    const ops = {
      backups_live: {
        last_backup: { status: 'success', stale: false, age_hours: 2 },
      },
    };
    const d = backupDriver(facts, ops);
    assert.equal(d.id, 'BACKUP_OK');
    assert.equal(d.title, 'Backups OK');

    const q = buildActionQueue(facts, {}, ops, null, {}, {});
    const all = [...(q.now ?? []), ...(q.soon ?? []), ...(q.historical ?? [])];
    assert.ok(!all.some((i) => i.id === 'BACKUP_STALE' || i.id === 'BACKUP_NOT_FOUND'));
  });

  it('hybrid: fresh external suppresses local stale', () => {
    const facts = {
      optional: {
        last_backup: { status: 'stale', stale: true },
        backup_external: { configured: true, status: 'success', stale: false },
      },
    };
    const d = backupDriver(facts, null);
    assert.equal(d.id, 'BACKUP_OK');
  });
});

describe('opsCanDriveActionQueue', () => {
  it('is false for empty ops', () => {
    assert.equal(opsCanDriveActionQueue(null), false);
    assert.equal(opsCanDriveActionQueue({}), false);
  });

  it('is true for backups_live, backup_external, crashes, or issues_live', () => {
    assert.equal(opsCanDriveActionQueue({ backups_live: { last_backup: {} } }), true);
    assert.equal(opsCanDriveActionQueue({ backup_external: { configured: true } }), true);
    assert.equal(opsCanDriveActionQueue({ crashes: { unreviewed_groups: 0 } }), true);
    assert.equal(opsCanDriveActionQueue({ issues_live: [{ id: 'DISK_HIGH' }] }), true);
  });

  it('builds backup queue cards from ops alone', () => {
    const ops = {
      backups_live: {
        last_backup: { status: 'stale', stale: true, age_hours: 48 },
      },
    };
    assert.equal(opsCanDriveActionQueue(ops), true);
    const q = buildActionQueue(null, {}, ops, null, {}, {});
    const all = [...(q.now ?? []), ...(q.soon ?? [])];
    assert.ok(all.some((i) => i.kind === 'backup'));
  });
});
