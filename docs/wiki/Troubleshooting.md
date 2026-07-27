# Troubleshooting

Symptom → where to click. Prefer the linked tab guide after you land.

---

## Quick index

| If you see… | Open first |
|-------------|------------|
| Lag / low TPS right now | [[Live-Charts|Live]] → [[Issues]] → [[Using-Spark-with-Watchtower|Spark]] |
| Crash / restart loop | [[Crashes]] → [[Logs]] |
| Empty or stale Overview / Issues | [[Sources]] → refresh browser |
| “Is Watchtower working?” | [[Sources]] |
| Login / password / 2FA | Below + [[Security-and-Access]] |
| Backup worry | [[Backups]] → Sources → Backup scan |
| Blank charts | Live + hard-refresh; see [[Live-Charts]] |
| Need to share with host | Rail **Build support pack** · [[Health-Reports]] |
| Server will not start | [[Disaster-Recovery]] |
| Lost in the UI | [[Dashboard-Tabs]] · **Help Center** |

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

Hard-refresh the browser (`Ctrl+Shift+R`) after updating the mod.

---

## Dashboard looks empty or stale

### Overview / Issues empty

**Usually:** Watching/Scanning still warming up, or the browser needs a refresh.

**Fix:** Open [[Sources]] for freshness. Open [[Live-Charts|Live]] and [[Issues]] — Scanning fills Issues without a deep audit. Resume Welcome if setup is unfinished. For a shareable snapshot: rail **Build support pack** or [[Health-Reports]].

### Crashes tab empty

Open [[Crashes]] and wait for Scanning, or click **Refresh** (background folder scan).

### Activity tab has few events

Activity fills from Scanning and gap backfill. **Refresh** on [[Activity]] helps without a full audit.

### Live numbers work but charts are blank

Replace the mod JAR if needed, hard-refresh the browser. See [[Live-Charts]].

### Charts slow on long ranges

Normal — long ranges refresh less often. Try a shorter window.

### Session tab empty

Server must be **online**. Playtime deepens from Scanning. See [[Session]].

---

## Support compose / diagnostics

### `/watchtower diagnostics` or Support download fails

Wait for Scanning to write `ops-cache.json` (usually within a minute after boot). Retry rail **Build support pack** or `/watchtower diagnostics`. Compose builds from continuous data — no legacy facts file required.

> **Coming soon:** the in-app zip download may still be finishing. You can still use console commands and the DR CLI when you need a bundle today.

---

## Backups

| Symptom | Fix |
|---------|-----|
| “Not tracking” and you expected a folder | [[Backups]] — complete Step A (folder) and optional Step B (webhook) |
| Freshness looks wrong | [[Sources]] → Backup scan job; Settings → Backups |

---

## Performance

| Symptom | Path |
|---------|------|
| Lag spike now | Live → Issues → Spark profile |
| Patterns over days | [[Insights]] |
| Suspect a mod | [[Mods]] + Spark Sources (profile share — not Ops Sources) |

---

## When to escalate

1. [[Health-Reports]] — Support pack for your host or a mod author  
2. [[Disaster-Recovery]] — server will not start  
3. [[DR-CLI-Reference]] — recovery tool flags  

---

## Related

- [[Dashboard-Tabs]]
- [[Understanding-Data-Sources]]
- [[Sources]]
- [[Commands]]
