import { create } from 'zustand';
import { api } from '@/api/client';
import { isFixturePreview, requiresLiveAuth } from '@/app/runtime';
import { shouldEnterSetupWizard } from '@/features/wizard/persist';

export type BootPhase = 'boot' | 'auth' | 'loading' | 'wizard' | 'ready';
export type AuthGate = 'none' | 'login' | 'totp' | 'password-change';

function roleFromBootSession(
  session: Record<string, unknown> | null | undefined,
): 'owner' | 'admin' | 'viewer' {
  const raw = session?.role;
  if (typeof raw !== 'string') return 'viewer';
  const lowered = raw.trim().toLowerCase();
  if (lowered === 'owner' || lowered === 'admin' || lowered === 'viewer') return lowered;
  return 'viewer';
}

type SessionState = {
  bootPhase: BootPhase;
  gate: AuthGate;
  session: Record<string, unknown> | null;
  bootError: string | null;
  setBootPhase: (phase: BootPhase) => void;
  setGate: (gate: AuthGate, session?: Record<string, unknown> | null) => void;
  applyAuthResult: (result: Record<string, unknown> | null | undefined) => AuthGate;
  resetToLogin: () => void;
  bootstrap: () => Promise<void>;
  resumeAfterAuth: () => Promise<void>;
};

export function gateFromAuthResult(result: Record<string, unknown> | null | undefined): AuthGate {
  if (!result) return 'login';
  const gate = result.gate;
  if (typeof gate === 'string' && gate !== 'none') {
    if (gate === 'login' || gate === 'totp' || gate === 'password-change') return gate;
  }
  if (result.must_change_password || result.mustChangePassword) return 'password-change';
  if (result.totp_required || result.requires_totp || result.totpRequired) return 'totp';
  if (result.authenticated === false) return 'login';
  return 'none';
}

export const useSessionStore = create<SessionState>((set, get) => ({
  bootPhase: 'boot',
  gate: 'none',
  session: null,
  bootError: null,

  setBootPhase: (bootPhase) => set({ bootPhase }),

  setGate: (gate, session) =>
    set((s) => ({
      gate,
      session: session === undefined ? s.session : session,
    })),

  applyAuthResult: (result) => {
    const next = gateFromAuthResult(result);
    set({ gate: next, session: result ?? null });
    return next;
  },

  resetToLogin: () =>
    set({ bootPhase: 'auth', gate: 'login', session: null, bootError: null }),

  bootstrap: async () => {
    set({ bootPhase: 'boot', bootError: null });

    if (isFixturePreview()) {
      const previewRole = new URLSearchParams(window.location.search).get('role') ?? 'owner';
      set({
        gate: 'none',
        session: { authenticated: true, username: 'admin', preview: true, role: previewRole },
        bootPhase: 'loading',
      });
      await get().resumeAfterAuth();
      return;
    }

    set({ bootPhase: 'auth' });
    try {
      const session = await api.session();
      const next = gateFromAuthResult(session);
      set({ session, gate: next });
      if (next === 'none') {
        set({ bootPhase: 'loading' });
        await get().resumeAfterAuth();
      }
    } catch (err) {
      set({
        gate: 'login',
        bootPhase: 'auth',
        bootError: err instanceof Error ? err.message : 'Could not reach auth session',
      });
    }
  },

  resumeAfterAuth: async () => {
    if (requiresLiveAuth()) {
      set({ bootPhase: 'loading' });
      await Promise.allSettled([
        api.reportsIndex(),
        api.settings(),
        api.overviewMeta(),
        api.opsCache(),
        api.dataSources(),
        api.samples(60, 500),
        api.live(),
      ]);
    }

    const forceSetup = new URLSearchParams(window.location.search).get('setup') === '1';
    if (isFixturePreview() && !forceSetup) {
      set({ bootPhase: 'ready', gate: 'none' });
      return;
    }
    const role = roleFromBootSession(get().session);
    if ((forceSetup && role === 'owner') || shouldEnterSetupWizard(role)) {
      set({ bootPhase: 'wizard', gate: 'none' });
      return;
    }
    set({ bootPhase: 'ready', gate: 'none' });
  },
}));
