/**
 * Port of MixinConfigIndex.java — maps mixin config paths/basenames to owning mods (CA-01).
 */

function str(o, key) {
  if (o == null || o[key] == null) return null;
  try {
    return String(o[key]);
  } catch {
    return null;
  }
}

function basename(path) {
  const bang = path.lastIndexOf('!');
  const after = bang >= 0 ? path.slice(bang + 1) : path;
  const slash = after.lastIndexOf('/');
  return slash >= 0 ? after.slice(slash + 1) : after;
}

function put(map, path, hit) {
  const normalized = path.replace(/\\/g, '/');
  if (!map.has(normalized)) map.set(normalized, hit);
  const lower = normalized.toLowerCase();
  if (!map.has(lower)) map.set(lower, hit);
  const base = basename(normalized);
  if (!map.has(base)) map.set(base, hit);
  const baseLower = base.toLowerCase();
  if (!map.has(baseLower)) map.set(baseLower, hit);
}

export function fromMods(mods) {
  const map = new Map();
  if (!Array.isArray(mods)) {
    return createIndex(map);
  }
  for (const mod of mods) {
    if (!mod || typeof mod !== 'object') continue;
    let modId = str(mod, 'id') || str(mod, 'mod_id');
    if (!modId || !modId.trim()) continue;
    let jarName = str(mod, 'jar_file') || str(mod, 'jar');
    if (Array.isArray(mod.mixin_configs)) {
      for (const path of mod.mixin_configs) {
        if (path == null || !String(path).trim()) continue;
        put(map, String(path), { modId, jarName, configPath: String(path) });
      }
    }
    if (Array.isArray(mod.jar_in_jar)) {
      for (const nested of mod.jar_in_jar) {
        if (!nested || typeof nested !== 'object') continue;
        const nestedId = str(nested, 'id') || modId;
        const nestedJar = str(nested, 'jar_file');
        const indexJar = jarName && nestedJar
          ? `${jarName}!${nestedJar}`
          : (nestedJar || jarName);
        if (!Array.isArray(nested.mixin_configs)) continue;
        for (const path of nested.mixin_configs) {
          if (path == null || !String(path).trim()) continue;
          put(map, String(path), { modId: nestedId, jarName: indexJar, configPath: String(path) });
        }
      }
    }
  }
  return createIndex(map);
}

export function empty() {
  return createIndex(new Map());
}

function createIndex(byKey) {
  return {
    resolve(configToken) {
      if (!configToken || !String(configToken).trim()) return null;
      const token = String(configToken).trim().replace(/\\/g, '/');
      let hit = byKey.get(token);
      if (hit) return hit;
      hit = byKey.get(token.toLowerCase());
      if (hit) return hit;
      const base = basename(token);
      hit = byKey.get(base);
      if (hit) return hit;
      return byKey.get(base.toLowerCase()) || null;
    },
    isEmpty() {
      return byKey.size === 0;
    },
  };
}
