# Contributing to Watchtower

Thanks for your interest in Watchtower. This repo is a Gradle multi-project: Java mod + CLI, plus static web UIs.

## Prerequisites

- **JDK 21+** (NeoForge 1.21.1 toolchain)
- **Git**
- **Node.js 18+** (DR viewer smoke tests only)

## Quick start (clone and build)

```bash
git clone https://github.com/djinnbanter/WatchTower.git
cd WatchTower

./gradlew :watchtower-core:test :neoforge-1.21.1:build

cd web/dr-viewer && npm ci && cd ../..
node tools/test-dr-analyze.mjs
node tools/test-dr-viewer.mjs
node tools/test-dr-bundle.mjs

# Optional — static dashboard preview (synthetic demo data in web/dashboard/data/)
cd web/dashboard && python -m http.server 8080
```

Build release JARs locally (not committed):

```bash
./gradlew copyReleaseJars
```

## What is not in the public repo

These folders/files stay **local only** (see `.gitignore`):

| Path | Purpose |
|------|---------|
| `fixtures/` | Real server logs, crash reports, validation output |
| `tools/watchtower.conf` | Local engine config — copy from `tools/watchtower.conf.example` |
| `releases/*.jar` | Built artifacts — use GitHub Releases or `copyReleaseJars` |
| `docs/dev/` | Maintainer-only planning, corpus studies, design specs (not published) |
| `**/build/`, `node_modules/` | Build output |

A fresh clone does **not** need `fixtures/` or `legacy/` to build or run tests. CI runs the same Gradle + DR smoke path as above.

## Pre-push audit

Before your first push (or when adding fixtures/docs):

```bash
node tools/audit-public-tree.mjs
node tools/audit-docs.mjs
```

Do not commit real server paths, hostnames, API tokens, RCON passwords, or production log exports.

## IDE setup

Copy `.vscode/launch.json.example` to `.vscode/launch.json` if you use VS Code for NeoForge dev run configs.

## License

GPL-3.0-or-later — see [LICENSE](LICENSE). By contributing, you agree that your contributions will be licensed under the same terms.

## Repository layout

| Path | Role |
|------|------|
| `watchtower-core/` | Report engine, collectors, analysis (loader-agnostic) |
| `watchtower-cli/` | DR CLI when the server will not boot |
| `mods/neoforge-1.21.1/` | NeoForge mod (dashboard HTTP, commands, live metrics) |
| `web/dashboard/` | Embedded dashboard source — synced into mod JAR at build |
| `web/dr-viewer/` | Static DR viewer (`npm run sync:dashboard` copies shared assets) |
| `tools/` | Smoke tests, wiki sync, issue import helpers |
| `docs/wiki/` | Wiki source (publish with `node tools/sync-wiki.mjs --push`) |
| `docs/ROADMAP.md` | Public planned releases |

Mod subprojects: see [`mods/README.md`](mods/README.md). Web UI: see [`web/README.md`](web/README.md).

## Issues and backlog

- **Bugs and feature requests** → [GitHub Issues](https://github.com/djinnbanter/WatchTower/issues). Use labels (`planned`, theme labels, and `WT-###` when tied to the tracker id scheme).
- **Public roadmap** → [`docs/ROADMAP.md`](docs/ROADMAP.md) (plain English; also on the [wiki](https://github.com/djinnbanter/WatchTower/wiki/Roadmap)).
- **Maintainer-only extended specs** — optional local `docs/dev/` (gitignored): version plan, issue archive, corpus studies, design notes. Sync GitHub URLs with `node tools/sync-issue-docs.mjs` when those files exist locally.
- **AI / agent implementation** — when working through planned releases **1.0.1→1.0.7**, start at `docs/dev/roadmap/AI-EXECUTION-GUIDE.md` (checkpoints, verify commands, code anchors). Hub: `docs/dev/roadmap/README.md`.
- **Import tooling** — outstanding backlog manifest: `tools/issues-outstanding.json`; import: `node tools/import-github-issues.mjs --dry-run` then `--apply --skip-existing` (requires `gh auth login`). On Windows, if `gh` is not on PATH: `"C:\Program Files\GitHub CLI\gh.exe" auth login` or `$env:Path += ";C:\Program Files\GitHub CLI"`.
