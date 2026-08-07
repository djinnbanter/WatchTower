function clean(s: unknown): string {
  return String(s ?? '').trim();
}

export function projectVersionLabel(mod: {
  version?: string | null;
  modrinth_version_number?: string | null;
}): string | null {
  const v = clean(mod.version) || clean(mod.modrinth_version_number);
  return v || null;
}

export function projectIdMetaLine(mod: {
  id: string;
  version?: string | null;
  modrinth_version_number?: string | null;
}): string {
  const id = clean(mod.id) || 'unknown';
  const v = projectVersionLabel(mod);
  return v ? `${id} · ${v}` : id;
}

export function projectJarMetaLine(jar: string | null | undefined): string | null {
  const j = clean(jar);
  return j || null;
}
