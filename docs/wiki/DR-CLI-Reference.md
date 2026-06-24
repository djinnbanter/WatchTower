# DR CLI Reference

**When you need this:** the game server **will not boot** and you have SSH access to the Linux host. This command-line tool builds a zip you open in the [[DR Viewer]].

---

## Quick usage

```bash
cd /path/to/your/server/mods
java -jar watchtower-cli-1.0.0.jar dr
```

Output: **`watchtower-dr-bundle-<timestamp>.zip`**

Use the same version as your mod when possible. Download from [GitHub Releases](https://github.com/djinnbanter/WatchTower/releases) or [Modrinth](https://modrinth.com/mod/watchtower).

---

## Common options

| Flag | What it does |
|------|----------------|
| `--server <path>` | Server root if not running from `mods/` |
| `--out /tmp` | Write zip somewhere the panel allows |
| `--minutes 720` | Log window if no boot time found (default 24h) |

### Examples

```bash
java -jar watchtower-cli-1.0.0.jar dr
java -jar watchtower-cli-1.0.0.jar dr --server /home/container
java -jar watchtower-cli-1.0.0.jar dr --out /tmp
```

---

## What's in the zip

- Summary JSON and brief text
- Log excerpts around the last start attempt
- Crash summaries
- Mod list and changes vs prior report (when available)

---

## Where to put the JAR

**Recommended:** `mods/` next to the Watchtower mod. NeoForge does not load it as a mod — you only run it with `java -jar` over SSH.

---

## See also

- [[Disaster Recovery]]
- [[DR Viewer]]
- [[Downloads and Releases]]
