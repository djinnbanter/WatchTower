# How it works: drop the Dashboard room

**Date:** 2026-07-31  
**Surface:** `web/marketing` — `/how-it-works`  
**Status:** Design approved in brainstorm (cut room; full remove; no First run copy add)  
**Related:**  
`docs/superpowers/specs/2026-07-31-marketing-how-it-works-overhaul-design.md`

---

## 1. Problem

The **Dashboard** room (`desk` / `:8787` port callout) is the weakest beat on
How it works. It mostly repeats port, localhost/SSH, and password rules that
First run already covers under Security, and that FAQ / Install also state.
The right plate is a settings callout, not a picture of the product. Home
already tours Overview / Issues / Live. This room does not teach a new
operating step.

## 2. Goal

Remove the Dashboard room from the How it works Shift Log. Keep the tour
focused on host operating steps. Do not invent a replacement room in this
change.

After the cut, a visitor can still answer: where the jar goes, what first-run
does, how watch → scan → fix works, where files live, and what to use if
Minecraft will not boot. Port safety stays available on FAQ / Install (and
First run Security as already written).

## 3. Decisions (locked)

| Decision | Choice |
|---|---|
| Keep a Dashboard room? | No — cut it |
| Fold `:8787` / login rules into First run? | No — leave First run copy as-is |
| Where safety copy lives | FAQ / Install (and existing First run Security) |
| Cleanup depth | Full remove (entry, content, plate, audit rail). No soft-hide dead files. |
| Replacement room | None in this change |

## 4. New room spine

Ordered entries after the cut:

1. **Drop** — jar in `mods/`; Install / Modrinth / wiki links  
2. **First run** — wizard path (unchanged copy)  
3. **Loop** — Watching → Scanning → Fix inbox  
4. **On disk** — `watchtower/` on the host  
5. **CLI** — disaster-recovery when the game will not boot  
6. **Close** — demo + Modrinth  

Removed: **Dashboard** (`desk`).

### Explicitly not in scope

- Rewriting First run, Drop, Install, or FAQ copy  
- Adding a ProductDesk peek in place of the port plate  
- Home Shift Log changes  
- Standing Orders / promises relocation  
- Renaming internal `desk` chrome components used elsewhere (`ProductDesk`,
  `HowDeskShell`, etc.)

## 5. Implementation surface

| Action | Path / note |
|---|---|
| Unwire entry | `web/marketing/app/how-it-works/page.tsx` — drop `HowDeskEntry` |
| Delete entry | `web/marketing/components/entries/how/desk.tsx` |
| Delete plate | `web/marketing/components/how/port-callout.tsx` (only used by desk) |
| Drop content | Remove `HOW.desk` from `web/marketing/content/how-it-works.ts` |
| Drop night meta | Remove `desk` from `HowNightEntryId` and `HOW_NIGHT` in `how-night.ts` |
| Audit | `web/marketing/scripts/audit-shift-log.mjs` — remove `['desk', 'Dashboard']` from expected how rail |
| Parent spec | Note supersession in overhaul design §5 Desk bullet (amend or add “Superseded” note) |

Id `desk` may remain only as historical chat context; it must not appear in the
live how-night rail or page after this change.

## 6. Acceptance

- `/how-it-works` scrolls Drop → First run → Loop → On disk → CLI → close  
- No “Dashboard” room title, rail label, or `:8787` settings plate on that page  
- First run copy unchanged  
- `node scripts/audit-shift-log.mjs` passes  
- FAQ / Install still state port / localhost / password where they already do  

## 7. Out of scope

- Dashboard product behavior  
- Multi-tour engine refactor  
- New how-it-works rooms beyond the cut  

---

## Plain English

How it works no longer has a separate “Dashboard / port 8787” stop. That
lesson already lives on Install and FAQ. The tour goes jar → first run →
daily loop → files on disk → DR CLI → try the demo.
