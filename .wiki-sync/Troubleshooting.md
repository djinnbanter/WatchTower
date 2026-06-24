# Troubleshooting

Symptom-first fixes for common Watchtower problems.

---

## Can't log in

### Default password doesn't work

Try `watchtower` / `password`. If someone already changed it, use that password or ask an admin to run `/watchtower dashboard reset-password` (OP 4).

### Forgot password

| 2FA on? | Fix |
|---------|-----|
| No | `/watchtower dashboard reset-password` → back to `password` |
| Yes | Recovery code at login, then change password in **Settings → Security** |
| Lost 2FA device | `/watchtower dashboard reset-password clear-2fa` (OP 4) |

### Too many wrong attempts

Wait **15 minutes** (5 tries per IP).

### Stuck on "Checking session…"

Hard-refresh the browser (`Ctrl+Shift+R`) after updating the mod. Use Watchtower **1.0.0+**.

---

## Dashboard looks empty or stale

### Overview / Issues empty

**Usually:** no full health report yet.

**Fix:** Click **Run Report** or `/watchtower run`. The full **Issues** list needs a report; some other tabs update from background scans sooner.

### Crashes tab empty

Run a report, or open **Crashes** and click **Refresh** (background folder scan).

### Activity tab has few events

Turn on [[Scheduled Reports]] and run reports regularly. **Refresh** on Activity helps without a full report.

### Live numbers work but charts are blank

Update to **1.0.0+**, replace the mod JAR, hard-refresh the browser.

### Charts slow on 90-day range

Normal — long ranges refresh less often. Try a shorter range if needed.

### Session tab empty

Server must be **online**. Run a report for historical playtime stats.

---

## Reports

### Report stuck or failed

- Check server console for errors
- Ensure enough disk space
- Very large logs may need longer timeout in TOML (`reportTimeoutMinutes`)

### `/watchtower diagnostics` fails

Run `/watchtower run` successfully first.

---

## Backups

### Always says "not configured"

Set backup location — **Backups** tab or **Settings → Backups**.

### Backups not found after choosing folder

- Path must be readable by the server process
- Click **Rescan**
- Archives should be `.tar.gz`, `.zip`, or similar

---

## Network and security

### Yellow exposure banner

Dashboard may be reachable from outside. On public hosts, bind to localhost and use SSH tunnel — [[Security and Access]].

### Can't reach port 8787

- Check firewall and panel port settings
- Confirm dashboard is enabled in TOML
- On the server itself, try `http://127.0.0.1:8787`

---

## Server won't boot (recovery)

### CLI can't find server folder

Run from `mods/` or use `--server /path` — [[DR CLI Reference]].

### Can't write zip on panel

`java -jar watchtower-cli-*.jar dr --out /tmp`

### DR viewer blank

Open via a web server (HTTP), not `file://` — [[DR Viewer]].

---

## Mods and hosting

### Wrong hosting panel shown

Set `PANEL=none` or the correct panel in config — [[Hosting Panels]].

### Temperature missing on Live tab

Normal on VPS/containers.

### Health still "critical" after fixing crashes

Mark crashes as **reviewed** on the **Crashes** tab.

### Client mod warnings

Often harmless — **Keep on server** on **Mods** tab or remove client-only mods.

---

## Installation

### Crash on boot: QrGenerator / TOTP error

Update to **1.0.0+** JAR (TOTP libraries included).

### CLI JAR in mods folder?

**Yes — recommended.** NeoForge does not load it as a mod.

---

## Still stuck?

1. `/watchtower diagnostics` — share zip (redact secrets)
2. [GitHub Issues](https://github.com/djinnbanter/WatchTower/issues)
3. Include: NeoForge version, host type, relevant log excerpt

---

## See also

- [[Security and Access]]
- [[Health Reports]]
- [[Disaster Recovery]]
