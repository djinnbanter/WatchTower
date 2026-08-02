import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatDiffLines, kindLabel, parseJoinClinicEntries } from './join-clinic-helpers';

describe('parseJoinClinicEntries', () => {
  it('prefers fix_copy and names missing mods', () => {
    const entries = parseJoinClinicEntries({
      join_clinic: {
        entries: [
          {
            key: 'mismatched_channel|Friend|create',
            kind: 'mismatched_channel',
            player: 'Friend',
            time: '2026-07-29T20:15:01Z',
            confidence: 'high',
            missing: [{ mod_id: 'create', display_name: 'Create', server_version: '6.0.4' }],
            extra: [],
            wrong_version: [],
            fix_copy: 'Hey Friend — install create.',
          },
        ],
      },
    });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.fixCopy, 'Hey Friend — install create.');
    assert.equal(entries[0]!.missingCount, 1);
    assert.equal(entries[0]!.missing[0]!.label, 'Create');
    assert.deepEqual(formatDiffLines(entries[0]!), ['Missing: Create (server 6.0.4)']);
    assert.equal(kindLabel('mismatched_channel'), 'Mismatched channels');
  });

  it('rebuilds fix copy when fix_copy absent', () => {
    const entries = parseJoinClinicEntries({
      join_clinic: {
        entries: [
          {
            kind: 'missing_mod',
            player: 'Alex',
            missing: [{ mod_id: 'jei', server_version: '1.2' }],
          },
        ],
      },
    });
    assert.match(entries[0]!.fixCopy, /jei/);
    assert.match(entries[0]!.fixCopy, /Alex/);
  });

  it('formats wrong-version and extra lines', () => {
    const entries = parseJoinClinicEntries({
      join_clinic: {
        entries: [
          {
            kind: 'wrong_version',
            player: 'Guest',
            missing: [],
            extra: [{ mod_id: 'sodiumextras' }],
            wrong_version: [
              {
                mod_id: 'supplementaries',
                display_name: 'Supplementaries',
                server_version: '3.1.14',
                client_version: '3.0.9',
              },
            ],
          },
        ],
      },
    });
    assert.deepEqual(formatDiffLines(entries[0]!), [
      'Wrong version: Supplementaries (need 3.1.14, has 3.0.9)',
      'Extra on client: sodiumextras',
    ]);
  });
});
