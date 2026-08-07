import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deriveCpuPct,
  formatCpuCaption,
  normalizeCpuDisplaySetting,
  resolveEffectiveCpuMode,
} from './cpu-display.ts';

describe('cpu-display', () => {
  const docker = { coresUsed: 3, limitCores: 12, hostCpuPct: 7 };

  it('normalizes unknown settings to auto', () => {
    assert.equal(normalizeCpuDisplaySetting('nope'), 'auto');
    assert.equal(normalizeCpuDisplaySetting('PANEL'), 'panel');
  });

  it('panel mode is cores * 100', () => {
    assert.equal(deriveCpuPct('panel', docker), 300);
  });

  it('quota mode is cores / limit * 100', () => {
    assert.equal(deriveCpuPct('quota', docker), 25);
  });

  it('host mode uses host_cpu_pct', () => {
    assert.equal(deriveCpuPct('host', docker), 7);
  });

  it('auto prefers panel when cores exist', () => {
    assert.equal(resolveEffectiveCpuMode('auto', docker), 'panel');
    assert.equal(deriveCpuPct('auto', docker), 300);
  });

  it('auto falls back to host without cores', () => {
    assert.equal(resolveEffectiveCpuMode('auto', { hostCpuPct: 42 }), 'host');
    assert.equal(deriveCpuPct('auto', { hostCpuPct: 42 }), 42);
  });

  it('quota without limit falls back to panel then host', () => {
    assert.equal(resolveEffectiveCpuMode('quota', { coresUsed: 2, hostCpuPct: 10 }), 'panel');
    assert.equal(deriveCpuPct('quota', { coresUsed: 2, hostCpuPct: 10 }), 200);
    assert.equal(resolveEffectiveCpuMode('quota', { hostCpuPct: 10 }), 'host');
  });

  it('formats caption with cores and mode', () => {
    assert.equal(formatCpuCaption('panel', docker), '3.0 of 12.0 cores · panel style');
    assert.equal(formatCpuCaption('quota', docker), '3.0 of 12.0 cores · of plan');
  });
});
