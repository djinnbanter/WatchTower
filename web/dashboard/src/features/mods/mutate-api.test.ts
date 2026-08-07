import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  blockersCanonical,
  fingerprintForBatch,
  fingerprintFromUpdateRow,
  impactFingerprint,
  primaryFileSha512,
  type MutateVersion,
} from './mutate-api';

describe('impactFingerprint', () => {
  it('changes when version_id changes', () => {
    const base = { mod_id: 'create', verdict: 'safe', summary: 'ok', blockers: [] };
    assert.notEqual(
      impactFingerprint({ ...base, version_id: 'a' }),
      impactFingerprint({ ...base, version_id: 'b' }),
    );
  });

  it('fingerprintFromUpdateRow includes selected version', () => {
    const row = {
      mod_id: 'create',
      impact_verdict: 'caution',
      impact_summary: 'needs flywheel',
      blockers: [{ mod_id: 'flywheel' }],
      modrinth_compatible_version_id: 'ver_old',
    };
    const withOld = fingerprintFromUpdateRow(row, 'ver_old');
    const withNew = fingerprintFromUpdateRow(row, 'ver_new');
    assert.notEqual(withOld, withNew);
  });

  it('blockersCanonical sorts mod ids like Java List.toString', () => {
    assert.equal(blockersCanonical([{ mod_id: 'b' }, { mod_id: 'a' }]), '[a, b]');
  });

  it('fingerprintForBatch binds sorted step keys and worst verdict', () => {
    const rows = [
      { mod_id: 'a', impact_verdict: 'safe' },
      { mod_id: 'b', impact_verdict: 'caution' },
    ];
    const a = fingerprintForBatch(
      [
        { mod_id: 'a', modrinth_version_id: '1' },
        { mod_id: 'b', modrinth_version_id: '2' },
      ],
      rows,
    );
    const b = fingerprintForBatch(
      [
        { mod_id: 'b', modrinth_version_id: '2' },
        { mod_id: 'a', modrinth_version_id: '1' },
      ],
      rows,
    );
    assert.equal(a, b);
    const safeOnly = fingerprintForBatch(
      [{ mod_id: 'a', modrinth_version_id: '1' }],
      rows,
    );
    assert.notEqual(a, safeOnly);
  });
});

describe('primaryFileSha512', () => {
  it('prefers primary file even when another file has sha512 first', () => {
    const version: MutateVersion = {
      id: 'v1',
      version_number: '2.0',
      files: [
        { filename: 'sources.jar', primary: false, hashes: { sha512: 'aaaa' } },
        { filename: 'mod.jar', primary: true, hashes: { sha512: 'bbbb' } },
      ],
    };
    assert.equal(primaryFileSha512(version), 'bbbb');
  });

  it('falls back to first file when no primary flag', () => {
    const version: MutateVersion = {
      id: 'v1',
      version_number: '2.0',
      files: [{ filename: 'only.jar', hashes: { sha512: 'cccc' } }],
    };
    assert.equal(primaryFileSha512(version), 'cccc');
  });

  it('returns undefined when missing', () => {
    assert.equal(primaryFileSha512(undefined), undefined);
    assert.equal(primaryFileSha512({ id: 'v', version_number: '1', files: [] }), undefined);
  });
});
