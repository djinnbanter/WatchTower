# Watchtower

Watchtower helps you keep your Minecraft server healthy. It checks logs, crashes, mods, backups, and how hard the machine is working — then shows the results in a web dashboard on your server. Everything stays on your machine. No cloud accounts, no AI, no data sent elsewhere.

---

## At a glance

- **Works on:** Linux servers running NeoForge for Minecraft **1.21.x**
- **Dashboard:** open `http://<your-server-ip>:8787` in a browser (you must sign in)
- **First login:** username `watchtower`, password `password` — you will be asked to change the password
- **Download:** [GitHub Releases](https://github.com/djinnbanter/WatchTower/releases) · [Modrinth](https://modrinth.com/mod/watchtower)

---

## What you get

| Feature | In plain English |
|---------|------------------|
| **Health reports** | A full check of your server — logs, crashes, mods, backups — saved as files you can read or share |
| **Live dashboard** | See server speed, lag, players, memory, and CPU with charts |
| **Fix list** | A prioritized list of problems from your latest report |
| **Recovery tools** | Help when the server will not start (separate command-line tool) |
| **Built-in guides** | **Docs** tab in the dashboard — search and browse help without leaving the game |

---

## Start here

**New to Watchtower?** Read in this order:

1. [[Installation]] — download and add the mod
2. [[Quick Start Checklist]] — first login, report, backups, schedule
3. [[Dashboard Overview]] — where everything is in the dashboard
4. [[Dashboard Tabs]] — what each tab is for
5. [[Understanding-Data-Sources]] — what updates right away vs needs a full report
6. [[Using-Spark-with-Watchtower]] — find what is slowing the server (optional)

**Server will not start?** → [[Disaster Recovery]]

**Something not working?** → [[Troubleshooting]]

**What is planned next?** → [[Roadmap]]

---

## Download (1.0.0)

| File | What to do with it |
|------|---------------------|
| `watchtower-neoforge-1.0.0+mc1.21.jar` | Put in your server **`mods/`** folder |
| `watchtower-cli-1.0.0.jar` | Put in **`mods/`** too (recovery tool — not loaded as a mod) |

See [[Downloads and Releases]] for GitHub, Modrinth, and build instructions.

---

## What's in 1.0.0

Live dashboard with 11 Monitor/Triage/Ops tabs plus Admin **Docs**. Setup wizard, scheduled reports, performance insights, Spark profiler tab, external backup tracking, always-on background scans, and disaster recovery CLI.

Details: [[Changelog]]

---

## For developers

Build and contributing: [CONTRIBUTING.md](https://github.com/djinnbanter/WatchTower/blob/main/CONTRIBUTING.md) on GitHub.

**Upcoming features (plain summary):** [[Roadmap]]
