import { asArray, asRecord, str } from '@/lib/utils';
import { parseJoinClinicEntries, type JoinClinicEntry } from './join-clinic-helpers';

export type SessionActivityKind = 'join' | 'leave' | 'failed';

export type SessionActivityItem = {
  id: string;
  kind: SessionActivityKind;
  player: string;
  time: string | null;
  /** failed only */
  clinic?: JoinClinicEntry;
};

function timeMs(iso: string | null | undefined): number {
  if (!iso) return Number.NEGATIVE_INFINITY;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

export function buildSessionActivityItems(ops: Record<string, unknown>): SessionActivityItem[] {
  const items: SessionActivityItem[] = [];

  const activity = asRecord(ops.activity);
  for (const ev of asArray<Record<string, unknown>>(activity.events)) {
    const type = str(ev.type);
    if (type !== 'player_join' && type !== 'player_leave') continue;
    const player = str(ev.detail) || str(ev.player) || 'Unknown player';
    const time = str(ev.time) || null;
    const kind: SessionActivityKind = type === 'player_join' ? 'join' : 'leave';
    items.push({
      id: `${kind}|${player}|${time ?? ''}`,
      kind,
      player,
      time,
    });
  }

  for (const clinic of parseJoinClinicEntries(ops)) {
    items.push({
      id: clinic.key || `failed|${clinic.player}|${clinic.time}`,
      kind: 'failed',
      player: clinic.player,
      time: clinic.time || null,
      clinic,
    });
  }

  items.sort((a, b) => timeMs(b.time) - timeMs(a.time));
  return items;
}
