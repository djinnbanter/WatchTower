# Backups

Watchtower does **not** guess where your backups live — you choose a folder and/or connect panel/cloud signals.

---

## Quick pick

| Your backups are… | Do this | Time |
|-------------------|---------|------|
| **Folder on this server** | **Backups** → Step A → choose folder → Save | ~1 min |
| **On your host panel or cloud** | **Backups** → Step B → heartbeat / marker | ~2 min |
| **Both** | Step A + Step B; mode **Both** | ~2 min |
| **Not tracking** | Step B → **Not tracking** → Save | ~30 sec |

Until you configure something (or choose **Not tracking**), the tab shows setup help and [[Issues]] may say backups are not set up. **Settings → Backups** shows status and links back here.

**Not tracking** stops backup Issues, Overview backup alerts, and folder polling. Saved folder paths stay so you can re-enable later.

---

## Step A — Local folder

1. Open **Backups**
2. Under **Local folder**, **Browse** (or type a path)
3. Pick the directory that contains backup archives
4. **Save folder**

Watchtower never auto-fills a guessed path.

---

## Step B — External / cloud / panel

1. Open **External / cloud**
2. Choose mode: **Folder** · **Heartbeat** · **Both** · **Not tracking**
3. Optional marker file path
4. Copy webhook URLs into your panel/script
5. Save

**Cloud-only:** skip Step A; heartbeat/marker still drive last-backup health.

---

## What you see

- Hero KPIs for freshness
- Archives list/detail (when a local folder is configured)
- Setup checklist
- Storage locations summary

Rescan refreshes local inventory without Support compose.

**Job freshness:** open [[Sources]] → **Backup scan** to see when the poller last ran and when the next pull is due.

---

## Related

- [[Sources]]
- [[Issues]]
- [[Quick-Start-Checklist]]
- [[Configuration]]
- [[HTTP-API]] (`/api/backups/*`)
