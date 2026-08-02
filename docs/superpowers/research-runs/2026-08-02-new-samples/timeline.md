# Timeline — 2026-08-02-new-samples

## Summary

**Pack / MC / loader:** Create-heavy NeoForge **1.21.1** dedicated server (NeoForge 21.1.247–248, Java 21). Mod footprint includes Sable/Shtreimel physics sublevels, C2ME, Spark, KubeJS, OpenPartiesAndClaims (OPAC) plus `opac_better_commands` 1.5, Create ecosystem mods (createfood, brassworksmissions datapack), and WatchTower. Hundreds of mods total per crash mod lists.

**Host hints:** Linux amd64 on AMD Ryzen 9 7950X3D (32 logical CPUs). Game panel layout (`/home/container/mods`). Large heap (up to ~45 GB max in Aug 1 crashes). `-XX:MaxRAMPercentage=95.0` style hosting.

**What repeatedly killed the server vs noise:**

- **Killed the server:** `opac_better_commands` API mismatch with OPAC (`NoSuchMethodError` on `getPlayerConfigs()`) — party chat command and listener paths, Aug 1 evening. Sable `Body has been removed` during sublevel save — Aug 1 21:49. Two watchdog follow-ups (~60 s after prior tick-loop crashes) — Aug 1 20:43 and 21:50 (`linkage` candidates). Chronic tick lag on Aug 1 (2,254 `Can't keep up` lines corpus-wide that day; 16 watchdog FATAL log lines).
- **Noise / secondary:** Spark profiler inactive on shutdown (Jul 31) — real crash file but shutdown-path, not root stability. createfood/KubeJS recipe parse flood (~51k createfood + ~56k kubejs lines). DISTXFORM client-on-server ERROR spam (~1,896 lines). Jade `InvWrapper` NPE sidecar (67 lines in `JadeErrorOutput.txt`; 1,173 corpus-wide). Loot-table missing-dep errors (~27k). GriefLogger MariaDB connection fail (~70).

Corpus span: **Jul 29 → Aug 2, 2026**. Six crash reports; five on Aug 1.

---

## Day-by-day

### Jul 29

- **Boots / stops:** 8 `Done (` / 7 `Stopping server` (8 rotated logs).
- **Can't keep up:** 7 (light).
- **Notable ERROR categories:** loot_parse 4,432; client_on_server (DISTXFORM) 112; recipe_missing_item 72; logger_error 51. GriefLogger MariaDB fail on boot.
- **Crashes:** none.

Quiet start. Mostly boot-time datapack/loot noise; no watchdog or mod-runtime crashes.

### Jul 30

- **Boots / stops:** 4 / 3 (5 rotated logs).
- **Can't keep up:** 17 (still light).
- **Notable ERROR categories:** loot_parse 6,094; createfood_recipe 12,916; kubejs_recipe_parse 14,020; client_on_server 56; logger_error 420.
- **Crashes:** none.

Recipe WARN flood begins in earnest (createfood + KubeJS). Server playable; lag warnings occasional.

### Jul 31

- **Boots / stops:** 8 / 7 (8 rotated logs).
- **Can't keep up:** 1 (minimal).
- **Notable ERROR categories:** loot_parse 4,986; createfood 11,619; kubejs 12,618; client_on_server 112.
- **Crashes:** 1 — Spark shutdown profiler inactive at 17:27 (`crash-2026-07-31_17.27.20-server.txt`).

Stable play day until a **shutdown-path Spark crash** — not player-facing mid-session.

### Aug 1

- **Boots / stops:** 12 / 10 (8 rotates + 5 debug_gz).
- **Can't keep up:** **2,254** (spikes: `2026-08-01-5.log.gz` 207, `-6` 153, `-7` 130, `-1` 126).
- **Notable ERROR categories:** loot_parse 8,960; createfood 19,371; kubejs 21,030; logger_error 2,472; client_on_server 182. Watchdog FATAL in logs: **16**. `nosuchmethod` (OPAC): **5** in logs. `sable_body_removed`: **4** in logs.
- **Crashes:** **5** — the incident day.
  1. 19:24 — OPAC better commands, party chat **command**
  2. 20:42 — OPAC better commands, party chat **listener**
  3. 20:43 — watchdog follow-up (`linkage` candidate after #2)
  4. 21:49 — Sable body removed on sublevel save
  5. 21:50 — watchdog follow-up (`linkage` candidate after #4)

Severe tick stress and repeated hard crashes. OPAC mismatch and Sable save bug are the actionable mod faults; watchdogs are timed follow-ups, not independent root causes.

### Aug 2

- **Boots / stops:** 2 / 1 (`2026-08-02-1.log.gz` spans 00:00–15:31; `latest.log`/`debug.log` capture a short 15:32–15:33 boot).
- **Can't keep up:** 947 (mostly in `2026-08-02-1.log.gz` — lag persists).
- **Notable ERROR categories:** loot_parse 2,800; createfood 6,455; kubejs 7,010; logger_error 1,262; client_on_server 28.
- **Crashes:** none in sample.

Lag continues but no new crash files. Corpus ends after a brief afternoon boot captured in `latest.log`.

---

## Ranked hurts vs noise

### Hurts (ops should act)

1. **OPAC API mismatch (`opac_better_commands` vs OpenPartiesAndClaims)** — reproducible `NoSuchMethodError` on party chat command and chat listener; two hard crashes Aug 1. Fix: align OPAC Better Commands with installed OPAC version or remove until compatible.
2. **Sable body removed on sublevel save** — `RuntimeException: Body has been removed` during `SubLevelSerializer` / world save; hard crash Aug 1 21:49 with active Sable sublevels and Create carriage contraption. Fix: update Sable stack or avoid triggering save with stale physics bodies.
3. **Chronic tick lag (Aug 1–2)** — 2,254 + 947 `Can't keep up` lines; correlated with crash evening and watchdog follow-ups. Investigate MSPT, chunk loading (C2ME), contraptions, and player load — lag is both symptom and amplifier.

### Noise (real lines, low incident value)

1. **createfood / KubeJS recipe flood** — ~51,694 createfood + ~56,080 kubejs parse lines; startup/recipe WARN volume, not crash drivers.
2. **DISTXFORM client-on-server** — ~1,896 lines; mods loading client classes on dedicated server; noisy, rarely actionable alone.
3. **Spark shutdown crash** — Jul 31 `Profiler job no longer active!` on server stop; `failure_kind: mod_runtime` in replay but ground truth is shutdown hygiene, not gameplay stability.
4. **Jade sidecar (`JadeErrorOutput.txt`)** — 67 `InvWrapper.getInv()` NPEs; non-fatal sidecar WT does not ingest today; worth a reader, not an outage.

---

## Crashes

### 1. `crash-2026-07-31_17.27.20-server.txt` — Spark profiler inactive on shutdown

| | |
| --- | --- |
| **Time** | 2026-07-31 17:27:20 |
| **Preliminary** | Spark shutdown: `IllegalStateException: Profiler job no longer active!` during server stop — likely not the root stability incident |
| **Confirmed** | Stack: `AsyncProfilerJob.checkActive` → `NeoForgeServerSparkPlugin.onDisable` → `ServerLifecycleHooks.handleServerStopping`. Spark stops its sampler during server shutdown and throws. No Sable sublevels active. |
| **Replay** | `failure_kind: mod_runtime`, `primary_mod_id: spark`, `category: mod`, confidence medium. Plain English: mod spark — check updates/conflicts. |
| **Linkage** | None. Isolated stop event. |

### 2. `crash-2026-08-01_19.24.51-server.txt` — OPAC NSM (party chat command)

| | |
| --- | --- |
| **Time** | 2026-08-01 19:24:51 |
| **Preliminary** | `opac_better_commands` `NoSuchMethodError` on `IServerData.getPlayerConfigs()` via party chat command |
| **Confirmed** | `PartyMessenger.sendPartyMessage` ← `PartyChatCommand` ← `performUnsignedChatCommand`. Missing OPAC API method — version mismatch between `opac_better_commands` 1.5 and `openpartiesandclaims` 0.29.3. |
| **Replay** | `failure_kind: mod_runtime`, `primary_mod_id: opac_better_commands`, `category: mod`, confidence medium. |
| **Linkage** | First of two OPAC crashes that evening; same root cause, different entry point than #3. |

### 3. `crash-2026-08-01_20.42.00-server.txt` — OPAC NSM (chat listener)

| | |
| --- | --- |
| **Time** | 2026-08-01 20:42:00 |
| **Preliminary** | Same `NoSuchMethodError` via party chat listener (chat path) |
| **Confirmed** | `PartyMessenger.sendPartyMessage` ← `PartyChatListener.onServerChat` ← `CommonHooks.onServerChatSubmittedEvent`. Same API mismatch; triggered by normal chat not slash command. Sable snapshot shows one active overworld sublevel. |
| **Replay** | `failure_kind: mod_runtime`, `primary_mod_id: opac_better_commands`, `category: mod`, confidence medium. |
| **Linkage** | Immediate precursor to watchdog #4 (63 s later). Tick loop died here; watchdog is follow-up. |

### 4. `crash-2026-08-01_20.43.06-server.txt` — Watchdog follow-up after #3

| | |
| --- | --- |
| **Time** | 2026-08-01 20:43:06 |
| **Preliminary** | `ServerHangWatchdog` ~60 s tick — likely follow-up after prior tick-loop crash |
| **Confirmed** | `ServerHangWatchdog detected that a single server tick took 60000004.00 seconds`. Occurs 63 s after OPAC listener crash #3. Large thread dump; no fresh mod exception — hang after crash/unwind. Census: matching watchdog FATAL in `2026-08-01-5.log.gz` at 20:43:05. |
| **Replay** | `failure_kind: watchdog`, `category: host_resource`, `primary_mod_id: c2me_base`, confidence high. Plain English: main thread stopped ~60s; read thread dump. |
| **Linkage** | **`linkage` candidate** — pair with crash #3; not a separate root incident. |

### 5. `crash-2026-08-01_21.49.17-server.txt` — Sable body removed on sublevel save

| | |
| --- | --- |
| **Time** | 2026-08-01 21:49:17 |
| **Preliminary** | Sable `RuntimeException: Body has been removed` during sublevel serialize/save |
| **Confirmed** | `RapierPhysicsPipeline.assertBodyValid` → `SubLevelSerializer.serialize` → `SubLevelHoldingChunkMap.saveAll` → `ServerLevel.save` during `saveEverything`. Active Create `CarriageContraptionEntity` and two Sable sublevels in snapshot. |
| **Replay** | `failure_kind: mod_runtime`, `primary_mod_id: sable_rapier`, `category: mod`, confidence medium. |
| **Linkage** | Precursor to watchdog #6 (64 s later). |

### 6. `crash-2026-08-01_21.50.21-server.txt` — Watchdog follow-up after #5

| | |
| --- | --- |
| **Time** | 2026-08-01 21:50:21 |
| **Preliminary** | Second watchdog follow-up after Sable crash |
| **Confirmed** | Same watchdog signature as #4. Occurs 64 s after Sable body-removed crash #5. Thread dump present; no new mod exception at head. |
| **Replay** | `failure_kind: watchdog`, `category: host_resource`, `primary_mod_id: c2me_base`, confidence high. |
| **Linkage** | **`linkage` candidate** — pair with crash #5; not a separate root incident. |

---

## Soft signals

| Signal | Corpus total | Notes |
| --- | ---: | --- |
| `player_join` | 1,258 | Active player base throughout |
| `jade_invwrapper_npe` | 1,173 | Sidecar + log lines; Jade addon compat |
| `db_addon_fail` | 70 | GriefLogger MariaDB — persistent config issue |
| `loot_parse` | 27,272 | Missing mod deps (e.g. dndecor) — datapack noise |
| `opac_better_commands` | 290 | Mod present every boot; crashes only when party chat used |

---

## Gaps

- Watchdog follow-ups (#4, #6) should link to preceding tick-loop crashes in WT UI — currently classified as standalone `watchdog` / `host_resource`.
- Spark shutdown crash classified `mod_runtime` — ground truth is stop-path noise; advice should not imply gameplay instability.
- OPAC `NoSuchMethodError` gets generic mod_runtime advice; API/version mismatch not surfaced in Fix text.
- Jade sidecar unread by LogScanner (see ingestion checklist).
- Recipe flood risks drowning actionable signals in Issues/Overview.

---

## Backlog pointer

Fixture backlog and gap matrix (Tasks 8–9) will consume this timeline. Seed rows: Spark advice, OPAC NSM classification, watchdog linkage (20:43 + 21:50), Sable body-removed, Jade blind, createfood noise, DISTXFORM spam.

---

## Ingestion appendix pointer

See `ingestion-checklist.md` in this run directory. Notable: `jade` and nested `archive` members partial/unread; kubejs sidecars scanned in census but not in live LogScanner file set.
