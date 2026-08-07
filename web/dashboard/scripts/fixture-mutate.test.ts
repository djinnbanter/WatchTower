import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFixtureSession, handleFixtureRequest } from './fixture-api-core.ts';
import { fingerprintFromUpdateRow, impactFingerprint } from '../src/features/mods/mutate-api.ts';

describe('fixture mutate stubs', () => {
  it('session includes can_mutate_mods for owner', async () => {
    const session = createFixtureSession();
    const res = await handleFixtureRequest(session, 'GET', '/api/auth/session');
    assert.ok(res);
    const body = JSON.parse(String(res.body));
    assert.equal(body.can_mutate_mods, true);
    assert.ok(Array.isArray(body.capabilities));
    assert.ok(body.capabilities.includes('mods.mutate'));
  });

  it('swap returns 202 and job reaches done', async () => {
    const session = createFixtureSession();
    const status0 = await handleFixtureRequest(session, 'GET', '/api/mods/mutate/status');
    assert.equal(status0?.status, 200);
    const fingerprint = fingerprintFromUpdateRow(
      { mod_id: 'create', impact_verdict: '', impact_summary: '', blockers: [] },
      'ver_preview_latest',
    );
    const swap = await handleFixtureRequest(session, 'POST', '/api/mods/mutate/swap', {
      mod_id: 'create',
      modrinth_version_id: 'ver_preview_latest',
      impact_fingerprint: fingerprint,
      confirm: true,
    });
    assert.equal(swap?.status, 202);
    const accepted = JSON.parse(String(swap!.body));
    assert.ok(accepted.job_id);
    await new Promise((r) => setTimeout(r, 2200));
    const job = await handleFixtureRequest(
      session,
      'GET',
      `/api/mods/mutate/jobs/${accepted.job_id}`,
    );
    assert.equal(job?.status, 200);
    const body = JSON.parse(String(job!.body));
    assert.equal(body.state, 'done');
    const status1 = await handleFixtureRequest(session, 'GET', '/api/mods/mutate/status');
    const st = JSON.parse(String(status1!.body));
    assert.equal(st.needs_restart, true);
  });

  it('fingerprint binds version id', () => {
    const a = impactFingerprint({
      mod_id: 'create',
      version_id: 'v1',
      verdict: 'safe',
      summary: 'ok',
    });
    const b = impactFingerprint({
      mod_id: 'create',
      version_id: 'v2',
      verdict: 'safe',
      summary: 'ok',
    });
    assert.notEqual(a, b);
  });
});
