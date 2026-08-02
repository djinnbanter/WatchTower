# Watchtower dashboard

> **Documentation has moved to the [GitHub Wiki](https://github.com/djinnbanter/WatchTower/wiki).**

- **[Dashboard Overview](https://github.com/djinnbanter/WatchTower/wiki/Dashboard-Overview)**
- **[Dashboard Tabs](https://github.com/djinnbanter/WatchTower/wiki/Dashboard-Tabs)**
- **[Live Charts](https://github.com/djinnbanter/WatchTower/wiki/Live-Charts)**
- **[HTTP API](https://github.com/djinnbanter/WatchTower/wiki/HTTP-API)**
- **[Security and Access](https://github.com/djinnbanter/WatchTower/wiki/Security-and-Access)**
- **[Accounts and Audit Log](https://github.com/djinnbanter/WatchTower/wiki/Accounts-And-Audit-Log)**

Source: [`docs/wiki/`](../../docs/wiki/) · UI code: `web/dashboard/`

### Settings panels

Open **Settings** (gear) or `?tab=settings&panel=<id>`:

| Panel | Who | Notes |
|-------|-----|-------|
| General, Monitoring, Backups, Alerts, Integrations | owner / admin | Viewers see read-only chrome where applicable |
| Security | signed-in user | Password, username, 2FA for your own account |
| Accounts | owner | Add people, change roles, reset temp passwords |
| Audit log | owner / admin | Who changed settings, acks, suppressions, accounts, sign-ins |
| About | anyone signed in | Install facts + relaunch setup wizard |

Details: wiki [Accounts and Audit Log](https://github.com/djinnbanter/WatchTower/wiki/Accounts-And-Audit-Log).

### Mod forensics / jdeps (1.0.17)

Owning-jar lookup uses `/api/mods/forensics/find-class` (entry scan). JDK **jdeps** is optional and offline-only — see wiki [[Dashboard Tabs]] and `tools/jdeps-mod-scan.mjs`. Watchtower does not spawn jdeps on the server.
