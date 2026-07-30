import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { useSessionStore } from './session-store';

describe('resetToLogin', () => {
  it('clears session and shows the login gate', () => {
    useSessionStore.setState({
      bootPhase: 'ready',
      gate: 'none',
      session: { authenticated: true, username: 'ella', role: 'owner' },
      bootError: null,
    });
    useSessionStore.getState().resetToLogin();
    const s = useSessionStore.getState();
    assert.equal(s.bootPhase, 'auth');
    assert.equal(s.gate, 'login');
    assert.equal(s.session, null);
    assert.equal(s.bootError, null);
  });
});
