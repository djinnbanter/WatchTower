# Watchtower roadmap

**Shareable poster:** [docs/assets/watchtower-roadmap.png](assets/watchtower-roadmap.png) · editable source [roadmap-poster.html](assets/roadmap-poster.html)

**What this page is:** a plain-English look at what Watchtower does **today**, what we’re **building next**, and what we’re **not** trying to be.

Watchtower is ops software for modded Minecraft servers. It runs **on your machine** — a jar in `mods/`, dashboard on your server. No cloud account. Nothing leaves your host unless you choose to share it.

**Today:** NeoForge **1.21.x** (**1.1.9**) · **Coming later:** Fabric and NeoForge **1.20.x**  
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
- **Smart mod list** — Modrinth lookups, pack-impact updates, conflicts, client-vs-server hints
- **Performance Insights** — busy vs quiet hours, storage trends, config health, and baseline “slower than normal”
- **Spark integration** — turn a profile into “what ate the tick,” plus opt-in auto-capture on critical lag
- **GC / JVM + RAM advice** — Live GC pause % of wall, flags profile, and a conservative “do I need more RAM?” card
- **Config audit** — read-only keep / tweak / why for `server.properties` and startup flags
- **Safe to restart? + incident stories** — Overview checklist before `/stop`; Activity stitches lag → crash → missed backup
- **Pack drift lock + client-only Issues** — checksum drift + high-confidence client-only jars on Issues
- **Weekly ops digest** — Insights → Digest + Overview teaser — grade, crashes, disk, MSPT trend, one next action (local only)
- **External kill detection** — OS OOM-killer vs panel force-kill when there is no crash report (Crashes **Killed** chip + correct fix)
- **Silent script / datapack failures** — KubeJS / CraftTweaker / datapack /reload errors that never crash become Issues
- **World pressure / farm storytelling** — continuous entity & chunk census; item storms, mob spikes, unattended loaders on Insights → World + Issues
- **Join & pack sync clinic** — failed join → named mod diffs on Session → Join clinic + Issues; player-safe Copy fix (read-only)
- **Named admin accounts + audit log** — owner / admin / viewer logins; Settings → Accounts and Audit log (`watchtower/audit-log.jsonl`)
- **Disk runway** — roughly how many days left, not just “82% full”
- **Sources** — poller freshness and next data pulls
- **Ops extras** — backups (local + Alpha panel/cloud), sessions, activity, logs, startup, Settings, and Help Center
- **Support packs** — redacted zip builder (presets, logs/crashes/Spark, Copy for Discord) when you need to share
- **Secure by default** — login, optional 2FA, honest metrics on hosted panels
- **Disaster recovery** — CLI + browser viewer when the server won’t boot

---

## Coming next

Grouped by situations every modded-server admin hits. Each line is one planned capability.

### When the server lags

*(Spot farms / chunk loaders via world pressure shipped in 1.1.9 — see Works today.)*

### When you need to trust a restart or understand an outage

- **Smarter restart advice** — suggest a maintenance window from uptime and GC trends (your panel still does the restart)

### When players can't join or the pack drifts

*(Join clinic shipped in 1.1.10 — see Works today.)*

- **Pin a known-good pack** — freeze a good modlist; get a banner and named diff when jars drift

### When the world itself is the problem

- **Corrupt chunk playbook** — crash points at a likely region; guided stop → backup → repair path (no silent world wipes)

*(Farm / item-storm storytelling and silent script failures shipped in 1.1.9 / 1.1.7 — see Works today.)*

### For teams and checking in on the go

*(Named accounts + audit log shipped in 1.1.18 — see Works today.)*

- **Public status page** — "are we up?" for Discord, without exposing the dashboard
- **Maintenance windows** — scheduled restarts stop looking like mystery outages
- **Mobile glance** — a fast phone-friendly health check you can pin to your home screen

### When you need to act or ask for help

- **Live command bridge** — preview and run safe triage commands (e.g. pause Chunky) from the dashboard; confirm first
- **Optional anonymous diagnostics** — after a report (with a daily cooldown), opt-in operators can send a redacted package of that report plus the full crash/log files it used — so Watchtower can learn real failures. Off by default; previewable; no continuous log streaming

---

## Later (bigger bets)

Parked apply / onboarding polish (still wanted, not scheduled):

- **First-hour sanity check** — green/amber/red on Java, loader, client-only jars, missing deps
- **Safe guided fixes** — apply vetted `server.properties` changes with preview and undo
- **Jar quarantine** — *in progress* — move a bad or client-only jar aside (not delete), with Undo (dashboard + mutate API)
- **Assisted Safe updates** — *in progress / single-swap path shipping* — Modrinth Safe path: download, verify, back up old jar, swap (batch + install follow)
- **Player-safe ops context** — lag vs timeout hints and richer restart roster
- **Player-safe explain / richer Discord paste** — short player blurb vs admin detail beyond today's support pack
- **Config secret sniff** — catch webhooks/tokens in known config paths
- **Did that update help?** — before/after performance after a mod change

Bigger bets:

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
