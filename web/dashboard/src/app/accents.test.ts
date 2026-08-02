import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ACCENT_PRESETS,
  defaultAccent,
  isAccentId,
  isThemeMode,
  resolveThemeMode,
} from './accents';

describe('accents', () => {
  it('exposes exactly eight presets', () => {
    assert.equal(ACCENT_PRESETS.length, 8);
    assert.equal(defaultAccent(), 'signal');
  });

  it('validates accent and theme ids', () => {
    assert.equal(isAccentId('teal'), true);
    assert.equal(isAccentId('hotpink'), false);
    assert.equal(isThemeMode('system'), true);
    assert.equal(isThemeMode('neon'), false);
  });

  it('resolves system to light or dark only', () => {
    assert.equal(resolveThemeMode('system', true), 'dark');
    assert.equal(resolveThemeMode('system', false), 'light');
    assert.equal(resolveThemeMode('black', true), 'black');
    assert.equal(resolveThemeMode('light', true), 'light');
  });
});
