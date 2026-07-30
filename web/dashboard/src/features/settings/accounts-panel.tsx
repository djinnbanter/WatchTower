import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useIsOwner } from '@/app/permissions';
import { FadeIn } from '@/ui/motion';
import { Button, EmptyState, ErrorState, Section, StatusPill } from '@/ui/patterns';
import { asArray, asRecord, bool, str, timeAgo } from '@/lib/utils';
import { AccountMinecraftLink } from './minecraft-link';

type AccountRow = {
  id: string;
  username: string;
  role: string;
  disabled: boolean;
  totp_enabled: boolean;
  created_at: string | null;
  last_login_at: string | null;
  is_you: boolean;
  minecraft_uuid: string | null;
  minecraft_name: string | null;
};

type ConfirmKind = 'disable' | 'enable' | 'remove' | 'reset';

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'viewer', label: 'Viewer' },
] as const;

function parseAccounts(payload: Record<string, unknown>): AccountRow[] {
  return asArray(payload.accounts)
    .map((raw) => {
      const r = asRecord(raw);
      const id = str(r.id);
      const username = str(r.username);
      if (!id || !username) return null;
      return {
        id,
        username,
        role: str(r.role, 'viewer'),
        disabled: bool(r.disabled),
        totp_enabled: bool(r.totp_enabled),
        created_at: str(r.created_at) || null,
        last_login_at: str(r.last_login_at) || null,
        is_you: bool(r.is_you),
        minecraft_uuid: str(r.minecraft_uuid) || null,
        minecraft_name: str(r.minecraft_name) || null,
      } satisfies AccountRow;
    })
    .filter((row): row is AccountRow => row != null);
}

function roleLabel(role: string): string {
  const hit = ROLE_OPTIONS.find((o) => o.value === role);
  return hit ? hit.label : role;
}

function accountErrorMessage(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  if (text.includes('last_owner')) {
    return 'That is the last owner account — give someone else owner first.';
  }
  if (text.includes('cannot_delete_self')) {
    return 'You cannot remove your own account.';
  }
  if (text.includes('invalid_account') || text.includes('duplicate')) {
    return 'Could not update that account. Check the username and try again.';
  }
  return text.replace(/^\d+\s+\S+:\s*/, '') || 'Something went wrong.';
}

function ConfirmInline({
  label,
  onConfirm,
  onCancel,
  busy,
}: {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <span className="st-accounts__confirm">
      <span className="st-accounts__confirm-label">{label}</span>
      <Button kind="ghost" size="xs" disabled={busy} onClick={onCancel}>
        Cancel
      </Button>
      <Button kind="primary" size="xs" disabled={busy} onClick={onConfirm}>
        Confirm
      </Button>
    </span>
  );
}

export function AccountsPanel() {
  const isOwner = useIsOwner();
  const qc = useQueryClient();
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'viewer' | 'owner'>('admin');
  const [tempPassword, setTempPassword] = useState<{ username: string; password: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<{ id: string; kind: ConfirmKind } | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  const q = useQuery({
    queryKey: ['accounts'],
    queryFn: api.accounts,
    enabled: isOwner,
  });

  const accounts = useMemo(
    () => (q.data ? parseAccounts(asRecord(q.data)) : []),
    [q.data],
  );

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['accounts'] });

  const createMut = useMutation({
    mutationFn: () => api.createAccount(newUsername.trim(), newRole),
    onSuccess: (res) => {
      const body = asRecord(res);
      const password = str(body.temp_password);
      const username = str(body.username, newUsername.trim());
      setNewUsername('');
      setNewRole('admin');
      setFormError('');
      if (password) setTempPassword({ username, password });
      setCopied(false);
      invalidate();
    },
    onError: (err) => setFormError(accountErrorMessage(err)),
  });

  const updateMut = useMutation({
    mutationFn: (args: { id: string; patch: { role?: string; disabled?: boolean } }) =>
      api.updateAccount(args.id, args.patch),
    onSuccess: (_res, vars) => {
      setRowErrors((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      setConfirm(null);
      invalidate();
    },
    onError: (err, vars) => {
      setRowErrors((prev) => ({ ...prev, [vars.id]: accountErrorMessage(err) }));
      setConfirm(null);
    },
  });

  const resetMut = useMutation({
    mutationFn: (id: string) => api.resetAccountPassword(id, false),
    onSuccess: (res, id) => {
      const body = asRecord(res);
      const password = str(body.temp_password);
      const row = accounts.find((a) => a.id === id);
      setConfirm(null);
      setRowErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (password) {
        setTempPassword({ username: row?.username ?? 'account', password });
        setCopied(false);
      }
      invalidate();
    },
    onError: (err, id) => {
      setRowErrors((prev) => ({ ...prev, [id]: accountErrorMessage(err) }));
      setConfirm(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteAccount(id),
    onSuccess: (_res, id) => {
      setConfirm(null);
      setRowErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      invalidate();
    },
    onError: (err, id) => {
      setRowErrors((prev) => ({ ...prev, [id]: accountErrorMessage(err) }));
      setConfirm(null);
    },
  });

  if (!isOwner) {
    return (
      <EmptyState title="Owner only">
        Only the owner can manage accounts.
      </EmptyState>
    );
  }

  if (q.isLoading) {
    return (
      <div className="grid gap-3">
        <div className="h-8 w-64 animate-pulse rounded-xl bg-wt-bg2" />
        <div className="h-72 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
      </div>
    );
  }

  if (q.isError) {
    return (
      <ErrorState title="Couldn't load accounts">
        {(q.error as Error)?.message || 'Try again in a moment.'}
      </ErrorState>
    );
  }

  const busy =
    createMut.isPending || updateMut.isPending || resetMut.isPending || deleteMut.isPending;

  async function copyTempPassword() {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword.password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <FadeIn>
      <Section
        title="Accounts"
        hint="Everyone gets their own login. Roles decide who can change things."
      >
        <div className="space-y-5">
          {tempPassword ? (
            <div className="st-accounts__temp" role="status">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-wt-text">
                  Temporary password for {tempPassword.username}
                </div>
                <p className="mt-1 text-xs text-wt-text-low">
                  Give this to them once. They will choose their own password when they sign in.
                </p>
                <code className="st-accounts__temp-code">{tempPassword.password}</code>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button kind="primary" size="sm" onClick={() => void copyTempPassword()}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button kind="ghost" size="sm" onClick={() => setTempPassword(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
          ) : null}

          <div className="st-accounts__table-wrap">
            <table className="st-accounts__table">
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Role</th>
                  <th scope="col">Two-factor</th>
                  <th scope="col">Last seen</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((row) => {
                  const pending = confirm?.id === row.id ? confirm.kind : null;
                  return (
                    <tr key={row.id} className={row.disabled ? 'st-accounts__row--disabled' : undefined}>
                      <td>
                        <div className="st-accounts__person">
                          <span className="font-medium">{row.username}</span>
                          {row.is_you ? <StatusPill tone="info">you</StatusPill> : null}
                          {row.disabled ? <StatusPill tone="warn">disabled</StatusPill> : null}
                        </div>
                        <div className="mt-2">
                          <AccountMinecraftLink
                            accountId={row.id}
                            uuid={row.minecraft_uuid}
                            name={row.minecraft_name}
                            disabled={busy || row.disabled}
                          />
                        </div>
                        {rowErrors[row.id] ? (
                          <p className="st-accounts__row-error">{rowErrors[row.id]}</p>
                        ) : null}
                      </td>
                      <td>
                        {row.is_you ? (
                          <span className="text-sm text-wt-text-mid">{roleLabel(row.role)}</span>
                        ) : (
                          <select
                            className="st-accounts__select"
                            value={row.role}
                            disabled={busy}
                            aria-label={`Role for ${row.username}`}
                            onChange={(e) => {
                              setRowErrors((prev) => {
                                const next = { ...prev };
                                delete next[row.id];
                                return next;
                              });
                              updateMut.mutate({ id: row.id, patch: { role: e.target.value } });
                            }}
                          >
                            {ROLE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        <StatusPill tone={row.totp_enabled ? 'ok' : 'neutral'}>
                          {row.totp_enabled ? 'On' : 'Off'}
                        </StatusPill>
                      </td>
                      <td className="st-accounts__seen">
                        {row.last_login_at ? timeAgo(row.last_login_at) : 'Never'}
                      </td>
                      <td>
                        {row.is_you ? (
                          <span className="text-xs text-wt-text-low">—</span>
                        ) : pending ? (
                          <ConfirmInline
                            busy={busy}
                            label={
                              pending === 'remove'
                                ? `Remove ${row.username}?`
                                : pending === 'reset'
                                  ? `Reset password for ${row.username}?`
                                  : pending === 'disable'
                                    ? `Disable ${row.username}?`
                                    : `Enable ${row.username}?`
                            }
                            onCancel={() => setConfirm(null)}
                            onConfirm={() => {
                              if (pending === 'remove') deleteMut.mutate(row.id);
                              else if (pending === 'reset') resetMut.mutate(row.id);
                              else {
                                updateMut.mutate({
                                  id: row.id,
                                  patch: { disabled: pending === 'disable' },
                                });
                              }
                            }}
                          />
                        ) : (
                          <div className="st-accounts__actions">
                            <Button
                              kind="ghost"
                              size="xs"
                              disabled={busy}
                              onClick={() => setConfirm({ id: row.id, kind: 'reset' })}
                            >
                              Reset password
                            </Button>
                            <Button
                              kind="ghost"
                              size="xs"
                              disabled={busy}
                              onClick={() =>
                                setConfirm({
                                  id: row.id,
                                  kind: row.disabled ? 'enable' : 'disable',
                                })
                              }
                            >
                              {row.disabled ? 'Enable' : 'Disable'}
                            </Button>
                            <Button
                              kind="ghost"
                              size="xs"
                              disabled={busy}
                              onClick={() => setConfirm({ id: row.id, kind: 'remove' })}
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <form
            className="st-accounts__new"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newUsername.trim() || createMut.isPending) return;
              setFormError('');
              createMut.mutate();
            }}
          >
            <label className="st-accounts__new-field">
              <span className="text-xs text-wt-text-low">Username</span>
              <input
                type="text"
                value={newUsername}
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. jordan"
                onChange={(e) => {
                  setNewUsername(e.target.value);
                  setFormError('');
                }}
                className="st-accounts__input"
              />
            </label>
            <label className="st-accounts__new-field">
              <span className="text-xs text-wt-text-low">Role</span>
              <select
                className="st-accounts__select"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as typeof newRole)}
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              kind="primary"
              type="submit"
              disabled={busy || !newUsername.trim()}
              className="self-end"
            >
              Add account
            </Button>
          </form>
          {formError ? <p className="text-sm text-wt-danger">{formError}</p> : null}
        </div>
      </Section>
    </FadeIn>
  );
}
