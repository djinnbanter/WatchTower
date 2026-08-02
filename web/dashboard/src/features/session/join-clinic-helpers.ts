import { asArray, asRecord, str } from '@/lib/utils';

export type JoinClinicMod = {
  modId: string;
  label: string;
  detail?: string;
};

export type JoinClinicEntry = {
  key: string;
  kind: string;
  player: string;
  time: string;
  confidence: string;
  missing: JoinClinicMod[];
  extra: JoinClinicMod[];
  wrongVersion: JoinClinicMod[];
  missingCount: number;
  extraCount: number;
  wrongVersionCount: number;
  fixCopy: string;
};

function modLabel(row: Record<string, unknown>): JoinClinicMod {
  const modId = str(row.mod_id);
  const display = str(row.display_name);
  const serverVer = str(row.server_version);
  const clientVer = str(row.client_version);
  let detail: string | undefined;
  if (serverVer && clientVer) {
    detail = `need ${serverVer}, has ${clientVer}`;
  } else if (serverVer) {
    detail = `server ${serverVer}`;
  }
  return {
    modId,
    label: display || modId,
    detail,
  };
}

export function parseJoinClinicEntries(ops: Record<string, unknown>): JoinClinicEntry[] {
  const block = asRecord(ops.join_clinic);
  return asArray<Record<string, unknown>>(block.entries).map((e) => {
    const missing = asArray<Record<string, unknown>>(e.missing).map(modLabel).filter((m) => m.modId);
    const extra = asArray<Record<string, unknown>>(e.extra).map(modLabel).filter((m) => m.modId);
    const wrongVersion = asArray<Record<string, unknown>>(e.wrong_version)
      .map(modLabel)
      .filter((m) => m.modId);
    const fixCopy = str(e.fix_copy) || rebuildFixCopy(e);
    return {
      key: str(e.key, `${str(e.kind)}|${str(e.player)}|${str(e.time)}`),
      kind: str(e.kind, 'unknown_pack'),
      player: str(e.player, 'Unknown player'),
      time: str(e.time),
      confidence: str(e.confidence, 'medium'),
      missing,
      extra,
      wrongVersion,
      missingCount: missing.length,
      extraCount: extra.length,
      wrongVersionCount: wrongVersion.length,
      fixCopy,
    };
  });
}

function rebuildFixCopy(e: Record<string, unknown>): string {
  const player = str(e.player, 'player');
  const lines = [`Hey ${player} — the server rejected your join.`, ''];
  const missing = asArray<Record<string, unknown>>(e.missing);
  if (missing.length) {
    lines.push('Install/update on your client:');
    for (const m of missing) {
      const id = str(m.mod_id);
      const ver = str(m.server_version);
      if (!id) continue;
      lines.push(ver ? `- ${id} (server has ${ver})` : `- ${id}`);
    }
    lines.push('');
  }
  lines.push('Ask the admin if you need the pack download.');
  return lines.join('\n');
}

export function kindLabel(kind: string): string {
  switch (kind) {
    case 'mismatched_channel':
      return 'Mismatched channels';
    case 'missing_mod':
      return 'Missing mods';
    case 'wrong_version':
      return 'Wrong versions';
    case 'registry':
      return 'Registry mismatch';
    default:
      return 'Pack sync';
  }
}

/** Short lines for the clinic card, e.g. "Missing: Create, Flywheel". */
export function formatDiffLines(entry: JoinClinicEntry): string[] {
  const lines: string[] = [];
  if (entry.missing.length) {
    lines.push(`Missing: ${entry.missing.map(formatModChip).join(', ')}`);
  }
  if (entry.wrongVersion.length) {
    lines.push(`Wrong version: ${entry.wrongVersion.map(formatModChip).join(', ')}`);
  }
  if (entry.extra.length) {
    lines.push(`Extra on client: ${entry.extra.map(formatModChip).join(', ')}`);
  }
  return lines;
}

function formatModChip(m: JoinClinicMod): string {
  return m.detail ? `${m.label} (${m.detail})` : m.label;
}
