# Mods

**Mods** is inventory, updates, conflicts, Modrinth metadata, and forensic diagnostics for your pack.

---

## When to open it

- After a crash or Issues card names a mod
- Checking for updates or known conflicts
- Investigating jar problems (forensics — not day-to-day)

---

## What you’ll see

The Mods page is a **management suite**: a mission hero, then a **Library** (full-width pack catalog). Tool pages live as **nested items under Mods in the main sidebar**.

| Area | One-line job |
|------|----------------|
| **Mods** (Library) | Pack inventory — filters All / Enabled / Disabled / Client / Server; search; click a mod for a full project page (header, sections, side rail with links and Modrinth CTAs) |
| **Updates** (sidebar under Mods) | Newer versions Watchtower knows about, with Safe / Caution / Break / Unknown impact on the project page |
| **Conflicts** (sidebar under Mods) | Version / dependency clashes |
| **Log errors** (sidebar under Mods) | Mod-related errors from Scanning |
| **Changes** (sidebar under Mods) | What changed in the pack recently |
| **Modrinth** (sidebar under Mods) | Online metadata (optional; privacy below) |
| **Forensics** (sidebar under Mods) | Deep jar / package ownership — use when debugging, not daily |

Client vs server chips tell you where a mod is expected to run. High-confidence **likely removable** client jars also appear on [[Issues]] under **Client-only jars**.

**Disable / Enable** (admin/owner): soft-rename a top-level jar under `mods/` to `name.jar.disabled` (Modrinth-style) or back. Disabled jars stay in the catalog with a **Disabled** badge — filter **All / Enabled / Disabled**. Nested jar-in-jar cannot be disabled this way. No Delete from the dashboard.

**World risk** badges appear when WatchTower finds evidence that disabling the mod may break the save (world dimension folders for that mod id, live dimension namespaces, or jar `data/<modId>/dimension/` paths). High risk requires an extra confirm. Overview shows a **Restart needed** chip until the server restarts after a jar change.

**Config** (from a mod’s project page, admin/owner to save): opens a popup editor for that mod’s config under `config/` (matched by path name). Clean `.toml` files open as a **form** (sections, toggles, numbers, strings) with a **Form | Raw** toggle; other formats and unparseable TOML stay raw-only. If several files match, pick one from the header dropdown. Review a simple diff, then save. Form saves only change setting values in place — comments, blank lines, and layout stay as they were. WatchTower writes a timestamped backup under `watchtower/config-backups/` first and keeps the last 10 per file. **Undo** restores the newest backup. Viewers can read but not save. Kill-switch: `MOD_CONFIG_EDIT_ENABLED=false` hides the API. Does not edit `server.properties`, `world/serverconfig/`, or jars. After a save, restart if the mod only reloads config on boot. Paths from Forensics → Config health that start with `config/` deep-link to the matching mod’s Config popup.

**Changes** shows pack add/remove/update. If a jar’s contents change **without** a version bump, Watchtower raises **Jar drift** on [[Issues]] (checksum lock) — confirm the swap was intentional.

---

## Modrinth privacy

Modrinth lookup is **optional**. When enabled (Welcome options or Settings), Watchtower may query Modrinth for project metadata. It does not upload your world or player data. Turn it off if your policy forbids outbound lookups.

---

## What to do next

1. Start on **Mods** (Library) or **Conflicts** in the sidebar for day-to-day
2. Open **Updates** in the sidebar when planning a pack bump (open a mod for pack-impact detail)
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
