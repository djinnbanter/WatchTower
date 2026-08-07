import { str } from '@/lib/utils';

/** Nested / jar-in-jar entries for a parent mod (Library project page). */
export function resolveNestedJars(
  mod: Record<string, unknown> | null | undefined,
  factsMods: Record<string, unknown>[] = [],
): Record<string, unknown>[] {
  if (!mod) return [];
  const fromJar = Array.isArray(mod.jar_in_jar)
    ? (mod.jar_in_jar as Record<string, unknown>[]).filter((j) => j && typeof j === 'object')
    : [];
  if (fromJar.length) return fromJar;

  const ids = Array.isArray(mod.nested_mod_ids)
    ? (mod.nested_mod_ids as unknown[]).map((id) => str(id)).filter(Boolean)
    : [];
  if (!ids.length) return [];

  const byId = new Map<string, Record<string, unknown>>();
  for (const m of factsMods) {
    const id = str(m.id || m.mod_id);
    if (id) byId.set(id, m);
  }

  return ids.map((id) => {
    const hit = byId.get(id);
    if (hit) {
      return {
        id,
        display_name: str(hit.display_name || hit.modrinth_title) || id,
        version: str(hit.version) || undefined,
      };
    }
    return { id, display_name: id };
  });
}
