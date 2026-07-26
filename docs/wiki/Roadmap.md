# Roadmap

Watchtower is ops software for **modded Minecraft servers**. Drop a jar in `mods/`, open the dashboard on your machine, and see what to fix — without a cloud account, and without homework every time you log in.

Releases ship when they’re ready (no fake dates). Grab jars from [[Downloads-and-Releases]] · see what changed in [[Changelog]].

**Platform today:** NeoForge **1.21.x** · **Coming later:** Fabric and NeoForge **1.20.x**

---

## How to read this

| Column | Meaning |
|--------|---------|
| **Works today** | Already in the jar you can download |
| **Coming next** | What we’re building next, by the problem it solves |
| **Later** | Bigger bets once the single-server experience is rock solid |
| **Not our job** | Things other tools do better — we stay out of the way |

Nothing here is a contract. Loud community requests move up the list. The same four columns live on the in-app **Roadmap** rail tab.

---

## Works today

Install Watchtower now and you already get a full ops desk for one server:

| You get | Why it matters |
|---------|----------------|
| **Live dashboard** | TPS, tick lag, CPU, memory, and players updating while you watch |
| **Watching + Scanning** | Charts and Issues stay current without running a report every visit |
| **Fix inbox ([[Issues]])** | Prioritized problems from continuous Scanning — what to tackle next |
| **Crash intelligence** | Groups crashes, names the likely mod, and points at a fix in plain English |
| **Smart mod list** | Inventory, updates, conflicts, Modrinth lookups, client-vs-server hints |
| **Performance Insights** | Busy vs quiet hours, storage trends, config health over a window |
| **Spark integration** | Turn a profiler capture into “what ate the tick” |
| **Sources** | See if Watchtower itself is fresh — pollers, next pull, layer health |
| **Ops extras** | Backups tracking, Session roster, Activity timeline, Logs, Startup boot profile |
| **Support packs** | A redacted zip when you need to share with a host or mod author |
| **Help Center** | Built-in guides and troubleshooting — this wiki, searchable in the app |
| **Secure by default** | Sign-in, optional 2FA, honest metrics on hosted panels |
| **Disaster recovery** | CLI + browser viewer path when the server will not boot |

Day-to-day truth is **Watching** (live) + **Scanning** (~every minute). **Support compose** is for sharing — not a daily chore. Details: [[Understanding-Data-Sources]].

---

## Coming next

Grouped by situations every modded-server admin hits. Each line is one planned capability.

### When the server lags

- **Catch lag for you** — auto-profile when TPS dips and name the culprit mod, even if you weren’t watching
- **Spot farms and chunk loaders** — world pressure (entities, loaded chunks) separately from “a bad mod”
- **Notice when “normal” gets worse** — learn your baseline and flag a sustained regression

### When you’re unsure about RAM or settings

- **GC / JVM health advisor** — heap-bound vs GC-bound vs tick/mod advice, with copyable flags when useful
- **Do I need more RAM?** — right-size card comparing heap peak vs `-Xmx` (never push RAM when the window looks tick-bound)
- **Config coach** — review `server.properties` and startup flags with keep / tweak / why
- **Safe guided fixes** — apply vetted settings from the dashboard with preview and undo

### When you need to trust a restart or understand an outage

- **Safe to restart?** — check backups, pregen, and who’s online before `/stop`
- **One incident timeline** — lag → crash → missed backup in a single story
- **Why it really died** — tell a mod crash apart from OOM or a panel/watchdog kill
- **Weekly digest** — grade, crashes, disk trend, and one useful next action
- **Disk runway** — not just “82% full,” but roughly how many days left and what’s growing

### When mods need care

- **Jar quarantine** — move a bad or client-only jar aside (not delete), with Undo
- **Assisted safe updates** — for pack-impact **Safe** updates: download, verify, back up, swap
- **Did that update help?** — before/after performance after a mod change
- **Tamper & secrets warnings** — jar changed without a version bump, or a config that looks like a token
- **CurseForge lookups** — richer coverage alongside Modrinth
- **Shareable crash rules** — export fixes you’ve proven for the same pack

### When players can’t join or the pack drifts

- **Join clinic** — failed join → mismatched jars → a short “copy for Discord” fix
- **Pin a known-good pack** — freeze a good modlist; banner + named diff when jars drift
- **First-hour sanity check** — green/amber/red on Java, loader, client-only jars, missing deps

### When the world itself is the problem

- **Farm / item-storm storytelling** — “thousands of item entities near forced chunks” instead of “buy more RAM”
- **Corrupt chunk playbook** — guided stop → backup → repair (no silent world wipes)
- **Silent script failures** — KubeJS / datapack errors that never crash but break recipes, raised as Issues

### When you need to act or ask for help

- **Live command bridge** — preview and run safe triage commands from the dashboard
- **Richer Support packs** — one redacted zip tuned for mod authors and hosts
- **Player-safe explain** — short blurb for players vs full detail for admins
- **Optional anonymous diagnostics** — opt-in, previewable, cooldown’d packages so Watchtower can learn real failures (off by default; no continuous streaming)

### For teams and checking in on the go

- **Named admin accounts** — per-person logins and who changed what
- **Public status page** — “are we up?” for Discord, without exposing the dashboard
- **Copy for Discord** — auto-redacted summary for support channels
- **Maintenance windows** — scheduled restarts stop looking like mystery outages
- **Mobile glance** — a fast phone-friendly health check you can pin

---

## Later (bigger bets)

Once one server feels effortless:

- **Insights schedule intelligence** — habit trends, local-time calendars, restart tips (local data only)
- **Fleet view** — TPS, crashes, and backups across many servers (local hub first)
- **Watchtower Cloud (paid, optional)** — remote ops desk, pairing code, history, alerts — Local stays free forever
- **Alerts that reach you** — Discord / webhook for crashes, lag, stale backups
- **More platforms** — Fabric and NeoForge **1.20.x**, same dashboard and workflow

---

## Not our job

We stay focused so the product stays clear:

| We don’t replace… | Use instead |
|-------------------|-------------|
| Host panels (start/stop, files, console) | Pterodactyl, Crafty, AMP, bare metal, … |
| Full player analytics (retention, GeoIP, leaderboards) | [Plan](https://www.playeranalytics.net/) and similar |
| Client GPU / graphics crash tooling | Doesn’t apply to headless dedicated servers |
| Generic APM / log warehouses | Watchtower is opinionated about Minecraft ops |

Watchtower **does** show who’s online during lag or crashes — that’s ops triage, not surveillance.

---

## Promises that don’t change

- **Your data stays yours** — local-first; nothing leaves your host unless you choose
- **You’re in control** — opt-in network features; preview and undo for risky actions
- **Ops, not surveillance** — help run the server; don’t track players like an analytics product
- **Drop-in beside your host** — a jar in `mods/`, not a second control panel

---

## Help shape it

- Vote and request on [GitHub Issues](https://github.com/djinnbanter/WatchTower/issues)
- Get running: [[Installation]] · [[Quick-Start-Checklist]] · [[Troubleshooting]]
- Full engineering notes: [docs/ROADMAP.md](https://github.com/djinnbanter/WatchTower/blob/main/docs/ROADMAP.md)
