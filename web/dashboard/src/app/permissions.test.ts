import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canManageAccounts, canWrite, roleFromSession } from './permissions';

describe('roleFromSession', () => {
  it('reads the role from the session payload', () => {
    assert.equal(roleFromSession({ role: 'admin' }), 'admin');
    assert.equal(roleFromSession({ role: 'VIEWER' }), 'viewer');
  });

  it('treats an unknown or missing role as viewer', () => {
    assert.equal(roleFromSession({ role: 'superuser' }), 'viewer');
    assert.equal(roleFromSession({}), 'viewer');
    assert.equal(roleFromSession(null), 'viewer');
  });

  it('keeps fixture preview usable as owner', () => {
    assert.equal(roleFromSession({ preview: true, role: 'owner' }), 'owner');
  });
});

describe('capabilities', () => {
  it('lets owner and admin write', () => {
    assert.equal(canWrite('owner'), true);
    assert.equal(canWrite('admin'), true);
    assert.equal(canWrite('viewer'), false);
  });

  it('limits account management to owner', () => {
    assert.equal(canManageAccounts('owner'), true);
    assert.equal(canManageAccounts('admin'), false);
    assert.equal(canManageAccounts('viewer'), false);
  });
});
