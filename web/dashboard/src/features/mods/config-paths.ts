/** Client-side heuristics: config paths are not tagged with mod_id on the API. */

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\\/g, '/');
}

function pathTokens(path: string): string[] {
  const rest = norm(path).replace(/^config\//, '');
  return rest.split(/[/_.-]+/).filter(Boolean);
}

export function configPathMatchesMod(
  path: string,
  mod: { id: string; modrinth_slug?: string | null },
): boolean {
  const id = norm(mod.id);
  const slug = mod.modrinth_slug ? norm(mod.modrinth_slug) : '';
  if (!id) return false;

  const lower = norm(path);
  const rest = lower.replace(/^config\//, '');
  const tokens = pathTokens(path);

  if (tokens.includes(id)) return true;
  if (slug && tokens.includes(slug)) return true;

  for (const needle of [id, slug].filter(Boolean)) {
    if (
      rest === needle ||
      rest.startsWith(`${needle}/`) ||
      rest.startsWith(`${needle}-`) ||
      rest.startsWith(`${needle}.`) ||
      rest.startsWith(`${needle}_`)
    ) {
      return true;
    }
  }
  return false;
}

/** Best-effort mod id from a config path for legacy deep-links. */
export function guessModIdFromConfigPath(path: string): string | null {
  const rest = norm(path).replace(/^config\//, '');
  if (!rest || rest === path.toLowerCase().replace(/\\/g, '/')) {
    // still ok if no config/ prefix
  }
  const firstSeg = rest.split('/')[0] || '';
  const base = firstSeg.replace(/\.(toml|json|cfg|properties|txt|conf)$/i, '');
  if (!base) return null;
  const head = base.split(/[-_]/)[0] || '';
  return head.length >= 2 ? head : null;
}

export function filterConfigPathsForMod<T extends { path: string }>(
  files: T[],
  mod: { id: string; modrinth_slug?: string | null },
): T[] {
  return files.filter((f) => configPathMatchesMod(f.path, mod));
}
