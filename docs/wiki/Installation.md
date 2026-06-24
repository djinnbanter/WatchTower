# Installation

This guide is for server owners installing Watchtower on a **Linux** server running **NeoForge** for Minecraft **1.21.x**.

---

## At a glance

- **Download:** `watchtower-neoforge-1.0.0+mc1.21.jar` from [GitHub Releases](https://github.com/djinnbanter/WatchTower/releases) or [Modrinth](https://modrinth.com/mod/watchtower)
- **Where it goes:** your server's **`mods/`** folder
- **Recovery tool (optional):** `watchtower-cli-1.0.0.jar` in the same folder
- **After start:** a **`watchtower/`** folder appears next to your world
- **Next step:** [[Quick Start Checklist]]

---

## What you need

| Requirement | Notes |
|-------------|-------|
| **Linux server** | Works on VPS, bare metal, and most hosting panels |
| **NeoForge 1.21.x** | Minecraft **1.21.1** through latest **1.21** patch |
| **Java 21** | Comes with NeoForge — you usually do not install Java separately |

---

## Install steps

1. Download **`watchtower-neoforge-1.0.0+mc1.21.jar`** from [[Downloads and Releases]]
2. Copy it into your server's **`mods/`** folder
3. Start (or restart) the server
4. Check the console for Watchtower messages and confirm a **`watchtower/`** folder exists
5. Open **`http://<your-server-ip>:8787`** and sign in — see [[Dashboard Overview]]

---

## What gets created

On first start, Watchtower creates a **`watchtower/`** folder on your server with settings, reports, and history files. You do not need to create this yourself.

---

## Technical details

**Recovery CLI JAR:** `watchtower-cli-1.0.0.jar` is not loaded as a mod. Keeping it in `mods/` is convenient so you can run recovery commands from SSH.

**Files created on first start** (under `<server>/watchtower/`):

- `watchtower.conf` — schedule, thresholds, backup paths (editable from Settings)
- Report outputs — `watchtower-facts-*.json`, `watchtower-brief-*.txt`
- Live history and minute-by-minute performance files

See [[On-disk Files]] for a full list.

---

## See also

- [[Quick Start Checklist]]
- [[Dashboard Overview]]
- [[Downloads and Releases]]
