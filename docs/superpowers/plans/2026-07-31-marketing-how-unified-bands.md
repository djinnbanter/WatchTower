# How it works Unified Mechanism Bands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restack How it works operating rooms into single-column bands so each mechanism is said once (plate owns detail; no TourBrings dupe).

**Architecture:** Keep ShiftLog shell and existing how plates. Drop two-column grids and `TourBrings` from how entries. Trim `HOW.*.brings` from content; fold any unique facts into capability (or plate) once.

**Tech Stack:** Next.js marketing app (`web/marketing`), existing how plates, `audit-shift-log.mjs`.

## Global Constraints

- Stacked single column per operating room (not home split)
- Mechanism plate owns detail; capability is one short sentence
- Remove `TourBrings` on how operating rooms
- Close unchanged; home unchanged
- Hyphens only; no Fabric shipping claims; no promises on this page
- Spec: `docs/superpowers/specs/2026-07-31-marketing-how-unified-bands-design.md`

---

## File map

| File | Responsibility |
|---|---|
| `content/how-it-works.ts` | Titles, capability, notes; no brings |
| `components/entries/how/{drop,wizard,loop,disk,cli}.tsx` | Stacked band composition |
| Plates (touch only if needed) | `mods-plate`, `wizard-steps`, `loop-path`, `disk-tree`, `cli-plate` |

---

### Task 1: Trim HOW content

**Files:**
- Modify: `web/marketing/content/how-it-works.ts`

- [x] Step 1: Remove `HowBring` type and every `brings` array
- [x] Step 2: Enrich capabilities only where a removed bring had a unique fact (disk no-upload/cleanup; CLI already covers when-to-use)
- [x] Step 3: Grep `HOW\.\w+\.brings` / `HowBring` — expect no hits

---

### Task 2: Restack operating entries

**Files:**
- Modify: `web/marketing/components/entries/how/drop.tsx`
- Modify: `web/marketing/components/entries/how/wizard.tsx`
- Modify: `web/marketing/components/entries/how/loop.tsx`
- Modify: `web/marketing/components/entries/how/disk.tsx`
- Modify: `web/marketing/components/entries/how/cli.tsx`

Shared pattern:

```tsx
<ShiftEntry {...meta}>
  <div className="min-w-0">
    <h1|h2 className="wt-entry ...">{HOW.x.title}</h1|h2>
    <p className="mt-4 max-w-[52ch] text-[1.0625rem] leading-relaxed text-[color:var(--wt-text-mid)]">
      {HOW.x.capability}
    </p>
    {/* Drop: CTA row mt-5 */}
    <div className="mt-8 w-full max-w-3xl">
      <Plate className="w-full" />
    </div>
    <MarginNote className="mt-5">{HOW.x.note}</MarginNote>
  </div>
</ShiftEntry>
```

- [x] Step 1: Restack Drop (keep ghost CTAs; remove TourBrings)
- [x] Step 2: Restack Wizard, Loop, Disk, CLI the same way
- [x] Step 3: Loop — drop side-column stretch; keep plate `min-h` inside LoopPath
- [x] Step 4: Disk — `max-w-xl` on tree wrapper so chrome is not sparse edge-to-edge
- [x] Step 5: Grep how entries for `TourBrings` / `grid-cols` — expect none on operating rooms

---

### Task 3: Verify

- [x] Step 1: `cd web/marketing && node scripts/audit-shift-log.mjs` — OK
- [x] Step 2: Spot-check `/how-it-works` — single column, no duplicate lists

---

## Acceptance

- No copy|plate split on how operating rooms
- No TourBrings on those rooms
- Spine + Close unchanged
- Audit passes
