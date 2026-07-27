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
| **Modrinth** | Online metadata (optional; privacy below) |
| **Forensics** | Deep jar / package ownership — use when debugging, not daily |

Client vs server chips tell you where a mod is expected to run.

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
