/**
 * Port of ModListGate.java — early-return gate for mod-list–dependent crash rules (CA-17).
 */

const CONNECTOR_IDS = new Set(['connector', 'connectormod']);

function str(o, key) {
  if (o == null || o[key] == null) return null;
  return String(o[key]);
}

function collectNestedIds(mod, ids) {
  if (Array.isArray(mod.nested_mod_ids)) {
    for (const nested of mod.nested_mod_ids) {
      if (nested != null && String(nested).trim()) {
        ids.add(String(nested).toLowerCase());
      }
    }
  }
  if (Array.isArray(mod.jar_in_jar)) {
    for (const el of mod.jar_in_jar) {
      if (el && typeof el === 'object') {
        const nested = str(el, 'id') || str(el, 'mod_id');
        if (nested && nested.trim()) ids.add(nested.toLowerCase());
      } else if (el != null && String(el).trim()) {
        ids.add(String(el).toLowerCase());
      }
    }
  }
  if (Array.isArray(mod.nested)) {
    for (const el of mod.nested) {
      if (el && typeof el === 'object') {
        const nested = str(el, 'id');
        if (nested && nested.trim()) ids.add(nested.toLowerCase());
      }
    }
  }
}

export function fromMods(mods) {
  const ids = new Set();
  if (!Array.isArray(mods)) {
    return createGate(ids);
  }
  for (const mod of mods) {
    if (!mod || typeof mod !== 'object') continue;
    let id = str(mod, 'id') || str(mod, 'mod_id');
    if (id && id.trim()) ids.add(id.toLowerCase());
    collectNestedIds(mod, ids);
  }
  return createGate(ids);
}

export function empty() {
  return createGate(new Set());
}

function createGate(modIds) {
  return {
    requiresMod(modId) {
      if (!modId || !String(modId).trim()) return false;
      return modIds.has(String(modId).toLowerCase());
    },
    forbidsMod(modId) {
      return !this.requiresMod(modId);
    },
    missingAnyOf(...wanted) {
      if (!wanted || wanted.length === 0) return true;
      for (const id of wanted) {
        if (this.requiresMod(id)) return false;
      }
      return true;
    },
    hasConnector() {
      for (const id of CONNECTOR_IDS) {
        if (modIds.has(id)) return true;
      }
      return false;
    },
    modIds() {
      return new Set(modIds);
    },
    isEmpty() {
      return modIds.size === 0;
    },
  };
}
