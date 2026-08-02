import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useSessionStore } from '@/app/session-store';
import { asArray, asRecord, bool, str } from '@/lib/utils';
import { Button } from '@/ui/patterns';
import { PlayerAvatar } from '@/ui/player-avatar';

export type MinecraftPlayerOption = {
  uuid: string;
  name: string;
  online: boolean;
};

export function parsePlayerDirectory(payload: Record<string, unknown>): MinecraftPlayerOption[] {
  const dir = asRecord(payload.player_directory);
  return asArray(dir.players)
    .map((raw) => {
      const r = asRecord(raw);
      const uuid = str(r.uuid);
      const name = str(r.name);
      if (!uuid || !name) return null;
      return { uuid, name, online: bool(r.online) };
    })
    .filter((row): row is MinecraftPlayerOption => row != null)
    .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
}

function usePlayerOptions(prefetched?: MinecraftPlayerOption[]) {
  const playersQ = useQuery({
    queryKey: ['players'],
    queryFn: api.players,
    staleTime: 30_000,
    enabled: prefetched == null,
  });
  return useMemo(() => {
    if (prefetched) return prefetched;
    return playersQ.data ? parsePlayerDirectory(asRecord(playersQ.data)) : [];
  }, [prefetched, playersQ.data]);
}

/** Owner linking someone else's account via /api/accounts/update */
export function AccountMinecraftLink({
  accountId,
  uuid,
  name,
  disabled,
  options: prefetchedOptions,
  compact,
}: {
  accountId: string;
  uuid: string | null;
  name: string | null;
  disabled?: boolean;
  /** Shared directory from Accounts table (avoids N× fetch). */
  options?: MinecraftPlayerOption[];
  /** Single-line table cell; avatar lives in the Person column. */
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const options = usePlayerOptions(prefetchedOptions);
  const [pick, setPick] = useState('');
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: (patch: {
      minecraft_uuid?: string;
      minecraft_name?: string;
      clear_minecraft?: boolean;
    }) => api.updateAccount(accountId, patch),
    onSuccess: () => {
      setError('');
      setPick('');
      void qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message.replace(/^\d+\s+\S+:\s*/, '') : 'Link failed');
    },
  });

  return (
    <MinecraftLinkBody
      uuid={uuid}
      name={name}
      options={options}
      pick={pick}
      onPick={setPick}
      error={error}
      busy={mut.isPending || Boolean(disabled)}
      compact={compact}
      onLink={() => {
        const hit = options.find((o) => o.uuid === pick);
        if (!hit) return;
        mut.mutate({ minecraft_uuid: hit.uuid, minecraft_name: hit.name });
      }}
      onClear={() => mut.mutate({ clear_minecraft: true })}
    />
  );
}

/** Self-service link via /api/accounts/me/minecraft */
export function SelfMinecraftLink() {
  const session = useSessionStore((s) => s.session);
  const setGate = useSessionStore((s) => s.setGate);
  const qc = useQueryClient();
  const uuid = typeof session?.minecraft_uuid === 'string' ? session.minecraft_uuid : null;
  const name = typeof session?.minecraft_name === 'string' ? session.minecraft_name : null;

  const options = usePlayerOptions();
  const [pick, setPick] = useState('');
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: (body: { uuid: string; name: string } | { clear: true }) =>
      api.linkMyMinecraft(body),
    onSuccess: (res) => {
      setError('');
      setPick('');
      const body = asRecord(res);
      if (session) {
        const next = { ...session };
        if (body.clear || !str(body.minecraft_uuid)) {
          delete next.minecraft_uuid;
          delete next.minecraft_name;
        } else {
          next.minecraft_uuid = str(body.minecraft_uuid);
          next.minecraft_name = str(body.minecraft_name);
        }
        setGate('none', next);
      }
      void qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message.replace(/^\d+\s+\S+:\s*/, '') : 'Link failed');
    },
  });

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Minecraft player</h3>
      <p className="text-xs text-wt-text-low">
        Optional. Shows your skin on the side rail. Does not change how you sign in.
      </p>
      <MinecraftLinkBody
        uuid={uuid}
        name={name}
        options={options}
        pick={pick}
        onPick={setPick}
        error={error}
        busy={mut.isPending}
        onLink={() => {
          const hit = options.find((o) => o.uuid === pick);
          if (!hit) return;
          mut.mutate({ uuid: hit.uuid, name: hit.name });
        }}
        onClear={() => mut.mutate({ clear: true })}
      />
    </div>
  );
}

function MinecraftLinkBody({
  uuid,
  name,
  options,
  pick,
  onPick,
  error,
  busy,
  compact,
  onLink,
  onClear,
}: {
  uuid: string | null;
  name: string | null;
  options: MinecraftPlayerOption[];
  pick: string;
  onPick: (v: string) => void;
  error: string;
  busy: boolean;
  compact?: boolean;
  onLink: () => void;
  onClear: () => void;
}) {
  const linked = Boolean(uuid);
  const label = linked ? name || uuid || 'Linked' : 'Not linked';

  if (compact) {
    return (
      <div className="st-accounts__mc">
        {linked ? (
          <div className="st-accounts__mc-row">
            <span className="st-accounts__mc-name" title={label}>
              {label}
            </span>
            <Button kind="ghost" size="xs" disabled={busy} onClick={onClear}>
              Clear
            </Button>
          </div>
        ) : (
          <div className="st-accounts__mc-row">
            <select
              className="st-accounts__select st-accounts__select--dense"
              value={pick}
              disabled={busy || options.length === 0}
              aria-label="Minecraft player"
              onChange={(e) => onPick(e.target.value)}
            >
              <option value="">
                {options.length ? 'Pick a player…' : 'No players yet'}
              </option>
              {options.map((o) => (
                <option key={o.uuid} value={o.uuid}>
                  {o.name}
                  {o.online ? ' (online)' : ''}
                </option>
              ))}
            </select>
            <Button kind="ghost" size="xs" disabled={busy || !pick} onClick={onLink}>
              Link
            </Button>
          </div>
        )}
        {error ? <p className="st-accounts__row-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <PlayerAvatar uuid={uuid} name={name || 'Player'} size={32} className="st-mc-avatar" />
        <span className="truncate text-sm text-wt-text-mid">{label}</span>
        {linked ? (
          <Button kind="ghost" size="xs" disabled={busy} onClick={onClear}>
            Clear
          </Button>
        ) : null}
      </div>
      {!linked ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="st-accounts__select min-w-[10rem]"
            value={pick}
            disabled={busy || options.length === 0}
            aria-label="Minecraft player"
            onChange={(e) => onPick(e.target.value)}
          >
            <option value="">
              {options.length ? 'Pick a player…' : 'No players known yet'}
            </option>
            {options.map((o) => (
              <option key={o.uuid} value={o.uuid}>
                {o.name}
                {o.online ? ' (online)' : ''}
              </option>
            ))}
          </select>
          <Button kind="ghost" size="xs" disabled={busy || !pick} onClick={onLink}>
            Link
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-xs text-wt-danger">{error}</p> : null}
    </div>
  );
}
