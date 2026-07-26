# Downloads and Releases

Watchtower ships **two files** per version: the mod (for your server) and a recovery tool (for when the server won't boot).

---

## Which file goes where

| File pattern | Where to put it |
|--------------|-----------------|
| `watchtower-neoforge-*+mc1.21.jar` | Server **`mods/`** — **required** |
| `watchtower-cli-*.jar` | Same **`mods/`** — **recommended** (not loaded as a mod; `java -jar` over SSH) |

Always take the **current release** from the links below — filenames include the version number.

---

## Download

| Source | Link |
|--------|------|
| **GitHub Releases** | https://github.com/djinnbanter/WatchTower/releases |
| **Modrinth** | https://modrinth.com/mod/watchtower |

JARs are not stored in the git repo — download from releases or build from source.

---

## After download

1. Install per [[Installation]]
2. First login per [[Quick-Start-Checklist]]
3. Keep the CLI jar for [[Disaster-Recovery]]

Match CLI version to mod version when possible.

---

## Related

- [[Installation]]
- [[Changelog]]
- [[Roadmap]]
