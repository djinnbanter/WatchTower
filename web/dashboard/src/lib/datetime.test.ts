import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatInstantRange,
  getOffsetMinutes,
  isValidTimeZone,
  parseTimezonePreference,
  resolveTimeZone,
  utcCellToLocal,
} from './datetime.ts';

describe('isValidTimeZone', () => {
  it('accepts common IANA zones', () => {
    assert.equal(isValidTimeZone('UTC'), true);
    assert.equal(isValidTimeZone('Europe/London'), true);
    assert.equal(isValidTimeZone('America/New_York'), true);
  });

  it('rejects empty and garbage', () => {
    assert.equal(isValidTimeZone(''), false);
    assert.equal(isValidTimeZone('Not/AZone'), false);
    assert.equal(isValidTimeZone(null), false);
  });
});

describe('resolveTimeZone', () => {
  it('resolves utc mode', () => {
    assert.equal(resolveTimeZone({ mode: 'utc' }), 'UTC');
  });

  it('resolves valid iana mode', () => {
    assert.equal(resolveTimeZone({ mode: 'iana', zone: 'Europe/Paris' }), 'Europe/Paris');
  });

  it('falls back invalid iana to browser', () => {
    const resolved = resolveTimeZone({ mode: 'iana', zone: 'Nope/Nowhere' });
    assert.equal(isValidTimeZone(resolved), true);
    assert.notEqual(resolved, 'Nope/Nowhere');
  });

  it('defaults browser mode to a valid zone', () => {
    assert.equal(isValidTimeZone(resolveTimeZone({ mode: 'browser' })), true);
  });
});

describe('parseTimezonePreference', () => {
  it('recovers corrupt storage', () => {
    assert.deepEqual(parseTimezonePreference('{not json'), { mode: 'browser' });
    assert.deepEqual(parseTimezonePreference('{"mode":"iana","zone":"Bad/Zone"}'), { mode: 'browser' });
  });

  it('parses utc and iana', () => {
    assert.deepEqual(parseTimezonePreference('{"mode":"utc"}'), { mode: 'utc' });
    assert.deepEqual(parseTimezonePreference('{"mode":"iana","zone":"Asia/Tokyo"}'), {
      mode: 'iana',
      zone: 'Asia/Tokyo',
    });
  });
});

describe('utcCellToLocal', () => {
  it('keeps UTC cells unchanged in UTC', () => {
    const local = utcCellToLocal(3, 15, 'UTC', new Date('2026-07-28T12:00:00Z'));
    assert.deepEqual(local, { dow: 3, hour: 15 });
  });

  it('rolls across midnight into the next local day', () => {
    // Fixed +60 offset: Europe/London during BST
    const at = new Date('2026-07-28T12:00:00Z'); // mid-summer, BST
    const offset = getOffsetMinutes('Europe/London', at);
    assert.equal(offset, 60);
    const local = utcCellToLocal(2, 23, 'Europe/London', at); // Tue 23:00 UTC → Wed 00:00 BST
    assert.equal(local.dow, 3);
    assert.equal(local.hour, 0);
  });

  it('rolls back across week boundary', () => {
    const at = new Date('2026-07-28T12:00:00Z');
    // Sun 00:00 UTC → Sat 20:00 America/New_York (EDT -4)
    const local = utcCellToLocal(0, 0, 'America/New_York', at);
    assert.equal(local.dow, 6);
    assert.equal(local.hour, 20);
  });
});

describe('formatInstantRange', () => {
  it('formats a same-day window', () => {
    const label = formatInstantRange(
      '2026-07-29T03:00:00Z',
      '2026-07-29T05:00:00Z',
      'UTC',
    );
    assert.match(label, /03:00–05:00/);
  });

  it('formats a window spanning local midnight', () => {
    // 23:00–01:00 UTC in London BST → Wed 00:00–02:00
    const label = formatInstantRange(
      '2026-07-28T23:00:00Z',
      '2026-07-29T01:00:00Z',
      'Europe/London',
    );
    assert.match(label, /00:00–02:00/);
  });

  it('handles DST spring forward in America/New_York', () => {
    // Transition skips 02:00 local: 06:00Z=01:00 EST, 07:00Z=03:00 EDT.
    const across = formatInstantRange(
      '2026-03-08T06:00:00Z',
      '2026-03-08T07:00:00Z',
      'America/New_York',
    );
    const after = formatInstantRange(
      '2026-03-08T08:00:00Z',
      '2026-03-08T09:00:00Z',
      'America/New_York',
    );
    assert.match(across, /01:00–03:00/);
    assert.match(after, /04:00–05:00/);
  });

  it('handles DST fall back in America/New_York', () => {
    // 2026-11-01 05:00 UTC = 01:00 EDT; 07:00 UTC = 01:00 EST (second 1am)
    const label = formatInstantRange(
      '2026-11-01T05:00:00Z',
      '2026-11-01T07:00:00Z',
      'America/New_York',
    );
    assert.notEqual(label, '—');
    assert.match(label, /01:00/);
  });
});
