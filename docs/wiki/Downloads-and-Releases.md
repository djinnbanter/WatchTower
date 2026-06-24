# Downloads and Releases

Watchtower ships **two files** per version: the mod (for your server) and a recovery tool (for when the server won't boot).

---

## Which file goes where

| File | Where to put it |
|------|-----------------|
| `watchtower-neoforge-1.0.0+mc1.21.jar` | Server **`mods/`** folder — **required** |
| `watchtower-cli-1.0.0.jar` | Same **`mods/`** folder — **recommended** (not loaded as a mod; used with `java -jar` over SSH) |

---

## Download

| Source | Link |
|--------|------|
| **GitHub Releases** | https://github.com/djinnbanter/WatchTower/releases |
| **Modrinth** | https://modrinth.com/mod/watchtower |

JARs are not stored in the git repo — download from releases or build from source.

---

## Current version (1.0.0)

| File | Purpose |
|------|---------|
| `watchtower-neoforge-1.0.0+mc1.21.jar` | Dashboard, reports, live metrics — Minecraft **1.21.x** |
| `watchtower-cli-1.0.0.jar` | Recovery zip when server won't boot |

**Local build:** `releases/1.0.0/` and `releases/latest/` after `./gradlew copyReleaseJars`.

Match CLI version to mod version when possible.

---

## After download

1. Copy mod JAR to `mods/`
2. Start server — see [[Installation]]
3. Open dashboard — see [[Quick Start Checklist]]

---

## Technical details

- NeoForge loader range: `[1.21.1,1.22)` — one JAR for **1.21.1** through latest **1.21.x** patch
- **License:** GPL-3.0-or-later (see repository `LICENSE`)
- Build from source: [CONTRIBUTING.md](https://github.com/djinnbanter/WatchTower/blob/main/CONTRIBUTING.md)

---

## See also

- [[Installation]]
- [[Disaster Recovery]]
- [[Changelog]]
