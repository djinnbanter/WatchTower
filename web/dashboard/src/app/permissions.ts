import { useSessionStore } from '@/app/session-store';

/** Tooltip when the signed-in role cannot mutate server settings. */
export const VIEW_ONLY_TITLE = 'Your account can view WatchTower but not change it';

export type Role = 'owner' | 'admin' | 'viewer';

const ROLES: readonly Role[] = ['owner', 'admin', 'viewer'];

/** Least privilege on anything we do not recognize. */
export function roleFromSession(session: Record<string, unknown> | null | undefined): Role {
  const raw = session?.role;
  if (typeof raw !== 'string') return 'viewer';
  const lowered = raw.trim().toLowerCase() as Role;
  return ROLES.includes(lowered) ? lowered : 'viewer';
}

export function canWrite(role: Role): boolean {
  return role === 'owner' || role === 'admin';
}

export function canManageAccounts(role: Role): boolean {
  return role === 'owner';
}

const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  viewer: 'Viewer',
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

export function usernameFromSession(session: Record<string, unknown> | null | undefined): string {
  const raw = session?.username;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : 'Signed in';
}

export function useRole(): Role {
  return roleFromSession(useSessionStore((s) => s.session));
}

export function useCanWrite(): boolean {
  return canWrite(useRole());
}

export function useIsOwner(): boolean {
  return canManageAccounts(useRole());
}

const MODS_MUTATE_CAP = 'mods.mutate';

/**
 * True when the session may run assisted mod jar changes (swap / install / quarantine).
 * Owner always may; others need can_mutate_mods or the mods.mutate capability.
 */
export function canMutateMods(session: Record<string, unknown> | null | undefined): boolean {
  if (!session || typeof session !== 'object') return false;
  if (session.can_mutate_mods === true) return true;
  if (roleFromSession(session) === 'owner') return true;
  const caps = session.capabilities;
  if (Array.isArray(caps)) {
    return caps.some((c) => typeof c === 'string' && c.trim() === MODS_MUTATE_CAP);
  }
  return false;
}

export function useCanMutateMods(): boolean {
  return canMutateMods(useSessionStore((s) => s.session));
}
