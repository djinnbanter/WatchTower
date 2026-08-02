# Marketing copy: feature-first, teen-readable

**Date:** 2026-07-31  
**Status:** Approved in brainstorm (approach 3)  
**Surfaces:** `web/marketing` Shift Log + shared `content/product.ts` strings

## 1. Goal

Make WatchTower marketing **feature-focused** and readable for Minecraft dedicated-server owners who are often under 18.

Left column teaches **what the feature is**. Right column (mock desks) stays the **sample UI proof**. Do not narrate fixture incidents in the left column (no Grade D stories, sticky-lag anecdotes, or MSPT spike “proof” paragraphs).

## 2. Voice

- Short sentences. Plain words. Contractions casual where it fits marketing.
- Explain product jargon once per beat in parentheses when kept (TPS, MSPT).
- No hype, no “ops poetry,” no fake urgency.
- Hyphens only (no em dashes / en dashes in user-facing strings).
- Do not invent features. Stay within PRODUCT.md / wiki.
- Do not claim Fabric as shipping. Prefer loader-agnostic “dedicated host / Minecraft dedicated servers.”

## 3. In / out of scope

**In**

- Welcome: `TAGLINE`, `HERO_OVERVIEW`, `HERO_CONTEXT`
- Tour: Live, Issues, Crashes, Overview, Insights (`capability` + `brings`; drop proofs / fixture lines)
- Standing orders: `PROMISES`, `NOT_OUR_JOB` (+ orders intro if needed)
- Close + footer blurb alignment
- Shared: `TWO_QUESTIONS`, `FOOTNOTE` if wording drifts from the new voice
- Entry components that currently inject `DESK.*` narrative into the left column

**Out**

- Changing mock desk layouts or baked fixture numbers inside cards
- Wiki / PRODUCT.md behavior changes
- Fabric shipping claims

## 4. Page structure (tour beats)

Each of Live, Issues, Crashes, Overview, Insights:

1. Feature `h2`
2. One `capability` line
3. `brings` list (3–4 items: short title + one sentence)
4. Margin note (`desk · …`)
5. Mock UI unchanged on the right

**Remove from left columns**

- All `TOUR.*.proof` usage (delete field or stop rendering)
- Overview: `Grade {letter}…` paragraph and restart-verdict callout
- Insights: `DESK.insights.stickyLag` paragraph

**Welcome**

- Brand-first stack unchanged structurally
- Rewrite tagline / overview / context for the new voice
- CTAs unchanged

**Standing orders**

- Keep promises + not-our-job grid
- Rewrite bodies for teen clarity (privacy, control, not a host panel)

**Close + footer**

- Keep demo + Modrinth CTAs
- Align headline/body with the same voice if needed

## 5. Content home

Primary: `web/marketing/content/product.ts`  
Thin edits: `web/marketing/components/entries/{live,issues,crashes,overview,insights}.tsx` (and close/footer/orders only if strings move)

`night.ts` `sources` arrays that cite DESK narrative for left-column proof should be updated to match (capability / brings / PRODUCT promises only).

## 6. Draft voice (direction samples)

Locked as voice targets in brainstorm; final strings may tighten in implementation as long as meaning and constraints hold.

**Welcome**

- Tagline: `The ops desk for your Minecraft server.`
- Overview: `It watches the server while it runs, then tells you what to fix. Everything stays on the machine you already use.`
- Context: `Local-first · dedicated host · no cloud required`

**Live**

- Capability: `See how healthy the server is right now - ticks, lag, memory, players, and the host PC - without digging through log files.`
- Bring example: `Game vitals` → `TPS (ticks per second), tick lag (MSPT), memory, and player count, color-coded so problems stand out.`

**Overview**

- Capability: `Your home screen after login: a health grade, a short list of what needs attention, and links into the rest of the desk.`
- No grade/restart story on the left. Mock still shows sample grade.

**Promises tone**

- Short titles. Bodies like: `Your files stay on your server. We don't upload logs by default.`

**Close**

- Simple ask: try the demo, then get it on Modrinth.

## 7. Implementation notes (for the later plan)

1. Rewrite `TOUR` capabilities + brings in plain English; remove or null `proof` and stop rendering it.
2. Strip Overview / Insights DESK narrative paragraphs from entries.
3. Rewrite Welcome / PROMISES / NOT_OUR_JOB / TWO_QUESTIONS / close as needed.
4. Run marketing copy through a humanizer pass (no AI filler, no em dashes).
5. Verify: `node scripts/audit-shift-log.mjs` (no em/en dashes in `content/`).
6. Manual skim: under-18 readability; mock cards still show fixtures; no invented features.

## 8. Success criteria

- No left-column fixture incident narratives on the Shift Log.
- A typical teen server owner can explain each beat after reading the capability + brings.
- Demo cards remain the place sample numbers live.
- Brand constraints (local-first, advisory-only, no cloud required by default) stay accurate.
