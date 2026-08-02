import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildStorageTreemapTree } from './storage-treemap-tree.ts';

describe('buildStorageTreemapTree', () => {
  it('returns null when nothing has size', () => {
    assert.equal(
      buildStorageTreemapTree({
        totalGb: NaN,
        worldGb: NaN,
        modsGb: NaN,
        logsGb: NaN,
        otherGb: NaN,
        dims: [],
        mods: [],
        logs: [],
        otherRows: [],
        backups: [],
        backupsGb: NaN,
        includeBackups: false,
      }),
      null,
    );
  });

  it('nests dimensions under World and omits backups when not included', () => {
    const tree = buildStorageTreemapTree({
      totalGb: 22.1,
      worldGb: 18.4,
      modsGb: 1.2,
      logsGb: 0.4,
      otherGb: 2.1,
      dims: [
        { key: 'overworld', label: 'Overworld', path: 'world', gb: 12 },
        { key: 'nether', label: 'Nether', path: 'world/DIM-1', gb: 4 },
      ],
      mods: [],
      logs: [{ key: 'archives', label: 'Rotated archives', path: 'logs/*.gz', gb: 0.3 }],
      otherRows: [{ key: 'other:config', label: 'config', path: 'config', gb: 1.5 }],
      backups: [{ key: 'bak:a.zip', label: 'a.zip', path: '/srv/a.zip', gb: 40 }],
      backupsGb: 40,
      includeBackups: false,
    });
    assert.ok(tree);
    assert.equal(tree.id, 'server');
    assert.equal(tree.valueGb, 22.1);
    const ids = tree.children!.map((c) => c.id);
    assert.deepEqual(ids, ['world', 'mods', 'logs', 'other']);
    const world = tree.children!.find((c) => c.id === 'world')!;
    assert.equal(world.children!.length, 2);
    assert.equal(world.children![0]!.label, 'Overworld');
    assert.equal(world.tone, 'accent');
  });

  it('nests jars under Mods when by_mods rows are present', () => {
    const tree = buildStorageTreemapTree({
      totalGb: 10,
      worldGb: NaN,
      modsGb: 1.2,
      logsGb: NaN,
      otherGb: NaN,
      dims: [],
      mods: [
        { key: 'mod:create.jar', label: 'create-6.0.1.jar', path: 'mods/create-6.0.1.jar', gb: 0.8 },
        { key: 'mod:jei.jar', label: 'jei-19.jar', path: 'mods/jei-19.jar', gb: 0.4 },
      ],
      logs: [],
      otherRows: [],
      backups: [],
      backupsGb: NaN,
      includeBackups: false,
    });
    const mods = tree?.children?.find((c) => c.id === 'mods');
    assert.ok(mods?.children?.length === 2);
    assert.equal(mods!.children![0]!.label, 'create-6.0.1.jar');
    assert.equal(mods!.tone, 'info');
  });

  it('nests archives under Backups when inventory rows are present', () => {
    const tree = buildStorageTreemapTree({
      totalGb: 10,
      worldGb: 8,
      modsGb: NaN,
      logsGb: NaN,
      otherGb: NaN,
      dims: [],
      mods: [],
      logs: [],
      otherRows: [],
      backups: [
        {
          key: 'bak:newest.zip',
          label: '2026-06-23_08-00-00.zip',
          path: '/srv/backups/minecraft/2026-06-23_08-00-00.zip',
          gb: 0.82,
        },
        {
          key: 'bak:older.zip',
          label: '2026-06-22_08-00-00.zip',
          path: '/srv/backups/minecraft/2026-06-22_08-00-00.zip',
          gb: 0.8,
        },
      ],
      backupsGb: 5,
      includeBackups: true,
    });
    const backups = tree?.children?.find((c) => c.id === 'backups');
    assert.ok(backups?.children?.length === 2);
    assert.equal(backups!.tone, 'ok');
    assert.equal(backups!.children![0]!.label, '2026-06-23_08-00-00.zip');
  });
});
