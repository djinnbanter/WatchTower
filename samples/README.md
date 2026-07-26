# Samples

Tracked sample data for tests, previews, and manual checks.

| Path | Role |
|------|------|
| `fixtures/` | Golden fixtures used by Java tests and Node parity harnesses — do not relocate without updating callers |
| `logs/` | Example server log excerpts |
| `archives/` | Packaged sample support/DR zips |
| `scripts/` | One-off helpers for working with sample data |
| `watchtower-dr/`, `watchtower-support-*`, `dashboard-poc/` | Example DR / support / POC extracts |

Local real-server corpora live under the gitignored root `fixtures/` folder, not here.
