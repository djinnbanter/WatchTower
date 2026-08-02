import { describe, expect, it } from 'vitest';
import { deriveMcVersion, isPlausibleMcVersion, neoforgeLoaderToMc } from './identity';

describe('deriveMcVersion', () => {
  it('rejects mod versions mistaken for Minecraft', () => {
    expect(isPlausibleMcVersion('1.1.4')).toBe(false);
    expect(isPlausibleMcVersion('1.21.1')).toBe(true);
    expect(neoforgeLoaderToMc('4.0.6')).toBe('');
    expect(neoforgeLoaderToMc('21.1.233')).toBe('1.21.1');
  });

  it('does not treat asynclogger-style -1.1.4 as Minecraft', () => {
    const facts = {
      meta: { loader: 'neoforge', engine_version: '4.0.42' },
      optional: {
        mods: [
          { id: 'aileron', version: 'neoforge-1.1.4' },
        ],
      },
    };
    expect(deriveMcVersion(facts)).toBe('');
  });

  it('reads +1.21.1 from Modrinth-style versions', () => {
    const facts = {
      meta: { loader: 'neoforge', engine_version: '4.0.42' },
      optional: {
        mods: [{ id: 'asynclogger', version: '1.1.4+1.21.1-neoforge' }],
      },
    };
    expect(deriveMcVersion(facts)).toBe('1.21.1');
  });

  it('prefers meta.minecraft_version over mod version noise', () => {
    const facts = {
      meta: { loader: 'neoforge', minecraft_version: '1.21.1', engine_version: '4.0.42' },
      optional: {
        mods: [{ id: 'asynclogger', version: 'neoforge-1.1.4' }],
      },
    };
    expect(deriveMcVersion(facts)).toBe('1.21.1');
  });

  it('maps NeoForge loader_version when meta MC missing', () => {
    const facts = {
      meta: { loader: 'neoforge' },
      optional: {
        spark_profile: {
          platform: { loader: 'NeoForge', loader_version: '21.1.233' },
        },
        mods: [{ id: 'asynclogger', version: 'neoforge-1.1.4' }],
      },
    };
    expect(deriveMcVersion(facts)).toBe('1.21.1');
  });

  it('reads +mc suffix from jar versions', () => {
    const facts = {
      meta: { loader: 'neoforge' },
      optional: {
        mods: [{ id: 'foo', version: '3.2.1+mc1.21.1' }],
      },
    };
    expect(deriveMcVersion(facts)).toBe('1.21.1');
  });
});
