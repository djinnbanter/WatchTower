# Storage Treemap Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add click-origin camera zoom, responsive label sizing, and adaptive GB/MB/KB units to the Storage treemap.

**Architecture:** Keep the existing D3 layout and keyed Motion stages. Record the clicked tile center as the transition origin, overlap outgoing and incoming stages, and reverse the transforms for drill-out. Derive bounded font sizes from tile area and format stored GB values through one exported helper.

**Tech Stack:** React 19, TypeScript, Motion, D3 hierarchy, Node test runner.

## Global Constraints

- Preserve current treemap data, colors, clipping, breadcrumbs, and keyboard behavior.
- Respect `prefers-reduced-motion`.
- Do not add dependencies.
- Do not commit unless requested.

---

### Task 1: Adaptive size formatter

**Files:**
- Modify: `web/dashboard/src/features/insights/panels/storage-treemap.tsx`
- Create: `web/dashboard/src/features/insights/panels/storage-treemap-format.test.ts`

**Interface:** `export function formatTreemapSize(valueGb: number): string`

- [ ] Test `1.2 GB`, `842 MB`, `8.5 MB`, and `512 KB` thresholds.
- [ ] Implement binary GB/MB/KB conversion.
- [ ] Use the helper in tiles, accessibility labels, summaries, and tooltips.
- [ ] Run the formatter and existing storage tests.

### Task 2: Camera zoom and responsive labels

**Files:**
- Modify: `web/dashboard/src/features/insights/panels/storage-treemap.tsx`
- Modify: `web/dashboard/src/features/insights/insights.css`

**Interfaces:**
- `ZoomOrigin = { xPct: number; yPct: number }`
- `onZoomInto(node, origin)`

- [ ] Calculate the clicked tile center as a percentage of map width and height.
- [ ] Use overlapping keyed Motion stages: zoom-in expands the parent and brings in the child; zoom-out reverses both around the stored origin.
- [ ] Derive label size from `sqrt(tileArea)`, clamped to 11–18 px; size text clamps to 10–14 px.
- [ ] Preserve clipping and reduced-motion behavior.
- [ ] Verify World, Mods, and Backups drill-in plus breadcrumb/Escape drill-out in the browser.

## Self-review

- Covers motion direction, spatial origin, responsive labels, and unit thresholds.
- No placeholders or new dependencies.
- Scope remains within the treemap component, CSS, and focused tests.
