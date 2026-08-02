# Roadmap

Watchtower is ops software for **modded Minecraft servers**. Drop a jar in `mods/`, open the dashboard on your machine, and see what to fix — without a cloud account, and without homework every time you log in.

Releases ship when they’re ready (no fake dates). Grab jars from [[Downloads-and-Releases]] · see what changed in [[Changelog]].

**Platform today:** NeoForge **1.21.x** (**1.1.9**) · **Coming later:** Fabric and NeoForge **1.20.x**

---

## How to read this

| Column | Meaning |
|--------|---------|
| **Works today** | Already in the jar you can download |
| **Coming next** | What we’re building next, by the problem it solves |
| **Later** | Bigger bets once the single-server experience is rock solid |
| **Not our job** | Things other tools do better — we stay out of the way |

Nothing here is a contract. Loud community requests move up the list. The same four columns live on the in-app **Roadmap** rail tab.

Canonical engineering copy: [docs/ROADMAP.md](https://github.com/djinnbanter/WatchTower/blob/main/docs/ROADMAP.md).

---

## Works today

Install Watchtower now and you already get a full ops desk for one server:

| You get | Why it matters |
|---------|----------------|
| **Live dashboard** | TPS, tick lag, CPU, memory, and players updating while you watch |
| **Watching + Scanning** | Charts and Issues stay current without running a report every visit |
| **Fix inbox ([[Issues]])** | Prioritized problems from continuous Scanning — what to tackle next |
| **Crash intelligence** | Groups crashes, names the likely mod, and points at a fix in plain English |
| **Smart mod list** | Inventory, Modrinth lookups, pack-impact updates, conflicts, client-vs-server hints |
| **Performance Insights** | Busy vs quiet hours, storage trends, config health, baseline “slower than normal” |
| **Spark integration** | Turn a profiler capture into “what ate the tick,” plus opt-in auto-capture on critical lag |
| **GC / JVM + RAM advice** | Live GC pause % of wall, flags profile, and a conservative “do I need more RAM?” card |
| **Config audit** | Read-only keep / tweak / why for `server.properties` and startup flags |
| **Safe to restart? + incident stories** | Overview checklist before `/stop`; Activity stitches lag → crash → missed backup |
| **Uptime & restart hygiene** | Suggests a maintenance restart from long uptime + rising GC/heap, plus the next quiet window — never auto-restarts |
| **Dashboard timezone display** | Browser-local Settings picker localizes Schedule and quiet-window times; backend data stays UTC |
| **Weekly ops digest** | Insights → Digest + Overview teaser — grade, crashes, disk, MSPT trend, one next action (local only) |
| **Pack drift lock + client-only Issues** | Checksum drift when a jar changes without a version bump; high-confidence client-only jars on the Issues inbox |
| **External kill detection** | Distinguishes OS OOM-killer vs panel force-kill when there is no crash report — Crashes **Killed** chip + correct fix text |
| **Silent script / datapack failures** | KubeJS, CraftTweaker, datapack JSON, and `/reload` errors that never crash become Issues (path when on the same log line) |
| **World pressure / farm storytelling** | Continuous entity & chunk census by dimension; item storms, mob spikes, and unattended loaders as Issues + Insights → World |
| **Join & pack sync clinic** | Failed join → named mod diffs on Session → Join clinic + Issues; player-safe Copy fix ([[Join-Clinic]]) |
| **Named admin accounts + audit log** | Owner / admin / viewer logins; Settings → Accounts and Audit log ([[Accounts-And-Audit-Log]]) |
| **Disk runway** | Roughly how many days left — not just percent full |
| **Sources** | See if Watchtower itself is fresh — pollers, next pull, layer health |
| **Ops extras** | Backups (local + Alpha panel/cloud), Session, Activity, Logs, Startup, Settings, Help Center |
| **Support packs** | Redacted zip builder (presets, logs/crashes/Spark, Copy for Discord) for hosts and mod authors |
| **Secure by default** | Sign-in, optional 2FA, honest metrics on hosted panels |
| **Disaster recovery** | CLI + browser viewer path when the server will not boot |

Day-to-day truth is **Watching** (live) + **Scanning** (~every minute). **Support compose** is for sharing — not a daily chore. Details: [[Understanding-Data-Sources]].

---

## Coming next

Grouped by situations every modded-server admin hits. Each line is one planned capability.

### When the server lags

*(World pressure / farms shipped in 1.1.9 — see Works today.)*

### When you need to trust a restart or understand an outage

*(Restart hygiene and timezone display shipped in 1.1.6 — see Works today.)*

### When players can’t join or the pack drifts

*(Join clinic shipped in 1.1.10 — see Works today / [[Join-Clinic]].)*

- **Pin a known-good pack** — freeze a good modlist; banner + named diff when jars drift

### When the world itself is the problem

- **Corrupt chunk playbook** — guided stop → backup → repair (no silent world wipes)

*(Farm / item-storm storytelling and silent script failures shipped in 1.1.9 / 1.1.7 — see Works today.)*

### For teams and checking in on the go

*(Named accounts + audit log shipped in 1.1.18 — see Works today / [[Accounts-And-Audit-Log]].)*

- **Public status page** — “are we up?” for Discord, without exposing the dashboard
- **Maintenance windows** — scheduled restarts stop looking like mystery outages
- **Mobile glance** — a fast phone-friendly health check you can pin

### When you need to act or ask for help

- **Live command bridge** — preview and run safe triage commands from the dashboard
- **Optional anonymous diagnostics** — opt-in, previewable, cooldown’d packages so Watchtower can learn real failures (off by default; no continuous streaming)

---

## Later (bigger bets)

Parked for now (still wanted):

- **First-hour sanity check** — Java / loader / client-only jars / missing deps
- **Safe guided fixes** — vetted settings apply with preview + undo
- **Jar quarantine** / **Assisted safe updates** — move jars aside; Modrinth Safe swap path
- **Player-safe ops context** / **player-safe explain** — Discord paste and lag-vs-timeout hints
- **Did that update help?** — before/after after a mod change

Once one server feels effortless:

- **Insights schedule intelligence** — richer habit trends beyond the shipped timezone picker and restart-hygiene quiet window
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
