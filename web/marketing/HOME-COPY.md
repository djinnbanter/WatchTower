# Marketing home page copy

Inventory of visible wording on `/` (marketing site home), as of 2026-08-07.

Sources: `web/marketing/content/product.ts`, `components/home/*`, `site-header.tsx`, `site-footer.tsx`, `theme-toggle.tsx`.

Desk mock fixtures (Issues / Crashes / Overview / Insights / Live dials) pull baked UI text from `content/baked/desk` and related desk components. Those fixture strings are **not** listed here; only marketing chrome and section copy.

Tone target: grounded, honest, direct. Readable. No sales montage, no brochure verbs.

---

## Site header

- Wordmark: **WatchTower**
- Nav: How it works · Features · Install · FAQ
- Social aria labels: Modrinth · GitHub
- Theme: Dark · Light
- Mobile: Menu / Close menu

---

## 00 Hero — promise

**Meta (alive):**  
WatchTower · on your host · watching

**Meta (stopped):**  
WatchTower · on your host · stopped

**Display title (h1):**  
Minecraft ops,  
sorted.

**Overview:**  
Dashboard for a NeoForge dedicated server. It runs on the same machine as the game, shows if things look healthy, and points at what to fix. No account. Your files stay on the host.

**Context stamp:**  
On your host · no cloud required

### You need

- NeoForge 1.21.x dedicated server
- Java 21
- Browser on the host (or SSH tunnel)

**CTAs:**  
Try the demo  
Get it on Modrinth

---

## 01 What is WatchTower

**Stamp:** `[ 01 · WHAT IS WATCHTOWER ]`  
**Meta right:** on your host

**Title:** What is WatchTower

**Lead:**  
Something's wrong on the server. You're digging through the panel, latest.log, and crash folders to find out what actually broke.

**Body:**  
WatchTower is a jar on that NeoForge box. It watches while Minecraft runs and puts the next fixes in one list. You open it in a browser on the host. No signup. It won't restart the server or change your mods for you.

**Facts:**

| Label | Detail |
|-------|--------|
| It is | Live numbers and a Fix list for one dedicated server. |
| It isn't | The panel that starts and stops the server, or a player tracker. |
| Runs on | NeoForge 1.21.x, Java 21. GPL. Free on your machine. |

---

## Live gauges plate (inside full-viewport hero)

**Meta:** Live · sample vitals · healthy band drift (or frozen)  
**Rail:** TPS · MSPT · Players · Heap · CPU · Disk

**Dial labels:** TPS · MSPT · Players · Heap · CPU · Disk  
(values are live/fixture; units include ms and %)

**Hazard accent:** short rule under the display title

---

## Strip under gauges

No cloud account /// data stays on your host /// you stay in control

**Scroll cue (bottom of full-viewport hero):** What is WatchTower ↓

---

## 02 Issues

**Stamp:** `[ 02 · ISSUES ]`  
**Meta right:** dashboard · Issues

**Title:** Issues

**Lead:**  
This is the Fix inbox. Live finds, scan results, boot fails, join problems, and crash pointers land here, ranked by how bad they look. Open a row for the next step and the evidence. Mark something reviewed when you're done; the files stay on disk.

**Plate meta:** Issues

*(ProductDesk issues mock — fixture copy omitted)*

---

## 03 Crashes

**Stamp:** `[ 03 · CRASHES ]`  
**Meta right:** dashboard · Crashes

**Title:** Crashes

**Lead:**  
Matching crash shapes stack into one group so you aren't reading the same dump over and over. Each group has fix steps, linked stacks and files, and fingerprint details. Odd shutdowns show up too when latest.log just stops with no crash report.

**Plate meta:** Crashes

*(ProductDesk crashes mock — fixture copy omitted)*

---

## 04 Overview + Insights

**Stamp:** `[ 04 · OVERVIEW + INSIGHTS ]`  
**Meta right:** grade · schedule

**Title:** Overview + Insights

**Lead:**  
Overview is the first screen after login: health grade, what needs attention, and restart advice that is advisory only (WatchTower does not restart the server). Insights adds busy-hour charts, world pressure, disk use, and a weekly summary so you can plan cleanup without guessing.

**Plate metas:**  
Overview grade  
Insights schedule

*(HeroReadout + EveningChart fixtures — fixture copy omitted)*

---

## 05 Close

**Stamp:** `[ 05 · Close ]`

**Headline:** Try the demo.

**Body:**  
Same dashboard UI, fake sample data. Click around. Nothing gets saved. If it feels useful, grab the jar on Modrinth.

**CTAs:**  
Try the demo  
Get it on Modrinth

**Footnote:**  
Free on your machine. GPL-3.0-or-later. Runs where the server runs.

---

## Site footer

**Blurb:**  
Dashboard for Minecraft dedicated servers. The jar sits on the same machine as the game.

**CTA:** Try the demo

**Product nav label:** Product  
How it works · Features · Install · Demo · FAQ

**Project nav label:** Project  
Modrinth · GitHub · Wiki · License

**Meta:**  
Free on your machine. GPL-3.0-or-later. Runs where the server runs.  
WatchTower

---

## SEO / document (not body UI)

**Default title template:** WatchTower  
**Description:** What's going on with your Minecraft server, and what to do next. Dashboard for a NeoForge dedicated server. It runs on the same machine as the game, shows if things look healthy, and points at what to fix. No account. Your files stay on the host.

**Board frame aria-label:** WatchTower product board
