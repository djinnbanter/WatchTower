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
| **Host CPU %** | Whole-host % looks tiny on a big CPU (e.g. 7% while the panel shows ~300%) | Samples **container CPU** when cgroup is readable; Settings → **Monitoring → CPU display** |
| **Temperature** | Often missing in Docker | Clear “unavailable” message |
| **Backups** | Panel backups may be outside the container | Badge + [[Backups]] tab / Settings → Backups |

---

## CPU display modes

Under **Settings → Monitoring → CPU display**:

| Mode | Meaning |
|------|---------|
| **Auto (recommended)** | Panel style when container CPU is readable; otherwise whole-host |
| **Panel style** | 100% = 1 core (can show 300% = ~3 cores — matches Pterodactyl-style panels) |
| **Of my plan** | Percent of allocated cores (needs a CPU limit from the container) |
| **Of whole host** | Classic host-wide busy % from `/proc/stat` |

Changing the mode re-scales charts from stored **cores used** when that history exists. Older points that only have host % stay on the host scale.

Lag Issues use **of-plan %** when a limit is known (independent of the display setting), so picking “of whole host” cannot hide overload on a capped plan.

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
