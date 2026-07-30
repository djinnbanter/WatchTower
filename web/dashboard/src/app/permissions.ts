import { useSessionStore } from '@/app/session-store';

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

export function useRole(): Role {
  return roleFromSession(useSessionStore((s) => s.session));
}

export function useCanWrite(): boolean {
  return canWrite(useRole());
}

export function useIsOwner(): boolean {
  return canManageAccounts(useRole());
}
