# World pressure

**Farms, item storms, and chunk loaders** often look like “the server needs more RAM” when the real problem is vanilla entity/chunk pressure. Watchtower keeps a continuous per-dimension census and raises plain-English classifiers when pressure holds — without replacing Spark’s per-chunk proof.

Watchtower **never** kills entities or unloads chunks for you.

---

## What the census measures

About once a minute (default `liveWorldCensusIntervalSeconds=60`), on the server tick thread, Watchtower walks loaded entities **once** (folded into the existing entity count) and records, per dimension (including mod dimensions, capped at 24):

| Field | Meaning |
|-------|---------|
| **entities** | Total loaded entities |
| **items** / **living** | ItemEntity vs LivingEntity split |
| **top_types** | Top 8 entity type ids by count |
| **loaded_chunks** | `getLoadedChunksCount()` |
| **forced_chunks** | Vanilla `/forceload` set size |
| **spawn_chunks** | Estimated spawn ticket footprint from `spawnChunkRadius` (Overworld only; 0 elsewhere) |
| **mod_forced_chunks** | Unique chunks in NeoForge `ForcedChunksSavedData` block/entity force-load trackers |
| **players** | Players currently in that dimension |
| **unattended** | Loaded chunks with zero players (UI context only) |

Counting must stay on the tick thread (Minecraft world state is not thread-safe). All baseline math, classifiers, and Issues merge run **off-thread** on the usual ops scan cadence.

L1 performance rollups also store `entities_max`, `chunks_max`, and `unattended_chunks_max` per minute so Insights can compare live load against busy hours and the window peak. Quiet-hour percentiles still drive Issue classifiers only.

### Chunk-load buckets (not the same thing)

| Bucket | What it is | What it is not |
|--------|------------|----------------|
| **Spawn** | Estimate of vanilla START tickets around world spawn | Live ticket walk; non-Overworld dims |
| **Vanilla /forceload** | `ServerLevel.getForcedChunks()` | Mod loaders |
| **Mod force-loads** | NeoForge TicketController / `ForcedChunksSavedData` trackers | Every custom `DistanceManager` ticket or per-mod brand name |

Loaded can stay high with **0 players** because spawn + these force-load sources (and other tickets) keep areas awake.

---

## Comparison bars (Insights → World)

Alert cards show four bars:

| Bar | Meaning | Source |
|-----|---------|--------|
| **Now** | Live census for that dimension / classifier evidence | `ops-cache` → `world_pressure` |
| **Quiet hours (p95)** | 95th percentile of `entities_max` during Schedule’s typically quiet UTC hours | `GET /api/performance/dashboard` → `world_pressure_compare.quiet` |
| **Busy hours (p95)** | 95th percentile of `entities_max` during Schedule’s typically busy UTC hours | `world_pressure_compare.busy` |
| **{7d\|30d} peak** | Highest single minute in the selected Insights window | `world_pressure_compare.peak` |

The Insights **7d / 30d** toggle refreshes `world_pressure_compare` with the same window split as Schedule.

---

## Dimension cards

Each **By dimension** card is labeled **`Dimension · {name}`** so custom worlds (e.g. Mining) read as places.

| Element | Meaning |
|---------|---------|
| **0 players** pill | That dimension currently has zero players online |
| **Chunk-load bar** | Stacked **Spawn · /forceload · Mod loaders** share of loaded (scaled if counts overlap) |
| **Force-kept flag** | UI-only when `(vanilla + mod) ≥ 8` **and** `(vanilla + mod) / loaded ≥ 5%` — spawn excluded; not an Issue |
| **Entity mix pie** | Top entity types in that dimension |
| **Players gauge** | Player count in that dimension (scale at least 8) |

Hero **Force-kept** = sum of vanilla `/forceload` + mod force-loads across dimensions.

---

## Classifiers

| Kind | When it fires | Sustained |
|------|---------------|-----------|
| **item_storm** | ≥1200 items **and** (items ≥40% of entities **or** entities ≥2× quiet-hours p95) | ≥3 scans |
| **mob_spike** | ≥900 living **and** entities ≥2× quiet-hours p95 | ≥3 scans |
| **pregen_outrunning_disk** | Pregen (Chunky/DH) active **and** disk write latency ≥ `DISK_IO_LATENCY_WARN_MS` | ≥ `CHUNK_WRITE_SUSTAINED_SCANS` (default 3) |
| **chunk_save_backlog** | Disk write latency sustained high **without** active pregen | ≥ `CHUNK_WRITE_SUSTAINED_SCANS` (default 3) |
| **heavy_chunk_generation** | Players online **and** loaded chunks grew by ≥ `CHUNK_WRITE_GROWTH_CHUNKS` (default 48) vs last scan | ≥ `CHUNK_WRITE_SUSTAINED_SCANS` (default 3) |

**Chunk write / pregen (1.1.23):** WatchTower also watches disk write latency and Chunky/DH pregen. Sustained save backlog, pregen outrunning disk, or heavy chunk growth while players are online raise Issues with advice to pause pregen and wait for saves — WatchTower will not pause pregen for you. Insights → World shows a **disk write pressure** bar (latency vs warn / ~3× critical) plus write/pregen evidence when `CHUNK_WRITE_PRESSURE_ENABLED` is on (default). WatchTower cannot read JVM save-queue depth — latency is the signal.

Tune thresholds in **Settings → Alerts → Chunk write / pregen** (or conf):

| Setting | Conf key | Default |
|---------|----------|---------|
| Enable classifiers | `CHUNK_WRITE_PRESSURE_ENABLED` | `true` |
| Disk write latency warn | `DISK_IO_LATENCY_WARN_MS` | `50` |
| Heavy growth (chunks / scan) | `CHUNK_WRITE_GROWTH_CHUNKS` | `48` |
| Sustained scans before Issue | `CHUNK_WRITE_SUSTAINED_SCANS` | `3` |

`item_storm` becomes **critical** when items ≥3000 **or** entity load correlates with MSPT (top vs bottom entity quartile over ~24h of rollups).

While Watchtower is still **learning** quiet hours (&lt;360 sample minutes with entity columns), baseline-only classifiers like `mob_spike` stay quiet; absolute item-share storms can still fire, without “× quiet normal” wording.

Temporary bursts (TNT farms, brief mob waves) should not open Issues — that is what the sustained-scan windows are for.

---

## Where you see it

- [[Dashboard-Tabs]] → Insights → **World** — hero totals, classifier cards, per-dimension cards (chunk-load breakdown + players gauge)
- [[Issues]] → Active → **Warning** (item storms / mob spikes land here by severity)
- Primary action: **Open World pressure** (`tab=insights&view=world`)
- Issue id shape: `WORLD_PRESSURE:{kind}:{dimension}`

For precise busy-chunk coordinates, open a Spark profile → **World** (Watchtower deep-links there from the classifier card). Per-chunk hotspots remain Spark’s job.

---

## What to do

1. Read the classifier detail (dimension + counts + quiet-hours ratio in the Issue copy when available)
2. Use the Now / Quiet / Busy / Peak bars to see whether entity load is above a typical quiet or busy evening, or near the window peak
3. On dimension cards, check spawn / /forceload / mod loader share and player count
4. Fly to the busy area / check hoppers, spawners, `/forceload`, and mod chunk loaders
5. Capture Spark if you need chunk-level proof
6. Mark the Issue **Reviewed** or **Hide** once handled

Kill-switch: `WORLD_PRESSURE_ENABLED` (default `true`) — see [[Configuration]].

---

## Related

- [[Issues]]
- [[Insights]]
- [[Dashboard-Tabs]]
- [[Configuration]]
- Spark World (dashboard Spark tab)
