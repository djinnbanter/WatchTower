# Live Charts

The **Overview** and **Live** tabs show line charts for server speed (TPS), tick lag (MSPT), memory, players, CPU, disk, and network.

---

## At a glance

- **Time range:** from 1 minute up to 90 days (depends on how much history is saved)
- **Overview:** linked **1h / 6h / 24h** buttons for the main vitals
- **Live tab:** full range picker plus refresh speed
- **Hover** (or drag on touch) to see exact time and value

---

## Where charts appear

| Location | What you see |
|----------|----------------|
| **Overview** | TPS, CPU, memory, players — shared 1h / 6h / 24h range |
| **Live** | TPS, lag, memory, players, CPU, disk, network |
| **Crashes** | Small TPS chart for 10 minutes before a crash |

---

## Chart controls

**Time range** — how far back the line goes. Longer ranges may refresh less often to keep the page smooth.

**Display refresh** — how often the latest number updates (1s to paused). This is separate from how much history is stored.

---

## Reading the lines

- **Green / yellow / red dot** on the right — latest value health for TPS, lag, CPU
- **Dashed guides** — e.g. 20 TPS target, 50 ms lag budget
- **Below the chart** — latest value and low/high for the window; or exact point when hovering

If charts stay empty after an update, hard-refresh the browser (`Ctrl+Shift+R`).

---

## Hosted servers and memory

On some hosts, “free RAM” is misleading because the game runs in a container. Watchtower charts show **memory in use** where possible, and labels Java heap separately. See [[Reading Metrics on Hosted Servers]].

**Long-term patterns** (busy hours, heatmaps) are on the **Insights** tab — not on Live charts.

---

## Technical details

| Setting | File | Effect |
|---------|------|--------|
| `liveSampleIntervalSeconds` | `watchtower-server.toml` | How often metrics are recorded (default 1s) |
| `liveRetentionHours` | `watchtower-server.toml` | Max history kept (default 90 days) |

Restart required for TOML changes. See [[Configuration]].

Minute-by-minute history for **Insights** is stored in `watchtower/performance-rollups.json` (`L1_ROLLUP_ENABLED`, `L1_RETENTION_DAYS` in `watchtower.conf`).

---

## See also

- [[Dashboard Tabs#Live]]
- [[Reading Metrics on Hosted Servers]]
- [[Troubleshooting]]
