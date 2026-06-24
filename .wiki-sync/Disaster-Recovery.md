# Disaster Recovery

Use this when **Minecraft will not start** — crash loop, mod error on boot, or the panel keeps restarting. The dashboard is not available; you work over **SSH** on the host.

---

## Quick steps

| Step | What to do |
|------|------------|
| 1 | SSH to your server, go to the **`mods/`** folder |
| 2 | Run `java -jar watchtower-cli-1.0.0.jar dr` |
| 3 | Download the zip file it creates |
| 4 | Open it in the [[DR Viewer]] in your browser — start on the **Fix** tab |

---

## When to use this

| Situation | Use recovery tools? |
|-----------|---------------------|
| Server crash loop, won't stay up | **Yes** |
| Mod won't load on boot | **Yes** |
| Server running fine | **No** — use dashboard + **Run Report** |
| Want live charts | **No** — recovery viewer has no Live tab |

---

## Run the recovery tool

```bash
cd /path/to/your/server/mods
java -jar watchtower-cli-1.0.0.jar dr
```

Creates **`watchtower-dr-bundle-<timestamp>.zip`** in the current folder.

Upload that zip to the [[DR Viewer]]. Analysis runs **in your browser** — nothing is sent to Watchtower's servers.

---

## Before problems happen

Each successful health report updates `watchtower/DR-README.txt` with the exact command for your server path.

Keep **`watchtower-cli-*.jar`** in `mods/` ahead of time, or download from [Releases](https://github.com/djinnbanter/WatchTower/releases) during an incident.

---

## Panel won't let you save the zip?

```bash
java -jar watchtower-cli-1.0.0.jar dr --out /tmp
```

Download from `/tmp` via SFTP.

---

## No CLI? Manual upload

In the DR viewer, expand **Advanced: analyze log files locally** and upload:

- `logs/latest.log` (required)
- `crash-reports/*.txt` (recommended)
- `mods/*.jar` (optional)
- Old `watchtower-facts-*.json` (optional)

---

## DR viewer tabs

| Tab | Purpose |
|-----|---------|
| **Fix** | What went wrong and what to try first |
| **Attempts** | Restart attempts since last good boot |
| **Logs** | Log excerpts from the bundle |
| **Mods** | What changed vs last report |
| **Report** | Full brief-style summary |

---

## Privacy

Analysis is **100% in your browser**. Optional cache stays on your machine only.

---

## See also

- [[DR CLI Reference]]
- [[DR Viewer]]
