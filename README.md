

# Watchtower
**What's happening on your server — and what to do next.**
<p align="center">
  <a href="https://github.com/djinnbanter/WatchTower/releases"><img src="https://img.shields.io/github/v/release/djinnbanter/WatchTower?style=flat-square" alt="Release"></a>
  <a href="https://github.com/djinnbanter/WatchTower/actions/workflows/ci.yml"><img src="https://github.com/djinnbanter/WatchTower/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://neoforged.net/"><img src="https://img.shields.io/badge/NeoForge-1.21.x-3b8526?style=flat-square" alt="NeoForge 1.21.x"></a>
  <a href="https://modrinth.com/mod/watchtower"><img src="https://img.shields.io/modrinth/dt/watchtower?label=Modrinth&style=flat-square" alt="Modrinth downloads"></a>
</p>

[Modrinth](https://modrinth.com/mod/watchtower) · [Wiki](https://github.com/djinnbanter/WatchTower/wiki) · [Changelog](CHANGELOG.md) · [Issues](https://github.com/djinnbanter/WatchTower/issues)

[Quick start](#quick-start) · [Features](#at-a-glance) · [Why](#why-this-exists) · [Roadmap](#where-its-headed) · [Docs](#documentation) · [Contributing](#contributing)

---

Watchtower is a **NeoForge mod for Linux dedicated servers** — a live ops dashboard, scheduled health reports, and a disaster-recovery toolkit in one install. Built for **modpack admins and self-hosters** who need incident triage, not player analytics. Everything stays on your machine: no cloud account, no telemetry service, no database to run.

## Quick start

1. Download from **[GitHub Releases](https://github.com/djinnbanter/WatchTower/releases)** or **[Modrinth](https://modrinth.com/mod/watchtower)**:
  - `watchtower-neoforge-1.0.0+mc1.21.jar` — required
  - `watchtower-cli-1.0.0.jar` — optional (DR when the server will not boot)
2. Copy both JARs into your server `**mods/`** folder.
3. Start the server, then open `**http://<server-ip>:8787**`, sign in, change your password, and complete the **setup wizard** (initial audit + scheduled reports). Use **Run Report** anytime for a full health check.

Full walkthrough: [Wiki — Quick Start Checklist](https://github.com/djinnbanter/WatchTower/wiki/Quick-Start-Checklist) · [Installation](https://github.com/djinnbanter/WatchTower/wiki/Installation)

**Requirements, default login, and download details**

**Requirements:** Linux dedicated server · NeoForge **1.21.x** (1.21.1 through latest 1.21 patch) · Java **21**

**First login:** `watchtower` / `password` — you will be prompted to change it. See [Security and Access](https://github.com/djinnbanter/WatchTower/wiki/Security-and-Access).


| File                                   | Purpose                                                         |
| -------------------------------------- | --------------------------------------------------------------- |
| `watchtower-neoforge-1.0.0+mc1.21.jar` | Mod — dashboard + reports while the server runs                 |
| `watchtower-cli-1.0.0.jar`             | Optional — DR bundle when Minecraft never reaches the dashboard |


NeoForge does not load the CLI as a mod; run it with `java -jar` over SSH. [Disaster recovery guide →](https://github.com/djinnbanter/WatchTower/wiki/Disaster-Recovery)

Build from source: [CONTRIBUTING.md](CONTRIBUTING.md)



---

## At a glance


|                       |                                                                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Live dashboard**    | TPS, MSPT, players, heap, CPU, RAM, disk, bandwidth — history from ~1 minute to 90 days. Overview, Live, Insights, Issues, Crashes, Mods, Backups, Activity, Session, Spark, and Sources at `:8787`. |
| **Setup wizard**      | First-run audit, backup discovery, scheduled reports, optional 2FA — reopen from Help anytime |
| **Health reports**    | On demand or on a schedule — plain-English **brief** + structured **facts** JSON under `watchtower/`. Log and crash analysis, backup age, mod load errors, panel-aware paths. In-game: `/watchtower run`, `status`, `issues`, and more. |
| **In-app Docs**       | Full operator wiki built into the dashboard — search, categories, same content as GitHub Wiki |
| **Disaster recovery** | When the JVM will not stay up, the CLI builds a local DR bundle zip; optional browser **DR viewer** (early preview — may not work fully yet). No dashboard required. |
| **Local by default**  | Rule-based analysis on your server. No external API calls to interpret logs or crashes.                                                                                                                                                 |
| **Secured access**    | Login required; optional 2FA in **Settings → Security**.                                                                                                                                                                                |


---

## Why this exists

Running a modded server often means jumping between a panel, `latest.log`, crash folders, backup paths, and whatever you were last grep-ing — especially when something breaks at 2am.

Watchtower was built to answer two questions **without leaving the server**:

1. **What's happening right now?** — TPS, lag, players, pregen, open issues
2. **What should I do next?** — plain-English issues, crash summaries, mod hints, backup status

It is **ops and incident triage**, not playtime leaderboards or retention graphs. Reports and charts live under `<server>/watchtower/` on disk — you are not shipping server data to a third party to get a useful summary.

---

## Where it's headed

**1.0.0** is the first public release: live metrics, scheduled reports, a secured dashboard with setup wizard and in-app docs, Spark profiler integration, performance insights, external backup tracking, and DR when the game will not start.

From there the plan is incremental — smarter mod advice, crash intelligence, fleet view for multi-server hosts, Fabric support, and more loader lines later.

The long-term goal is simple: **one place on the server** for what's happening right now and what to do next.

See the full version-ordered [roadmap](docs/ROADMAP.md).

---

## Documentation

The **[GitHub Wiki](https://github.com/djinnbanter/WatchTower/wiki)** is the main guide for server owners.


| Topic                 | Link                                                                                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install & quick start | [Installation](https://github.com/djinnbanter/WatchTower/wiki/Installation) · [Quick Start Checklist](https://github.com/djinnbanter/WatchTower/wiki/Quick-Start-Checklist) |
| Dashboard             | [Dashboard Overview](https://github.com/djinnbanter/WatchTower/wiki/Dashboard-Overview)                                                                                     |
| Commands & config     | [Commands](https://github.com/djinnbanter/WatchTower/wiki/Commands) · [Configuration](https://github.com/djinnbanter/WatchTower/wiki/Configuration)                         |
| Security              | [Security and Access](https://github.com/djinnbanter/WatchTower/wiki/Security-and-Access)                                                                                   |
| Disaster recovery     | [Disaster Recovery](https://github.com/djinnbanter/WatchTower/wiki/Disaster-Recovery)                                                                                       |
| Troubleshooting       | [Troubleshooting](https://github.com/djinnbanter/WatchTower/wiki/Troubleshooting)                                                                                           |
| Roadmap & changelog   | [Roadmap](docs/ROADMAP.md) · [Changelog](CHANGELOG.md)                                                                                                                      |


Contributors: [CONTRIBUTING.md](CONTRIBUTING.md) · [docs/ROADMAP.md](docs/ROADMAP.md)

---

## Contributing

Bug reports and ideas: [GitHub Issues](https://github.com/djinnbanter/WatchTower/issues)

Clone, build, and test: [CONTRIBUTING.md](CONTRIBUTING.md)

---

## License

GPL-3.0-or-later — see [LICENSE](LICENSE).
