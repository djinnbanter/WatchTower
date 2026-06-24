# Reading Metrics on Hosted Servers

On **bloom.host**, **Pterodactyl**, **Crafty**, and similar hosts, Minecraft often runs **inside a container**. Some numbers are from **inside the game**; others are from the **host machine**. Without labels, it is easy to misread memory — especially when setting **`-Xmx`**.

Watchtower labels metrics so you know what to trust. **Charts show memory in use**, not misleading “free GB” on panels.

---

## Always trustworthy

| Metric | Why |
|--------|-----|
| **TPS** | Measured from the game |
| **Tick lag (MSPT)** | Measured from the game |
| **Players online** | From the player list |
| **Java heap** | Memory inside your Minecraft process (`-Xmx`) |
| **Entities / chunks** | From the running server |

---

## Easy to misread on containers

| Metric | Common mistake | What Watchtower does |
|--------|----------------|----------------------|
| **Host RAM** | Looks like you have tons of free RAM | Shows **Java heap** on Overview; **used/total** on Live |
| **Host CPU %** | Hard to compare without core count | Shows quota when known |
| **Temperature** | Often missing in Docker | Clear “unavailable” message |
| **Backups** | Panel backups may be outside the container | Badge + **Settings → Backups** for panel signal |

---

## Three different “memory” numbers

Do not mix these up:

1. **Java heap** — room before `OutOfMemoryError` inside the game (your `-Xmx`).
2. **Container / host RAM** — the limit the host gives your server (can kill the process before heap fills).
3. **Spark heap report** — which mods hold memory during a profile (optional, see [[Using-Spark-with-Watchtower]]).

---

## See also

- [[Live Charts]]
- [[Understanding-Data-Sources]]
- [[Configuration]]
