# DR CLI Reference

**When you need this:** the game server **will not boot** and you have SSH access. This tool builds a recovery zip. Open it yourself or try [[DR-Viewer]] (**Coming soon** for complete Fix guidance).

---

## Quick usage

```bash
cd /path/to/your/server/mods
java -jar watchtower-cli-<version>.jar dr
```

Output: **`watchtower-dr-bundle-<timestamp>.zip`**

Use the same version as your mod when possible — [[Downloads-and-Releases]].

---

## Common options

| Flag | What it does |
|------|----------------|
| `--server <path>` | Server root if not running from `mods/` |
| `--out /tmp` | Write zip somewhere the panel allows |
| `--minutes 720` | Log window if no boot time found (default 24h) |

### Examples

```bash
java -jar watchtower-cli-<version>.jar dr
java -jar watchtower-cli-<version>.jar dr --server /home/container
java -jar watchtower-cli-<version>.jar dr --out /tmp
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

## Related

- [[Disaster-Recovery]]
- [[DR-Viewer]]
- [[Commands]]
