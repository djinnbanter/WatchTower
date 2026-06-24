# Scheduled Reports

Automatic health reports keep your **Issues** list, **Activity** timeline, and trends useful without running `/watchtower run` by hand every time.

---

## At a glance

- **Default:** twice daily at **midnight and noon** (server local time)
- **Change in:** **Settings → General** — saves immediately, no restart
- **Turn off:** choose **Off** in Settings or `/watchtower schedule off`

---

## Turn on in the dashboard

1. Click **Settings** (gear icon)
2. **Scheduled reports** — default is **Twice daily (12:00 AM & 12:00 PM)**
3. Save happens automatically

Settings also shows when the next report will run, lookback window, and incremental scan toggle.

---

## Turn on with commands

```
/watchtower schedule show
/watchtower schedule set 60
/watchtower schedule off
```

Needs OP level 2 by default. See [[Commands]].

---

## What each scheduled report does

- Writes new summary and data files
- Refreshes **Issues**, **Crashes**, **Mods** in the dashboard
- Adds events to **Activity**
- Updates recovery readme on disk

It does **not** replace **Live** charts — those update separately while you watch.

---

## Choosing a schedule

| Schedule | Good for |
|----------|----------|
| Twice daily | **Default** — balanced for most servers |
| Every 60 minutes | Very active servers |
| Every 6 hours | Large modpacks, lighter load |
| Every 24 hours | Dev or low-priority servers |
| Off | You run reports manually only |

A longer “lookback” per report does not replace running reports often — it only widens how far back each scan reads logs.

---

## Technical details

| Key | Default | Notes |
|-----|---------|-------|
| `REPORT_SCHEDULE_MODE` | `wall_clock` | `wall_clock`, `interval`, or `off` |
| `REPORT_WALL_CLOCK_HOURS` | `0,12` | Hours 0–23, server local time |
| `REPORT_INTERVAL_MINUTES` | `720` | When mode is `interval` |

`watchtower-server.toml` `reportIntervalMinutes` is only the initial default — use `watchtower.conf` or Settings for live changes.

---

## See also

- [[Health Reports]]
- [[Configuration]]
- [[Dashboard Tabs#Activity]]
