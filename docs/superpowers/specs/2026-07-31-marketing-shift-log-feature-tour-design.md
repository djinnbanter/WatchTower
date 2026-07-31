# WatchTower marketing home: Shift Log feature tour

**Date:** 2026-07-31  
**Surface:** `web/marketing` home page (`/`) — Shift Log entries, rail, entry copy  
**Status:** Design approved in chat; pending implementation plan  
**Parent:** `docs/superpowers/specs/2026-07-31-marketing-shift-log-design.md`  
**Related:** `docs/superpowers/specs/2026-07-31-marketing-hero-welcome-design.md` (amended: gauges leave Welcome)

---

## 1. Problem

The home page tells one incident night well enough that the product surfaces
get lost. Readers follow clocks and story beats, but it is hard to say which
WatchTower features they just saw. Context is thin: a beat shows an instrument
without naming the desk surface that owns it.

## 2. Goal

Rewrite the home as a **feature-first Shift Log tour**. Each beat leads with a
named WatchTower surface. The night fixtures stay as proof under that name.
Someone who only reads the rail should still leave with the core desk map.

Success:

- Rail-only skim names Welcome, Live, Issues, Crashes, Overview, Insights,
  Standing orders, End of shift.
- Each product beat answers “what is this surface?” in one plain sentence
  before any night fact.
- No invented features or claims beyond PRODUCT.md / README / DESK fixtures /
  existing `web/marketing/content/product.ts`.

---

## 3. Decisions (locked)

| Decision | Choice |
|---|---|
| Priority | **Feature first**, night as short context under it |
| Tour shape | **Remap** the eight beats (not “same slots, new adjectives only”) |
| Must-have surfaces | **Core desk:** Welcome → Live → Issues → Crashes → Overview → Insights → Standing orders → Close |
| Rail | **Feature rail** — labels are surface names; clocks only in body proof |
| Approach | **Remap + fixed beat recipe** (Approach 2) |
| Scope | Copy + entry remapping + layout moves required by remap. No new card chrome, no motion redesign, no dashboard app changes |

---

## 4. Tour map

| Order | Entry id (proposed) | Rail / h2 | Job | Proof (fixtures only) |
|---|---|---|---|---|
| 1 | `welcome` (was `quiet` brand half) | Welcome | Brand + what WatchTower is | Tagline / hero overview / CTAs. **No gauges.** |
| 2 | `live` | Live | Is the server okay right now? | TPS / MSPT / Heap gauges from DESK live vitals |
| 3 | `issues` (was `spike`) | Issues | Ranked Fix inbox | Lag / attention item from DESK issues + overview attention |
| 4 | `crashes` (was `killed`) | Crashes | Crash / odd-shutdown review | External-kill / crash inbox fixtures |
| 5 | `overview` (was `answer`) | Overview | Grade + attention + next step | Overview grade / attention; two-questions framing ok |
| 6 | `insights` (merge `fills` + `pattern`) | Insights | Patterns over the window | Evening chart + sticky-lag / busy / storage hint as needed |
| 7 | `orders` | Standing orders | Promises + not our job | `PROMISES` / `NOT_OUR_JOB` |
| 8 | `close` | End of shift | Close + CTA | Demo / Modrinth / footnote |

**Merge rule:** today’s `fills` (evening chart) and `pattern` become **one**
Insights beat. Welcome and Live split today’s `quiet`.

Entry ids may keep temporary filenames during implementation if rename churn
hurts; the **public rail/h2 labels** above are the contract.

---

## 5. Beat recipe

Every product beat (Live, Issues, Crashes, Overview, Insights) uses the same
slots:

1. **Rail label** = surface name  
2. **h2** = same surface name (sentence case where multi-word)  
3. **Capability sentence** — what that surface does (plain English)  
4. **Proof line** — night fact or fixture stamp; clocks live here only  
5. **Margin note** — `desk · <Surface>`

Welcome stays brand-first: `h1` **WatchTower**, overview, context strip, CTAs,
scroll cue into Live (not into a nameless night).

End of shift stays close-shaped: short close line + CTAs + footnote. Rail
label **End of shift**.

Standing orders: h2 matches rail; lists unchanged in meaning.

### Draft capability + proof (implementation may humanize lightly)

| Beat | Capability | Proof shape |
|---|---|---|
| Welcome | Watches while the game runs, then tells you what to fix - on the host you already run. | Local-first · NeoForge dedicated · CTAs |
| Live | Live vitals so you can see if the process is healthy without digging logs. | Healthy-band gauges; watching note |
| Issues | A ranked Fix inbox: what’s wrong, how sure, what to try next. | Spike / attention item with body clock if useful |
| Crashes | Crash and odd-shutdown review in plain English, with the evidence beside it. | Kill / crash fixture; clock in body only |
| Overview | One desk answer: grade, what’s loud, restart advice you run yourself. | Grade + attention from DESK |
| Insights | Schedule and load patterns so you see the busy window, not one sample. | Evening chart + window / sticky-lag proof |
| Standing orders | What we promise, and what we don’t do. | Existing promise / boundary lists |
| End of shift | Try the desk or grab the jar. | Demo + Modrinth + footnote |

Voice: ops desk, short sentences, contractions ok, no hype, hyphen not em dash.
Run a **light** anti-AI humanizer pass on final user-facing strings.

---

## 6. Layout moves

- **Welcome:** brand stack + CTAs only; remove gauges from this beat.  
- **Live:** receives quiet gauges + Live vitals caption.  
- **Issues / Crashes / Overview:** keep instruments; rename headlines and rail.  
- **Insights:** evening chart moves here from fills; pattern proof folds in.  
- **Standing orders / End of shift:** same jobs; rail labels match §4.  
- Layout kinds (`split` / `bleed` / `ledger` / `close`) may follow content;
  no requirement to invent new layouts.

`night.ts` (or successor) updates: stamps may become `null` for feature-rail
beats, or stamps stay internal for fixture binding but **railLabel** is always
the surface name. User-visible rail never shows `18:20`-style clocks.

Scroll cue and any “one night on the desk” framing should retarget: this is a
**desk tour with night proof**, not a clock-led story.

---

## 7. Parent spec amendments

Relative to `2026-07-31-marketing-shift-log-design.md`:

- Story priority flips from incident chronology to **named surface tour**.  
- Rail ticks are **feature names**, not clock stamps.  
- Eight-entry count stays; contents remapped as in §4.  
- Four authored motion moments may keep their emotional beats if they still
  attach to Issues / Crashes / Insights / Close; do not invent new motion for
  this rewrite.

Relative to `2026-07-31-marketing-hero-welcome-design.md`:

- Welcome remains brand-first.  
- **Amendment:** live gauges move to the **Live** beat, not the Welcome
  viewport. Hero welcome proof is copy + CTAs only.

---

## 8. Boundaries

**In scope**

- Entry remapping, rail labels, headlines, capability/proof copy  
- Moving gauges and evening chart to match the tour map  
- Content constants in `web/marketing/content/*` as needed  
- Light humanizer pass on marketing strings  

**Out of scope**

- Extra beats (Mods, Backups, Support, Spark deep, Join clinic)  
- New marketing chrome / card systems  
- Motion system redesign  
- Dashboard (`web/dashboard`) behavior changes  
- Invented product claims  

---

## 9. Checks

- Rail labels match h2 surface names for every beat.  
- Skimming the rail alone lists the six product surfaces plus Welcome /
  Standing orders / End of shift.  
- Clocks appear only in body proof, never on the rail.  
- Claims trace to PRODUCT.md / README / DESK / product.ts.  
- Marketing preview / build still loads; no CSS or oversized SVG regressions.  

---

## 10. Plain-English summary (what the visitor gets)

The home page stops reading like a mystery night log. You meet WatchTower,
then walk the real desk: Live, Issues, Crashes, Overview, Insights. Each stop
says what that screen is for, then shows a piece of a real night as proof.
Promises and a clear close finish the shift. You leave knowing what WatchTower
offers, not only how one evening went.
