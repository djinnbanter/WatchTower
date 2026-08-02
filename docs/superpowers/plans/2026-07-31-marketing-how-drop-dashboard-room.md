# Drop How it works Dashboard Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Dashboard (`desk`) room from `/how-it-works` so the tour is Drop → First run → Loop → On disk → CLI → close.

**Architecture:** Full delete of the how-only entry, port plate, `HOW.desk` copy, and night meta. No First run / FAQ / Install copy changes. Shared `ProductDesk` / `HowDeskShell` chrome stays.

**Tech Stack:** Next.js marketing app (`web/marketing`), existing Shift Log shell, `audit-shift-log.mjs`.

## Global Constraints

- No new How it works rooms in this change
- Leave First run copy as-is
- Do not rename product `desk` chrome used elsewhere
- Hyphens only in user-facing copy (no new copy expected)
- Spec: `docs/superpowers/specs/2026-07-31-marketing-how-drop-dashboard-room-design.md`

---

## File map

| File | Responsibility |
|---|---|
| `app/how-it-works/page.tsx` | Unwire `HowDeskEntry` |
| `components/entries/how/desk.tsx` | Delete |
| `components/how/port-callout.tsx` | Delete (desk-only) |
| `content/how-it-works.ts` | Remove `HOW.desk` |
| `content/how-night.ts` | Remove `desk` id + entry |
| `scripts/audit-shift-log.mjs` | Remove `['desk', 'Dashboard']` expected rail |

---

### Task 1: Unwire and delete desk surfaces

**Files:**
- Modify: `web/marketing/app/how-it-works/page.tsx`
- Delete: `web/marketing/components/entries/how/desk.tsx`
- Delete: `web/marketing/components/how/port-callout.tsx`

- [x] Step 1: Remove `HowDeskEntry` import and `<HowDeskEntry />` from the page
- [x] Step 2: Delete `desk.tsx` and `port-callout.tsx`
- [x] Step 3: Grep for `HowDeskEntry`, `port-callout`, `PortCallout` — expect no hits under `web/marketing`

---

### Task 2: Drop content + night meta + audit

**Files:**
- Modify: `web/marketing/content/how-it-works.ts`
- Modify: `web/marketing/content/how-night.ts`
- Modify: `web/marketing/scripts/audit-shift-log.mjs`

- [x] Step 1: Remove the entire `desk: { ... }` block from `HOW`
- [x] Step 2: Remove `'desk'` from `HowNightEntryId` and the `HOW_NIGHT` desk object
- [x] Step 3: Remove `['desk', 'Dashboard']` from expected how rail in the audit script
- [x] Step 4: Run `cd web/marketing && node scripts/audit-shift-log.mjs` — expect OK
- [x] Step 5: Confirm page order is Drop → First run → Loop → On disk → CLI → close

---

## Acceptance

- No Dashboard room on `/how-it-works`
- First run copy unchanged
- Audit passes
