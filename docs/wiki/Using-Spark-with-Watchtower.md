# Using Spark with Watchtower

Spark records **what is using server time** when lag happens. Watchtower reads Spark’s saved profile and turns it into plain advice on the **Spark** tab — which mods and code paths are slowing ticks down.

---

## What you need

- [Spark](https://modrinth.com/mod/spark) installed on the server
- Current Watchtower release from [[Downloads-and-Releases]] (Spark tab + on-demand parse)
- A saved `.sparkprofile` file (see below)

---

## Quick workflow (Spark tab)

1. **Capture while lagging:** `/spark profiler start` → wait **30–60 seconds** → `/spark profiler stop --save-to-file`
2. **Open the Spark tab** and click **Refresh** if you just saved a new profile, then use the **profile dropdown** to pick the file
3. **Or** click **Import from URL** and paste a `https://spark.lucko.me/…` link (downloads once into `watchtower/spark-upload/`)
4. **Read the evidence** — Overview, Findings, World, **Map** (chunk heat from this capture), Sources, Timeline, Call paths, Technical, Compare

Day-to-day lag triage starts on [[Live-Charts]] and [[Issues]]. Spark is for proof when you need it — not a required daily “run report” step.

---

## Capture a profile while the server is lagging

1. `/spark profiler start`
2. Wait **30–60 seconds** while lag is happening
3. `/spark profiler stop --save-to-file`

Spark saves a file like `config/spark/profile-….sparkprofile`.

**Optional:** copy the file to `<server>/watchtower/spark-upload/` so it appears first in the dropdown.

---

## Pick a profile

On the **Spark** tab:

- Use the **Profile** dropdown (newest first)
- Click **Refresh** to rescan `watchtower/spark-upload/` and `config/spark/`
- Click **Import from URL** for a spark.lucko.me link or 10-character key
- Unreadable files show a short notice instead of failing silently
- Last selected path is remembered in this browser

Watchtower lists up to **25** profiles. To turn Spark ingest off, set `SPARK_ENABLED=false` in `watchtower.conf` and restart.

---

## Read the Spark tab

| Sub-tab | What it shows |
| -------- | ----------------- |
| **Overview** | Capture health, findings, next actions, quality limits |
| **Findings** | Ranked evidence |
| **World** | Entity/chunk context when present |
| **Map** | Pan/zoom chunk heat from this capture’s busy chunks |
| **Sources** | **Profile** source/mod attribution (own-time vs stack involvement) |
| **Timeline** | One-minute windows for TPS, MSPT, CPU, players, entities, chunks |
| **Call paths** | Searchable thread trees |
| **Technical** | Sampler settings, JVM metadata, provenance |
| **Compare** | Baseline vs target deltas |

> **Name clash:** Spark → **Sources** explains which mod owns time in a **profile**. Ops → [[Sources]] explains Watchtower **pollers**. They are different tabs.

## Map

**Map** shows busy chunks from the **selected Spark profile** on a pan/zoom grid (not a live world map, not terrain). Click a square for the same chunk details as World cards. Switch dimension when the capture includes more than one.

### When Spark helps / when it doesn’t

| Helps | Does not prove |
|-------|----------------|
| Which mods dominate tick time during a capture | That a mod is “bad” forever |
| Call paths for a lag window | Network or client-only issues |
| Compare two captures | Memory leaks from allocation mode alone |

---

## How Watchtower interprets a profile

- **Execution mode** — where CPU/wall time was spent (milliseconds)
- **Allocation mode** — newly allocated memory (bytes); not CPU time; cannot alone prove a leak
- **Inclusive** vs **Self / own** — whole stack vs this frame only
- **Source involvement** — inclusive weight at each source’s entry points (not double-counted nested frames)
- Timeline windows describe the capture; rolling TPS/MSPT metadata is labeled separately

Watchtower labels jar-index attribution as a fallback when Spark’s class sources are missing. Unknown and native frames stay visible. Evidence limits are shown on Overview — trust the quality notes.

---

## Overview teaser

When a fresh profile exists, [[Dashboard-Overview]] may show a short Spark summary with **Open Spark**. That is a shortcut into this tab — not a separate “run report” button for day-to-day use.

Optional Support compose can attach Spark context when you share a pack ([[Health-Reports]]).

---

## Related

- [[Issues]] — fix inbox during lag
- [[Live-Charts]] — right-now TPS / tick lag
- [[Mods]] — inventory and conflicts
- [[Sources]] — Ops pollers (not Spark Sources)
- [[Troubleshooting]]
