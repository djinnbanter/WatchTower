# Storage Treemap (UI-first) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a WinDirStat-style squarified treemap to Insights → Storage using only data already collected, placed as a new card so existing meters and tables stay visible for side-by-side comparison.

**Architecture:** Client-only. A pure function builds a nested `{ id, label, path, valueGb, tone, children? }` tree from the same fields `StoragePanel` already uses (`world_gb`, `mods_gb`, `logs_gb`, residual other, `by_dimension`, `by_logs`, `by_other`, optional backups). A small SVG component lays that tree out with `d3-hierarchy` + `ParentSize` and supports click-to-zoom. No Java, API, or scan changes.

**Tech Stack:** React 19, TypeScript, `d3-hierarchy` (new), `@visx/responsive` `ParentSize` (existing), `node:test` via `tsx --test`, styles in `insights.css`.

## Global Constraints

- **Add, do not replace:** Keep Server space meters, Disk gauge, World/Logs/Other share tables, and Mods link card exactly as they are. The treemap is a new card.
- **No backend:** Do not change `DimensionStorageScanner`, live storage scan, or any API payload shape.
- **No nivo:** Do not add `@nivo/treemap` or another charting stack. Use `d3-hierarchy` + SVG.
- **No mock regen required:** Fixtures already include `by_dimension` / `by_logs` / `by_other`.
- **Match existing tones:** World `accent`, Mods `info`, Logs `warn`, Other `neutral`, Backups `ok` (same as meters).
- **Commits:** Only when the user asks; do not commit unless requested.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `web/dashboard/src/features/insights/panels/storage-treemap-tree.ts` | Pure tree types + `buildStorageTreemapTree` |
| `web/dashboard/src/features/insights/panels/storage-treemap-tree.test.ts` | Unit tests for the builder |
| `web/dashboard/src/features/insights/panels/storage-treemap.tsx` | SVG treemap UI (layout, zoom, breadcrumb, tooltip) |
| `web/dashboard/src/features/insights/panels/storage.tsx` | Wire tree + render new card; leave meters/tables alone |
| `web/dashboard/src/features/insights/insights.css` | `.in-storage-treemap*` styles |
| `web/dashboard/package.json` | Add `d3-hierarchy` (+ types if needed) |
| `docs/wiki/Insights.md` | One-line Storage blurb mentioning the space map |

---

### Task 1: Dependency + tree builder (TDD)

**Files:**
- Modify: `web/dashboard/package.json` (and lockfile via npm install)
- Create: `web/dashboard/src/features/insights/panels/storage-treemap-tree.ts`
- Test: `web/dashboard/src/features/insights/panels/storage-treemap-tree.test.ts`
- Modify: `web/dashboard/package.json` scripts — add `"test:storage": "tsx --test src/features/insights/panels/storage-treemap-tree.test.ts"`

**Interfaces:**
- Produces:

```ts
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
  totalGb: number; // NaN if unknown
  worldGb: number;
  modsGb: number;
  logsGb: number;
  otherGb: number; // residual category GB (same as panel "Other")
  dims: StorageTreemapShareRow[];
  logs: StorageTreemapShareRow[];
  otherRows: StorageTreemapShareRow[];
  backupsGb: number; // NaN if omit
  includeBackups: boolean;
};

export function buildStorageTreemapTree(
  input: BuildStorageTreemapTreeInput,
): StorageTreemapNode | null;
```

- Returns `null` when there are no positive-GB category children.
- Root: `id: 'server'`, `label: 'Server'`, `path: '.'`, `tone: 'neutral'`.
- Root `valueGb`: `totalGb` if finite and `> 0`, else sum of category children.
- Category children only if their GB is finite and `> 0`.
- World/Logs/Other get `children` from dims/logs/otherRows when those rows have `gb > 0`.
- Mods is always a leaf.
- Backups child only when `includeBackups && Number.isFinite(backupsGb) && backupsGb > 0`.
- Skip empty branches; leaf categories when they have no child rows.

- [x] **Step 1: Add dependency**

From `web/dashboard`:

```bash
npm install d3-hierarchy@^3.1.2
npm install -D @types/d3-hierarchy@^3.1.7
```

- [ ] **Step 2: Add npm script**

In `web/dashboard/package.json` scripts:

```json
"test:storage": "tsx --test src/features/insights/panels/storage-treemap-tree.test.ts"
```

- [ ] **Step 3: Write the failing tests**

Create `storage-treemap-tree.test.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildStorageTreemapTree } from './storage-treemap-tree.ts';

describe('buildStorageTreemapTree', () => {
  it('returns null when nothing has size', () => {
    assert.equal(
      buildStorageTreemapTree({
        totalGb: NaN,
        worldGb: NaN,
        modsGb: NaN,
        logsGb: NaN,
        otherGb: NaN,
        dims: [],
        logs: [],
        otherRows: [],
        backupsGb: NaN,
        includeBackups: false,
      }),
      null,
    );
  });

  it('nests dimensions under World and omits backups when not included', () => {
    const tree = buildStorageTreemapTree({
      totalGb: 22.1,
      worldGb: 18.4,
      modsGb: 1.2,
      logsGb: 0.4,
      otherGb: 2.1,
      dims: [
        { key: 'overworld', label: 'Overworld', path: 'world', gb: 12 },
        { key: 'nether', label: 'Nether', path: 'world/DIM-1', gb: 4 },
      ],
      logs: [{ key: 'archives', label: 'Rotated archives', path: 'logs/*.gz', gb: 0.3 }],
      otherRows: [{ key: 'other:config', label: 'config', path: 'config', gb: 1.5 }],
      backupsGb: 40,
      includeBackups: false,
    });
    assert.ok(tree);
    assert.equal(tree.id, 'server');
    assert.equal(tree.valueGb, 22.1);
    const ids = tree.children!.map((c) => c.id);
    assert.deepEqual(ids, ['world', 'mods', 'logs', 'other']);
    const world = tree.children!.find((c) => c.id === 'world')!;
    assert.equal(world.children!.length, 2);
    assert.equal(world.children![0]!.label, 'Overworld');
    assert.equal(world.tone, 'accent');
  });

  it('includes backups when includeBackups is true', () => {
    const tree = buildStorageTreemapTree({
      totalGb: 10,
      worldGb: 8,
      modsGb: NaN,
      logsGb: NaN,
      otherGb: NaN,
      dims: [],
      logs: [],
      otherRows: [],
      backupsGb: 5,
      includeBackups: true,
    });
    assert.ok(tree?.children?.some((c) => c.id === 'backups' && c.valueGb === 5 && c.tone === 'ok'));
  });
});
```

- [ ] **Step 4: Run tests — expect FAIL**

Run: `npm run test:storage` (cwd `web/dashboard`)

Expected: FAIL (module / function not found)

- [ ] **Step 5: Implement `buildStorageTreemapTree`**

Create `storage-treemap-tree.ts` with the types above and logic:

```ts
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
    cats.push({
      id: 'mods',
      label: 'Mods',
      path: 'mods',
      valueGb: input.modsGb,
      tone: 'info',
    });
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
    cats.push({
      id: 'backups',
      label: 'Backups',
      path: 'backups',
      valueGb: input.backupsGb,
      tone: 'ok',
    });
  }
  if (!cats.length) return null;
  const sum = cats.reduce((s, c) => s + c.valueGb, 0);
  return {
    id: 'server',
    label: 'Server',
    path: '.',
    valueGb: positive(input.totalGb) ? input.totalGb : sum,
    tone: 'neutral',
    children: cats,
  };
}
```

- [ ] **Step 6: Run tests — expect PASS**

Run: `npm run test:storage`

Expected: PASS (3 tests)

---

### Task 2: `StorageTreemap` SVG component

**Files:**
- Create: `web/dashboard/src/features/insights/panels/storage-treemap.tsx`
- Modify: `web/dashboard/src/features/insights/insights.css` (append treemap rules near `.in-storage-meter` ~line 995)

**Interfaces:**
- Consumes: `StorageTreemapNode`, `StorageTreemapTone` from `./storage-treemap-tree`
- Produces: `export function StorageTreemap({ tree }: { tree: StorageTreemapNode }): JSX.Element`
- Also uses: `formatGb`, `formatPct` from `@/domain/formats`; `ParentSize` from `@visx/responsive`; `hierarchy`, `treemap`, `treemapSquarify` from `d3-hierarchy`

**Behavior:**
- Breadcrumb above the SVG: path of zoom ancestors; clicking a crumb sets zoom root.
- Zoom state: `zoomId` string path (e.g. `server` or `server/world`). Find node by walking `id` segments; layout that subtree.
- Layout leaves (or nodes with children shown as nested leaf tiles): use `treemap().tile(treemapSquarify).size([width, height]).paddingInner(2).paddingOuter(2)` on `hierarchy(zoomRoot).sum((d) => d.valueGb).sort((a, b) => (b.valueGb ?? 0) - (a.valueGb ?? 0))`.
- Render **leaf** descendants of the zoom root (depth ≥ 1 relative to zoom) as rects. Prefer showing immediate children as tiles; if a child has nested children and the tile is large, nesting can wait — **v1 shows immediate children only** (simpler, still WinDirStat-like after zoom).
- Click tile with `children` → zoom into that node. Click leaf → no zoom.
- Escape: if zoomed past server, zoom out one level.
- Hover: floating tooltip with label, path, `formatGb(valueGb)`, share % of zoom root.
- Color: CSS var by tone — map `accent→var(--wt-accent)`, `info→var(--wt-info, var(--wt-accent))`, `warn→var(--wt-warn)`, `neutral→var(--wt-text-low)`, `ok→var(--wt-ok)`. Fill with `color-mix(in srgb, var(...) 55%, transparent)`.
- Label text only if `x1 - x0 >= 56 && y1 - y0 >= 28`.
- Height: parent sets min-height ~260px; `ParentSize` fills width.
- `role="img"` + `aria-label` summarizing top tiles; each tile `tabIndex={0}` with Enter to zoom when it has children.
- If `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, do not animate layout transitions (instant swap is fine).

- [ ] **Step 1: Add CSS**

Append to `insights.css`:

```css
.in-storage-treemap-card {
  /* reuse plate spacing; card is full-width below the split */
}

.in-storage-treemap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 260px;
}

.in-storage-treemap__crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--wt-text-low);
}

.in-storage-treemap__crumb {
  background: none;
  border: none;
  padding: 0;
  color: var(--wt-accent);
  cursor: pointer;
  font: inherit;
}

.in-storage-treemap__crumb[aria-current='page'] {
  color: var(--wt-text);
  cursor: default;
}

.in-storage-treemap__viewport {
  position: relative;
  flex: 1;
  min-height: 240px;
  border-radius: calc(var(--radius-wt) - 2px);
  overflow: hidden;
  background: var(--wt-bg2, var(--wt-bg1));
}

.in-storage-treemap__tile {
  stroke: var(--wt-bg1);
  stroke-width: 1.5;
  cursor: default;
}

.in-storage-treemap__tile--zoomable {
  cursor: pointer;
}

.in-storage-treemap__tile:focus-visible {
  stroke: var(--wt-accent);
  stroke-width: 2;
}

.in-storage-treemap__label {
  fill: var(--wt-text);
  font-size: 11px;
  pointer-events: none;
}

.in-storage-treemap__tooltip {
  position: absolute;
  z-index: 2;
  max-width: 16rem;
  padding: 0.4rem 0.55rem;
  border-radius: 6px;
  border: 1px solid var(--wt-line);
  background: var(--wt-bg1);
  font-size: 0.75rem;
  pointer-events: none;
  box-shadow: 0 4px 16px color-mix(in srgb, #000 25%, transparent);
}
```

- [ ] **Step 2: Implement `StorageTreemap`**

Create `storage-treemap.tsx` with:

- Local helpers `toneVar(tone)`, `findNode(root, idPath: string[])`, `parentPath(idPath)`.
- State: `zoomPath: string[]` starting `['server']`; `hover: { node, x, y } | null`.
- `ParentSize` → inner that builds layout and maps `root.leaves()` or `root.children` to `<rect>` + optional `<text>`.
- Prefer mapping **`hierarchyRoot.children`** (immediate children of zoom node) as tiles sized by `valueGb` via treemap — not all deep leaves — so root view matches category meters.

Sketch of layout call:

```ts
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import type { StorageTreemapNode } from './storage-treemap-tree';

const rootNode = findNode(tree, zoomPath) ?? tree;
const root = hierarchy(rootNode)
  .sum((d) => (d.children?.length ? 0 : d.valueGb))
  // For category parents with children, sum must use leaf values OR valueGb on node:
  // Prefer: .sum((d) => d.valueGb) then .each(n => { if (n.children) n.value = n.data.valueGb }) 
  // Simplest correct approach for "immediate children tiles":
  // build a shallow clone { ...rootNode, children: rootNode.children } and
  // .sum((d) => d.children ? 0 : d.valueGb) after making each child a leaf clone without grandchildren.
```

**Required layout approach (lock this in):** For the current zoom node, map each **immediate child** to a leaf for layout by cloning `{ ...child, children: undefined }` while keeping `valueGb`. Run treemap on that shallow tree. Zooming into a child re-runs with that child’s real children (or itself as single tile if leaf).

- [ ] **Step 3: Smoke-check TypeScript**

Run from `web/dashboard`:

```bash
npx tsc -b --pretty false
```

Expected: no errors in the new files (panel not wired yet is fine).

---

### Task 3: Wire into Storage panel (add card, keep meters)

**Files:**
- Modify: `web/dashboard/src/features/insights/panels/storage.tsx`
- Modify: `docs/wiki/Insights.md`

**Interfaces:**
- Consumes: `buildStorageTreemapTree`, `StorageTreemap`
- Placement: **new full-width `FadeIn` card after the Server space / Disk `in-storage-split` block** (after ~line 830) and **before** the World by dimension `StorageShareCard`. Do not edit the meter `.in-storage-legend` block.

- [ ] **Step 1: Build tree in `StoragePanel`**

After `spaceShareSum` / `spaceRows` are defined (~line 534), add:

```ts
const treemapTree = useMemo(
  () =>
    buildStorageTreemapTree({
      totalGb,
      worldGb,
      modsGb,
      logsGb,
      otherGb: categories.find((c) => c.id === 'other')?.gb ?? NaN,
      dims: dimsSorted,
      logs: logsRows,
      otherRows,
      backupsGb: backupTotalGb,
      includeBackups: includeBackupsInShare,
    }),
  [
    totalGb,
    worldGb,
    modsGb,
    logsGb,
    categories,
    dimsSorted,
    logsRows,
    otherRows,
    backupTotalGb,
    includeBackupsInShare,
  ],
);
```

Import `useMemo` if not already imported (it is). Import builder + component.

- [ ] **Step 2: Render new card**

Insert after the closing of the Server space / Disk `FadeIn` (~line 830):

```tsx
{treemapTree ? (
  <FadeIn>
    <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 in-storage-plate in-storage-treemap-card p-5">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <HardDrive size={16} className="text-wt-accent" />
          <h3 className="text-sm font-semibold">Space map</h3>
        </div>
        <p className="mt-0.5 text-xs text-wt-text-low">
          WinDirStat-style view of the same breakdown as the meters and tables — click a tile to zoom.
        </p>
      </div>
      <StorageTreemap tree={treemapTree} />
    </div>
  </FadeIn>
) : null}
```

Leave meters, tables, Mods card untouched.

- [ ] **Step 3: Update wiki**

In `docs/wiki/Insights.md`, change the Storage row from:

`| **Storage** | Disk projection and dimension breakdown |`

to:

`| **Storage** | Disk projection, dimension breakdown, and space map (treemap) |`

- [ ] **Step 4: Run unit tests again**

Run: `npm run test:storage`

Expected: PASS

- [ ] **Step 5: Manual preview**

Run: `npm run preview` (cwd `web/dashboard`)

Open Insights → Storage and confirm:

1. Server space **meters still present**
2. New **Space map** card below the split, above World by dimension
3. Root tiles roughly match World/Mods/Logs/Other/(Backups) proportions
4. Click World → dimensions; breadcrumb returns to Server
5. Share tables still below and unchanged

---

## Self-review

1. **Spec coverage:** UI-first over existing data — Tasks 1–3. Add-not-replace — Task 3 placement. No nivo / no backend — Global Constraints. Zoom + tooltip + tones — Task 2.
2. **Placeholders:** None intentionally left; layout approach locked to shallow immediate-children treemap.
3. **Types:** `StorageTreemapNode` / `BuildStorageTreemapTreeInput` defined in Task 1 and consumed in Tasks 2–3.

## Out of scope (explicit)

- Removing or replacing meters / share tables (later, after visual review)
- Deeper `du` walks or new scan fields
- Per-jar mods breakdown
- Canvas renderer
