# Disaster Recovery

Use this when **Minecraft will not start** — crash loop, mod error on boot, or the panel keeps restarting. The dashboard is not available; you work over **SSH** on the host.

---

## Quick steps

| Step | What to do |
|------|------------|
| 1 | SSH to your server, go to the **`mods/`** folder |
| 2 | Run `java -jar watchtower-cli-<version>.jar dr` (match [[Downloads-and-Releases]]) |
| 3 | Download the zip it creates |
| 4 | Prefer reading the zip contents / logs first. Optionally open [[DR-Viewer]] — **Coming soon** for full Fix-tab reliability |

---

## When to use this

| Situation | Use recovery tools? |
|-----------|---------------------|
| Server crash loop, won't stay up | **Yes** |
| Mod won't load on boot | **Yes** |
| Server running fine | **No** — use the dashboard + Watching/Scanning |
| Want live charts | **No** — recovery path has no Live tab |

---

## Run the recovery tool

```bash
cd /path/to/your/server/mods
java -jar watchtower-cli-<version>.jar dr
```

Creates **`watchtower-dr-bundle-<timestamp>.zip`** in the current folder.

Analysis in [[DR-Viewer]] runs **in your browser** — nothing is sent to Watchtower servers. If the viewer is incomplete, open the zip and inspect logs / crash-reports directly. Full CLI flags: [[DR-CLI-Reference]].

---

## Before problems happen

Successful Support / legacy report flows update `watchtower/DR-README.txt` with the exact command for your path. Keep **`watchtower-cli-*.jar`** in `mods/` ahead of time.

---

## Panel won't let you save the zip?

```bash
java -jar watchtower-cli-<version>.jar dr --out /tmp
```

Download from `/tmp` via SFTP.

---

## No CLI? Manual files

Drop into the viewer (or inspect locally):

- `logs/latest.log` (required)
- `crash-reports/*.txt` (recommended)
- `mods/*.jar` (optional)

---

## Privacy

Bundle review is **local to your browser** when using the viewer. Optional cache stays on your machine.

---

## Related

- [[DR-CLI-Reference]]
- [[DR-Viewer]]
- [[Troubleshooting]]
- [[Downloads-and-Releases]]
