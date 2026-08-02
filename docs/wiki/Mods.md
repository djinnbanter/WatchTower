# Mods

**Mods** is inventory, updates, conflicts, Modrinth metadata, and forensic diagnostics for your pack.

---

## When to open it

- After a crash or Issues card names a mod
- Checking for updates or known conflicts
- Investigating jar problems (forensics — not day-to-day)

---

## What you’ll see

| View | One-line job |
|------|----------------|
| **Overview** | Pack inventory and status |
| **Updates** | Newer versions Watchtower knows about |
| **Conflicts** | Version / dependency clashes |
| **Log errors** | Mod-related errors from Scanning |
| **Changes** | What changed in the pack recently |
| **Configs** | Form edit for clean `.toml` under `config/` (raw fallback; backup + undo) |
| **Modrinth** | Online metadata (optional; privacy below) |
| **Forensics** | Deep jar / package ownership — use when debugging, not daily |

Client vs server chips tell you where a mod is expected to run. High-confidence **likely removable** client jars also appear on [[Issues]] under **Client-only jars**.

**Disable / Enable** (admin/owner): soft-rename a top-level jar under `mods/` to `name.jar.disabled` (Modrinth-style) or back. Disabled jars stay in the catalog with a **Disabled** badge — filter **All / Enabled / Disabled**. Nested jar-in-jar cannot be disabled this way. No Delete from the dashboard.

**World risk** badges appear when WatchTower finds evidence that disabling the mod may break the save (world dimension folders for that mod id, live dimension namespaces, or jar `data/<modId>/dimension/` paths). High risk requires an extra confirm. Overview shows a **Restart needed** chip until the server restarts after a jar change.

**Configs** (admin/owner to save): open a file under `config/`. Clean `.toml` files open as a **form** (sections, toggles, numbers, strings) with a **Form | Raw** toggle; other formats and unparseable TOML stay raw-only. Review a simple diff, then save. Form saves rewrite the TOML cleanly — original comments may be dropped; values stay correct. WatchTower writes a timestamped backup under `watchtower/config-backups/` first and keeps the last 10 per file. **Undo** restores the newest backup. Viewers can read but not save. Kill-switch: `MOD_CONFIG_EDIT_ENABLED=false` hides the API. Does not edit `server.properties`, `world/serverconfig/`, or jars. After a save, restart if the mod only reloads config on boot. Paths from Forensics → Config health that start with `config/` deep-link here.

**Changes** shows pack add/remove/update. If a jar’s contents change **without** a version bump, Watchtower raises **Jar drift** on [[Issues]] (checksum lock) — confirm the swap was intentional.

---

## Modrinth privacy

Modrinth lookup is **optional**. When enabled (Welcome options or Settings), Watchtower may query Modrinth for project metadata. It does not upload your world or player data. Turn it off if your policy forbids outbound lookups.

---

## What to do next

1. Start on **Overview** / **Conflicts** for day-to-day
2. Use **Updates** when planning a pack bump
3. Open **Forensics** only when Fix/Crashes asks for package ownership
4. Cross-check lag suspects with Spark → **Sources** (profile share — not Ops [[Sources]])

---

## Healthy vs problem

| Healthy | Problem |
|---------|---------|
| Conflicts quiet, inventory matches disk | Unresolved conflicts after every boot |
| Modrinth disabled or fresh | Forensics error state — see Tools / status |

---

## Related

- [[Issues]]
- [[Crashes]]
- [[Installation]] — privacy on first setup
- [[Using-Spark-with-Watchtower]]
- [[Configuration]]
