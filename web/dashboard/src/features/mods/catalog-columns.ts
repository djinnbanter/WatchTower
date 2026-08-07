function clean(s: unknown): string {
  return String(s ?? '').trim();
}

export function catalogJarRaw(mod: { jar_file?: string; jar?: string }): string {
  return clean(mod.jar_file) || clean(mod.jar);
}

export function catalogJarDisplay(jar: string): string {
  const j = clean(jar);
  if (!j) return '';
  return j.endsWith('.disabled') ? j.slice(0, -'.disabled'.length) : j;
}

export function catalogVersionDisplay(version: string | null | undefined): string {
  return clean(version) || '—';
}

export function catalogJarCell(mod: { jar_file?: string; jar?: string }): {
  raw: string;
  display: string;
} {
  const raw = catalogJarRaw(mod);
  return { raw, display: raw ? catalogJarDisplay(raw) : '—' };
}
