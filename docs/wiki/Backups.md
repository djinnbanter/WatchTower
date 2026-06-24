# Backups

Watchtower can tell you whether backups are **recent and configured** — but only after you tell it **where backups live**. It does not guess backup folders or panel jobs.

---

## At a glance — pick your setup

| Where your backups are | Where to set up | Time |
|------------------------|-----------------|------|
| **Folder on this server** (zip/tar files you can browse) | **Backups** tab → **Choose backup folder** | ~1 min |
| **On your host panel or cloud** (bloom, S3, etc.) | **Settings → Backups** wizard | ~2 min |
| **Both** | **Settings → Backups** | ~2 min |

---

## Folder backups (files on this server)

1. Open **Backups** tab (or **Settings → Backups** → local section)
2. Click **Choose backup folder**
3. Browse to where your panel stores `.zip` / `.tar.gz` backups
4. Confirm — Watchtower scans and saves the path
5. Click **Rescan** after new backups run

Until configured, the **Backups** tab shows setup help and **Issues** may say backups are not set up.

---

## Panel or cloud backups (files not on this server)

Common on **bloom.host**, Docker, and S3-style backups.

**Settings → Backups** — two-step wizard:

1. Choose **On my panel only** (or **Both**) → **Continue**
2. Copy the command → paste into your panel’s “after backup” task → **Test it worked**

Watchtower shows steps tailored to Crafty, Pterodactyl, bloom, and others.

---

## What you see on the Backups tab

- Last backup age and status
- **Panel backups** section when panel signal is configured
- Table of archive files (name, size, date)
- Plain “what to do” steps when something is wrong

---

## When backups look wrong

| Message | Meaning | Fix |
|---------|---------|-----|
| Not configured | No folder or panel signal | **Settings → Backups** or choose folder |
| Not found | Path empty or wrong | Check path, rescan |
| Stale | Nothing recent | Check panel backup schedule |

---

## Tips by host type

| Host | Tip |
|------|-----|
| Crafty | Often under `crafty-4/backups` |
| Pterodactyl | Path varies — check panel docs |
| bloom / VPS | Use SFTP to find path, then pick in browser |
| Manual | Point at your `.tar.gz` / `.zip` exports |

---

## Technical details

### Config keys (`watchtower.conf`)

`BACKUP_DIRS`, `BACKUP_WEBHOOK_TOKEN`, `BACKUP_EXTERNAL_MARKER`, `BACKUP_SUPPRESS_LOCAL_MISSING`

### Manual panel heartbeat (curl)

```bash
curl -sS -X POST "http://127.0.0.1:8787/api/backups/heartbeat" \
  -H "Authorization: Bearer your-secret" \
  -H "Content-Type: application/json" \
  -d '{"last_at":"'"$(date -Iseconds)"'","source":"panel","status":"success"}'
```

### Status file JSON (`backup-heartbeat.json`)

Fields: `last_at` (required), `source`, `status`, `detail`, `size_gb`, `remote_uri`.

Supported archives: `.tar.gz`, `.zip`, common panel formats.

---

## See also

- [[Quick Start Checklist]]
- [[Hosting Panels]]
- [[Configuration]]
