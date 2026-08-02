import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSessionActivityItems } from './session-activity-helpers';

describe('buildSessionActivityItems', () => {
  it('merges joins, leaves, and failed joins newest-first', () => {
    const items = buildSessionActivityItems({
      activity: {
        events: [
          { time: '2026-07-30T10:00:00Z', type: 'player_join', detail: 'Steve' },
          { time: '2026-07-30T10:05:00Z', type: 'player_leave', detail: 'Steve' },
          { time: '2026-07-30T09:00:00Z', type: 'lag_incident', detail: 'ignored' },
        ],
      },
      join_clinic: {
        entries: [
          {
            key: 'missing_mod|Alex|create',
            kind: 'missing_mod',
            player: 'Alex',
            time: '2026-07-30T10:03:00Z',
            missing: [{ mod_id: 'create', display_name: 'Create', server_version: '6.0.4' }],
            fix_copy: 'Hey Alex…',
          },
        ],
      },
    });
    assert.equal(items.length, 3);
    assert.deepEqual(
      items.map((i) => i.kind),
      ['leave', 'failed', 'join'],
    );
    assert.equal(items[1].player, 'Alex');
    assert.ok(items[1].clinic?.fixCopy);
  });

  it('returns empty when neither source has rows', () => {
    assert.equal(buildSessionActivityItems({}).length, 0);
  });
});
