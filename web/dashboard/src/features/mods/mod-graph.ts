import type { DepTreeNode } from './types';

type ModLike = Record<string, unknown>;

export function buildModGraph(mods: ModLike[] | null | undefined) {
  const byId = new Map<string, ModLike>();
  const reverse = new Map<string, Set<string>>();
  const forward = new Map<string, Array<{ modId: string; mandatory: boolean }>>();

  for (const mod of mods ?? []) {
    const id = String(mod.id ?? mod.mod_id ?? '');
    if (!id) continue;
    byId.set(id, mod);
    const deps = Array.isArray(mod.dependencies) ? mod.dependencies : [];
    for (const d of deps as ModLike[]) {
      const target = String(d.modId ?? d.mod_id ?? '');
      if (!target) continue;
      const mandatory = d.mandatory !== false;
      if (!forward.has(id)) forward.set(id, []);
      forward.get(id)!.push({ modId: target, mandatory });
      if (mandatory) {
        if (!reverse.has(target)) reverse.set(target, new Set());
        reverse.get(target)!.add(id);
      }
    }
  }

  return {
    byId,
    dependentsOf(id: string) {
      return [...(reverse.get(id) ?? [])].sort((a, b) => a.localeCompare(b));
    },
    dependenciesOf(id: string) {
      return [...(forward.get(id) ?? [])].sort((a, b) => a.modId.localeCompare(b.modId));
    },
  };
}

export function toTree(
  rootId: string,
  mods: ModLike[],
  direction: 'dependents' | 'dependencies' = 'dependents',
  maxDepth = 6,
): DepTreeNode {
  const graph = buildModGraph(mods);
  const visited = new Set([rootId]);

  function nodeFor(modId: string, mandatory: boolean): DepTreeNode {
    const mod = graph.byId.get(modId) ?? {};
    return {
      mod_id: modId,
      mandatory: !!mandatory,
      display_name: mod.display_name ? String(mod.display_name) : undefined,
      version: mod.version ? String(mod.version) : undefined,
      side_score: mod.side_score ? String(mod.side_score) : undefined,
      is_mcreator: !!mod.is_mcreator || undefined,
      loader_hint: mod.loader_hint ? String(mod.loader_hint) : undefined,
      children: [],
    };
  }

  function buildChildren(parentId: string, depth: number): DepTreeNode[] {
    if (depth >= maxDepth) return [];
    const children: DepTreeNode[] = [];
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
