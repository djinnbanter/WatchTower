# DR Viewer

A **web page in your browser** to understand a recovery zip when the server will not boot. No login, no live dashboard — diagnosis from the bundle only.

> **Coming soon:** some Fix-tab guidance, upload flows, and tabs may still be incomplete. Prefer the **DR CLI** zip plus manual log review when you need a reliable path today. Report issues on [GitHub](https://github.com/djinnbanter/WatchTower/issues).

---

## At a glance

- **Upload:** `watchtower-dr-bundle-*.zip` from [[Disaster-Recovery]]
- **Or:** drop log folders / old facts JSON manually
- **Privacy:** runs in your browser — files are not uploaded to a remote Watchtower server

---

## How to use it

1. Get a bundle zip ([[Disaster-Recovery]] / [[DR-CLI-Reference]])
2. Open the DR viewer URL (often in `DR-README.txt`)
3. Upload the zip
4. Start on **Fix** when available — otherwise open Logs / files in the zip
5. Use **Logs**, **Mods**, **Report** tabs as they appear on your build

### No zip?

Expand **Advanced: analyze log files locally** and drop a folder with `logs/`, `crash-reports/`, and `mods/`.

---

## Host it yourself (optional)

Publish the `web/dr-viewer/` folder to any static host.

Optional in `watchtower.conf`:

```ini
DR_VIEWER_URL=https://your-site.example/watchtower-dr/
```

---

## What's not included

No Live charts, no Backups tab, no sign-in — this is recovery-only.

---

## Related

- [[Disaster-Recovery]]
- [[DR-CLI-Reference]]
