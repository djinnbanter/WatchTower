# Live Charts

The **Live** tab is the ops console for tick health, host load, and right-now signals. **Overview** shares a shorter vitals window.

---

## At a glance

- **Live windows:** **5m → 30d** (within saved history)
- **Overview:** **1h / 6h / 24h** for main vitals
- **Sections on Live:** Game vitals · Host & storage · Network · Thermal · World background jobs
- **Hover** (or drag on touch) for exact time and value

---

## Where charts appear

| Location | What you see |
|----------|----------------|
| **Overview** | TPS, CPU, memory, players — shared 1h / 6h / 24h |
| **Live** | TPS, tick lag, memory, players, CPU, disk, network, thermal, world jobs |
| **Crashes** | Small TPS chart for minutes before a crash |

Long-term patterns (busy hours, heatmaps) live on [[Insights]] — not Live.

---

## Chart controls

| Control | Meaning |
|---------|---------|
| **Time range** | How far back the line goes (5m … 30d on Live) |
| **Display refresh (Poll)** | How often the latest number updates (separate from stored history) |
| **Pin lag** | Keep lag focused while you work |

Longer ranges may refresh less often to keep the page smooth.

---

## Reading the lines

- **Green / yellow / red** on the header readout — latest TPS, lag, CPU health
- **Dashed guides** — e.g. 20 TPS target, 50 ms lag budget
- Empty after an update? Hard-refresh (`Ctrl+Shift+R`)

---

## Hosted servers and memory

On some hosts, “free RAM” is misleading in containers. Watchtower charts show **memory in use** where possible and labels Java heap separately. See [[Reading-Metrics-on-Hosted-Servers]].

---

## GC health (Java heap vs garbage collection)

Under Java Heap on Live:

| KPI | Meaning |
| --- | ------- |
| **GC pause % of wall** | Share of real time in GC pauses (not “% of a Minecraft tick”) |
| **Heap pressure** | Heap used ÷ max |
| **Flags** | Detected JVM profile |
| **Java** | Running major version |

**How to read it**

- Heap full, GC calm → often need more `-Xmx` (or a leak)
- GC pause % high, heap not full → fix flags / Java before buying RAM
- Heap and GC fine but tick lag high → mod/tick work; more RAM will not fix it

**Copy recommended flags** lives on [[Insights]] → Configs. Confirm with `/spark gc` on the server when needed.

---

## Technical details

| Setting | File | Effect |
|---------|------|--------|
| `liveSampleIntervalSeconds` | `watchtower-server.toml` | How often metrics are recorded |
| `liveRetentionHours` | `watchtower-server.toml` | Max history kept |

Restart required for TOML changes. See [[Configuration]].

---

## Related

- [[Insights]]
- [[Dashboard-Overview]]
- [[Using-Spark-with-Watchtower]]
- [[Reading-Metrics-on-Hosted-Servers]]
- [[Troubleshooting]]
