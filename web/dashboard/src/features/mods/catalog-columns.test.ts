import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  catalogJarCell,
  catalogJarDisplay,
  catalogJarRaw,
  catalogVersionDisplay,
} from './catalog-columns';

describe('catalog-columns', () => {
  it('prefers jar_file over jar', () => {
    assert.equal(catalogJarRaw({ jar_file: 'a.jar', jar: 'b.jar' }), 'a.jar');
    assert.equal(catalogJarRaw({ jar: 'b.jar' }), 'b.jar');
    assert.equal(catalogJarRaw({}), '');
  });

  it('strips .disabled for display only', () => {
    assert.equal(catalogJarDisplay('dimmod.jar.disabled'), 'dimmod.jar');
    assert.equal(catalogJarDisplay('create-1.0.jar'), 'create-1.0.jar');
    assert.equal(catalogJarDisplay(''), '');
  });

  it('formats jar cell with em dash when missing', () => {
    assert.deepEqual(catalogJarCell({ jar_file: 'x.jar.disabled' }), {
      raw: 'x.jar.disabled',
      display: 'x.jar',
    });
    assert.deepEqual(catalogJarCell({}), { raw: '', display: '—' });
  });

  it('formats version or em dash', () => {
    assert.equal(catalogVersionDisplay('1.7.5'), '1.7.5');
    assert.equal(catalogVersionDisplay('  '), '—');
    assert.equal(catalogVersionDisplay(undefined), '—');
  });
});
