# How it works: mechanism pipeline rebuild

**Date:** 2026-07-31  
**Surface:** `web/marketing` — `/how-it-works`  
**Status:** Design approved in brainstorm (approach B: continuous pipeline diagram, full delete + fresh build)  
**Supersedes:** All prior How it works specs building the setup-room version of this page:  
`docs/superpowers/specs/2026-07-31-marketing-how-it-works-overhaul-design.md`,  
`docs/superpowers/specs/2026-07-31-marketing-how-drop-dashboard-room-design.md`,  
`docs/superpowers/specs/2026-07-31-marketing-how-unified-bands-design.md`

---

## 1. Problem

The current `/how-it-works` page (Drop → First run → Loop → On disk → CLI →
close) is a second install guide: jar-drop animation, wizard step strip, a
CLI command box. `/install` already owns setup. The page never explains what
`PRODUCT.md` actually calls the mechanism: **"continuous Watching + Scanning
into a Fix inbox and Insights, with Support packs when you need to share
evidence."** A visitor who reads this page cannot yet answer "how does
WatchTower turn my server into advice?"

## 2. Goal

Replace the page with a single mechanism story: **Collect → Understand →
Advise**, shown as one continuous, connected pipeline — not discrete
full-bleed rooms, not setup steps. After reading it, a visitor knows what
WatchTower watches, that it makes sense of what it sees, and what comes out
the other side (Fix inbox, Overview grade, Insights, Support pack).

## 3. Decisions (locked)

| Decision | Choice |
|---|---|
| Page job | Explain the collect → analyze → advise mechanism, not setup |
| Structure | One continuous scrollytelling pipeline diagram (not `ShiftLog` rooms) |
| Setup steps | Dropped entirely from this page; Install page owns setup, no closing pointer needed |
| Example depth | Category level only (Vitals, Logs, Mods, World, Backups) — no worked "X causes Y" examples |
| Advise outputs | Four: Fix inbox, Overview grade, Insights trends, Support pack (not trimmed to three) |
| Proof moment | One real `ProductDesk` mock under Fix inbox only — the single place the pipeline becomes a real screen |
| Old how-room components | Deleted outright, not archived (drop/wizard/loop/disk/cli entries + their plates) |
| Close band | Unchanged content/behavior (demo + Modrinth), no longer wrapped in `ShiftEntry`/`ShiftLog` |
| Home page | Untouched — keeps `ShiftLog` feature tour |

## 4. Design read

**Subject:** the actual data pipeline inside WatchTower — vitals/logs/mods/
world/backups feeding classifiers, classifiers feeding a fix inbox. Night
Watch Desk materials (Geist + JetBrains Mono, Signal Blue scarce, hairline
plates, 2/4/6px radii) carry over; the *shape* of the page does not carry over
from home's Shift Log.

**Signature element:** many small Collect nodes converging into one calm,
wider Understand plate, then fanning back out to four Advise nodes, with a
single traveling Signal Blue pulse running the whole path once. The
convergence/divergence shape *is* the thesis — it visually says "lots of
input, one read, a few clear outputs" without a paragraph explaining it.

**Not:** a generic node-graph library look, a second Shift Log, a setup guide,
an Awwwards diagram flex. No new decorative motion beyond the one pulse pass.

## 5. Page structure

```
[ Site header — unchanged ]

<main>
  Page intro
    h1: How it works
    One short lede sentence naming the mechanism

  Pipeline (single section, scroll-revealed once)
    Stage: Collect    — Vitals, Logs, Mods, World, Backups (5 nodes)
    Connector + pulse  — Collect → Understand
    Stage: Understand  — one wide calm node, one plain-English sentence
    Connector + pulse  — Understand → Advise
    Stage: Advise      — Fix inbox, Overview grade, Insights trends,
                          Support pack (4 nodes)
    Proof mock          — real ProductDesk (Issues/fix-inbox surface),
                          anchored under the Fix inbox node only

  Close band (unchanged content: "Try the demo, then get it on Modrinth.")
</main>

[ Site footer — unchanged ]
```

- No rail, no per-room scroll-snap bands, no `data-entry-id` tour progress.
- One page-level intro; the pipeline is the entire body between intro and
  Close.

## 6. Stage content

### Collect (5 nodes, plain noun-phrase labels)

| Node | Source (do not invent beyond this) |
|---|---|
| Vitals | TPS, MSPT, heap, CPU, disk (`PRODUCT.md` Live) |
| Logs | latest.log tail, crash reports |
| Mods | jar inventory + checksums |
| World | chunk load, entity/item counts (World pressure) |
| Backups | presence, age |

### Understand (1 node)

One plain-English sentence: raw scans become "is this actually a problem" and
"have we seen this before" — no internal class names (`CrashClassifier`,
`WorldPressureAnalyzer`, etc.) surfaced in UI copy.

### Advise (4 nodes)

| Node | What it is |
|---|---|
| Fix inbox | Ranked Issues, plain next step |
| Overview grade | Health grade, needs-attention list |
| Insights trends | Schedule / load / storage trends over time |
| Support pack | Redacted bundle to share with a helper or mod author |

### Proof mock

Reuse an existing `ProductDesk` cut (Issues/fix-inbox surface, same fixture
data already used on home) anchored under the Fix inbox node. This is the only
place a real screen appears — it is not repeated under the other three Advise
nodes.

## 7. Visual / motion spec

- **Nodes:** small hairline-bordered rectangular tags, tight radius (`2/4px`),
  mono uppercase label — same family as `HowPill`/plate labels, not circles.
- **Understand node:** visually widest/calmest; centered; larger plate than
  Collect/Advise nodes.
- **Connectors:** 1px lines in the existing line-color token.
- **Pulse:** one Signal Blue pulse travels Collect → Understand → Advise on
  first scroll-into-view. Single pass, `viewport={{ once: true }}`. This is
  the only signature motion beat on the page.
- **Reveal order:** Collect nodes stagger in → pulse to Understand → Advise
  nodes stagger in → proof mock settles under Fix inbox.
- **Reduced motion:** everything renders fully connected and static
  immediately (lines drawn as static borders/SVG, not motion-only); no pulse,
  no stagger.
- **Layout direction:** left-to-right (Collect → Understand → Advise) on
  desktop; connectors rotate to vertical and stack top-to-bottom on
  mobile/tablet — never disappear.
- **Type:** stage titles (`Collect`/`Understand`/`Advise`) at `wt-entry`
  scale; node labels at existing mono/label scale (`0.75rem` uppercase,
  tracked), matching `MarginNote`/pill conventions already in the codebase.

## 8. Copy rules

- Page lede: one sentence, plain English, states the mechanism (watches the
  host, makes sense of what it sees, turns that into next steps) — exact
  wording finalized at implementation time following house voice (no
  inflated marketing, hyphens only, no em-dashes).
- Node labels: short noun phrases, sourced from `PRODUCT.md` capabilities.
- Understand copy: one sentence, no internal analyzer/class names.
- No promises / not-our-job content on this page (existing rule carries over).
- No Fabric shipping claims.

## 9. Close band

Same visual content and behavior as today's close room: `MarginNote` "End of
shift", `wt-display` headline (`CLOSE_HEADLINE`), body (`CLOSE_BODY`), demo CTA
(new tab, spark burst on press) + Modrinth CTA, footnote. Implementation may
wrap only the minimal provider it needs (e.g. `SparkProvider`) locally on this
page instead of the full `ShiftLog`/`ShiftEntry` shell, since that shell is
otherwise removed from this route.

## 10. File plan

| Action | Path |
|---|---|
| Delete | `app/how-it-works/page.tsx` (rewritten fresh) |
| Delete | `components/entries/how/drop.tsx` |
| Delete | `components/entries/how/wizard.tsx` |
| Delete | `components/entries/how/loop.tsx` |
| Delete | `components/entries/how/disk.tsx` |
| Delete | `components/entries/how/cli.tsx` |
| Delete | `components/entries/how/close.tsx` |
| Delete | `components/how/mods-plate.tsx` |
| Delete | `components/how/wizard-steps.tsx` |
| Delete | `components/how/loop-path.tsx` |
| Delete | `components/how/disk-tree.tsx` |
| Delete | `components/how/cli-plate.tsx` |
| Delete | `components/how/plate-shell.tsx` (only consumed by the above; confirmed no other usage) |
| Delete | `content/how-it-works.ts` |
| Delete | `content/how-night.ts` |
| New | `components/how/pipeline.tsx` (or split into `pipeline-collect.tsx` / `pipeline-understand.tsx` / `pipeline-advise.tsx` if the file grows unwieldy — decide at plan time) |
| New | Content constants for stage/node copy (new `content/how.ts` or colocated in the pipeline component — decide at plan time based on size) |
| New | `app/how-it-works/page.tsx` — page intro + pipeline + Close band |
| Modify | `scripts/audit-shift-log.mjs` — remove all how-rail/how-room/how-entry assumptions; this route no longer participates in Shift Log audit rules |

## 11. Acceptance

- `/how-it-works` has no `ShiftLog`/`ShiftEntry` usage
- One continuous Collect → Understand → Advise diagram, not discrete rooms
- Exactly one real product mock on the page (Fix inbox, under Advise)
- No setup-step content (jar drop, wizard steps, CLI command) anywhere on the
  page
- Reduced motion shows a fully connected, static diagram
- Mobile/tablet: stages stack top-to-bottom, still connected
- Close band content/behavior matches today's, visually
- `node scripts/audit-shift-log.mjs` passes with how-specific rules removed
- Home page and `ShiftLog` component are unmodified

## 12. Out of scope

- Home page / Shift Log
- Install page (still owns setup steps)
- FAQ
- New product behavior or claims beyond what `PRODUCT.md` documents
- A generalized/reusable pipeline-diagram component for other pages — this is
  a one-off build for this route

---

## Plain English

How it works stops being a second install guide. It now shows the actual
mechanism: WatchTower watches vitals, logs, mods, world state, and backups on
your server; makes sense of what it sees; and turns that into a ranked fix
list, a health grade, trend insights, and a shareable support pack when you
need help. One connected picture, one real screenshot at the end, then the
same "try the demo" close as before.
