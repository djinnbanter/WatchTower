import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergeLogErrorRows, sampleLinesFrom } from './log-errors.ts';

describe('mergeLogErrorRows', () => {
  it('merges report + scan and attaches fix steps', () => {
    const rows = mergeLogErrorRows({
      opsBlock: {
        entries: [{ mod_id: 'create', total: 2, sample_line: 'scan line' }],
      },
      factsErrors: [{ mod_id: 'create', total: 5, sample_lines: ['report line'], display_name: 'Create' }],
      recommendations: [
        {
          mod_id: 'create',
          why: 'mixin clash',
          severity: 'warning',
          fix_steps: ['Update Create', 'Restart'],
        },
      ],
      modIssues: [],
      hasReport: true,
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].total, 5);
    assert.equal(rows[0].display_name, 'Create');
    assert.equal(rows[0].why, 'mixin clash');
    assert.deepEqual(rows[0].fix_steps, ['Update Create', 'Restart']);
    assert.ok(rows[0].sample_lines.includes('report line'));
  });

  it('omits rows for reviewed mod issues', () => {
    const rows = mergeLogErrorRows({
      opsBlock: {
        entries: [
          { mod_id: 'create', total: 4 },
          { mod_id: 'kubejs', total: 2 },
        ],
      },
      factsErrors: [],
      recommendations: [],
      modIssues: [],
      hasReport: false,
      ackedModIds: ['create'],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].mod_id, 'kubejs');
  });

  it('sampleLinesFrom prefers array', () => {
    assert.deepEqual(sampleLinesFrom({ sample_lines: ['a', 'b'] }), ['a', 'b']);
    assert.deepEqual(sampleLinesFrom({ sample_line: 'x' }), ['x']);
  });
});
