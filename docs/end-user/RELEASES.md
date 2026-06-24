# Release JAR archive

> **User download guide:** [Downloads and Releases](https://github.com/djinnbanter/WatchTower/wiki/Downloads-and-Releases) on the wiki.

This file documents the **maintainer** local `releases/` layout (gitignored JARs).

## Layout

```text
releases/
  latest/
    LICENSE
    watchtower-*.jar
  1.0.0/
  archive/
```

Each release folder includes **`LICENSE`** (GPL-3.0-or-later) alongside JARs when built with `copyReleaseJars`.

## Which JAR?

| Your server | Mod JAR | CLI JAR |
|-------------|---------|---------|
| **NeoForge 1.21.x** | `watchtower-neoforge-<version>+mc1.21.jar` | `watchtower-cli-<version>.jar` |
| **NeoForge 1.20.x** (planned **1.3.0**) | `watchtower-neoforge-<version>+mc1.20.jar` | Same CLI |
| **Fabric 1.21.x** (planned **1.2.0**) | `watchtower-fabric-<version>+mc1.21.jar` | Same CLI |

Pick the mod JAR that matches your **Minecraft + loader** line. The CLI is shared — place it in `mods/` for DR when the server will not boot.

Detail: public [ROADMAP.md](../ROADMAP.md).

## Build

```bash
./gradlew copyReleaseJars
```

`copyReleaseJars` emits `watchtower-neoforge-<version>+mc1.21.jar`, `watchtower-cli-<version>.jar`, and copies **`LICENSE`**.

See [CONTRIBUTING.md](https://github.com/djinnbanter/WatchTower/blob/main/CONTRIBUTING.md) for build instructions.
