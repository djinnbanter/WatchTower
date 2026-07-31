# How it works: unified mechanism bands

**Date:** 2026-07-31  
**Surface:** `web/marketing` — `/how-it-works`  
**Status:** Design approved in brainstorm (stacked mechanism-led rooms)  
**Related:**  
`docs/superpowers/specs/2026-07-31-marketing-how-it-works-overhaul-design.md`,  
`docs/superpowers/specs/2026-07-31-marketing-how-drop-dashboard-room-design.md`

---

## 1. Problem

Each How it works room is a home-style split: left copy (`TourBrings`) + right
plate. The plate restates the same steps the list already names (wizard steps,
Watching / Scanning / Fix inbox, folder story, CLI command). The page feels
like a second desk tour instead of an operating-model log, and visitors read
the same idea twice.

## 2. Goal

Remake each operating room as **one unified band**: short frame copy, then the
mechanism plate full-width. Say each idea once. Keep Night Watch Desk materials
so the page is clearly the same site as home, with a different job.

After the change, a visitor still learns jar → first run → loop → on disk →
CLI → close, without left/right duplication.

## 3. Decisions (locked)

| Decision | Choice |
|---|---|
| Layout | Stacked single column per room (not home split) |
| Who owns detail | Mechanism plate (or CTAs where there is no list) |
| Left `TourBrings` on how rooms | Remove |
| Capability copy | One short sentence; no step laundry lists |
| Plates | Keep and reuse (mods, wizard, loop, disk, CLI) |
| Close | Unchanged end-of-shift CTA band |
| Home Shift Log | Out of scope |
| Tokens / craft | Existing marketing tokens; Geist + JetBrains Mono; hairline plates |

## 4. Design read

**Subject:** Minecraft dedicated-server ops; Night Watch Desk field-manual tone.  
**Audience:** Host admins learning how WatchTower runs on the machine.  
**Page job:** Operating-model tour — one mechanism per band.

**Not:** A second home feature gallery, glass SaaS, or numbered “01 / 02”
decoration for its own sake. Room order already carries sequence via scroll and
the Shift Log shell.

**Signature:** Full-width instrument under a short lead — a field-manual strip,
not a two-column teach + mock.

## 5. Room spine (unchanged order)

1. **Drop**  
2. **First run**  
3. **Loop**  
4. **On disk**  
5. **CLI**  
6. **Close**

## 6. Band structure

Every operating room (not Close):

```
TITLE (h1 Drop / h2 others)
One capability sentence
[ optional Drop / CLI CTA row ]
[ mechanism plate — full width of content column ]
MarginNote stamp
```

ASCII:

```
| TITLE                                              |
| One short capability line.                         |
| [Install] [Modrinth] [wiki]   ← Drop only          |
| ┌────────────────────────────────────────────────┐ |
| │            mechanism plate                     │ |
| └────────────────────────────────────────────────┘ |
| host · mods/                                       |
```

### Per-room content roles

| Room | Copy keeps | Plate owns | Remove |
|---|---|---|---|
| Drop | Title, capability, CTAs, note | Mods folder / jar drop | `HOW.drop.brings` / TourBrings |
| First run | Title, capability, note | Wizard step strip | `HOW.wizard.brings` / TourBrings |
| Loop | Title, capability, note | Vertical loop path stages | `HOW.loop.brings` / TourBrings |
| On disk | Title, capability, note | `watchtower/` tree | `HOW.disk.brings` / TourBrings |
| CLI | Title, capability, note, optional wiki/CTA if already present | Command plate | `HOW.cli.brings` / TourBrings |
| Close | Existing headline / body / CTAs | n/a | no change |

### Copy rule

- Capability may name the mechanism in one breath (“watches, scans, and fills
  a fix inbox”) without a second structured list of the same beats.
- If a plate label already carries a step name, do not repeat it in a brings
  row.
- Hyphens only. No Fabric shipping claims. No promises / not-our-job on this
  page.

### Plate enrichment (only if a removed bring had unique fact)

After dropping brings, skim for facts that exist only in brings and nowhere on
the plate or capability:

- Drop “get the jar / match MC line” → already covered by CTAs + capability;
  no plate change required.
- First run step names → already on `WizardSteps`.
- Loop stage meaning → already on `LoopPath` labels/values; if a value is too
  thin, slightly enrich plate copy once (not a second list).
- Disk “no upload by default” / “easy to clean up” → prefer folding **one**
  short clause into capability if missing; do not rebuild a three-row list.
- CLI “when to use” → prefer one clause in capability; command stays on plate.

Do not invent new product behavior.

## 7. Layout / CSS

- Drop `lg:grid-cols-[…]` split on how operating entries.
- Single column `max-w` consistent with Shift Log content width (`max-w-[84rem]`
  shell already); plate `w-full`.
- Vertical rhythm: title → capability (`mt-4`) → CTAs if any (`mt-5`) → plate
  (`mt-8` or similar) → note (`mt-5`).
- Loop plate no longer needs a side column stretch hack; keep vertical path and
  a sensible `min-h` so the strip still has presence.
- Disk tree: full content width is fine; optional `max-w-xl` / `max-w-2xl` if
  the tree looks sparse stretched — prefer readable, not edge-to-edge empty
  chrome.
- Bands / temp / ShiftEntry shell unchanged.

## 8. Implementation surface

| Action | Path / note |
|---|---|
| Restack entries | `components/entries/how/{drop,wizard,loop,disk,cli}.tsx` |
| Trim content | `content/how-it-works.ts` — remove `brings` (and type if unused) |
| Capability tweaks | Same file — only as needed per §6 enrichment |
| Plates | Touch only if a unique fact must land on the plate |
| Audit | Extend or adjust `scripts/audit-shift-log.mjs` if it assumes TourBrings / split; keep how rail ids |
| Parent overhaul | Note supersession of hybrid split right-column rule for how rooms |

Close entry and home entries untouched.

## 9. Acceptance

- No how operating room uses a two-column copy|plate split  
- No `TourBrings` on how operating rooms  
- Each mechanism appears once (plate or single capability clause)  
- Spine order unchanged; Close unchanged  
- Same marketing tokens / Shift Log shell  
- `node scripts/audit-shift-log.mjs` passes  
- Page still feels WatchTower (Night Watch Desk), not a generic one-column SaaS
  restyle  

## 10. Out of scope

- Home Shift Log layout  
- Install / FAQ rewrites  
- New rooms or Dashboard room return  
- Multi-tour engine refactor  
- Renaming shared `desk` chrome components  

---

## Plain English

How it works stops repeating itself. Each stop is a short line, then one full
width picture of the mechanism. Home still does the feature desk tour; this
page just walks how the thing runs on your server.
