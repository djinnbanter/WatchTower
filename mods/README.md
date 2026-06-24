# Mod projects

One Gradle subproject per **loader + Minecraft line**. Each depends on [`watchtower-core`](../watchtower-core/) and adds loader-specific tick metrics, commands, and JAR metadata.

Build from **repo root** (canonical):

```bash
./gradlew :neoforge-1.21.1:build
./gradlew copyReleaseJars
```

From **1.0.0**, `copyReleaseJars` emits **`watchtower-neoforge-<version>+mc1.21.jar`**. After **1.0.4** release engineering, the 1.21 project renames to `:neoforge-1.21:`.

See [../CONTRIBUTING.md](../CONTRIBUTING.md) and [../docs/ROADMAP.md](../docs/ROADMAP.md).

## Loader matrix

| Loader | MC line | Folder | Release artifact | Status |
|--------|---------|--------|------------------|--------|
| NeoForge | **1.21.x** | [`neoforge-1.21.1/`](neoforge-1.21.1/) → `neoforge-1.21/` | `watchtower-neoforge-*+mc1.21.jar` | **Active** |
| NeoForge | **1.20.x** | `neoforge-1.20/` (planned) | `watchtower-neoforge-*+mc1.20.jar` | Planned **1.3.0** |
| Fabric | **1.21.x** | `fabric-1.21/` (planned) | `watchtower-neoforge-*+mc1.21-fabric.jar` | Planned **1.2.0** |
| Forge | 1.20.x | — | — | Low priority |

**Dual NeoForge JARs:** one product version ships **two NeoForge mod JARs + one CLI** after 1.3.0. See [../docs/ROADMAP.md](../docs/ROADMAP.md).

## Adding a new loader

1. Copy `neoforge-1.21.1/` → `mods/<loader>-<mc-line>/`
2. Add `include` + `projectDir` in [`settings.gradle`](../settings.gradle)
3. Extend root [`build.gradle`](../build.gradle) `copyReleaseJars` (artifacts land in `releases/<version>/`)
4. Document in [CONTRIBUTING.md](../CONTRIBUTING.md)

Always use the **root** `./gradlew`; mod subprojects are not standalone Gradle roots.
