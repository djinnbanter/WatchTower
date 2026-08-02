# Insights

**Insights** shows patterns over a window — config health, mod churn, storage trends, and the weekly ops digest — not the live second.

---

## When to open it

- You want busy/quiet hours or recurring lag patterns
- Disk runway / RAM sizing questions
- After Overview’s performance, storage, or weekly-digest teaser
- You want a one-screen “how was this week?” summary

Use [[Live-Charts]] for right-now TPS and tick lag.

---

## What you’ll see

| Nav | Job |
|-----|-----|
| **Overview** (patterns) | Window summary |
| **Digest** | Weekly ops rollup — grade, crashes, disk, MSPT trend, mod changes, one next action |
| **Schedule** | Busy/quiet timing in your selected dashboard timezone |
| **Load** | Load patterns |
| **Incidents** | Recurring incident shape |
| **Configs** | Config / JVM health notes |
| **Mod changes** | Pack churn over the window |
| **World** | Live entity/chunk pressure vs busy-hours p95 and window peak; quiet hours still drive Issues |
| **Storage** | Disk projection, dimension breakdown, and space map (treemap) |

### Schedule & quiet windows

Heatmaps and busy/quiet cards use canonical UTC `hour_of_week` cells from the API, then convert to the timezone chosen under Settings → Timezone (browser-local `wt-timezone`). Changing the picker updates Schedule labels without reloading the page.

Overview **Restart hygiene** (when active) links here for evidence of the next quiet window. Watchtower only suggests a window — it does not schedule or run a restart; your panel or `/stop` still controls that.

### World pressure comparisons

Insights → **World** charts compare **live now** against **busy-hours p95** and the **peak minute** in the selected **7d / 30d** window (same toggle as Schedule). Those baselines come from `world_pressure_compare` on the performance dashboard payload. Quiet-hour baselines remain classifier-only for Issue detection — see [[World-Pressure]].

### Configs / RAM sizing

Insights → **Configs** includes a **RAM sizing** card. WatchTower compares **host/container memory** (cgroup when available) to **`-Xmx`**, then heap history over the window. If the heap leaves too little room outside Java, advice is to **lower `-Xmx` or raise the plan** — not “add more RAM on this box” (that path invites an external OOM kill). Heap peak/pressure advice still applies when the host has room.

### Weekly ops digest

Built from data Watchtower already has (no outbound mail or webhooks). Auto-refreshes about every `WEEKLY_DIGEST_INTERVAL_DAYS` days (default **7**). Use **Generate now** on the Digest panel when you want a fresh card. Prior weeks stay in a short history (default **8**). Kill-switch and caps: [[Configuration#Weekly ops digest]]. Overview shows a dismissible teaser when a digest exists.

### Patterns vs right now

| Insights | Live |
|----------|------|
| Last days/weeks of behavior | Last minutes/hours of vitals |
| DISK_FILL / RAM sizing in plain language | Instant heap and TPS |

---

## What to do next

1. Pick the window that matches your question
2. Follow storage runway into host disk planning
3. Open [[Configuration]] if Configs flags restart-needed keys
4. Return to [[Issues]] if a pattern becomes an active problem

---

## Related

- [[Live-Charts]]
- [[Dashboard-Overview]]
- [[Configuration]]
- [[Activity]]
