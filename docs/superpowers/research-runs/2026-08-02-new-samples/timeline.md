# Timeline — 2026-08-02-new-samples

F4 polish after forensic deep-read (`forensic/cross-check.md`). Day and crash sections cite `forensic/files/…` notes. Claims changed by deep-read are marked **Revised (forensic):**. WatchTower replay facts come only from `crash-replay.json` (no invented Issues/brief output).

## Summary

**Pack / MC / loader:** Create-heavy NeoForge **1.21.1** dedicated server (NeoForge 21.1.247–248, Java 21). Mod footprint includes Sable/Shtreimel physics sublevels, C2ME, Spark, KubeJS, OpenPartiesAndClaims (OPAC) plus `opac_better_commands` 1.5, Create ecosystem mods (createfood, brassworksmissions datapack), and WatchTower. Hundreds of mods total per crash mod lists.

**Host hints:** Linux amd64 on AMD Ryzen 9 7950X3D (32 logical CPUs). Game panel layout (`/home/container/mods`). Large heap (up to ~45 GB max in Aug 1 crashes). `-XX:MaxRAMPercentage=95.0` style hosting.

**What repeatedly killed the server vs noise:**

- **Killed the server:** `opac_better_commands` API mismatch with OPAC (`NoSuchMethodError` on `getPlayerConfigs()`) — party chat command and listener paths, Aug 1 evening. Sable `Body has been removed` during sublevel save — Aug 1 21:49. Two watchdog follow-ups (~60 s after prior tick-loop crashes) — Aug 1 20:43 and 21:50 (`linkage` candidates; dumps lack `"Server thread"`). Chronic tick lag on Aug 1 (2,254 `Can't keep up` lines corpus-wide that day; 16 watchdog FATAL log lines).
- **Noise / secondary:** Spark profiler inactive on shutdown (Jul 31) — real crash file but shutdown-path; ISE absent from Jul 31 rotate bodies. createfood/KubeJS recipe parse flood (~51k createfood + ~56k kubejs lines; dense WARN set also in `kubejs/server.log`). DISTXFORM client-on-server ERROR spam (~1,896 lines). Jade sidecar — **Revised (forensic):** **8 INSTANCE** events (5 InvWrapper NPE + Lectern NPE + cauldron ISE + Create Lectern ClassCast), not “67 InvWrapper”; census sidecar/corpus InvWrapper counts are overcount. Loot-table missing-dep errors (~27k). GriefLogger MariaDB / GLRA fail (~70); Jul 29 strongest story is MariaDB **1130 host ACL**.

Corpus span: **Jul 29 → Aug 2, 2026**. Six crash reports; five on Aug 1.

---

## Day-by-day

### Jul 29

Notes: `forensic/files/logs__2026-07-29-2.log.gz.md`, `logs__2026-07-29-7.log.gz.md`, `logs__2026-07-29-8.log.gz.md` (plus peer rotates skimmed).

- **Boots / stops:** 8 `Done (` / 7 `Stopping server` (8 rotated logs).
- **Can't keep up:** 7 (light).
- **Notable ERROR categories:** loot_parse 4,432; client_on_server (DISTXFORM) 112; recipe_missing_item 72; logger_error 51. GriefLogger MariaDB fail on boot.
- **Crashes:** none.
- **Revised (forensic) — new vignette candidates (not Aug 1 crash drivers):**
  1. **Login disconnect storm** (`logs/2026-07-29-7.log.gz`) — ~199 `ServerLoginPacketListenerImpl` Disconnected after one short successful join; server “up” ~4 h but almost unplayable. Candidate: `signal-login-storm-0729`.
  2. **GriefLogger × Create mounted-storage NPE** (`logs/2026-07-29-8.log.gz` ~21:31) — `menuProvider is null` on `create:contraption_interact`; FATAL task, process continues. Candidate: `signal-gl-create-npe-0729`.
  3. **MariaDB 1130 ACL** (`logs/2026-07-29-2.log.gz`) — host not allowed; core GriefLogger + LuckPerms SQL disabled this boot (later boots recover core; GLRA keeps failing).

Quiet start for hard crashes. Boot datapack/loot noise plus underweighted joinability / DB / Create-compat signals.

### Jul 30

Notes: `forensic/files/logs__2026-07-30-*.log.gz.md` (day rotates).

- **Boots / stops:** 4 / 3 (5 rotated logs).
- **Can't keep up:** 17 (still light).
- **Notable ERROR categories:** loot_parse 6,094; createfood_recipe 12,916; kubejs_recipe_parse 14,020; client_on_server 56; logger_error 420.
- **Crashes:** none.

Recipe WARN flood begins in earnest (createfood + KubeJS). Server playable; lag warnings occasional.

### Jul 31

Notes: `forensic/files/crash-reports__crash-2026-07-31_17.27.20-server.txt.md`, `logs__2026-07-31-1.log.gz.md`, `logs__2026-07-31-2.log.gz.md` (clean-stop peers).

- **Boots / stops:** 8 / 7 (8 rotated logs).
- **Can't keep up:** 1 (minimal).
- **Notable ERROR categories:** loot_parse 4,986; createfood 11,619; kubejs 12,618; client_on_server 112.
- **Crashes:** 1 — Spark shutdown profiler inactive at 17:27 (`crash-2026-07-31_17.27.20-server.txt`).
- **Revised (forensic):** Spark `Profiler job no longer active!` is **crash-report-only** — **not present** in any Jul 31 rotate body. Session that produced 17:27 is a gap before `-2` @ 17:43; clean Spark stops (e.g. `-2`) never log the ISE.

Stable play day until a **shutdown-path Spark crash** — not player-facing mid-session. Rotate evidence is absence + clean peer stops.

### Aug 1

Notes: crash vignettes below; rotate windows `forensic/files/logs__2026-08-01-4.log.gz.md` … `-7.log.gz.md` (crash evening); peers `-1`…`-3`, `-8` for volume.

- **Boots / stops:** 12 / 10 (8 rotates + 5 debug_gz).
- **Can't keep up:** **2,254** (spikes: `2026-08-01-5.log.gz` 207, `-6` 153, `-7` 130, `-1` 126).
- **Notable ERROR categories:** loot_parse 8,960; createfood 19,371; kubejs 21,030; logger_error 2,472; client_on_server 182. Watchdog FATAL in logs: **16**. `nosuchmethod` (OPAC): **5** in logs. `sable_body_removed`: **4** in logs.
- **Crashes:** **5** — the incident day.
  1. 19:24 — OPAC better commands, party chat **command** (`-4`)
  2. 20:42 — OPAC better commands, party chat **listener** (`-5`)
  3. 20:43 — watchdog follow-up (`linkage` after #2; dump lacks `"Server thread"`)
  4. 21:49 — Sable body removed on sublevel save (`-6`; Create carriage in play)
  5. 21:50 — watchdog follow-up (`linkage` after #4; dump lacks `"Server thread"`)
- Recovery window in `-7` (~21:50–23:05): playable but laggy; residual Sable sublevel storage miss; OPAC still loaded, unused that hour.

Severe tick stress and repeated hard crashes. OPAC mismatch and Sable save bug are the actionable mod faults; watchdogs are timed follow-ups after tick death, not independent lag hangs.

### Aug 2

Notes: `forensic/files/logs__latest.log.md`, `logs__kubejs__server.log.md`, `logs__kubejs__client.log.md`, `logs__kubejs__startup.log.md`; rotate `logs/2026-08-02-1.log.gz` for overnight lag volume.

- **Boots / stops:** 2 / 1 (`2026-08-02-1.log.gz` spans 00:00–15:31; `latest.log`/`debug.log` capture a short afternoon boot).
- **Can't keep up:** 947 (mostly in `2026-08-02-1.log.gz` — lag persists).
- **Notable ERROR categories:** loot_parse 2,800; createfood 6,455; kubejs 7,010; logger_error 1,262; client_on_server 28.
- **Crashes:** none in sample.
- **Revised (forensic):** `latest.log` is **Aug 2 ~62 s** boot only (15:32:57–15:33:59) — **not** the Aug 1 incident day. Aug 1 OPAC/Sable/watchdog evidence lives in dated rotates + crash-reports. KubeJS: `client.log` empty; `startup.log` clean; recipe flood (~1402 WARNs) in `server.log` (mirrored under KubeJS in latest).

Lag continues but no new crash files. Corpus ends after a brief afternoon boot captured in `latest.log`.

---

## Ranked hurts vs noise

### Hurts (ops should act)

1. **OPAC API mismatch (`opac_better_commands` vs OpenPartiesAndClaims)** — reproducible `NoSuchMethodError` on party chat command and chat listener; two hard crashes Aug 1. Fix: align OPAC Better Commands with installed OPAC version or remove until compatible.
2. **Sable body removed on sublevel save** — `RuntimeException: Body has been removed` during `SubLevelSerializer` / world save; hard crash Aug 1 21:49 with active Sable sublevels and Create carriage contraption. Fix: update Sable stack or avoid triggering save with stale physics bodies.
3. **Chronic tick lag (Aug 1–2)** — 2,254 + 947 `Can't keep up` lines; correlated with crash evening and watchdog follow-ups. Investigate MSPT, chunk loading (C2ME), contraptions, and player load — lag is both symptom and amplifier. (Not promoted to a new WatchTower gap — detection acceptable.)

### Noise (real lines, low incident value)

1. **createfood / KubeJS recipe flood** — ~51,694 createfood + ~56,080 kubejs parse lines; startup/recipe WARN volume, not crash drivers. Dense set also in unread `kubejs/server.log`.
2. **DISTXFORM client-on-server** — ~1,896 lines; mods loading client classes on dedicated server; noisy, rarely actionable alone.
3. **Spark shutdown crash** — Jul 31 `Profiler job no longer active!` on server stop; `failure_kind: mod_runtime` in replay but ground truth is shutdown hygiene. **Revised (forensic):** ISE not in Jul 31 rotates; clean stops do not reproduce it.
4. **Jade sidecar (`JadeErrorOutput.txt`)** — **Revised (forensic):** **8 INSTANCE** events (5 InvWrapper + Lectern NPE + cauldron ISE + Create Lectern ClassCast); InvWrapper text lines = **5**, not 67. Census sidecar 67 / corpus 1,173 overcount (stack frames + plugin-load / DEBUG false matches). Non-fatal; WatchTower does not ingest today — worth a reader, not an outage.

### Underweighted Jul 29 candidates (F5)

1. **Login storm** — process healthy, join path broken (`2026-07-29-7`).
2. **GriefLogger × Create NPE** — FATAL task on mounted storage without crash-report (`2026-07-29-8`).
3. **MariaDB 1130 ACL** — core GriefLogger disable + LuckPerms SQL (`2026-07-29-2`); later GLRA-only fails.

---

## Crashes

### 1. `crash-2026-07-31_17.27.20-server.txt` — Spark profiler inactive on shutdown

Note: `forensic/files/crash-reports__crash-2026-07-31_17.27.20-server.txt.md` · rotate gap: `logs__2026-07-31-1.log.gz.md`, `logs__2026-07-31-2.log.gz.md`

| | |
| --- | --- |
| **Time** | 2026-07-31 17:27:20 |
| **Preliminary** | Spark shutdown: `IllegalStateException: Profiler job no longer active!` during server stop — likely not the root stability incident |
| **Confirmed** | Stack: `AsyncProfilerJob.checkActive` → `NeoForgeServerSparkPlugin.onDisable` → `ServerLifecycleHooks.handleServerStopping`. Spark stops its sampler during server shutdown and throws. No Sable sublevels active. Empty server (`Player Count: 0`). |
| **Revised (forensic)** | ISE **absent** from all Jul 31 rotate bodies (gap before `-2` @ 17:43). Clean Spark-enabled stop in `-2` does not log the ISE — crash report is the artifact. |
| **Replay** (`crash-replay.json`) | `failure_kind: mod_runtime`, `primary_mod_id: spark`, `category: mod`, confidence medium. Plain English: mod spark — check updates/conflicts. Fix: update or remove spark. |
| **Linkage** | None. Isolated stop event. |

### 2. `crash-2026-08-01_19.24.51-server.txt` — OPAC NSM (party chat command)

Note: `forensic/files/crash-reports__crash-2026-08-01_19.24.51-server.txt.md` · log window: `logs__2026-08-01-4.log.gz.md`

| | |
| --- | --- |
| **Time** | 2026-08-01 19:24:51 |
| **Preliminary** | `opac_better_commands` `NoSuchMethodError` on `IServerData.getPlayerConfigs()` via party chat command |
| **Confirmed** | `PartyMessenger.sendPartyMessage` ← `PartyChatCommand` ← `performUnsignedChatCommand`. Missing OPAC API method — version mismatch between `opac_better_commands` 1.5 and `openpartiesandclaims` 0.29.3. Full server (40/40). Party invite/chat traffic seconds earlier in `-4`. |
| **Replay** (`crash-replay.json`) | `failure_kind: mod_runtime`, `primary_mod_id: opac_better_commands`, `category: mod`, confidence medium. Generic update/remove Fix — misses API/version-align advice. |
| **Linkage** | First of two OPAC crashes that evening; same root cause, different entry point than #3. |

### 3. `crash-2026-08-01_20.42.00-server.txt` — OPAC NSM (chat listener)

Note: `forensic/files/crash-reports__crash-2026-08-01_20.42.00-server.txt.md` · log window: `logs__2026-08-01-5.log.gz.md`

| | |
| --- | --- |
| **Time** | 2026-08-01 20:42:00 |
| **Preliminary** | Same `NoSuchMethodError` via party chat listener (chat path) |
| **Confirmed** | `PartyMessenger.sendPartyMessage` ← `PartyChatListener.onServerChat` ← `CommonHooks.onServerChatSubmittedEvent`. Same API mismatch; triggered by normal chat not slash command. Sable snapshot shows one active overworld sublevel. Log narrative: party invite → chat → NSM. |
| **Replay** (`crash-replay.json`) | `failure_kind: mod_runtime`, `primary_mod_id: opac_better_commands`, `category: mod`, confidence medium. |
| **Linkage** | Immediate precursor to watchdog #4 (63 s later). Tick loop died here; watchdog is follow-up. |

### 4. `crash-2026-08-01_20.43.06-server.txt` — Watchdog follow-up after #3

Note: `forensic/files/crash-reports__crash-2026-08-01_20.43.06-server.txt.md` · log window: `logs__2026-08-01-5.log.gz.md`

| | |
| --- | --- |
| **Time** | 2026-08-01 20:43:06 |
| **Preliminary** | `ServerHangWatchdog` ~60 s tick — likely follow-up after prior tick-loop crash |
| **Confirmed** | `ServerHangWatchdog detected that a single server tick took 60000004.00 seconds`. Occurs 63 s after OPAC listener crash #3. Large thread dump; no fresh mod exception — hang after crash/unwind. Census: matching watchdog FATAL in `2026-08-01-5.log.gz` at 20:43:05. |
| **Revised (forensic)** | Dump has **249** named threads and **no `"Server thread"`** — proves follow-up after tick death, not an independent stuck-lag stack. c2me mixin on ServerWatchdog explains WatchTower latching `c2me_base`; Chunky/MSPT-only advice is misleading here. |
| **Replay** (`crash-replay.json`) | `failure_kind: watchdog`, `category: host_resource`, `primary_mod_id: c2me_base`, confidence high. Plain English: main thread stopped ~60s; read thread dump. Fix hints mention Chunky/DH/MSPT. |
| **Linkage** | **`linkage` candidate** — pair with crash #3; not a separate root incident. |

### 5. `crash-2026-08-01_21.49.17-server.txt` — Sable body removed on sublevel save

Note: `forensic/files/crash-reports__crash-2026-08-01_21.49.17-server.txt.md` · log window: `logs__2026-08-01-6.log.gz.md`

| | |
| --- | --- |
| **Time** | 2026-08-01 21:49:17 |
| **Preliminary** | Sable `RuntimeException: Body has been removed` during sublevel serialize/save |
| **Confirmed** | `RapierPhysicsPipeline.assertBodyValid` → `SubLevelSerializer.serialize` → `SubLevelHoldingChunkMap.saveAll` → `ServerLevel.save` during `saveEverything`. Active Create `CarriageContraptionEntity` and two Sable sublevels in snapshot. Log: shtreimel sub-level add / AeroClaims unregistered ship ~6 s before crash. |
| **Replay** (`crash-replay.json`) | `failure_kind: mod_runtime`, `primary_mod_id: sable_rapier`, `category: mod`, confidence medium. Generic update/remove Fix — misses sublevel-save / Create carriage context. |
| **Linkage** | Precursor to watchdog #6 (64 s later). |

### 6. `crash-2026-08-01_21.50.21-server.txt` — Watchdog follow-up after #5

Note: `forensic/files/crash-reports__crash-2026-08-01_21.50.21-server.txt.md` · log window: `logs__2026-08-01-6.log.gz.md`

| | |
| --- | --- |
| **Time** | 2026-08-01 21:50:21 |
| **Preliminary** | Second watchdog follow-up after Sable crash |
| **Confirmed** | Same watchdog signature as #4. Occurs 64 s after Sable body-removed crash #5. Thread dump present; no new mod exception at head. |
| **Revised (forensic)** | Dump has **288** named threads and **no `"Server thread"`** — same chain signal as #4. Larger dump, same causal shape. |
| **Replay** (`crash-replay.json`) | `failure_kind: watchdog`, `category: host_resource`, `primary_mod_id: c2me_base`, confidence high. |
| **Linkage** | **`linkage` candidate** — pair with crash #5; not a separate root incident. |

---

## Soft signals

| Signal | Corpus total | Notes |
| --- | ---: | --- |
| `player_join` | 1,258 | Active player base throughout; Jul 29 `-7` shows joinability can fail without crash |
| `jade_invwrapper_npe` | 1,173 | **Revised (forensic):** census overcount. Sidecar ground truth = **8 INSTANCE** / **5** InvWrapper stacks + Lectern / cauldron / Create ClassCast (`forensic/files/logs__JadeErrorOutput.txt.md`) |
| `db_addon_fail` | 70 | GriefLogger MariaDB — persistent; Jul 29 `-2` is MariaDB **1130 ACL** (core disable); later often GLRA-only (`griefloggerrollbackaddon`) |
| `loot_parse` | 27,272 | Missing mod deps (e.g. dndecor) — datapack noise |
| `opac_better_commands` | 290 | Mod present every boot; crashes only when party chat used |
| Jul 29 login storm | ~199 disconnects | New candidate — `2026-07-29-7`; underweighted vs joins |
| Jul 29 GL × Create NPE | 1 FATAL task | New candidate — `2026-07-29-8` 21:31; no crash-report |

---

## Gaps

- Watchdog follow-ups (#4, #6) should link to preceding tick-loop crashes in WatchTower UI — currently classified as standalone `watchdog` / `host_resource` with `c2me_base` primary. **Revised (forensic):** missing `"Server thread"` strengthens chain evidence.
- Spark shutdown crash classified `mod_runtime` — ground truth is stop-path noise; advice should not imply gameplay instability. **Revised (forensic):** rotate bodies lack the ISE.
- OPAC `NoSuchMethodError` gets generic mod_runtime advice; API/version mismatch not surfaced in Fix text.
- Jade sidecar unread by LogScanner (see ingestion checklist). **Revised (forensic):** expect multi-exception sidecar, not InvWrapper-only ×67.
- Recipe flood risks drowning actionable signals in Issues/Overview; kubejs `server.log` unread (`client.log` empty).
- Jul 29 login storm + GriefLogger×Create NPE underweighted — provisional F5 candidates (`signal-login-storm-0729`, `signal-gl-create-npe-0729`).
- `latest.log` as primary LogScanner target misses Aug 1 incident day (session mismatch, not a classifier bug by itself).

---

## Backlog pointer

Fixture backlog and gap matrix (Tasks 8–9 / F5) will consume this timeline. Seed rows: Spark advice (+ rotate absence), OPAC NSM classification, watchdog linkage (20:43 + 21:50, missing Server thread), Sable body-removed, Jade blind (8 INSTANCE / multi-exception), createfood noise, DISTXFORM spam, kubejs `server.log`, MariaDB ACL / GLRA, Jul 29 login storm + GL×Create NPE candidates.

---

## Ingestion appendix pointer

See `ingestion-checklist.md` in this run directory. Notable: `jade` and nested `archive` members partial/unread; kubejs sidecars scanned in census but not in live LogScanner file set (`client.log` empty; flood in `server.log`).
