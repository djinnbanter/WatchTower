import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  projectIdMetaLine,
  projectJarMetaLine,
  projectVersionLabel,
} from './project-header-meta';

describe('project-header-meta', () => {
  it('prefers catalog version over modrinth_version_number', () => {
    assert.equal(
      projectVersionLabel({ version: '2.0.6', modrinth_version_number: '2.1.1' }),
      '2.0.6',
    );
  });

  it('falls back to modrinth_version_number', () => {
    assert.equal(projectVersionLabel({ version: '', modrinth_version_number: '2.1.1' }), '2.1.1');
  });

  it('formats id · version and id alone', () => {
    assert.equal(projectIdMetaLine({ id: 'cameraoverhaul', version: '2.0.6' }), 'cameraoverhaul · 2.0.6');
    assert.equal(projectIdMetaLine({ id: 'cameraoverhaul' }), 'cameraoverhaul');
  });

  it('returns jar line or null', () => {
    assert.equal(projectJarMetaLine('CameraOverhaul-v2.0.6.jar'), 'CameraOverhaul-v2.0.6.jar');
    assert.equal(projectJarMetaLine('  '), null);
    assert.equal(projectJarMetaLine(undefined), null);
  });
});
