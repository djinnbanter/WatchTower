/**
 * Client-side mod dependency tree (mirrors ModDependencyGraph.toTree).
 */

/**
 * @param {Array<object>} mods
 * @returns {{ dependentsOf: (id: string) => string[], dependenciesOf: (id: string) => Array<{modId:string,mandatory:boolean}>, byId: Map<string, object> }}
 */
export function buildModGraph(mods) {
  const byId = new Map();
  const reverse = new Map(); // target -> dependents
  const forward = new Map(); // mod -> deps

  for (const mod of mods ?? []) {
    const id = mod.id ?? mod.mod_id;
    if (!id) continue;
    byId.set(id, mod);
    const deps = Array.isArray(mod.dependencies) ? mod.dependencies : [];
    for (const d of deps) {
      const target = d.modId ?? d.mod_id;
      if (!target) continue;
      const mandatory = d.mandatory !== false;
      if (!forward.has(id)) forward.set(id, []);
      forward.get(id).push({ modId: target, mandatory });
      if (mandatory) {
        if (!reverse.has(target)) reverse.set(target, new Set());
        reverse.get(target).add(id);
      }
    }
  }

  return {
    byId,
    dependentsOf(id) {
      return [...(reverse.get(id) ?? [])].sort((a, b) => a.localeCompare(b));
    },
    dependenciesOf(id) {
      return [...(forward.get(id) ?? [])].sort((a, b) => a.modId.localeCompare(b.modId));
    },
  };
}

/**
 * @param {string} rootId
 * @param {Array<object>} mods
 * @param {'dependents'|'dependencies'} direction
 * @param {number} maxDepth
 */
export function toTree(rootId, mods, direction = 'dependents', maxDepth = 6) {
  const graph = buildModGraph(mods);
  const visited = new Set([rootId]);

  function nodeFor(modId, mandatory) {
    const mod = graph.byId.get(modId) ?? {};
    return {
      mod_id: modId,
      mandatory: !!mandatory,
      display_name: mod.display_name ?? undefined,
      version: mod.version ?? undefined,
      side_score: mod.side_score ?? undefined,
      is_mcreator: mod.is_mcreator || undefined,
      loader_hint: mod.loader_hint ?? undefined,
      children: [],
    };
  }

  function buildChildren(parentId, depth) {
    if (depth >= maxDepth) return [];
    const children = [];
    if (direction === 'dependents') {
      for (const childId of graph.dependentsOf(parentId)) {
        if (visited.has(childId)) continue;
        visited.add(childId);
        const node = nodeFor(childId, true);
        node.children = buildChildren(childId, depth + 1);
        visited.delete(childId);
        children.push(node);
      }
    } else {
      for (const edge of graph.dependenciesOf(parentId)) {
        if (visited.has(edge.modId)) continue;
        visited.add(edge.modId);
        const node = nodeFor(edge.modId, edge.mandatory);
        node.children = buildChildren(edge.modId, depth + 1);
        visited.delete(edge.modId);
        children.push(node);
      }
    }
    return children;
  }

  const root = nodeFor(rootId, true);
  root.children = buildChildren(rootId, 0);
  return root;
}
