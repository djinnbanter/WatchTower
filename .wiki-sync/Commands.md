# Commands

Use these in the **server console** or **in-game** (if you have permission). Most commands need **OP level 2** unless noted.

All commands start with **`/watchtower`**.

---

## Commands you will use most

### `/watchtower run [hours]`

Run a **full health report** now.

- Optional `hours` — how far back to look (1–720). Default comes from Settings.
- **Example:** `/watchtower run 720` — 30-day first baseline
- Creates readable summary and data files in `watchtower/`

### `/watchtower brief`

Print the latest report summary in chat (up to 24 lines). Run a report first if none exists.

### `/watchtower issues`

List up to 12 active problems from the last report — severity and short title.

### `/watchtower status`

Quick snapshot: TPS, lag, players, mod count, when last report ran, issue counts.

### `/watchtower diagnostics`

Build a **support zip** (facts, brief, log tail, crash summaries) to share with your host or mod authors. Needs at least one successful report first.

---

## Scheduled reports

You can also change the schedule in **Settings → General** — see [[Scheduled Reports]].

| Command | What it does |
|---------|----------------|
| `/watchtower schedule show` | Show current schedule |
| `/watchtower schedule set 60` | Run a full report every 60 minutes |
| `/watchtower schedule off` | Turn off automatic reports |

---

## Dashboard login (OP level 4)

| Command | What it does |
|---------|----------------|
| `/watchtower dashboard reset-password` | Reset login to `watchtower` / `password` — must change on next login |
| `/watchtower dashboard reset-password clear-2fa` | Same, and turns off 2FA |

See [[Security and Access]] for when to use these.

---

## Report files on disk

```text
<server>/watchtower/watchtower-brief-<timestamp>.txt
<server>/watchtower/watchtower-facts-<timestamp>.json
```

---

## Technical details

- Default permission: OP level 2 (`commandPermissionLevel` in `watchtower-server.toml`)
- Schedule keys: `REPORT_SCHEDULE_MODE`, `REPORT_WALL_CLOCK_HOURS`, `REPORT_INTERVAL_MINUTES` in `watchtower.conf`

---

## See also

- [[Health Reports]]
- [[Scheduled Reports]]
- [[Configuration]]
