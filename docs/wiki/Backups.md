# Backups

Watchtower does **not** guess where your backups live — you choose a folder and/or connect panel/cloud signals.

---

## Quick pick

| Your backups are… | Do this | Time |
|-------------------|---------|------|
| **Folder on this server** (zip/tar you can browse) | **Backups** tab → Step A → **Choose backup folder** → Save | ~1 min |
| **On your host panel or cloud** (bloom, S3, rclone, etc.) | **Backups** tab → Step B → heartbeat / marker | ~2 min |
| **Both** | Configure Step A and Step B; tracking mode **Both** | ~2 min |
| **Not tracking backups** | **Backups** tab → Step B → **Not tracking** → Save | ~30 sec |

Until you configure something (or choose **Not tracking**), the **Backups** tab shows setup help and **Issues** may say backups are not set up. Settings → Backups only shows status and a link back here.

**Not tracking** sets `BACKUP_TRACKING_ENABLED=false`: Watchtower stops backup Issues, Overview backup alerts, and folder polling. Existing folder paths stay saved so you can turn tracking back on later.

---

## Step A — Local folder

1. Open the **Backups** tab
2. Under **Local folder**, click **Browse** (or type a path) — the field stays empty until you choose
3. Pick the directory that contains backup archives
4. Click **Save folder**

Watchtower scans that folder for recent archives. It never auto-fills a guessed path.

---

## Step B — External / cloud / panel

Use this when backups are written by a panel job, rclone, or cloud sync — not as loose files Watchtower can list.

1. On the **Backups** tab, open **External / cloud**
2. Choose tracking mode:
   - **Folder** — only local scan (Step A)
   - **Heartbeat** — your backup job calls Watchtower webhooks (or writes a marker file)
   - **Both** — folder inventory plus external signals
   - **Not tracking** — opt out completely (no backup Issues or alerts; folder paths kept)
3. Optional: set a **marker file** path your job touches when a backup finishes
4. Copy the webhook URLs (start / complete / fail) into your panel or script
5. Save external settings

**Cloud-only:** you may skip Step A. The tab will explain that inventory is empty until a folder is chosen, while heartbeat/marker still drive “last backup” health.

---

## What you see

- Recent archives (when a local folder is configured)
- Last external heartbeat / marker time
- Plain “what to do” when backups are missing or stale

Rescan refreshes the local inventory without a full report.

---

## See also

- [[Dashboard Tabs]]
- [[Installation]]
- [[HTTP API]] (`/api/backups/*`)
