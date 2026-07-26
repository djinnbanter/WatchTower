# Commands

Use these in the **server console** or **in-game** (if you have permission). Most commands need **OP level 2** unless noted.

All commands start with **`/watchtower`**.

---

## Commands you will use most

| Command | What it does |
|---------|----------------|
| `/watchtower run` | Compose a **support bundle** (Quick preset) from Watching + Scanning |
| `/watchtower diagnostics` | Same Support compose path — share with host / mod authors |
| `/watchtower brief` | Print latest **legacy** report summary when a non-support facts file exists |
| `/watchtower issues` | List up to 12 active problems |
| `/watchtower status` | Quick snapshot: TPS, lag, players, mods, issue counts |
| `/watchtower url` | Print dashboard URL |

For presets and log pickers, prefer the dashboard rail **Build support pack** — [[Health-Reports]]. Day-to-day tabs do **not** require `/watchtower run`.

---

## Optional schedule (legacy)

Legacy deep audits — see [[Health-Reports]]. New installs default **Off**.

| Command | What it does |
|---------|----------------|
| `/watchtower schedule show` | Show current schedule |
| `/watchtower schedule set 60` | Interval example (minutes) |
| `/watchtower schedule off` | Turn off |

Not exposed in Settings — use commands or `watchtower.conf`.

---

## Dashboard login (OP level 4)

| Command | What it does |
|---------|----------------|
| `/watchtower dashboard reset-password` | Reset to `watchtower` / `password` |
| `/watchtower dashboard reset-password clear-2fa` | Same, and turns off 2FA |

See [[Security-and-Access]].

---

## Files on disk

```text
<server>/watchtower/watchtower-support-<timestamp>.zip   ← Support compose
<server>/watchtower/watchtower-facts-support-*.json      ← Compose / zip only
<server>/watchtower/watchtower-brief-*.txt               ← Legacy (optional)
<server>/watchtower/watchtower-facts-*.json              ← Legacy (optional)
```

---

## Related

- [[Health-Reports]]
- [[Configuration]]
- [[Disaster-Recovery]]
