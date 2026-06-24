# DR Viewer

A **web page you open in your browser** to understand a recovery zip when the server will not boot. No login, no live dashboard — just diagnosis from the bundle.

> **Early preview:** The DR viewer is in **very early development**. Tabs, upload flows, and Fix-tab guidance may be incomplete or behave unexpectedly. Prefer the **DR CLI** bundle and manual log review when you need a reliable path; report issues on [GitHub](https://github.com/djinnbanter/WatchTower/issues).

---

## At a glance

- **Upload:** `watchtower-dr-bundle-*.zip` from [[Disaster Recovery]]
- **Or:** drop log folders / old facts JSON manually
- **Privacy:** everything runs in your browser — files are not uploaded to a remote server

---

## How to use it

1. Get a bundle zip (see [[Disaster Recovery]])
2. Open the DR viewer URL (your host may set one in config — check `DR-README.txt`)
3. Upload the zip on the landing screen
4. Start on **Fix** — follow prioritized steps
5. Use **Logs**, **Mods**, **Report** tabs as needed

### No zip?

Expand **Advanced: analyze log files locally** and drop a folder with `logs/`, `crash-reports/`, and `mods/`.

---

## Host it yourself (optional)

Publish the `web/dr-viewer/` folder to any static website (GitHub Pages, Cloudflare Pages, etc.).

Optional in `watchtower.conf`:

```ini
DR_VIEWER_URL=https://your-site.example/watchtower-dr/
```

That URL is written into `DR-README.txt` after each successful report.

---

## What's not included

Compared to the live dashboard: no Live charts, no Backups tab, no sign-in.

---

## Technical details

- Local dev: `npm run serve` in `web/dr-viewer` → http://localhost:8790
- Must be served over **HTTP** — opening `index.html` as `file://` breaks some features

---

## See also

- [[Disaster Recovery]]
- [[DR CLI Reference]]
