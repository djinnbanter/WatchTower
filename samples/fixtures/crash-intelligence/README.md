# Crash intelligence golden fixtures (1.0.13)

Synthetic crash reports and log excerpts for WatchTower **crash intelligence v2** (G-01–G-11, S-01 boot profile). Used by Java golden tests and DR parity scripts — not live server data.

| File | Covers | Expectation (see `expected.json`) |
| ---- | ------ | --------------------------------- |
| `create-npe.txt` | G-01/G-02 Create NPE, `TRANSFORMER/create@…`, no `Mod File:` | `mod_runtime` / `create` |
| `nbt-corrupt.txt` | G-02 NBT/ZLIB EOF | `world_nbt_corrupt` |
| `watchdog-seconds.txt` | G-03 absurd `took N seconds` | `watchdog_tick_ms: 60000` |
| `watchdog-pregen.txt` | G-04/G-07 squaremap stall | `watchdog_pregen` / `squaremap` |
| `fml-multiblock.log` | G-10 three FML issue blocks | `fml_issues_length: 3` |
| `boot-loot.log` | G-08 / S-01 loot + Pride before `Done!`, then Chunky/squaremap | `total_sec: 142.3`, Pride non-blocking |
| `create-npe-paired-watchdog.txt` | G-11 ~90s after Create NPE | same `incident_id`, `watchdog_followup` |

`expected.json` is the schema contract (`crash-intelligence-v1`) and per-case assertions.
