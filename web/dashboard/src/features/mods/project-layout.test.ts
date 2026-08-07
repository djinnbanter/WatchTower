import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { projectMainSections, projectRailCta } from './project-layout.ts';
import { resolveNestedJars } from './nested-jars.ts';

describe('projectMainSections', () => {
  it('keeps side out of the main column (rail owns client/server)', () => {
    assert.deepEqual(
      projectMainSections({
        hasUpdate: false,
        highWorldRisk: false,
        hasAbout: false,
        hasNested: false,
      }),
      ['deps'],
    );
  });

  it('orders update, world risk, about, nested, then deps', () => {
    assert.deepEqual(
      projectMainSections({
        hasUpdate: true,
        highWorldRisk: true,
        hasAbout: true,
        hasNested: true,
      }),
      ['update', 'world_risk', 'about', 'nested', 'deps'],
    );
  });
});

describe('projectRailCta', () => {
  it('routes outdated mods to the in-app update detail page', () => {
    assert.deepEqual(
      projectRailCta({
        outdated: true,
        hasUpdateRow: true,
        modId: 'create',
        modrinthUrl: 'https://modrinth.com/mod/create',
      }),
      { kind: 'update_detail', modId: 'create' },
    );
  });

  it('falls back to external Modrinth when no update is available', () => {
    assert.deepEqual(
      projectRailCta({
        outdated: false,
        hasUpdateRow: false,
        modId: 'create',
        modrinthUrl: 'https://modrinth.com/mod/create',
      }),
      { kind: 'modrinth', url: 'https://modrinth.com/mod/create' },
    );
  });

  it('returns none when neither update nor Modrinth URL exists', () => {
    assert.deepEqual(
      projectRailCta({
        outdated: false,
        hasUpdateRow: false,
        modId: 'create',
        modrinthUrl: '',
      }),
      { kind: 'none' },
    );
  });
});

describe('resolveNestedJars', () => {
  it('prefers jar_in_jar rows when present', () => {
    const rows = resolveNestedJars(
      {
        id: 'create',
        jar_in_jar: [
          {
            id: 'flywheel',
            display_name: 'Flywheel',
            version: '1.0.2',
            nested_path: 'META-INF/jarjar/flywheel.jar',
          },
        ],
      },
      [],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'flywheel');
  });

  it('builds rows from nested_mod_ids via facts lookup', () => {
    const rows = resolveNestedJars(
      { id: 'create', nested_mod_ids: ['flywheel'] },
      [{ id: 'flywheel', display_name: 'Flywheel', version: '1.0.2' }],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].display_name, 'Flywheel');
    assert.equal(rows[0].version, '1.0.2');
  });
});
