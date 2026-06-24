# Release JAR archive (local builds)

This folder is a **local Gradle output** for maintainers who run `copyReleaseJars`. Built JARs are **gitignored** and are **not** what you download from GitHub.

**Public downloads:** [GitHub Releases](https://github.com/djinnbanter/WatchTower/releases) · Modrinth (when published)

See [../docs/end-user/RELEASES.md](../docs/end-user/RELEASES.md) for the full build and archive layout.

## Layout (after `copyReleaseJars`)

```text
releases/
  latest/                          ← convenience copy of current version pair
  <version>/                       ← e.g. 1.0.0/ — mod + CLI for that release
  archive/
    legacy-pre-1.0.0/              ← pre-public internal builds
    internal-dev/                  ← optional non-public dev JAR stash
```

## Build

From repo root:

```bash
./gradlew copyReleaseJars
```

Outputs:

- `releases/<mod_version>/` — versioned mod + CLI
- `releases/latest/` — same pair locally

Version is set in root `gradle.properties` (`mod_version`).
