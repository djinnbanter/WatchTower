/** Spark-style All / Flat / Mods transforms over a parsed call tree. */

export type TreeNode = {
  key: string;
  label: string;
  source: string;
  className: string;
  methodName: string;
  methodDesc: string;
  pct: number;
  ownPct: number;
  inclusiveByWindow: number[];
  selfByWindow: number[];
  children: TreeNode[];
};

export type FlatSort = 'total' | 'self';

export type ModSection = {
  id: string;
  pct: number;
  ownPct: number;
  entries: TreeNode[];
};

export function methodKey(node: Pick<TreeNode, 'className' | 'methodName' | 'methodDesc' | 'label'>): string {
  if (node.className || node.methodName || node.methodDesc) {
    return `${node.className}\0${node.methodName}\0${node.methodDesc}`;
  }
  return node.label;
}

export function formatFrameLabel(className: string, method: string, fallback: string): string {
  const methodPart = !method ? '' : method.endsWith('()') ? method : `${method}()`;
  if (className && methodPart) return `${className}.${methodPart}`;
  if (methodPart) return methodPart;
  if (className) return className;
  return fallback || 'Unknown frame';
}

type Acc = {
  key: string;
  label: string;
  source: string;
  total: number;
  self: number;
  instances: TreeNode[];
};

function leafClass(label: string): string {
  const last = label.split('.').at(-1) || label;
  return last.replace(/\(\)$/, '');
}

/**
 * Top-N methods for Flat view (Spark FlatViewGenerator semantics, top-down expand).
 */
export function buildFlatRoots(
  threadChildren: TreeNode[],
  sort: FlatSort = 'total',
  limit = 250,
): TreeNode[] {
  const acc = new Map<string, Acc>();

  const visit = (node: TreeNode, seenOnPath: Set<string> | null) => {
    const key = methodKey(node);
    const row = acc.get(key) ?? {
      key,
      label: node.label,
      source: node.source,
      total: 0,
      self: 0,
      instances: [],
    };
    row.self += node.ownPct;
    if (seenOnPath == null || !seenOnPath.has(key)) {
      row.total += node.pct;
      if (seenOnPath) seenOnPath.add(key);
    }
    if (node.source && node.source !== 'unknown' && (!row.source || row.source === 'unknown')) {
      row.source = node.source;
    }
    row.instances.push(node);
    acc.set(key, row);

    const nextSeen = seenOnPath ? new Set(seenOnPath) : null;
    for (const child of node.children) {
      visit(child, nextSeen);
    }
  };

  for (const root of threadChildren) {
    visit(root, sort === 'total' ? new Set() : null);
  }

  const ranked = [...acc.values()].sort((a, b) => {
    const av = sort === 'self' ? a.self : a.total;
    const bv = sort === 'self' ? b.self : b.total;
    return bv - av;
  }).slice(0, limit);

  return ranked.map((row, index) => {
    const callees = mergeCallees(row.instances);
    return {
      key: `flat:${index}:${row.key}`,
      label: row.label,
      source: row.source,
      className: row.instances[0]?.className || '',
      methodName: row.instances[0]?.methodName || leafClass(row.label),
      methodDesc: row.instances[0]?.methodDesc || '',
      pct: row.total,
      ownPct: row.self,
      inclusiveByWindow: [],
      selfByWindow: [],
      children: callees,
    };
  });
}

/** Merge children of several instances of the same method (by methodKey). */
function mergeCallees(instances: TreeNode[]): TreeNode[] {
  const byKey = new Map<string, { template: TreeNode; pct: number; ownPct: number; kids: TreeNode[] }>();
  for (const instance of instances) {
    for (const child of instance.children) {
      const key = methodKey(child);
      const current = byKey.get(key);
      if (!current) {
        byKey.set(key, {
          template: child,
          pct: child.pct,
          ownPct: child.ownPct,
          kids: [...child.children],
        });
      } else {
        current.pct = Math.max(current.pct, child.pct);
        current.ownPct = Math.max(current.ownPct, child.ownPct);
        current.kids.push(...child.children);
      }
    }
  }
  return [...byKey.entries()]
    .sort((a, b) => b[1].pct - a[1].pct)
    .map(([key, value], index) => ({
      ...value.template,
      key: `flat-child:${index}:${key}`,
      pct: value.pct,
      ownPct: value.ownPct,
      // One level of merged callees is enough for expand; deeper levels keep original children of template.
      children: value.template.children,
    }));
}

/**
 * Mods view: sections per mod_id with entry-frame roots (first attributed frames on a branch).
 */
export function buildModSections(threadChildren: TreeNode[]): ModSection[] {
  const sections = new Map<string, { pct: number; ownPct: number; entries: Map<string, TreeNode> }>();

  const addEntry = (node: TreeNode) => {
    const mod = node.source || 'unknown';
    if (!mod) return;
    const bucket = sections.get(mod) ?? { pct: 0, ownPct: 0, entries: new Map() };
    const key = methodKey(node);
    const existing = bucket.entries.get(key);
    if (!existing) {
      bucket.entries.set(key, { ...node, key: `mod:${mod}:${key}`, children: node.children });
      bucket.pct += node.pct;
      bucket.ownPct += node.ownPct;
    } else {
      // Merge duplicate entry signatures: keep hotter pct, union not needed for children (use max).
      if (node.pct > existing.pct) {
        bucket.entries.set(key, {
          ...node,
          key: existing.key,
          pct: node.pct,
          ownPct: Math.max(existing.ownPct, node.ownPct),
          children: node.children,
        });
        bucket.pct += node.pct - existing.pct;
        bucket.ownPct += Math.max(0, node.ownPct - existing.ownPct);
      }
    }
    sections.set(mod, bucket);
  };

  const walk = (node: TreeNode, parentSource: string | null) => {
    const source = node.source || 'unknown';
    const isEntry = parentSource == null || parentSource !== source;
    if (isEntry && source) {
      addEntry(node);
      // Do not look for further entries of the same source under this node.
      // Still walk children so *other* mods' entry frames are found.
      for (const child of node.children) {
        walk(child, source);
      }
      return;
    }
    for (const child of node.children) {
      walk(child, source);
    }
  };

  for (const root of threadChildren) {
    walk(root, null);
  }

  return [...sections.entries()]
    .map(([id, bucket]) => ({
      id,
      pct: bucket.pct,
      ownPct: bucket.ownPct,
      entries: [...bucket.entries.values()].sort((a, b) => b.pct - a.pct),
    }))
    .filter((section) => section.pct > 0 || section.entries.length > 0)
    .sort((a, b) => b.pct - a.pct);
}

export function filterModSections(sections: ModSection[], query: string): ModSection[] {
  if (!query) return sections;
  const q = query.toLowerCase();
  return sections.flatMap((section) => {
    if (section.id.toLowerCase().includes(q)) return [section];
    const entries = section.entries.filter(
      (node) => node.label.toLowerCase().includes(q) || node.source.toLowerCase().includes(q),
    );
    if (!entries.length) return [];
    return [{ ...section, entries }];
  });
}
