export type StorageTreemapTone = 'accent' | 'info' | 'warn' | 'neutral' | 'ok';

export type StorageTreemapNode = {
  id: string;
  label: string;
  path: string;
  valueGb: number;
  tone: StorageTreemapTone;
  children?: StorageTreemapNode[];
};

export type StorageTreemapShareRow = {
  key: string;
  label: string;
  path: string;
  gb: number;
};

export type BuildStorageTreemapTreeInput = {
  totalGb: number;
  worldGb: number;
  modsGb: number;
  logsGb: number;
  otherGb: number;
  dims: StorageTreemapShareRow[];
  mods: StorageTreemapShareRow[];
  logs: StorageTreemapShareRow[];
  otherRows: StorageTreemapShareRow[];
  backups: StorageTreemapShareRow[];
  backupsGb: number;
  includeBackups: boolean;
};

function positive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

function childFromRows(
  id: string,
  label: string,
  path: string,
  valueGb: number,
  tone: StorageTreemapTone,
  rows: StorageTreemapShareRow[],
): StorageTreemapNode {
  const children = rows
    .filter((r) => positive(r.gb))
    .map((r) => ({
      id: r.key,
      label: r.label,
      path: r.path,
      valueGb: r.gb,
      tone,
    }));
  return {
    id,
    label,
    path,
    valueGb,
    tone,
    ...(children.length ? { children } : {}),
  };
}

export function buildStorageTreemapTree(
  input: BuildStorageTreemapTreeInput,
): StorageTreemapNode | null {
  const cats: StorageTreemapNode[] = [];
  if (positive(input.worldGb)) {
    cats.push(
      childFromRows('world', 'World', 'world', input.worldGb, 'accent', input.dims),
    );
  }
  if (positive(input.modsGb)) {
    cats.push(
      childFromRows('mods', 'Mods', 'mods', input.modsGb, 'info', input.mods),
    );
  }
  if (positive(input.logsGb)) {
    cats.push(
      childFromRows('logs', 'Logs', 'logs', input.logsGb, 'warn', input.logs),
    );
  }
  if (positive(input.otherGb)) {
    cats.push(
      childFromRows(
        'other',
        'Other',
        '.',
        input.otherGb,
        'neutral',
        input.otherRows,
      ),
    );
  }
  if (input.includeBackups && positive(input.backupsGb)) {
    cats.push(
      childFromRows(
        'backups',
        'Backups',
        'backups',
        input.backupsGb,
        'ok',
        input.backups,
      ),
    );
  }
  if (!cats.length) return null;
  const sum = cats.reduce((s, c) => s + c.valueGb, 0);
  return {
    id: 'server',
    label: 'Server',
    path: '.',
    valueGb: input.includeBackups
      ? sum
      : positive(input.totalGb)
        ? input.totalGb
        : sum,
    tone: 'neutral',
    children: cats,
  };
}
