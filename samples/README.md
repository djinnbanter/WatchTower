# Samples

Tracked sample data for tests, previews, and manual checks.

| Path | Role |
|------|------|
| `fixtures/` | Golden fixtures used by Java tests and Node parity harnesses — do not relocate without updating callers |
| `logs/` | Redacted example server log excerpts (no real hostnames / UUIDs / player names) |
| `archives/` | Packaged sample support/DR zips (synthetic / redacted only) |
| `scripts/` | One-off helpers for working with sample data |
| `watchtower-dr/`, `watchtower-support-v4-sample/`, `dashboard-poc/` | Example DR / support / POC extracts |

Local real-server corpora live under the gitignored root `fixtures/` folder, not here. Do not commit personal support packs or unredacted logs — `tools/audit-public-tree.mjs` will fail CI.
