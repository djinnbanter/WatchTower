# Dashboard Overview

**Overview** is mission control — health grade, vitals, what needs attention, and shortcuts to the right tab.

---

## At a glance

- **You must sign in** — visitors without a login only see the sign-in screen
- **First login:** `watchtower` / `password` — change it right away ([[Security-and-Access]])
- **Side rail** — Monitor / Triage / Ops plus System (**Help Center**, Settings, Roadmap)
- **Top bar** — hostname, Live/Offline, freshness, Search (⌘K), inbox
- **Support pack** — rail **Build support pack**, Overview card, or Help Center hub (not Settings → Advanced as the primary path)

---

## First visit

1. Sign in and change your password
2. Optional **Welcome** tour (`?tab=wizard` or Help Center hub)
3. Check [[Sources]] — Watching + Scanning fresh (or Waiting)
4. Skim **Needs attention** and the grade on Overview
5. Configure [[Backups]] or leave Not tracking on purpose

---

## What you’ll see

| Area | Meaning |
|------|---------|
| **Health grade** | Snapshot of overall server health from Watchtower’s signals |
| **Needs attention** | Queue of things to open next (Issues, crashes, backups, …) |
| **Right now** | Live vitals (TPS, lag, players, …) |
| **Incident story** | Recent narrative of what happened — deeper on [[Activity]] |
| **Lag incidents** | Detected lag windows |
| **Performance insight** | Teaser into [[Insights]] |
| **Weekly ops digest** | Dismissible week summary (grade, crashes, disk, next action) — full history on [[Insights]] → Digest |
| **Spark** | Short summary + Open Spark when a fresh profile exists |
| **Boot profile** | Teaser into [[Startup]] |
| **Restart** | Safe / Caution / Wait — informational only |
| **Storage** | Disk used %, world size, runway — detail on Insights → Storage |
| **First-run cards** | Setup nudges (backups, Support pack, …) |

### What the grade means

| Tone | Operator takeaway |
|------|-------------------|
| Strong / OK | Keep the daily check short — Overview → Issues → Sources |
| Caution | Open Needs attention and the linked tab before peak hours |
| Poor | Treat as an incident — Issues / Crashes / Live first |

Exact letter or label wording follows what Overview shows on your build.

---

## Restart checklist

| Verdict | Meaning |
|---------|---------|
| **Safe** | Fresh backup, no active pregen, disk OK |
| **Caution** | Restart possible — check listed notes first |
| **Wait** | Pause — e.g. pregen mid-run, backup too old, disk critical |

Each reason can **Open** the relevant tab. The card never blocks `/stop` or your host panel.

---

## Chrome — rail and top bar

| Control | What it does |
|---------|----------------|
| Monitor / Triage / Ops | Primary tabs — [[Dashboard-Tabs]] |
| **Build support pack** | Support compose ([[Health-Reports]]) |
| **Help Center** | This wiki |
| **Settings** | Thresholds, backups, security |
| Theme / Collapse | Appearance and rail width |
| **Search** | Command palette (Ctrl/Cmd+K) |
| **Inbox** | Unreviewed crashes and update nudges |

---

## Settings (gear)

| Panel | What you can do |
|-------|-----------------|
| **General** | TPS/lag warning levels |
| **Monitoring** | How often things are checked |
| **Backups** | Where backups live |
| **Rules** | Crash / issue rules |
| **Security** | Password, username, 2FA |
| **Advanced** | Advanced options |
| **About** | Version and tour entry |

Most changes apply immediately. A few need a server restart — Settings says which.

---

## Banners you might see

| Banner | Meaning |
|--------|---------|
| **Exposure warning** | Dashboard may be reachable from outside — [[Security-and-Access]] |
| **Update available** | Newer Watchtower release |
| **Environment** | Hosted server context (e.g. CPU limits) |
| **Legacy facts stale** | Old on-disk facts — day-to-day tabs still use Scanning |

---

## Related

- [[Dashboard-Tabs]] — map of every tab
- [[Issues]] — fix inbox
- [[Sources]] — is Watchtower working?
- [[Live-Charts]] — right-now charts
- [[Activity]] — incident story detail
- [[Using-Spark-with-Watchtower]] — lag proof
- [[Understanding-Data-Sources]] — Watching vs Scanning vs Support
