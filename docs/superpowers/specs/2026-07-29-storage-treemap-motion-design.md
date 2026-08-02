# Storage Treemap Motion Design

## Goal

Make drill-in and drill-out feel like moving a camera through the selected
treemap tile, while allowing labels to use more available tile space without
becoming oversized. Size labels should automatically use a readable unit.

## Motion

- Clicking a zoomable tile records its center as a percentage of the map.
- Drill-in overlaps two stages:
  - the current stage scales from `1` to `1.18` around the clicked tile and
    fades out;
  - the child stage scales from `0.92` to `1` around the same point and fades
    in.
- Drill-out reverses that motion around the stored entry point:
  - the child stage scales from `1` to `0.92` and fades out;
  - the parent stage scales from `1.18` to `1` and fades in.
- Stages overlap rather than waiting for one another, using a 280 ms
  ease-out transition.
- Breadcrumb and Escape navigation use the same reverse transition.
- `prefers-reduced-motion` removes scale motion and uses an immediate view
  change.

## Labels

- Compute font size from tile area using a bounded square-root scale.
- Clamp primary labels to 11–18 px.
- Clamp size labels to 10–14 px.
- Format tile and tooltip sizes using binary thresholds:
  - `>= 1 GB`: show GB with one decimal place;
  - `>= 1 MB` and `< 1 GB`: show MB, with one decimal below 10 MB and a whole
    number at 10 MB or above;
  - `< 1 MB`: show whole KB.
- Keep existing clipping, single-line ellipsis, and hover tooltip so no text
  escapes a tile and the full value remains discoverable.

## Scope

Only `storage-treemap.tsx` and its treemap label CSS change. A local
`formatTreemapSize(valueGb)` helper supplies adaptive GB/MB/KB labels. Data
collection, tree construction, colors, dimensions, and drill-down contents
remain unchanged.

## Verification

- Drill into World, Mods, and Backups from differently positioned tiles.
- Return with breadcrumb and Escape; motion must reverse toward the original
  tile.
- Confirm large tiles have visibly larger labels while small tiles remain
  legible and clipped.
- Confirm values around 1 GB and 1 MB switch units correctly in labels and
  tooltips.
- Confirm reduced-motion disables scaling.
