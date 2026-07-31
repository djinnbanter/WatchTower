# Marketing How it works: operating-model Shift Log

**Date:** 2026-07-31  
**Surface:** `web/marketing` — `/how-it-works`  
**Status:** Design approved in brainstorm (approach 1)  
**Related:**  
`docs/superpowers/specs/2026-07-31-marketing-shift-log-design.md`,  
`docs/superpowers/specs/2026-07-31-marketing-shift-log-feature-tour-design.md`,  
`docs/superpowers/specs/2026-07-31-marketing-feature-first-copy-design.md`,  
`docs/superpowers/specs/2026-07-31-marketing-drop-standing-orders-design.md`

---

## 1. Problem

`/how-it-works` is still four identical text bands (loop, disk, port, CLI). That
is the same catalog texture the home audit rejected. Home is now a Shift Log
feature tour. How it works still looks like an early draft and does not teach
the operating model with the same craft.

## 2. Goal

Remake How it works as a **second Shift Log**: same shell as home, different
job. Rooms walk **how WatchTower runs on the host** (drop → wizard → loop →
disk → CLI → close). Not a second Features page. Not a trust/promises
page.

After the tour, a visitor can answer: where the jar goes, what first-run does,
how watch → scan → fix works, where files live, and what to use if Minecraft
will not boot. (Port / localhost safety: FAQ / Install; Desk room cut — see
`2026-07-31-marketing-how-drop-dashboard-room-design.md`.)

## 3. Decisions (locked)

| Decision | Choice |
|---|---|
| Page job | Operating-model tour (brainstorm option C) |
| Room spine | Mix of A + B (see §5) |
| Chrome | Same `ShiftLog` + `ShiftEntry` shell as home (option A) |
| Right column | Hybrid mechanism plates + sparse desk peek (option B) |
| Trust / promises | Out of this page (option A). Standing Orders relocation is separate. |
| Implementation | Sibling tour (approach 1). Do not generalize home into a multi-tour engine. |
| Copy voice | Feature/mechanism-first, teen-readable; same house rules as home |

## 4. Design read

Reading this as: **marketing mechanism page for Minecraft dedicated-server
admins**, Night Watch Desk language (Geist + JetBrains Mono, Signal Blue /
Lantern Amber, 2/4/6px radii), extending the Shift Log — **not** a greenfield
glass / mesh / Awwwards rebuild.

`DESIGN.md`, `PRODUCT.md`, and home Shift Log craft win on materials and chrome.
Attached taste skills inform hierarchy, anti-slop, and motion restraint only.

## 5. Room spine

Ordered entries:

1. **Drop** — jar in `mods/`; pointer to Install / Modrinth (not a full Install
   rewrite)
2. **First run** — wizard path: account → options → Initial discovery →
   backups → security
3. **Loop** — Watching → Scanning → Fix inbox as one room with three beats
4. **On disk** — `watchtower/` stays on the host unless the operator opts into
   a network feature
5. **CLI** — optional disaster-recovery when the game will not boot
6. **Close** — demo + Modrinth CTAs (demo opens in a new tab)

**Supersession (2026-07-31):** The former **Desk / Dashboard** room (`:8787`
port callout) was cut. See
`docs/superpowers/specs/2026-07-31-marketing-how-drop-dashboard-room-design.md`.
Spine is now drop → wizard → loop → disk → CLI → close.

### Explicitly not rooms

- Live / Issues / Crashes / Overview / Insights feature tours (home owns those)
- Promises / not-our-job
- Fabric shipping claims
- Cloud / fleet promises

## 6. Copy

### Voice

- Short sentences. Plain words. Contractions OK where natural.
- Left column teaches **how it works**. Right column proves. Do not narrate
  fixture incidents on the left.
- No hype, no ops poetry, no fake urgency.
- Hyphens only in user-facing strings (no em dashes / en dashes).
- PRODUCT.md / wiki only. No invented capabilities.
- Loader-agnostic wording (“dedicated host”). Do not claim Fabric as shipping.
- Sentence-case headings.

### Shape per room

1. `h2` = room name
2. One `capability` line
3. `brings` list (2–4 short title + one sentence) where useful; Drop and Close
   may stay shorter
4. Optional margin note — sparse, not every room

### Content homes

- Primary strings: `web/marketing/content/how-it-works.ts` (`HOW` object)
- Meta + sources: `web/marketing/content/how-night.ts`
- Shared CTAs / links / footnote: reuse `content/product.ts`
  (`DEMO_URL`, `LINKS`, `FOOTNOTE` if still accurate)
- Loop captions: reuse `READOUTS` unless How-specific wording is needed

### Draft voice (direction; final strings in implementation)

- Drop: “Drop the jar in `mods/`. Restart once. That’s the install.”
- Loop: “While the game runs, WatchTower watches, scans, and fills a fix inbox
  with next steps.”
- Desk: “Open the dashboard on port 8787. Prefer localhost or an SSH tunnel.
  Change the default login.”

## 7. Visuals

### Right column (hybrid)

| Room | Proof |
|---|---|
| Drop | Mono path plate: `mods/watchtower-….jar` + one-line restart note |
| First run | Vertical step strip (5 labels), hairline + Signal Blue on current step. No fake form UI. |
| Loop | Signature: thin Signal Blue path Watching → Scanning → Fix inbox + readouts. Optional small Issues desk peek under Fix (fixture bands only). |
| On disk | Compact `watchtower/` tree (`ops-cache`, `state`, spark uploads, support zips) |
| Desk | Port callout `:8787` + three hard rules (localhost/SSH, do not expose, change password) |
| CLI | Terminal-tone plate: one DR command example + wiki link. Labeled optional / when game will not boot. |
| Close | CTA row only (match home close; demo `newTab`) |

### Keep

- Geist + JetBrains Mono; 2/4/6px radii; tonal `ink` / `plate` / `ember` bands
- `ShiftEntry` split layout; sparse margin notes
- Scarce Signal Blue; lantern for brand warmth only

### Ban (home audit lessons)

- Equal catalog bands with only lift reveals
- Glow-orb / dot-grid wallpaper spam
- Icon-in-rounded-square next to “Watching”
- Periwinkle / peach light-mode mush
- Non-interactive card chrome; large SaaS radii; decorative scroll cues

### Band sketch

| id | band | layout |
|---|---|---|
| `drop` | ink | split |
| `wizard` | plate | split |
| `loop` | ember | split |
| `disk` | plate | split |
| `desk` | ink | split |
| `cli` | plate | split |
| `close` | ink | close |

## 8. Motion

At most three authored beats, all gated on `prefers-reduced-motion`:

1. **Loop path** — page signature (draw / progress Watching → Scanning → Fix)
2. **Entry enter** — short rise + fade once (existing Reveal / ShiftEntry)
3. **One calm accent** — wizard step highlight or desk port plate; no infinite
   decoration

Under reduced motion: loop path appears complete immediately; no looping
ornament.

## 9. Architecture (approach 1)

Sibling tour. Mirror home composition; do not refactor home into a shared
multi-tour engine.

### Files (expected)

- Replace: `web/marketing/app/how-it-works/page.tsx` — compose `ShiftLog` +
  entries
- Create: `web/marketing/content/how-it-works.ts`
- Create: `web/marketing/content/how-night.ts`
- Create: entry components under `web/marketing/components/entries/how/`
  (`drop.tsx`, `wizard.tsx`, `loop.tsx`, `disk.tsx`, `desk.tsx`, `cli.tsx`,
  `close.tsx`)
- Create: mechanism plates under `web/marketing/components/how/`
  (`mods-plate.tsx`, `wizard-steps.tsx`, `loop-path.tsx`, `disk-tree.tsx`,
  `port-callout.tsx`, `cli-plate.tsx`)
  Reuse Issues desk peek from existing desk components only in the Loop room.
- Extend: marketing audit script(s) so How-it-works strings get the same
  no-em-dash / sources checks as the home tour
- Reuse: `ShiftLog`, `ShiftEntry`, `Cta` (`newTab`), `MarginNote`, `Reveal`,
  Issues desk peek only where specified

### Page chrome

Nav label and route stay `/how-it-works` / “How it works”. Metadata title
unchanged. No sticky timeline rail required (home Shift Log is already an
ordered entry list).

## 10. In / out of scope

**In**

- Full remake of `/how-it-works` as the 7-room operating-model Shift Log
- New copy, meta, plates, entries, audit hooks
- Drop → Install / Modrinth links; CLI → wiki DR link
- Demo CTA opens in a new tab

**Out**

- Relocating promises / not-our-job onto this page
- Changing home rooms, Features, or Install beyond Drop’s pointer
- Dashboard product behavior changes
- Fabric / cloud / fleet claims
- Approach 2 (configurable tour engine)
- Fully interactive wizard or live CLI

## 11. QA / success

- Desktop + mobile: split rooms readable; plates do not blow the layout
- Light / dark / black: no pastel glow mush; accent scarce
- Reduced motion: loop signature static or instant-complete
- Links work: Install, wiki, Modrinth, demo (`newTab`)
- After implementation: run Impeccable `detect.mjs` on changed marketing targets
- Manual check: page reads as “how it runs,” not a second feature catalog

**Success:** A visitor who already saw the home feature tour understands the
host-side operating model without re-reading Features.

## 12. Plain-English summary (end user)

How it works becomes a short scroll tour, same feel as the home desk tour, that
shows how WatchTower actually lives on your server: drop the jar, run first
setup, watch while the game runs, keep files on disk, open the local dashboard
safely, and fall back to the CLI if Minecraft will not start. It does not rehash
every feature, and it does not pitch cloud or take control of your host.
