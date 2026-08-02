# Script failed silently

**Script / datapack / KubeJS errors that never crash the server** often scroll off `latest.log` within minutes. Watchtower watches the log on the usual Scanning cadence and raises them as continuous [[Issues]] so they stay visible.

---

## What gets detected

| Kind | Typical trigger | Severity |
|------|-----------------|----------|
| **KubeJS** | `[KubeJS…/]` ERROR / Exception / failed | warning |
| **CraftTweaker** | `[CraftTweaker…]` ERROR lines | warning |
| **Datapack JSON** | `Couldn't parse data file` / `Couldn't parse element` | warning |
| **/reload failed** | `Failed to execute reload` / `Reload failed` | info |

When the failing **path** (and optional **line**) appears on the **same log line** as the trigger, the Issue message includes it — for example:

> KubeJS script error — `kubejs/server_scripts/machines.js:42`

Path capture is best-effort and same-line only. If the script path only appears on a later stack-trace line, the Issue is still raised, but without a path.

Watchtower does **not** edit scripts or datapacks for you.

---

## Where you see it

- [[Issues]] → Active → **Warning** (script & datapack failures land here by severity)
- Primary action opens [[Logs]]
- Issue id shape: `SILENT_FAIL:{kind}:{path-or-hash}`

Entries age out of ops-cache after about **7 days** without a re-hit, then the continuous Issue resolves.

---

## What to do

1. Open the reported path (when present) and fix the syntax / missing item / bad JSON
2. Run `/reload` (or the mod’s reload command) and confirm the error is gone from Logs
3. Mark the Issue **Reviewed** or **Hide** if you already handled it

Kill-switch: `SILENT_FAIL_DETECT_ENABLED` (default `true`) — see [[Configuration]].

---

## Related

- [[Issues]]
- [[Logs]]
- [[Mods]]
- [[Configuration]]
