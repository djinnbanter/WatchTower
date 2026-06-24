# Hosting Panels

If you use a **hosting panel** (Crafty, Pterodactyl, bloom, AMP, and others), Watchtower can detect it and show helpful context. It still will **not** find your backups automatically — you set those separately.

---

## At a glance

- **Default:** automatic detection (`PANEL=auto`)
- **Wrong panel shown?** Set `PANEL=none` or the correct panel name in config
- **Backups:** always set up manually — [[Backups]]

---

## Panels Watchtower recognizes

When set to auto, Watchtower looks for common setups including:

Crafty, Pterodactyl / Pelican, PufferPanel, MCSManager, AMP, Multicraft, MineOS, Docker, and bare-metal installs.

Some panels must be set manually (TCAdmin, WISP, PebbleHost).

---

## bloom.host / VPS / containers

| Concern | What to do |
|---------|------------|
| Dashboard on public IP | Bind to localhost + SSH tunnel — [[Security and Access]] |
| Temperature missing on charts | Normal on VPS — not always available |
| Cannot see backup folder | Use **Settings → Backups** for panel-only backups |
| Recovery tool cannot write | Run CLI with output to `/tmp` |

---

## Backup hints

Watchtower may suggest where backups *might* live, but you confirm the path:

- **Backups** tab → **Choose backup folder** if files are on this server
- **Settings → Backups** if backups stay on the panel or cloud only

Issue messages: `BACKUP_NOT_CONFIGURED`, `BACKUP_NOT_FOUND`, `BACKUP_STALE` — see [[Backups]].

---

## Technical details

### Force or disable panel detection

```ini
PANEL=auto          # default
PANEL=none          # disable integration
PANEL=crafty        # force a panel
CRAFTY_ROOT=/path/to/crafty
```

Common root keys: `CRAFTY_ROOT`, `PTERODACTYL_ROOT`, `AMP_ROOT`, `MINEOS_ROOT`.

### Crafty API (when RCON unavailable)

```ini
CRAFTY_URL=https://your-panel:8443
CRAFTY_API_TOKEN=your-token
CRAFTY_SERVER_UUID=server-uuid
```

See [watchtower.conf.example](https://github.com/djinnbanter/WatchTower/blob/main/tools/watchtower.conf.example).

---

## See also

- [[Configuration]]
- [[Backups]]
- [[Security and Access]]
