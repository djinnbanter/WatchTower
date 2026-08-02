# Marketing Features page: 1.2.0-beta.1 catalog refresh

**Date:** 2026-08-02  
**Status:** Approved in brainstorm (Approach 1 — content-only catalog pass)  
**Surfaces:** `web/marketing` Features page (`/features`)  
**Release source:** `CHANGELOG.md` / wiki Changelog for [1.2.0-beta.1](https://github.com/djinnbanter/WatchTower/releases/tag/v1.2.0-beta.1)

## 1. Goal

Update the Features capability catalog so it matches what WatchTower ships in **1.2.0-beta.1**, without redesigning the page.

Plain-English end state: someone who already saw the home desk tour can scan Features and find the new insides (soft jar disable, configs editor, space map, Spark Map, theme) plus accurate blurbs for backups and related fold-ins.

## 2. Why

1.2.0-beta.1 rolled up a large set of interim ships. The Features page already covers many of them (join clinic, world pressure, external kill, digest, accounts). Several distinct capabilities are still missing or under-described (jar disable, Mods Configs, storage space map, Spark Map, theme/accent), and Backup health still reads like “folder present” only.

## 3. Job / not job

**Job:** Content-only refresh of `FEATURE_CAPABILITIES` + `FEATURE_BENTO_MORE` placement. Plain, proper English that younger operators can follow - no slang, no invented features.

**Not this page:**

- Layout / bento CSS / showcase cell redesign
- “New in 1.2” callout, badge, or changelog grouping
- Homepage Shift Log, How it works, Install, screenshots
- Promises / not-our-job / roadmap bets
- Fabric shipping claims

## 4. Decisions (locked)

| Decision | Choice |
| --- | --- |
| Scope | Catalog refresh only (Approach A / Approach 1) |
| New vs fold | New tiles only for distinct capabilities; smaller upgrades fold into existing blurbs - except Spark Map and Theme + accent (own tiles by request) |
| Storage | Two tiles: Space map + existing disk runway |
| Backups | One merged tile: freshness + verify + test restore |
| Showcase | Keep the existing seven `FEATURE_BENTO_SHOWCASE` cells unchanged |
| Copy register | Clear and proper; young-readable; no slang (“flip off”, “slammed”, etc.) |
| Soft disable wording | Rename jar to skip next boot - not a live toggle |

## 5. Capability inventory

### 5.1 Add (standard weight)

| id | Title | Tag | Tone (prefer reuse) |
| --- | --- | --- | --- |
| `jar-disable` | Soft jar disable / enable | Mods | `warn` |
| `mod-configs` | Mods → Configs | Mods | `accent` |
| `storage-space-map` | Storage space map | Insights | `disk` |
| `spark-map` | Spark Map | Spark | `lantern` |
| `theme-accent` | Theme + accent | Settings | `info` |

Approved blurbs:

- **Soft jar disable / enable** — Rename a mod jar to `*.jar.disabled` so it skips the next boot (or rename it back). Filter All / Enabled / Disabled. High world risk asks you to confirm first. Admins only - no delete.
- **Mods → Configs** — Edit files under the server `config/` folder from the dashboard. TOML gets a form when WatchTower can parse it; otherwise you edit the raw text. Saves create a backup and support undo. Admins only.
- **Storage space map** — A treemap of what is using disk space. Drill into World, Logs, Mods, or Backups.
- **Spark Map** — Pan and zoom chunk heat from the selected Spark profile. Click a chunk for details.
- **Theme + accent** — Light, Dark, Black, or System, plus an accent color. Saved per signed-in account.

### 5.2 Rewrite (existing ids)

| id | Blurb |
| --- | --- |
| `backups` | See whether local backups look present and fresh, then verify zip/tar.gz integrity. Optional test restore only under `watchtower/restore-verify/` - never into the live world. |
| `health-grade` | Letter grade, plain reasons when it is not Strong, and Safe / Caution / Wait restart advice. Long uptime plus worse GC can suggest a quiet maintenance window. WatchTower does not restart the server for you. |
| `gc-ram` | GC pause share of wall time, JVM flags profile, and RAM advice that uses your host or container memory limit - not a one-size guess. |
| `schedule-load` | Busy vs quiet hours so you plan restarts around real load. Times follow the timezone you set in the dashboard. |
| `mods-modrinth` | Installed jars, conflicts, Modrinth lookup hints, and mod log errors with Active / Reviewed. Modrinth never downloads jars for you. |
| `accounts` | Owner / admin / viewer logins, optional Minecraft player link on the side rail, Sign out, and a Settings audit log of account and settings changes. |
| `spark` | Optional Spark companion turns a profile into what ate the tick. Deep Spark workspace is Alpha. (Map is its own tile - do not re-describe Map here beyond keeping Alpha on deep workspace.) |

Title for `backups` stays **Backup health** (merged story in the blurb). Title for `spark` stays **Spark lag proof** with `alpha: true`.

### 5.3 Fold only (no new tile)

| Topic | Folds into |
| --- | --- |
| Restart hygiene | `health-grade` |
| Scorecard `grade_reasons` | `health-grade` |
| Dashboard timezone preference | `schedule-load` |
| Host-aware RAM envelope | `gc-ram` |
| Mods log-errors Active / Reviewed | `mods-modrinth` |
| Minecraft player link + rail Sign out | `accounts` |

### 5.4 Unchanged leads / showcase

Lead weights and showcase ids stay:

`health-grade`, `fix-inbox`, `world-pressure`, `join-clinic`, `live-vitals`, `support-pack`, `spark`

Lede (`FEATURE_LEDE`) unchanged unless a one-line tweak is needed for grammar only - not required.

Copy rules: hyphens only (no em dashes), plain English, no Fabric claims, no inventing, Alpha only where already true.

## 6. Placement

**Page chrome:** unchanged (`app/features/page.tsx`).

**Showcase (`FEATURE_BENTO_SHOWCASE`):** no id swaps.

**More grid (`FEATURE_BENTO_MORE`):** insert the five new tiles near related neighbors. Desktop rows must still fill six columns (`half`=3, `one`=2, `two`=4). No orphan 5-col rows.

Suggested neighborhood (exact spans locked in the implementation plan):

- After `jar-drift`: `jar-disable`
- Near mods block: `mod-configs`
- After `storage-runway`: `storage-space-map`
- Near Spark / crash area: `spark-map` (showcase keeps `spark`)
- Near settings row: `theme-accent` beside `accounts` / `auth`

## 7. Architecture

| File | Change |
| --- | --- |
| `web/marketing/content/features.ts` | Add five capabilities; rewrite seven blurbs as above |
| `web/marketing/content/features-bento.ts` | Place new ids in `FEATURE_BENTO_MORE` only; keep showcase |
| `web/marketing/components/features/capability-marks.tsx` | Touch only if a tone lacks a mark - prefer existing tones |
| `web/marketing/app/features/page.tsx` | No structural change |

No new dependencies. No screenshot sync required for this pass.

## 8. Verification

1. `cd web/marketing && npm run dev` → open `/features`
2. Confirm five new tiles render with approved titles/blurbs
3. Confirm rewritten Backup / Health / GC / Schedule / Mods / Accounts / Spark blurbs
4. Desktop: more-grid rows fill full width; no holes
5. Mobile: single-column stack still readable
6. Showcase still shows the same seven lead/standard showcase cells
7. No “new in 1.2” chrome appears

## 9. Out of scope

- Homepage, How it works, Install, FAQ copy
- Demo bake / Modrinth release notes
- Capability-mark visual redesign
- Promoting any new tile into showcase

## 10. Plain-English summary (end user)

Features stays the same shape of page. It just lists a few more tools WatchTower already has in 1.2 beta 1 - soft-disable mods, edit configs, see a disk space map, use Spark’s chunk map, and pick theme/accent - and the backup tile finally says verify and test restore, not only “folder looks present.”
