import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  configPathMatchesMod,
  filterConfigPathsForMod,
  guessModIdFromConfigPath,
} from './config-paths.ts';

describe('configPathMatchesMod', () => {
  it('matches create-*.toml and nested create/ paths', () => {
    const mod = { id: 'create', modrinth_slug: 'create' };
    assert.equal(configPathMatchesMod('config/create-common.toml', mod), true);
    assert.equal(configPathMatchesMod('config/create-server.toml', mod), true);
    assert.equal(configPathMatchesMod('config/create/flywheel.toml', mod), true);
    assert.equal(configPathMatchesMod('config/appleskin-client.toml', mod), false);
    assert.equal(configPathMatchesMod('config/fml.toml', mod), false);
  });

  it('matches modrinth slug when id differs', () => {
    assert.equal(
      configPathMatchesMod('config/sodium-options.json', {
        id: 'rubidium',
        modrinth_slug: 'sodium',
      }),
      true,
    );
  });
});

describe('guessModIdFromConfigPath', () => {
  it('takes the first token of the filename', () => {
    assert.equal(guessModIdFromConfigPath('config/create-common.toml'), 'create');
    assert.equal(guessModIdFromConfigPath('config/appleskin.toml'), 'appleskin');
  });
});

describe('filterConfigPathsForMod', () => {
  it('filters a file list', () => {
    const files = [
      { path: 'config/create-common.toml' },
      { path: 'config/fml.toml' },
      { path: 'config/create-server.toml' },
    ];
    assert.deepEqual(
      filterConfigPathsForMod(files, { id: 'create' }).map((f) => f.path),
      ['config/create-common.toml', 'config/create-server.toml'],
    );
  });
});
