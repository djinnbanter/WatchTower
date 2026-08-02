import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFixtureSession,
  handleFixtureRequest,
} from './fixture-api-core.ts';

describe('fixture-api-core', () => {
  it('createFixtureSession returns a mutable session object', () => {
    const s = createFixtureSession();
    assert.equal(typeof s, 'object');
    assert.ok(s);
  });

  it('returns null for non-API paths', async () => {
    const session = createFixtureSession();
    const res = await handleFixtureRequest(session, 'GET', '/not-api');
    assert.equal(res, null);
  });

  it('serves GET /api/live as JSON', async () => {
    const session = createFixtureSession();
    const res = await handleFixtureRequest(session, 'GET', '/api/live');
    assert.ok(res);
    assert.equal(res.status, 200);
    assert.match(res.contentType, /json/);
    const body =
      typeof res.body === 'string' ? JSON.parse(res.body) : JSON.parse(res.body.toString('utf8'));
    assert.equal(typeof body, 'object');
  });

  it('serves GET /api/auth/session as authenticated preview', async () => {
    const session = createFixtureSession();
    const res = await handleFixtureRequest(session, 'GET', '/api/auth/session');
    assert.ok(res);
    assert.equal(res.status, 200);
    const body = JSON.parse(String(res.body));
    assert.equal(body.authenticated === true || body.ok === true || body.user != null, true);
  });

  it('POST /api/issues/ack returns ok', async () => {
    const session = createFixtureSession();
    const res = await handleFixtureRequest(session, 'POST', '/api/issues/ack', {
      id: 'issue:demo',
    });
    assert.ok(res);
    assert.equal(res.status, 200);
    const body = JSON.parse(String(res.body));
    assert.equal(body.ok, true);
  });
});
