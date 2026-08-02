# WatchTower marketing home page: The Shift Log

**Date:** 2026-07-31
**Surface:** `web/marketing` — home page (`/`) and the shared marketing design system
**Status:** Design agreed; **amended 2026-07-31** by feature-tour remapping (see below)
**Amendment:** Story priority and rail are superseded by
`docs/superpowers/specs/2026-07-31-marketing-shift-log-feature-tour-design.md`:
feature-first desk tour (Welcome → Live → Issues → Crashes → Overview → Insights →
Standing orders → End of shift); rail labels are surface names (not clocks);
gauges live on Live; evening chart on Insights. Own-world, motion budget, and
anti-slop rules in this document still apply.

---

## 1. Why we are rebuilding

The current home page is well-built and reads as generated. This is not a polish
problem; it is a structural one.

### Evidence from the audit

Screenshots were taken of all seven sections at 1440×900 in both themes. The
findings below are grounded in `web/marketing/components/sections/*.tsx` as of
this date.

**The page has one texture and repeats it seven times.** Every section is
`border-t border-wt-line` + `py-16 md:py-24` + `mx-auto max-w-[84rem]` + an `h2`
+ an `InstrumentPlate`. Hero, Loop, Questions, Showcases, Promises, Boundaries
and Close all resolve to the same rectangle at the same width with the same
padding. No section is a different size, no section is full-bleed, nothing
changes pace.

**Decorative glow orbs appear six times.** `hero.tsx`, `loop.tsx`, `close.tsx`
and each of the four `showcases.tsx` tiles paint the same two radial gradients —
`--wt-glow-accent` top-right, `--wt-glow-lantern` bottom-left. Combined with
`DeskDotGrid`, this is the exact background recipe that reads as generated.

**Eight generic icons sit in small bordered squares.** `loop.tsx` uses `Eye`,
`ScanSearch`, `Inbox`; `boundaries.tsx` uses `Server`, `ChartColumn`,
`MonitorOff`; `shipping-strip.tsx` adds five more. An eye beside the word
"Watching" and an inbox beside "Fix inbox" carry no information. Icon-in-a-
rounded-square is the single most recognisable signature of a templated page.

**Motion is uniform, so none of it means anything.** `Reveal kind="lift"` wraps
almost every section; `loop.tsx` and `boundaries.tsx` add `motion.li` /
`motion.div` stagger; all of it uses the same `y: 10–18` distance and the same
`[0.16, 1, 0.3, 1]` easing. `loop.tsx` also runs an infinite 7-second gradient
sweep with no meaning attached to it.

**Promises is a 2×2 grid of four equal cells** with an identical amber dash above
each. Nothing is more important than anything else.

**Light mode is the cliché by name.** With `--wt-glow-lantern` and
`--wt-glow-accent` both active over `--wt-bg0: #f2f3f5`, the hero renders as a
peach → lavender → pale-blue pastel wash. `DESIGN.md` bans this explicitly under
"The No AI-SaaS Chrome Rule". The mechanism that produces it is still in the
stylesheet.

**The same CTA pair appears three times verbatim** — hero, close, footer — with
identical labels and identical treatment.

### The root cause

The page is a **catalog**: here is a list of what WatchTower is, in identical
boxes. A catalog in identical boxes is precisely what a generator produces,
because a generator has no opinion about which thing matters most.

WatchTower exists because of one specific bad moment — late at night, TPS is
8.4, something killed the process, and you do not know why. That moment is the
entire product. The page never puts the visitor in it.

### What is worth keeping

- Tight 2–6px radii, hairline borders, mono instrument labels. On-brand and real.
- The desk components (`components/desk/*`) and the baked fixtures. Genuinely good.
- Plain-English voice in `content/product.ts`.
- The `boundaries.tsx` "We do not replace | Use instead" ledger — the one section
  on the page with a real editorial point of view.

---

## 2. Concept

**The home page is one incident night on a NeoForge dedicated server, told in
order, as WatchTower saw it.**

The visitor scrolls through time. Product capability is demonstrated by what the
desk already knew at each moment, never described in a feature list. A thin rail
in the left gutter carries mono timestamps and an amber progress fill, so scroll
position reads as time of night.

Why this defeats the templated look at the root: the page is organised by **when**
rather than by **what**. A component-list generator cannot produce a temporal
spine, because it has no narrative to order things by. Every downstream fix —
varied section shapes, authored motion, a single light source — follows from the
spine rather than being applied as decoration.

### Non-negotiable framing

The rail is only worth building if the timestamps are load-bearing. Every stamp
must mark a real thing in `web/marketing/content/baked/desk.ts`. Decorative
timestamps would make the whole page a gimmick.

---

## 3. Content truth rules

These bind every line of copy on the page.

1. **No invented metrics.** Every number traces to `content/baked/desk.ts`,
   which is itself baked from `web/dashboard/data/*`.
2. **Clock times only, never calendar dates.** The fixture crash filenames carry
   real dates (`crash-2026-06-22_14-33-07-server.txt`). The shift log therefore
   uses times of day only, so the narrative can never contradict a filename.
   Crash filenames are shown verbatim inside the crash ledger and nowhere else.
3. **No weekday claims.** The busy-hour bands in `DESK.insights.busy` carry
   hours, not weekdays. The morning entry claims the 20:00–21:00 UTC pattern and
   nothing beyond it.
4. **Promises and Not-our-job stay verbatim** from `content/product.ts`, which is
   sourced from `docs/ROADMAP.md`.
5. **No testimonials, no download counts, no version numbers hardcoded in copy.**
   Carried over from the existing surface brief.
6. **Advisory framing holds.** Nothing on the page may imply WatchTower restarts
   the server, downloads jars, or edits mods or worlds.

---

## 4. Information architecture: the eight entries

Each entry is an `<li>` in one ordered list. `stamp` is what the rail shows.

### Entry 0 — `quiet` · stamp `18:20`

**Job:** welcome first-time visitors: name WatchTower, say what it is, show a
healthy desk, invite scroll into the night story.

Amendment: `docs/superpowers/specs/2026-07-31-marketing-hero-welcome-design.md`.

Opening on brand (not mid-story) fixes “what am I looking at?”; the calm hook
moves to Entry 1 so the night log still starts quiet.

- `h1`: **"WatchTower"**
- Lead (`TAGLINE`): "The ops desk for your Minecraft server."
- Overview (`HERO_OVERVIEW`): "It watches while the game runs, then tells you
  what to fix - on the machine your server already runs on."
- Context strip (`HERO_CONTEXT`): `Local-first · NeoForge dedicated · is it okay?
  · what next?`
- Layout: left-aligned display type against the rail; bare live gauges to the
  right (big TPS, MSPT + Heap under). Caption: `Live vitals · healthy band`.
- Desk data (`DESK.live.vitals`): TPS `19.99` ok, MSPT `4.7ms` ok, Heap `79%`.
- CTAs: `Open the demo` (primary) + `Get it on Modrinth` (ghost). One of only two
  places the full CTA pair appears in page body.
- Scroll cue (`SCROLL_CUE`) → `#fills`: `Scroll for one night on the desk`

### Entry 1 — `fills` · stamp `19:40`

**Job:** open the night story on calm, then show what continuous watching means
before anything is wrong.

- `h2`: **"Most nights, nothing happens."**
- Body opens: "Then the server fills up. Nothing is wrong yet." then players
  climb and tick time creeps with them. WatchTower is sampling the whole time -
  there is no scan to remember to start and no audit to sit through.
- Data (`DESK.insights.busy` + `DESK.insights.evening` for the chart): peak hours
  19:00–22:00 UTC as before; evening series 15:00–23:00 from fixture averages.
- Layout: **full-bleed**, edge to edge, breaking the 84rem container. Interactive
  evening chart — players as area, MSPT as line.
- Margin note: `sampled continuously · no scheduled audit`

### Entry 2 — `spike` · stamp `22:47`

**Job:** the break. The only place the page raises its voice.

- The number **is** the headline: `118` set in JetBrains Mono at display scale
  with `ms` as a small trailing unit.
- `h2` beneath it: **"Tick time hit 118ms. TPS fell to 8.4."**
- Evidence ledger in mono, from `DESK.issues.bands[0].items[0]` and
  `DESK.overview.attention[0]`:
  - `TPS 8.4` · `MSPT 118ms` · `4 players online`
  - `World pregen was active.`
  - `Last command: /chunky continue.`
- Body: the differentiating claim, which is true and which a bare graph cannot
  make — WatchTower ties the spike to what was running when it happened.
- Layout: full-bleed, dark, generous vertical space, numeral dominating.
- Background temperature: `data-temp="hot"` (see §6).

### Entry 3 — `killed` · stamp `23:12`

**Job:** crashes in plain English, earned rather than asserted.

- `h2`: **"Then the process died without writing a crash log."**
- Body: the JVM never got the chance, so `latest.log` just stops. WatchTower
  found the host OOM-killer evidence instead and said so in a sentence.
- Data: `DESK.issues.bands[0].items[1]` — "External kill - out-of-memory" /
  "Host OOM killer evidence in the last scan window."
- Supporting crash ledger from `DESK.crashes.items`, filenames verbatim, plus
  `DESK.crashes.unreviewed` = 12.
- Motion: the live indicator that has been pulsing green since Entry 0 goes flat
  and dark here. The desk stops. (See §7, moment 4.)
- Background temperature: `data-temp="hot"`.

### Entry 4 — `answer` · stamp `23:20`

**Job:** the payoff, and the product's money shot.

- `h2`: **"You open WatchTower. It already knew."**
- Body answers both product questions in context, so the old `Questions` section
  dissolves into the story: is the server okay right now, and what should I fix
  next.
- The dual-pane desk gets the most room of anything on the page:
  - Grade `D` / `Critical` / "Needs attention" (`DESK.overview`)
  - `38 low-TPS minutes (24h). MSPT p95 134ms. Restart with caution.`
  - Restart verdict `Caution` — "Players online and pregen active. Wait for a
    quieter window if you can." This is the advisory-only proof point.
  - Ranked fix inbox from `DESK.issues.bands`, 2 critical + 3 warning.
- Explicit line, because it is the thing an admin actually feels: you did not
  have to grep anything.
- Background temperature: returns to `cool`.

### Entry 5 — `pattern` · stamp `08:05`

**Job:** the product stops being reactive.

- `h2`: **"By morning it isn't one bad night. It's a pattern."**
- Data:
  - `DESK.insights.stickyLag` — "Sticky lag after players left - MSPT stayed hot
    for 45 min (peak 72 ms)."
  - `DESK.insights.busy` — the 20:00–21:00 UTC band is the heaviest hour.
  - `DESK.insights.storageHint` — "Disk use rose 6.2% since last check (12.4 GB
    less free)."
  - `DESK.backups.rows` — `mods-snapshot` is Stale, no run in 9 days.
- Layout: wide ledger of hours, right-aligned numerals, hairline rules. No cards.
- Margin note: `insights · 7d window`

### Entry 6 — `orders` · **no stamp**, rail reads `STANDING ORDERS`

**Job:** the contract. Time deliberately stops.

The missing timestamp is the point — it signals this entry is not story. The rail
tick renders hollow instead of filled here.

- `h2`: **"Standing orders."**
- Two columns in one ledger:
  - Left: the four `PROMISES` as a numbered list, verbatim.
  - Right: the three `NOT_OUR_JOB` rows as the We-do-not-replace / Use-instead
    table, verbatim. No icons.
- This merges the current `promises.tsx` and `boundaries.tsx`, keeping the good
  editorial device and giving it more weight.

### Entry 7 — `close` · **no stamp**, rail reads `END OF SHIFT`

**Job:** convert.

- `h2`: **"Point it at your server and see what it finds."**
- Body: the demo is the real dashboard on sample data; click through every
  surface before installing anything.
- CTAs: `Open the demo` + `Get it on Modrinth`. Second and last appearance.
- Footnote, verbatim from `FOOTNOTE`: "Free forever on your machine.
  GPL-3.0-or-later. Runs where the server runs."

---

## 5. The rail

The signature element, split across `components/shift-log/rail-track.tsx`,
`rail-shortcuts.tsx`, and the stamp markup inside `entry.tsx`.

### Behaviour

The rail reads as one object but is three parts with different positioning.
Keeping them separate is what makes it work.

**Part 1 — the track.** A single element spanning the full document height of the
log container, `position: absolute` in the gutter. Not sticky, not fixed.

- A 1px vertical line in `--wt-line` runs its full height.
- An overlaid segment in `--wt-lantern` grows from the top down to the reader's
  scroll progress through the log. This is the lantern moving down the tower, and
  it is the **only** light source on the page. Only this fill's `scaleY` animates,
  so it stays on the compositor and costs nothing per frame.
- Because the track is absolute over the whole log, it needs no scroll-position
  maths to stay aligned with content.

**Part 2 — the stamps and ticks.** These are **not** in the rail. Each entry
renders its own stamp and tick as part of its own markup, pushed into the gutter
on desktop with a negative margin. This is why the rail cannot be sticky: ticks
must sit at their entry's position in the document.

- Stamped entries render a filled tick; unstamped entries (`orders`, `close`)
  render a hollow tick.
- The entry currently in view renders its stamp in `--wt-text` at full weight;
  the others sit at `--wt-text-low`, switched by an `IntersectionObserver` in
  `use-log-progress.ts`.

**Part 3 — the shortcut nav.** A compact `Demo` / `Install` pair, and the only
part that is `position: sticky`, pinned near the bottom of the viewport inside
the gutter for the length of the log. This is the skimmer's permanent escape
hatch.

The sticky shortcut nav takes `top`/`bottom` offsets that clear the sticky site
header, so the two never overlap at any scroll position or viewport height.

### Layout

- Desktop (`≥1024px`): rail occupies an 88px gutter to the left of the content
  column. Content column max-width stays 84rem, offset right.
- Tablet (`768–1023px`): rail collapses. Each entry's stamp renders inline above
  its heading, mono, with a short lantern rule beside it.
- Mobile (`<768px`): same as tablet.

### Accessibility

- The log is a single `<ol>`; each entry is an `<li>` containing its own `<h2>`
  (except Entry 0, which carries the `<h1>`).
- Each entry's timestamp lives in that entry's DOM, positioned into the gutter by
  CSS on desktop. It is **not** duplicated in the rail, so there is no repeated
  announcement.
- The rail line, fill and ticks are decorative and carry `aria-hidden="true"`.
- The rail's Demo / Install pair is a `<nav aria-label="Shortcuts">`.
- Heading order is `h1` → `h2` ×7, uninterrupted.

---

## 6. Type, colour and atmosphere

### Type scale additions (`styles/globals.css`)

| Token | Value | Use |
|---|---|---|
| `--wt-fs-hero` | `clamp(2.75rem, 7.5vw, 6rem)`, lh `0.94`, tracking `-0.04em` | Entry 0 `h1` |
| `--wt-fs-entry` | `clamp(1.75rem, 3.6vw, 2.75rem)`, lh `1.05`, tracking `-0.03em` | Entry `h2` |
| `--wt-fs-numeral` | `clamp(4rem, 16vw, 13rem)`, lh `0.82`, tracking `-0.05em` | Entry 2's `118` |

`--wt-fs-numeral` uses JetBrains Mono at weight 600 with `tabular-nums`. Mono at
display scale is rare, unmistakably technical, and is the strongest single
typographic move available here.

**Removed:** the uppercase tracked eyebrow above every heading. Mono labels
survive only where they are a genuine instrument caption inside a desk component.

#### The 12px label floor

Every mono label on the marketing site has a **12px (`0.75rem`) minimum**. The
current site runs instrument captions at `0.6875rem` (11px) and `0.625rem`
(10px), and severity chips at `0.5625rem` (9px). At dashboard viewing distance
that density is the point; on a marketing page it reads as sub-legible
micro-type, which is a recognised tell in its own right.

- Applies to `web/marketing` only. The dashboard keeps its existing sizes.
- Includes labels inside the marketing copies of the desk components, so the
  desk visuals on this site will be fractionally less dense than the real
  product. That is an accepted trade.
- Mono labels keep **wide positive tracking** (`0.14em`) at the larger size. The
  combination of small-but-not-tiny mono with generous tracking is what reads as
  system chrome rather than shrunken body text.
- Hierarchy below 12px must come from weight and colour, never from size.

**Added:** `components/type/margin-note.tsx` — mono micro-notes set in the gutter
beside body copy. Field-manual texture, carrying real product detail
(`watchtower/`, `insights · 7d window`).

### Colour

**Delete the glow mechanism entirely.** Remove `--wt-glow-lantern` and
`--wt-glow-accent` and every `radial-gradient` that consumes them, across
`hero.tsx`, `loop.tsx`, `close.tsx`, `showcases.tsx` and `.wt-field` in
`globals.css`. Remove `DeskDotGrid` from the home page. The rail's amber fill
replaces all of it.

**Light mode becomes paper.** Warm off-white stock with ink text, hairlines, and
no glow of any kind — a field manual printed on paper. This removes the pastel
wash by deleting its mechanism rather than tuning it.

| Token | Current | New |
|---|---|---|
| `--wt-bg0` | `#f2f3f5` | `#f4f2ee` |
| `--wt-bg1` | `#ffffff` | `#fbfaf8` |
| `--wt-bg2` | `#e8eaef` | `#eae7e1` |
| `--wt-bg3` | `#d7dbe3` | `#ddd9d1` |
| `--wt-text` | `#171a20` | `#16181d` |
| `--wt-text-mid` | `#4d5562` | `#4a5058` |
| `--wt-text-low` | `#747d8b` | `#696e76` |
| `--wt-line` | `rgba(23,26,32,0.1)` | `rgba(22,24,29,0.14)` |
| `--wt-glow-lantern` | `rgba(180,105,14,0.12)` | *(removed)* |
| `--wt-glow-accent` | `rgba(27,79,224,0.1)` | *(removed)* |

`--wt-accent` (`#1b4fe0`) and `--wt-lantern` (`#b4690e`) are unchanged, so the
light theme still matches the dashboard's light theme identity.

#### Measured contrast against paper `#f4f2ee`

Computed with the WCAG 2.x relative-luminance formula. These are the values the
implementation must reproduce.

| Token | Hex | Ratio | Verdict |
|---|---|---|---|
| `--wt-text` | `#16181d` | 15.9:1 | AA / AAA, all sizes |
| `--wt-text-mid` | `#4a5058` | 7.3:1 | AA / AAA, all sizes |
| `--wt-text-low` | `#696e76` | 4.6:1 | AA normal text |
| `--wt-accent` | `#1b4fe0` | 5.8:1 | AA normal text |
| `--wt-lantern` | `#b4690e` | 3.8:1 | **Large text only** |

Two constraints follow from this table:

- `--wt-text-low` must be `#696e76`, not the `#6f747c` first considered. That
  lighter value measures 4.2:1 and fails AA for normal text.
- **In the light theme, `--wt-lantern` may not be used for normal-size text.** At
  3.8:1 it clears AA only for large text (≥24px, or ≥18.66px bold) and for
  non-text graphics. It is fine for the rail fill, the rail's active tick, and
  display-scale numerals. Anywhere a mono micro-label currently uses lantern at
  11px, the light theme must fall back to `--wt-text-mid`.

### Night temperature

Entries 2 and 3 sit on a fractionally warmer, darker background than the rest of
the page. Implemented as a `data-temp` attribute on the entry with a CSS
transition — no JavaScript interpolation, no scroll listener.

- Dark theme: `cool` = `#14171e` (unchanged `--wt-bg0`), `hot` = `#171519`.
- Light theme: `cool` = `#f4f2ee`, `hot` = `#f1ece5`.
- Transition `background-color 600ms var(--wt-ease)`.

The shift is deliberately near-subliminal. It should be felt, not noticed.

### Elevation: hairlines only, no drop shadows

The home page carries **zero `box-shadow` for elevation**. Depth comes from the
tonal surface ladder plus a single hairline, which is already how `DESIGN.md`
describes the system — the marketing site simply stopped obeying it.

- `--wt-shadow` (currently `0 1px 0 inset, 0 18px 48px rgba(0,0,0,0.45)`) is not
  applied anywhere on the home page. `InstrumentPlate` must expose a shadowless
  mode, or the entries must not use it.
- Surface ladder in dark: `#14171e` page → `#222833` surface → `#2e3543` well.
  Separation between adjacent steps must be visible without a shadow; if it is
  not, the ladder is wrong, not the shadow.
- Hairline `--wt-line` is the only elevation signal. A second, stronger hairline
  (`--wt-line-strong`) marks interactive or focused surfaces.

This is the single largest find-and-delete in the redesign, and it removes the
glow, the glass reflex, and the stacked-marketing-shadow look in one pass.

### Radius hierarchy

`DESIGN.md` already defines 2 / 4 / 6px. The rule the marketing site must add is
that **radius scales with element size and nested radii differ from their
parent**:

- Structural surfaces and full-bleed entries: square (0) or 2px.
- Plates and wells: 4px.
- Small controls inside a plate: 2px, never matching their container.
- Buttons: 4px. No pills anywhere.

### Interaction states

Every interactive element on the page defines all of these. Missing microstates
are stronger evidence of an unfinished page than any decorative flaw.

| State | Requirement |
|---|---|
| Default | As specified |
| Hover | Visible change in ~150ms; brightness or hairline shift, not motion |
| `:focus-visible` | 2px `--wt-accent` outline, 2px offset, plus the `--wt-accent-soft` ring already in `globals.css`. Never removed. |
| Active | Distinct from hover; instant, no transition |
| Disabled | Only where a control can actually be disabled; not decorative |
| Visited | Left at browser default for external links |

The rail's shortcut nav, both CTAs, every nav link and the crash-ledger rows all
qualify. Keyboard traversal of the whole page must be visible at every stop.

### Brand relationship to the dashboard

The marketing site keeps the dashboard's palette, both fonts, and the tight
radius scale, so it reads as the same product. It is allowed its own **expression
layer**: larger display type, asymmetric editorial layout, full-bleed sections,
marginalia, and display-scale numerals. None of those move into the dashboard.

---

## 7. Motion

**Total budget: four authored moments. Nothing else on the page moves.**

Removing the blanket fade-up is what makes the remaining four mean anything. This
is the single highest-leverage motion change in the redesign.

1. **The rail fill** follows scroll progress through the log, via `useScroll` on
   the log container with `offset: ['start start', 'end end']`, smoothed with a
   spring. The page's through-line.
2. **Entry 0's vitals tick gently** — small, slow value jitter within a healthy
   band. The server is alive and fine. Establishes the baseline that Entry 3
   later takes away.
3. **Entry 2's numeral counts up** from a healthy tick time to `118` as it enters
   the viewport, once, with the MSPT sparkline drawing alongside it. The one
   violent moment on an otherwise calm page.
4. **Entry 3 flatlines.** The green pulse indicator running since Entry 0 goes
   dark and static. The process death expressed as motion rather than described.

### Performance constraints

Scroll reveals are a Cumulative Layout Shift generator: animating content from
`opacity: 0` before its space is reserved fires a shift on every reveal, and
enrolling the LCP element in an opacity-from-zero entry animation delays its
reported paint, because an element is not an LCP candidate until it has visibly
painted. Removing the blanket `Reveal` is therefore a Core Web Vitals fix as much
as a taste one.

Binding rules for the four remaining moments:

- Final dimensions are reserved from first paint; animation happens *inside* the
  reserved box.
- Only `transform` and `opacity` animate. The rail fill animates `scaleY`.
- Nothing rests below 100% opacity.
- Anything that fires on scroll fires **once** and unobserves. No re-triggering
  on re-entry.
- Total animation in the initial viewport stays under ~800ms, with no single
  animation over 500ms.
- No element in the initial viewport animates its opacity from zero, so the LCP
  candidate is never delayed.

`motion/react` stays, because the count-up and the spring-smoothed rail fill
justify it. If the rail fill is the only remaining consumer after implementation,
reimplement it with a CSS scroll-driven animation and drop the dependency.

### Removed

- `Reveal` on every section. `components/reveal.tsx` is retired from home page
  usage; content is simply present when you reach it.
- The infinite 7-second gradient sweep in `loop.tsx`.
- All `motion.li` / `motion.div` stagger in `loop.tsx` and `boundaries.tsx`.
- The `y: 10–18` fade-up on the hero readout inbox rows.

### Reduced motion

Under `prefers-reduced-motion: reduce`: the rail fill renders static at full
height, the vitals hold at their fixture values, the numeral renders as `118`
immediately, and the Entry 3 indicator renders in its final dark state. Every
entry remains fully legible and the narrative still reads.

---

## 8. File structure

### New

| File | Responsibility |
|---|---|
| `content/night.ts` | The eight entries: id, stamp, rail label, and a source trace for every fact |
| `components/shift-log/log.tsx` | The `<ol>` container; mounts the track and shortcut nav, provides progress context |
| `components/shift-log/rail-track.tsx` | Absolute full-height line + animated lantern fill |
| `components/shift-log/rail-shortcuts.tsx` | Sticky Demo / Install pair in the gutter |
| `components/shift-log/entry.tsx` | `<li>` wrapper: renders its own stamp and tick into the gutter, sets `data-temp`, applies layout variant (`split` / `bleed` / `ledger`) |
| `components/shift-log/use-log-progress.ts` | Scroll progress value + active entry index via `IntersectionObserver` |
| `components/type/display-numeral.tsx` | Display-scale mono numeral with optional count-up |
| `components/type/margin-note.tsx` | Gutter marginalia |
| `components/evening-chart.tsx` | Full-bleed players-area + MSPT-line chart for Entry 1 |
| `components/entries/quiet.tsx` | Entry 0 |
| `components/entries/fills.tsx` | Entry 1 |
| `components/entries/spike.tsx` | Entry 2 |
| `components/entries/killed.tsx` | Entry 3 |
| `components/entries/answer.tsx` | Entry 4 |
| `components/entries/pattern.tsx` | Entry 5 |
| `components/entries/orders.tsx` | Entry 6 |
| `components/entries/close-entry.tsx` | Entry 7 |

### Modified

| File | Change |
|---|---|
| `app/page.tsx` | Compose the log from the eight entries |
| `styles/globals.css` | New type tokens, paper light theme, remove glow tokens and `.wt-field` |
| `components/site-header.tsx` | Nav labels reviewed against the new page; no structural change |
| `content/baked/desk.ts` | Additive only, if an entry needs a field that is not yet baked |

### Retained

Per the standing preference not to delete files, nothing is removed from the
tree. Verified import graph as of this date:

- `components/sections/hero.tsx`, `loop.tsx`, `questions.tsx`, `showcases.tsx`,
  `promises.tsx`, `boundaries.tsx`, `close.tsx` are imported **only** by
  `app/page.tsx`. Once that file is rewritten they become unreferenced. They stay
  in the tree.
- `components/desk-dot-grid.tsx` is imported only by `sections/hero.tsx`, so it
  also becomes unreferenced. It stays in the tree.
- `components/reveal.tsx` remains in active use by `app/how-it-works/page.tsx`
  and `app/features/page.tsx`. It is retired from the home page only, and must
  not be changed in a way that breaks those two pages.
- `components/sections/shipping-strip.tsx` is imported only by `showcases.tsx`
  and becomes unreferenced with it.

Implementation note: unreferenced components may trip lint rules for unused
exports or unused imports. If the marketing lint config flags them, they move to
`components/sections/_archive/` with imports left intact rather than being
deleted.

---

## 9. Out of scope

- `/features`, `/install`, `/how-it-works`, `/faq`, `/demo`. These continue to
  use the existing sections and will get a conformance pass under a separate
  spec once the home page and the shared system have landed.
- The dashboard at `web/dashboard`. No token or component changes propagate to it.
- `DESIGN.md`. The marketing expression layer is additive; the design system
  document does not change.

---

## 10. Success criteria

The redesign is done when all of the following hold.

**Structural**
- No two adjacent entries share the same layout shape.
- At least two entries are full-bleed and break the 84rem container.
- The full CTA pair appears exactly twice in the page body, plus once in the rail.

**Anti-tell checklist** — every item must be zero:
- Radial glow gradients on the home page: 0
- Generic icons inside bordered squares: 0
- Dot-grid backgrounds: 0
- Sections wrapped in the same plate component in sequence: 0
- Elements using a generic fade-up reveal: 0
- Equal-weight card grids with no hierarchy: 0

**Content**
- Every number on the page traces to `content/baked/desk.ts`.
- No calendar dates appear outside verbatim crash filenames.
- Promises and Not-our-job match `content/product.ts` word for word.

**Quality**
- WCAG 2.2 AA contrast on every text token in both themes.
- Heading order is `h1` → `h2` ×7 with no skips.
- The page is fully legible and the narrative intact under
  `prefers-reduced-motion: reduce`.
- The page is fully legible with JavaScript disabled — the rail degrades to
  static, entries render in order.
- No layout shift from the rail on load.

**The subjective test**, which is the one that actually matters: a Minecraft
server admin who has never seen WatchTower should be able to describe one
specific moment from the page to another admin afterwards. Right now there is no
such moment.

### The negative list

Silent constraints revert to defaults, so the prohibitions have to be written
down as explicitly as the requirements. None of the following may appear in
`web/marketing` on the home page:

- `radial-gradient` used as decorative atmosphere
- `box-shadow` used for elevation
- `backdrop-filter` outside the site header
- `bg-clip-text` / gradient-filled text
- Any Lucide icon inside a bordered or tinted square
- `Sparkles`, `Zap`, `Rocket`, `ArrowRight` as a glyph in copy
- A raw `→` character welded into a link or button label
- Border radius above 6px, or any pill
- An all-caps tracked eyebrow above a section heading
- Any text below 12px, mono or otherwise
- A card grid whose tiles are equal weight and equal height
- `whileInView` fade-up applied by `.map()` across a list
- Any invented metric, testimonial, download count, or logo wall

### Silhouette check

Before sign-off, render the home page as a ~200px-wide black-on-white silhouette
— blocks for sections, lines for text, no colour, no type — and do the same for
five other server-tooling and dev-tool sites. If the WatchTower silhouette is not
immediately identifiable, the structure has not changed enough, regardless of how
the palette looks.

---

## 11. Appendix: external research

Full report from the [AI slop traits research](cd4b6511-70eb-4ee2-b964-f73f1ccdf9e8).
Summarised here because several findings changed this spec.

### The finding that reframes the rest

The naive rule — ban purple, ban Inter — is empirically wrong. When
[ai-design-tells](https://github.com/hankimis/ai-design-tells) recalibrated its
detector against 202 human-designed, design-led sites, its strongest signals
collapsed: Stripe paints 123 purple accents and scores clean, and Linear ships
Inter. Meanwhile a generated page with *less* purple scores worse.

What separates them is a **craft-credit model**. A page earns credit for a
radius hierarchy, optical tracking on display type, a designed `:focus-visible`
state, and a real type system — and that credit offsets cosmetic defaults. The
templated look is **a bundle of defaults with nothing compensating**.

Consequence for us: the effort belongs in structure, elevation, radius
hierarchy, microstates and rationed colour — not in changing hues. That is why
§6 gained elevation, radius and interaction-state subsections, and why the
palette is barely touched outside the light theme.

### Measured norms from ~199 design-led sites

Useful as calibration, not as rules.

- Real sites use **many radii and many type sizes**, and **almost never centre
  everything**. Centring is not itself the tell; the absence of any other spatial
  decision is.
- Only **13%** of real primary buttons carry any shadow.
- Dark themes use a **tinted near-black** (`#0b0f19`, `#18181b`), never pure
  `#000`, and off-white body text, never pure `#fff`. WatchTower's `#14171e` and
  `#f3f5f8` already sit correctly here.
- Content max-width median is 1200px. Our 84rem (1344px) is wider but within
  range for a page with full-bleed entries.

### Corpus frequencies

From [Adrian Krebs' scan of 1,590 Show HN landing pages](https://adriankrebs.ch/blog/design-slop/):
22% trigger four or more slop patterns, 32% trigger two to three. Individual
tells present on the current WatchTower home page and their corpus frequency:

| Tell | Frequency | On our page |
|---|---|---|
| Hero + three equal icon-topped cards | ~20% | Loop section |
| Centre-everything hero | 23.5% | Hero |
| Glassmorphism by reflex | 17% | Site header |
| Coloured border stripe on cards | 13% | Promises amber dashes |
| Coloured glow shadows | 4.3% | Six radial glows |

One designer quoted in that study: *"coloured left borders are almost as
reliable a sign of AI-generated design as em-dashes are for text."* The Promises
2×2 uses an amber rule above each cell, which is the same gesture.

### Precedent that matches this direction

[Oxide Computer](https://oxide.computer) is the closest reference for an ops
product and independently arrives at nearly this design: a three-step near-black
surface ladder, **zero drop shadows**, elevation carried by a single hairline
used 5,900+ times, `border-radius: 1px` on every structural element, mono at
10–12px with wide *positive* tracking for all system chrome, sans reserved for
prose at weight 400 only, and an accent colour that behaves like an LED status
indicator rather than a fill. Their diagrams carry figure captions and fault
codes.

Also relevant: [Supabase](https://supabase.com) replaces its entire shadow system
with a three-value border scale; [Vercel](https://vercel.com) sets mono for every
non-prose datum — IDs, SHAs, timestamps — rather than for code; [Netlify](https://netlify.com)
encodes one bit of real meaning in colour (yellow strip = production branch);
[Fly.io](https://fly.io) prints `fly launch` in empty states instead of a button.

The through-line is that each picked a small number of load-bearing rules and
enforced them everywhere. Our equivalents are the rail as sole light source, the
no-shadow elevation rule, and mono-at-display-scale for the one number that
matters.

### Two places this spec deliberately departs from the research

**The hero opens calm, not mid-incident.** Ranked move #7 in the research says
the hero should be a real product state, "ideally mid-incident rather than
all-green." Entry 0 is deliberately all-green. The departure is intentional: the
page as a whole is mid-incident, and the calm opening exists so Entry 2 has
something to break. The underlying requirement — real fixture data, not a
placeholder or a 3D blob — is met. Revisit if testing shows visitors bounce
before Entry 2.

**Four motion moments, not one.** Ranked move #8 says author exactly one moment.
We keep four. Each is tied to information rather than decoration, and moments 2
and 4 are a matched pair — the pulse that establishes life at 18:20 is the same
element that dies at 23:12, so removing either breaks the other. All four obey
the performance constraints in §7.

### Caveats carried from the research

- Source quality varies. The empirical backbone (Krebs' 1,590-site scan, the
  202-site calibration, Anthropic's own guidance) is solid; several supporting
  sources are content-marketing blogs selling design packs, and per-site hex
  values come from third-party style extractions that should be verified against
  the live site before being copied.
- These lists describe mid-2020s model defaults and will decay. The durable asset
  is the method, not the list.
- A pattern is a tell when it is a default reached for without reason, not
  whenever it appears. Restraint executed well is a decision, not timidity.
