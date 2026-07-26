# Sources

**Sources** is Watchtower’s self-health page — pollers, feed freshness, and when the next data pull is due.

> Theory of Watching / Scanning / Support lives on [[Understanding-Data-Sources]]. This page is the how-to for the Ops **Sources** tab.

> **Name clash:** Ops **Sources** (this page) ≠ Spark → **Sources** (profile mod attribution). See [[Using-Spark-with-Watchtower]].

---

## When to open it

- “Is Watchtower working?”
- Overview / Issues look empty or stale
- After changing **Settings → Monitoring**

---

## What you’ll see

### Hero verdict

A short status for overall freshness (healthy, waiting, stale, degraded — as shown on your build).

### Layers

| Layer | Plain English |
|-------|----------------|
| **Watching** | Live charts / vitals |
| **Scanning** | ~60s ops (logs, crashes, Issues, mods, …) |
| **Support compose** | On-demand zip — not a continuous poller |

### Job grid

| Job | What it feeds |
|-----|----------------|
| **Live telemetry** | Watching / charts |
| **Ops cache** | Core Scanning store |
| **Activity / log scan** | [[Activity]] / log-derived events |
| **Mod scan** | [[Mods]] deltas |
| **Backup scan** | [[Backups]] freshness |
| **Modrinth lookup** | Optional online metadata |
| **Issues live** | [[Issues]] continuous ledger |
| **Support compose** | On-request pack build |

Cards show idle vs active, last success, and **next pull** / **Due now**.

---

## What to do next

1. Confirm Watching + Scanning are fresh (or Waiting on first tick after boot)
2. If a job is stale, wait one interval or check server console errors
3. Open **Monitoring settings** (Sources CTA → **Settings → Monitoring**) to review cadence
4. For sharing with a host, use rail **Build support pack** — not this job grid alone ([[Health-Reports]])

---

## Healthy vs problem

| Healthy | Problem |
|---------|---------|
| Watching Just now / recent; Scanning within ~1–2 min | Stale / Degraded while the server is online |
| Jobs Idle between pulls | Stuck Due now with no progress |

---

## Related

- [[Understanding-Data-Sources]]
- [[Troubleshooting]]
- [[Configuration]]
- [[Dashboard-Overview]]
- [[Backups]]
