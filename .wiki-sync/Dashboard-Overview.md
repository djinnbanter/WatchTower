# Dashboard Overview

The dashboard is a website served by Watchtower on your server — usually **`http://<your-server-ip>:8787`**. It is the main place to see health, live charts, crashes, mods, and backups.

---

## At a glance

- **You must sign in** — visitors without a login only see the sign-in screen
- **First login:** `watchtower` / `password` — change password right away ([[Security and Access]])
- **Side menu** — tabs grouped as Monitor, Fix problems, and Day to day
- **Top bar** — run a report, open Settings, Help, Docs, theme, logout
- **Settings (gear)** — schedule, backups, login security, version info
- **Help (?)** — short guide and tour; full articles in **Docs**
- **Docs (book icon)** — all guides built in, with search

---

## First visit

1. Sign in and change your password
2. If you have no report yet, the **welcome screen** offers a **30-day baseline** report and a tour
3. **Run Report** in the top bar runs a full health check (same as `/watchtower run`)

---

## Top bar — what each button does

| Button | What it does |
|--------|----------------|
| Report dropdown | Switch between saved health reports |
| **Run Report** | Run a new full health check now |
| **Settings** | Schedule, backups, security, about |
| **Docs** | Full guides with search |
| **Help** | Short guide and walkthrough |
| Theme | Light / dark / black |
| **Logout** | Sign out |

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
