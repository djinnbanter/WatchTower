import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCatalogRows, buildBadgeMaps, sortCatalogRows, mergeModSources, enrichedFactsMods } from './catalog.ts';
import { matchesCatalogFilter } from './side.ts';

describe('buildCatalogRows', () => {
  it('merges live + facts and hides nested peers', () => {
    const badgeMaps = buildBadgeMaps(
      {
        running_mods: {
          mods: [
            { id: 'create', display_name: 'Create', version: '1' },
            { id: 'nested_lib', display_name: 'Nested', nested: true },
          ],
        },
        mods_light: { mods: [{ id: 'create', side_score: 'server_required' }] },
      },
      {
        mods: [
          {
            id: 'create',
            modrinth_title: 'Create',
            nested_mod_ids: ['nested_lib'],
            jar_in_jar: [{ id: 'nested_lib' }],
          },
          { id: 'appleskin', display_name: 'AppleSkin', side_score: 'likely_removable' },
        ],
      },
    );

    const rows = buildCatalogRows(
      { mods: [{ id: 'create', display_name: 'Create', version: '1' }, { id: 'nested_lib', nested: true }] },
      [
        {
          id: 'create',
          modrinth_title: 'Create',
          nested_mod_ids: ['nested_lib'],
          jar_in_jar: [{ id: 'nested_lib' }],
        },
        { id: 'appleskin', display_name: 'AppleSkin', side_score: 'likely_removable' },
      ],
      badgeMaps,
    );

    assert.equal(rows.some((r) => r.id === 'nested_lib'), false);
    assert.ok(rows.find((r) => r.id === 'create'));
    assert.ok(rows.find((r) => r.id === 'appleskin'));
  });

  it('sorts updates first', () => {
    const sorted = sortCatalogRows(
      [
        { id: 'a', display_name: 'A', modrinth_outdated: false },
        { id: 'b', display_name: 'B', modrinth_outdated: true },
      ],
      'updates',
      false,
    );
    assert.equal(sorted[0].id, 'b');
  });

  it('filters client leaning', () => {
    const row = { id: 'sodium', display_name: 'Sodium', side_score: 'likely_removable' };
    assert.equal(matchesCatalogFilter(row, 'client', true), true);
    assert.equal(matchesCatalogFilter(row, 'server', true), false);
  });

  it('filters enabled vs disabled jars', () => {
    const on = { id: 'create', display_name: 'Create', disabled: false };
    const off = {
      id: 'dimmod',
      display_name: 'DimMod',
      disabled: true,
      jar_file: 'dimmod-1.0.jar.disabled',
    };
    assert.equal(matchesCatalogFilter(on, 'enabled', true), true);
    assert.equal(matchesCatalogFilter(on, 'disabled', true), false);
    assert.equal(matchesCatalogFilter(off, 'enabled', true), false);
    assert.equal(matchesCatalogFilter(off, 'disabled', true), true);
  });

  it('filters mods with available updates', () => {
    const stale = { id: 'create', display_name: 'Create', modrinth_outdated: true };
    const fresh = { id: 'jei', display_name: 'JEI', modrinth_outdated: false };
    assert.equal(matchesCatalogFilter(stale, 'updates', true), true);
    assert.equal(matchesCatalogFilter(fresh, 'updates', true), false);
  });

  it('keeps disabled-only inventory jars in the catalog', () => {
    const badgeMaps = buildBadgeMaps(
      { mods_light: { mods: [{ id: 'dimmod', disabled: true, jar_file: 'dimmod.jar.disabled' }] } },
      { mods: [{ id: 'dimmod', disabled: true, jar_file: 'dimmod.jar.disabled', world_risk: { level: 'high' } }] },
    );
    const rows = buildCatalogRows(
      { mods: [{ id: 'create', display_name: 'Create' }] },
      [
        { id: 'create', display_name: 'Create' },
        { id: 'dimmod', disabled: true, jar_file: 'dimmod.jar.disabled', world_risk: { level: 'high' } },
      ],
      badgeMaps,
    );
    const disabled = rows.find((r) => r.id === 'dimmod');
    assert.ok(disabled);
    assert.equal(disabled!.disabled, true);
    assert.equal(disabled!.jar_file, 'dimmod.jar.disabled');
  });
});

describe('mergeModSources', () => {
  it('overlays Modrinth scan icons onto base mods', () => {
    const merged = mergeModSources(
      [{ id: 'create', display_name: 'Create' }],
      [{ id: 'create', modrinth_icon_url: 'https://cdn.modrinth.com/create.png' }],
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0].modrinth_icon_url, 'https://cdn.modrinth.com/create.png');
  });

  it('reads modrinth_scan from ops-cache when facts mods are empty', () => {
    const mods = enrichedFactsMods(
      {
        mods_light: { mods: [{ id: 'jei', display_name: 'JEI' }] },
        modrinth_scan: {
          mods: [{ id: 'jei', modrinth_icon_url: 'https://cdn.modrinth.com/jei.png' }],
        },
      },
      {},
    );
    assert.equal(mods.length, 1);
    assert.equal(mods[0].modrinth_icon_url, 'https://cdn.modrinth.com/jei.png');
  });
});
