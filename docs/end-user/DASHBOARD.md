# Watchtower dashboard

> **Documentation has moved to the [GitHub Wiki](https://github.com/djinnbanter/WatchTower/wiki).**

- **[Dashboard Overview](https://github.com/djinnbanter/WatchTower/wiki/Dashboard-Overview)**
- **[Dashboard Tabs](https://github.com/djinnbanter/WatchTower/wiki/Dashboard-Tabs)**
- **[Live Charts](https://github.com/djinnbanter/WatchTower/wiki/Live-Charts)**
- **[HTTP API](https://github.com/djinnbanter/WatchTower/wiki/HTTP-API)**
- **[Security and Access](https://github.com/djinnbanter/WatchTower/wiki/Security-and-Access)**

Source: [`docs/wiki/`](../../docs/wiki/) · UI code: `web/dashboard-alpha/`

### Mod forensics / jdeps (1.0.17)

Owning-jar lookup uses `/api/mods/forensics/find-class` (entry scan). JDK **jdeps** is optional and offline-only — see wiki [[Dashboard Tabs]] and `tools/jdeps-mod-scan.mjs`. Watchtower does not spawn jdeps on the server.
