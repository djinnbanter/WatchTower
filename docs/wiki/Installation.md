# Installation

Install Watchtower on a **Linux** server running **NeoForge** for Minecraft **1.21.x**.

**NeoForge** is the mod loader for your Minecraft server (the folder that already has `mods/`).

---

## At a glance

- **Download:** current NeoForge jar from [[Downloads-and-Releases]] (GitHub Releases or Modrinth)
- **Where it goes:** server **`mods/`** folder
- **Recovery tool (optional):** matching `watchtower-cli-*.jar` in the same folder
- **After start:** a **`watchtower/`** folder appears on the server
- **Next step:** [[Quick-Start-Checklist]]

---

## What you need

| Requirement | Notes |
|-------------|-------|
| **Linux server** | VPS, bare metal, or most hosting panels |
| **NeoForge 1.21.x** | Minecraft **1.21.1** through the latest **1.21** patch |
| **Java 21** | Comes with NeoForge — you usually do not install Java separately |

---

## Install steps

1. Download the current **`watchtower-neoforge-*+mc1.21.jar`** from [[Downloads-and-Releases]]
2. Copy it into your server's **`mods/`** folder
3. Start (or restart) the server
4. Confirm Watchtower messages in the console and a **`watchtower/`** folder
5. Open **`http://<your-server-ip>:8787`** and sign in — [[Dashboard-Overview]]

### You're done when

- [ ] Mod jar is in `mods/`
- [ ] Server started without Watchtower load errors
- [ ] `watchtower/` exists
- [ ] Dashboard sign-in page loads

---

## What gets created

On first start, Watchtower creates **`watchtower/`** with settings, history, and related files. You do not create this yourself. See [[On-disk-Files]].

---

## Privacy (optional Modrinth lookup)

By default Watchtower stays local — dashboard and day-to-day Scanning do not need Modrinth.

If you enable **Modrinth lookup** (Welcome options or **Settings → Monitoring**):

- Watchtower may send **SHA-512 hashes of jar files** to `api.modrinth.com` (capped; cached)
- No world, logs, or player data are sent
- Watchtower **never downloads jars** into `mods/`
- Leave it off for zero Modrinth network traffic

More detail: [[Mods]].

---

## Related

- [[Quick-Start-Checklist]]
- [[Security-and-Access]]
- [[Downloads-and-Releases]]
- [[Crash-Rule-Packs]]
- [[Dashboard-Overview]]