# Dashboard Overview

The dashboard is a website served by Watchtower on your server — usually **`http://<your-server-ip>:8787`**. It is the main place to see health, live charts, crashes, mods, and backups.

---

## At a glance

- **You must sign in** — visitors without a login only see the sign-in screen
- **First login:** `watchtower` / `password` — change password right away ([[Security and Access]])
- **Overview welcome** — personalized greeting with hostname and a short live status summary
- **Side menu** — tabs grouped as **Monitor**, **Triage**, and **Ops**, plus **System** (Docs / Settings) with theme and collapse at the bottom
- **Top bar** — hostname, Live/Offline and report freshness chips, Search (⌘K), and inbox
- **Reports** — mid-rail glass plate: pick a saved report and **Run Report**
- **Settings (gear)** — schedule, backups, login security, version info
- **Help (?)** — short guide and tour; full articles in **Docs**
- **Docs (book icon)** — all guides built in, with search

---

## First visit

1. Sign in and change your password
2. The **setup wizard** opens automatically on first visit — live discovery audit (logs, crashes, mods, backup configured?), optional 30-day baseline report, then Backups, schedule (default twice daily), and optional 2FA
3. **Run Report** in the side rail (Reports plate) runs a full health check anytime (same as `/watchtower run`)
4. Optional: start the **guided tour** from **Help → Tour** or **Settings → About**

---

## Chrome — rail and top bar

### Side rail

| Control | What it does |
|---------|----------------|
| **Monitor / Triage / Ops** | Switch primary tabs (see [[Dashboard Tabs]]) |
| **Reports** | Pick a saved health report; **Run Report** for a new full check |
| **Docs / Settings** | Guides and configuration (System group) |
| **Theme** | Cycle light / dark / black (bottom tool row) |
| **Collapse** | Shrink the rail to icons only |

### Top bar

| Control | What it does |
|---------|----------------|
| Hostname | Server host label (falls back to “Unknown host”) |
| **Live / Offline** | Connection chip (stays quiet when the connection-down banner is already up) |
| Freshness | Short chip: `Fresh · …` / `Stale · …` / `No report` |
| **Search** | Command palette (Ctrl/Cmd+K) |
| **Inbox** | Unreviewed crashes and update nudges |

---

## Settings (gear icon)

| Section | What you can do |
|---------|-----------------|
| **General** | Report schedule, how far back to look, warning levels |
| **Monitoring** | See (read-only) how often things are checked |
| **Backups** | Tell Watchtower where backups live |
| **Security** | Password, username, 2FA |
| **About** | Version and update check |

Most changes apply immediately. A few advanced options need a server restart — Settings links to those.

---

## Help and Docs

- **Help (?)** — quick answers and a ~2 minute tour
- **Docs** — full guides: installation, tabs, backups, security, troubleshooting, and more. Search or browse by topic.

---

## Banners you might see

| Banner | Meaning |
|--------|---------|
| **Exposure warning** | Dashboard may be reachable from outside — see [[Security and Access]] |
| **Update available** | A newer Watchtower release exists |
| **Environment** | Hosted server context (e.g. CPU limits) |
| **Report stale** | No full report in the last 24 hours |

---

## Public server? Connect safely

If your server is on the internet, do **not** leave the dashboard open on `0.0.0.0:8787`. Bind to localhost and use an SSH tunnel instead. Steps in [[Security and Access]].

---

## Technical details

- **UI layout:** collapsible side rail, command palette (⌘K), wide main area
- **Report files:** `watchtower-facts-*.json` snapshots in the report dropdown
- **Support bundle:** Overview can download latest brief + facts zip for Discord or support
- **`/watchtower url`** — in-game command to print dashboard URL

---

## Related

- [[Dashboard Tabs]] — what each tab shows
- [[Understanding-Data-Sources]] — live vs background vs full report
- [[Commands]]
- [[Security and Access]]
