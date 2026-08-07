import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildActiveItems, fromLedgerRow, groupByBand, type IssueItem } from './helpers.ts';

function item(partial: Partial<IssueItem> & Pick<IssueItem, 'key' | 'issueId' | 'severity' | 'title'>): IssueItem {
  return {
    kind: 'issue',
    source: 'ops',
    band: partial.severity === 'info' ? 'info' : partial.severity === 'critical' ? 'critical' : 'warning',
    summary: '',
    detail: null,
    steps: [],
    hints: [],
    primaryAction: null,
    when: null,
    ackedAt: null,
    metrics: null,
    confidence: null,
    sample: null,
    ...partial,
  };
}

describe('groupByBand', () => {
  it('groups by severity only, Critical → Warning → Info, omitting empty bands', () => {
    const items = [
      item({ key: 'issue:TICK_LAG', issueId: 'TICK_LAG', severity: 'critical', title: 'Lag' }),
      item({
        key: 'issue:MOD_JAR_DRIFT:swap.jar',
        issueId: 'MOD_JAR_DRIFT:swap.jar',
        severity: 'warning',
        title: 'Drift',
      }),
      item({
        key: 'issue:CLIENT_ON_SERVER:iris',
        issueId: 'CLIENT_ON_SERVER:iris',
        severity: 'info',
        title: 'Iris',
      }),
      item({
        key: 'issue:SILENT_FAIL:kubejs:foo.js:1',
        issueId: 'SILENT_FAIL:kubejs:foo.js:1',
        severity: 'warning',
        title: 'KubeJS',
      }),
      item({
        key: 'issue:WORLD_PRESSURE:item_storm:minecraft:overworld',
        issueId: 'WORLD_PRESSURE:item_storm:minecraft:overworld',
        severity: 'warning',
        title: 'Item storm',
      }),
      item({ key: 'issue:MEM', issueId: 'MEM_PRESSURE', severity: 'info', title: 'Mem' }),
    ];

    const bands = groupByBand(items);
    assert.deepEqual(
      bands.map((b) => b.key),
      ['critical', 'warning', 'info'],
    );
    assert.equal(bands[0]?.items.length, 1);
    assert.equal(bands[1]?.items.length, 3);
    assert.equal(bands[2]?.items.length, 2);
    assert.ok(bands[1]?.items.some((i) => i.issueId.includes('MOD_JAR_DRIFT')));
    assert.ok(bands[1]?.items.some((i) => i.issueId.includes('WORLD_PRESSURE')));
    assert.ok(bands[2]?.items.some((i) => i.issueId.includes('CLIENT_ON_SERVER')));
  });

  it('omits empty severity bands', () => {
    const bands = groupByBand([
      item({ key: 'issue:a', issueId: 'A', severity: 'warning', title: 'W' }),
    ]);
    assert.deepEqual(
      bands.map((b) => b.key),
      ['warning'],
    );
  });
});

describe('fromLedgerRow JOIN_SYNC', () => {
  it('deep-links Session activity from JOIN_SYNC', () => {
    const item = fromLedgerRow({
      id: 'JOIN_SYNC:mismatched_channel|FriendName|create',
      severity: 'warning',
      message: "FriendName can't join",
      fix_steps: ['Install create'],
    });
    assert.equal(item.primaryAction?.tab, 'session');
    assert.equal(item.primaryAction?.label, 'Open Session activity');
  });
});

describe('buildActiveItems peek vs issues_live dedupe', () => {
  it('does not duplicate lag peek when issues_live already has TICK_LAG', () => {
    const items = buildActiveItems({
      peek: {
        lag_issues: [
          {
            incident_id: 'inc-1',
            title: 'Lag spike',
            narrative: 'MSPT climbed',
            severity: 'critical',
            started_at: '2026-08-06T12:00:00Z',
          },
        ],
      },
      ops: {
        issues_live: [
          {
            id: 'TICK_LAG',
            status: 'open',
            severity: 'critical',
            message: 'Tick lag detected',
            source: 'ops',
          },
        ],
      },
      facts: {},
      acks: {},
      suppressedIds: new Set(),
    });

    const lagLike = items.filter(
      (i) =>
        i.kind === 'lag' ||
        i.issueId === 'TICK_LAG' ||
        i.key === 'issue:TICK_LAG' ||
        i.key.startsWith('lag:'),
    );
    assert.equal(lagLike.length, 1, `expected one lag card, got ${lagLike.map((i) => i.key).join(',')}`);
    assert.equal(lagLike[0]?.key, 'issue:TICK_LAG');
  });

  it('keeps peek lag when issues_live has no lag keys', () => {
    const items = buildActiveItems({
      peek: {
        lag_issues: [
          {
            incident_id: 'inc-2',
            title: 'Lag spike',
            narrative: 'MSPT climbed',
            severity: 'warning',
            started_at: '2026-08-06T12:00:00Z',
          },
        ],
      },
      ops: { issues_live: [] },
      facts: {},
      acks: {},
      suppressedIds: new Set(),
    });
    assert.ok(items.some((i) => i.key === 'lag:inc-2'));
  });
});
