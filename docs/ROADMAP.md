# Watchtower roadmap

**Shareable poster:** [docs/assets/watchtower-roadmap.png](assets/watchtower-roadmap.png) · editable source [roadmap-poster.html](assets/roadmap-poster.html)

**What this page is:** a plain-English look at what Watchtower does **today**, what we’re **building next**, and what we’re **not** trying to be.

Watchtower is ops software for modded Minecraft servers. It runs **on your machine** — a jar in `mods/`, dashboard on your server. No cloud account. Nothing leaves your host unless you choose to share it.

**Today:** NeoForge **1.21.x** · **Coming later:** Fabric and NeoForge **1.20.x**  
[Modrinth](https://modrinth.com/mod/watchtower) · [Changelog](../CHANGELOG.md) · [Install guide](https://github.com/djinnbanter/WatchTower/wiki/Installation)

Releases ship when they’re ready — no fake dates. When something lands, it shows up in the [Changelog](../CHANGELOG.md).

---

## How to read this

| Section | Meaning |
| ------- | ------- |
| **Works today** | Already in the jar you can download |
| **Coming next** | Planned work, grouped by the problem it solves for you |
| **Later** | Bigger bets (fleet, alerts, more loaders) |
| **Not our job** | Things other tools do better — we stay out of the way |

Nothing here is a contract. Loud community requests move up the list.

---

## Works today

If you install Watchtower now, you already get:

- **Live dashboard** — TPS, tick lag, CPU, memory, and players updating while you watch
- **Watching + Scanning** — charts and Issues stay current without homework every visit
- **Fix inbox** — prioritized problems from continuous Scanning
- **Crash intelligence** — names the likely mod and the fix in plain English
- **Smart mod list** — Modrinth lookups, updates, conflicts, client-vs-server hints
- **Performance Insights** — busy vs quiet hours, storage trends, config health
- **Spark integration** — turn a profile into “what ate the tick”
- **Sources** — poller freshness and next data pulls
- **Ops extras** — backups, sessions, activity, logs, startup, and Help Center
- **Support packs** — redacted zip when you need to share with a host or mod author
- **Secure by default** — login, optional 2FA, honest metrics on hosted panels
- **Disaster recovery** — CLI + browser viewer when the server won’t boot

---

## Coming next

Grouped by situations every modded-server admin hits. Each line is one planned capability.

### When the server lags

- **Catch lag for you** — auto-profile when TPS dips and name the culprit mod, even if you weren’t watching
- **Spot farms and chunk loaders** — show world pressure (entities, loaded chunks) separately from “a bad mod”
- **Notice when “normal” gets worse** — learn your baseline and flag a sustained regression (“slower since Tuesday”)

### When you’re unsure about RAM or settings

- **GC / JVM health advisor** — Live GC pause % of wall, heap pressure, flags profile, and plain-English heap-bound vs GC-bound vs tick/mod advice (with Copy flags for Paper/Aikar when useful)
- **Do I need more RAM?** — Insights → **Configs** right-size card: conservative heap peak/p95 vs `-Xmx`, never suggests more RAM when the window looks tick/GC-bound
- **Config coach** — review `server.properties` and startup flags with keep / tweak / why
- **Safe guided fixes** — apply vetted settings from the dashboard with preview and undo

### When you need to trust a restart or understand an outage

- **Safe to restart?** — check backups, pregen, and who’s online before `/stop`
- **One incident timeline** — lag → crash → missed backup in a single story
- **Why it really died** — tell a mod crash apart from OOM or a panel/watchdog kill
- **Weekly digest** — grade, crashes, disk trend, and one useful next action
- **Disk runway** — not just “82% full,” but roughly how many days left and what’s growing
- **Smarter restart advice** — suggest a maintenance window from uptime and GC trends (your panel still does the restart)

### When mods need care

- **Jar quarantine** — move a bad or client-only jar aside (not delete), with Undo and a restart reminder
- **Assisted Safe updates** — for pack-impact **Safe** updates: download, verify, back up the old jar, swap. Risky updates stay manual
- **Did that update help?** — before/after performance after a mod change
- **Tamper & secrets warnings** — jar changed without a version bump, or a config that looks like it contains a webhook/token
- **CurseForge lookups** — richer coverage alongside Modrinth
- **Shareable crash rules** — export fixes you’ve proven and share them with other admins on the same pack

### When players can’t join or the pack drifts

- **Join clinic** — failed join → exact mismatched jars → a short, redacted “copy for Discord” fix
- **Pin a known-good pack** — freeze a good modlist; get a banner and named diff when jars drift
- **First-hour sanity check** — after install, green/amber/red on Java, loader, client-only jars on the server, and missing deps

### When the world itself is the problem

- **Farm / item-storm storytelling** — “thousands of item entities near forced chunks” instead of “buy more RAM”
- **Corrupt chunk playbook** — crash points at a likely region; guided stop → backup → repair path (no silent world wipes)
- **Silent script failures** — KubeJS / datapack errors that never crash but break recipes, raised as Issues

### When you need to act or ask for help

- **Live command bridge** — preview and run safe triage commands (e.g. pause Chunky) from the dashboard; confirm first
- **Support pack export** — one redacted zip for mod authors (facts, crash TLDR, mod list)
- **Player-safe explain** — short blurb for players vs full detail for admins
- **Player-safe ops context** — lag vs timeout hints and richer restart roster (not player analytics)
- **Optional anonymous diagnostics** — after a report (with a daily cooldown), opt-in operators can send a redacted package of that report plus the full crash/log files it used — so Watchtower can learn real failures. Off by default; previewable; no continuous log streaming

### For teams and checking in on the go

- **Named admin accounts** — per-person logins and a log of who changed what
- **Public status page** — “are we up?” for Discord, without exposing the dashboard
- **Copy for Discord** — auto-redacted summary for support channels
- **Maintenance windows** — scheduled restarts stop looking like mystery outages
- **Mobile glance** — a fast phone-friendly health check you can pin to your home screen

---

## Later (bigger bets)

- **Insights schedule intelligence** — 7d vs 30d habit trends on Patterns → Schedule (`3 (−2)` style), local-time calendars, restart/event window tips, and drift teasers when the week stops matching the month (local data only)
- **Fleet view** — TPS, crashes, and backups across many servers (proxy-aware for Velocity/Bungee); local hub first, optional **Watchtower Cloud** later for remote fleet + history when nodes go dark
- **Watchtower Cloud (paid, optional)** — same mod + pairing code; remote ops desk, multi-server account, retention, and alerts — Local dashboard stays free forever
- **Alerts that reach you** — Discord / webhook pings for crashes, lag, stale backups, and pregen stalls (host-side and/or Cloud)
- **More platforms** — Fabric and NeoForge **1.20.x**, same dashboard and workflow

---

## Not our job

We stay focused so the product stays clear:

| We don’t replace… | Use instead / leave alone |
| ----------------- | ------------------------- |
| Host panels (start/stop, files, console) | Pterodactyl, Crafty, AMP, bare metal, etc. |
| Player analytics (retention, GeoIP, leaderboards) | [Plan](https://www.playeranalytics.net/) and similar |
| Client GPU / graphics crash tooling | Doesn’t apply to headless dedicated servers |

Watchtower **does** show who’s online during lag or crashes — that’s ops triage, not surveillance.

---

## Promises that don’t change

- **Your data stays yours** — local-first; no telemetry; no log uploads by default (optional anonymous diagnostics contribution is explicit opt-in only; optional **Watchtower Cloud** sync is a separate paid opt-in)
- **You’re in control** — opt-in network features; preview and undo for risky actions; no quiet edits to mods or the world
- **Ops, not surveillance** — help run the server; don’t track players like an analytics product
- **Drop-in beside your host** — a jar in `mods/`, not a second control panel

---

## Help shape it

- **Vote and request:** [GitHub Issues](https://github.com/djinnbanter/WatchTower/issues)
- **Get running:** [Installation](https://github.com/djinnbanter/WatchTower/wiki/Installation) · [Troubleshooting](https://github.com/djinnbanter/WatchTower/wiki/Troubleshooting)
