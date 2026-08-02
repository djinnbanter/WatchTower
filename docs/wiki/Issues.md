# Issues

**Issues** is your fix inbox — live peeks, scanning ledger, boot findings, and crash pointers in one place.

---

## When to open it

- Daily check after Overview
- Something feels wrong but you are not sure where to start
- Boot or lag cards appeared in Overview’s attention queue

---

## What you’ll see

| View | Job |
|------|-----|
| **Active** | Open problems to work |
| **Reviewed** | Items you already handled |
| **Tools** | Filters and inbox utilities |

On a card, open **Fix** for recommended next steps or **Details** for evidence. Boot-related filters help when Startup flagged config or launch problems.

Active groups by severity only (**Critical** → **Warning** → **Info**). Pack-trust findings still appear in those bands by their severity:

| Finding | Typical severity | Meaning |
|---------|------------------|---------|
| **Jar drift** | Warning | Same jar filename + version, different checksum since last baseline — verify the file swap was intentional ([[Mods]] → Changes) |
| **Client-only jars** | Info | High-confidence likely-removable client mods on this dedicated server ([[Mods]] → Overview, Client filter) |
| **Script & datapack failures** | Warning | KubeJS / CraftTweaker / datapack JSON / `/reload` silent fails from the live log — see [[Script-Failed-Silently]] |
| **World pressure** | Warning | Sustained item storms and mob spikes — see [[World-Pressure]] |
| **Join clinic** | Warning / Info | Pack sync join rejections (`JOIN_SYNC`) — see [[Join-Clinic]] |
| **Server tick frozen** | Critical | Process up but ticks stalled (`SOFT_HANG`) - optional dump under `watchtower/hangs/` when `SOFT_HANG_THREAD_DUMP=true` |

Kill-switches: `MOD_JAR_DRIFT_ENABLED`, `CLIENT_ON_SERVER_ISSUES_ENABLED`, `SILENT_FAIL_DETECT_ENABLED`, `WORLD_PRESSURE_ENABLED`, `JOIN_CLINIC_ENABLED`, `SOFT_HANG_ENABLED` in `watchtower.conf` — see [[Configuration]].


If the server process is up but ticks stop, WatchTower raises **Server tick frozen** (`SOFT_HANG`) with phase and how long it has been stuck. Optional hang dumps land under `watchtower/hangs/` when `SOFT_HANG_THREAD_DUMP=true`. When a hang dump is available, WatchTower also shows a likely cause category and may hint at a suspect mod — treat that as a lead, not proof. WatchTower never restarts the server for you.
---

## What to do next

1. Sort by severity — tackle Active top cards first
2. Follow **Fix** links into [[Crashes]], [[Mods]], [[Live-Charts]], or [[Sources]] as needed
3. Mark reviewed when done so the inbox stays honest

Dismissing / reviewing does **not** delete underlying crash files or mod jars — it only clears your inbox state.

---

## Healthy vs problem

| Healthy | Problem |
|---------|---------|
| Active empty or only low-noise items | Repeated high-severity lag, crash, disk, or backup cards |
| Fresh Scanning on [[Sources]] | Stale Sources while Issues look empty |

Issues is not a replacement for deep crash work ([[Crashes]]) or mod forensics ([[Mods]]).

---

## Related

- [[Crashes]]
- [[Mods]]
- [[Sources]]
- [[Script-Failed-Silently]]
- [[Troubleshooting]]
- [[Dashboard-Overview]]
- [[Startup]]
