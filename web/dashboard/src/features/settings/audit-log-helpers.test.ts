import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { auditTone, describeAuditEvent, groupAuditRowsByDay, parseAuditRows } from './audit-log-helpers';

const payload = {
  entries: [
    {
      at: '2026-07-30T09:15:00Z',
      event: 'settings_changed',
      actor: 'ella',
      role: 'owner',
      detail: 'tps_warn 19.5 -> 18.5',
      ip: '10.0.0.4',
      result: 'ok',
    },
    {
      at: '2026-07-30T08:02:00Z',
      event: 'write_denied',
      actor: 'sam',
      role: 'viewer',
      target: 'POST /api/settings',
      ip: '10.0.0.7',
      result: 'denied',
    },
    {
      at: '2026-07-29T21:40:00Z',
      event: 'login_failed',
      actor: 'unknown',
      ip: '203.0.113.9',
      result: 'failed',
    },
  ],
};

describe('parseAuditRows', () => {
  it('reads entries and assigns stable ids', () => {
    const rows = parseAuditRows(payload);
    assert.equal(rows.length, 3);
    assert.equal(rows[0].event, 'settings_changed');
    assert.equal(rows[0].actor, 'ella');
    assert.notEqual(rows[0].id, rows[1].id);
  });

  it('tolerates a missing or malformed payload', () => {
    assert.deepEqual(parseAuditRows({}), []);
    assert.deepEqual(parseAuditRows({ entries: 'nope' } as never), []);
    assert.deepEqual(parseAuditRows({ entries: [{}] }), []);
  });
});

describe('describeAuditEvent', () => {
  it('writes one plain sentence per known event', () => {
    const [settings, denied, failed] = parseAuditRows(payload);
    assert.equal(describeAuditEvent(settings), 'ella changed settings');
    assert.equal(describeAuditEvent(denied), 'sam was blocked from POST /api/settings');
    assert.equal(describeAuditEvent(failed), 'Failed sign-in for unknown');
  });

  it('falls back to the raw event name for anything new', () => {
    const [row] = parseAuditRows({
      entries: [
        { at: '2026-07-30T09:15:00Z', event: 'brand_new_thing', actor: 'ella', result: 'ok' },
      ],
    });
    assert.equal(describeAuditEvent(row), 'ella — brand_new_thing');
  });
});

describe('auditTone', () => {
  it('flags denials and failures', () => {
    const [settings, denied, failed] = parseAuditRows(payload);
    assert.equal(auditTone(denied), 'danger');
    assert.equal(auditTone(failed), 'warn');
    assert.equal(auditTone(settings), 'neutral');
  });
});

describe('groupAuditRowsByDay', () => {
  it('groups newest day first and keeps row order', () => {
    const groups = groupAuditRowsByDay(parseAuditRows(payload), 'UTC');
    assert.equal(groups.length, 2);
    assert.equal(groups[0].rows.length, 2);
    assert.equal(groups[0].rows[0].event, 'settings_changed');
    assert.equal(groups[1].rows[0].event, 'login_failed');
  });
});
