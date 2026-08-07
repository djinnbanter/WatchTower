import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { enrichUpdateImpactForDisplay } from './update-impact-enrich.ts';

describe('enrichUpdateImpactForDisplay', () => {
  it('keeps server impact lists when present', () => {
    const row = {
      mod_id: 'create',
      impact_verdict: 'safe',
      impact_summary: 'No pack blockers found for this loader/MC-compatible update.',
      confidence: 'high',
      blockers: [],
      co_updates: [{ mod_id: 'flywheel', detail: 'from server' }],
      dependents: [{ mod_id: 'createaddition' }],
    };
    const out = enrichUpdateImpactForDisplay(row, [
      { id: 'create', display_name: 'Create' },
      { id: 'flywheel', display_name: 'Flywheel' },
    ]);
    assert.equal(out.impact_verdict, 'safe');
    assert.deepEqual(out.co_updates, row.co_updates);
    assert.deepEqual(out.dependents, row.dependents);
    assert.equal(out.related_pair, 'flywheel');
  });

  it('fills create/flywheel related_pair and co-update when scan is summary-only', () => {
    const out = enrichUpdateImpactForDisplay(
      {
        mod_id: 'create',
        impact_verdict: 'unknown',
        impact_summary: 'Newer Modrinth build available for this loader/MC line.',
        confidence: 'medium',
        current_version: '6.0.4',
        latest_compatible: '6.0.6',
      },
      [
        { id: 'create', display_name: 'Create', version: '6.0.4' },
        { id: 'flywheel', display_name: 'Flywheel', version: '1.0.2' },
      ],
    );
    assert.equal(out.related_pair, 'flywheel');
    assert.ok(Array.isArray(out.blockers));
    assert.equal((out.blockers as unknown[]).length, 0);
    const co = out.co_updates as Record<string, unknown>[];
    assert.ok(co.some((c) => c.mod_id === 'flywheel'));
    assert.equal(out.impact_verdict, 'caution');
  });

  it('lists dependents from local dependency graph when impact lists are missing', () => {
    const out = enrichUpdateImpactForDisplay(
      {
        mod_id: 'flywheel',
        impact_verdict: 'unknown',
        impact_summary: 'Newer Modrinth build available for this loader/MC line.',
      },
      [
        { id: 'flywheel', display_name: 'Flywheel', version: '1.0.2' },
        {
          id: 'create',
          display_name: 'Create',
          version: '6.0.4',
          dependencies: [{ modId: 'flywheel', mandatory: true }],
        },
      ],
    );
    const deps = out.dependents as Record<string, unknown>[];
    assert.ok(deps.some((d) => d.mod_id === 'create'));
    assert.equal(out.related_pair, 'create');
  });

  it('flags missing paired mod as a blocker', () => {
    const out = enrichUpdateImpactForDisplay(
      {
        mod_id: 'create',
        impact_verdict: 'unknown',
        impact_summary: 'Newer Modrinth build available for this loader/MC line.',
      },
      [{ id: 'create', display_name: 'Create', version: '6.0.4' }],
    );
    const blockers = out.blockers as Record<string, unknown>[];
    assert.ok(blockers.some((b) => b.mod_id === 'flywheel' && b.kind === 'need_install'));
    assert.equal(out.impact_verdict, 'break');
  });
});
