# F3 Cross-check — 2026-08-02-new-samples

Research only. Sources: `forensic/manifest.json`, all `forensic/files/*.md`, `census.json`, `crash-replay.json`, `gap-matrix.md`, `fixture-backlog.md`, `timeline.md`, `REPORT.md`, `ingestion-checklist.md`. No product Java/UI changes. Do not treat this file as editing gap-matrix / timeline / REPORT (F4–F6).

---

## 1. Coverage proof

| Check | Result |
| ----- | ------ |
| Manifest `coverage.non_dup_scannable_total` | **47** |
| Manifest `coverage.read_complete` | **47** |
| `forensic/files/*.md` note count | **47** |
| Pending | **none** (`coverage.pending: []`) |

**Coverage = 47/47 read_complete.** Every non-dup scannable file has a forensic note and `read_complete: true`.

### Skips (intentional, not pending)

| Skip | Count | Detail |
| ---- | ----: | ------ |
| Archive not scannable | 1 | `logs/mega.tar.gz` — `skip_reason: not_scannable`; no note |
| Duplicates skipped | 7 | `logs/mega.tar.gz#2026-08-01-{1..7}.log.gz` — each `duplicate_of` matching free-standing rotate; `skip_reason: deduped` |

Deep-read emphasis: all six crash notes, Jade sidecar, kubejs sidecars, `latest.log`, Aug 1 rotates (`-4`…`-7` crash windows), Jul 29 (`-2` MariaDB ACL, `-7` login storm, `-8` GriefLogger×Create NPE), Jul 31 Spark rotate gap (`-1`/`-2` and clean-stop peers). Day rotates skimmed for contradictions — none overturn Aug 1 crash chain or Spark shutdown ground truth.

---

## 2. AI ↔ census ↔ WT triangulation

WatchTower columns use **`crash-replay.json` only** for crash rows; log/sidecar rows use `ingestion-checklist.md` (no invented Issues output).

| Forensic finding | Census claim | WT replay / ingestion | Verdict |
| ---------------- | ------------ | --------------------- | ------- |
| Jul 31 Spark `Profiler job no longer active!` on stop path | `spark_profiler_inactive: 1` in crash file only; **absent** from all Jul 31 rotate bodies; clean Spark stops never log the ISE | Replay: `failure_kind=mod_runtime`, primary `spark`, “update or remove spark” | **wt_gap** (agree signal exists; wrong kind/advice). Census OK for crash file; rotate gap is evidence quality note |
| Aug 1 19:24 OPAC NSM via party **command** | `nosuchmethod` + `opac_better_commands` in crash + `2026-08-01-4` | Replay: primary `opac_better_commands` OK; `mod_runtime` + generic Fix | **wt_gap** |
| Aug 1 20:42 OPAC NSM via party **listener** | Same NSM in crash + `2026-08-01-5` | Same as command path | **wt_gap** |
| Aug 1 20:43 watchdog ~63 s after listener crash; dump has **249 threads, no `"Server thread"`** | `watchdog_fatal` in crash + rotate | Replay: standalone `watchdog` / `host_resource`, primary `c2me_base`, MSPT/Chunky advice; no chain | **wt_gap** (linkage + wrong primary strengthened by missing Server thread) |
| Aug 1 21:49 Sable `Body has been removed` on sublevel save + Create carriage | `sable_body_removed` in crash + `2026-08-01-6` | Replay: primary `sable_rapier` OK; generic update/remove Fix | **wt_gap** (advice only) |
| Aug 1 21:50 watchdog ~64 s after Sable; **288 threads, no `"Server thread"`** | `watchdog_fatal` | Same standalone watchdog / `c2me_base` pattern | **wt_gap** |
| Jade sidecar: **8 INSTANCE** events (5 InvWrapper NPE + Lectern NPE + cauldron ISE + Create LecternController ClassCast); InvWrapper text lines = **5** | Sidecar `jade_invwrapper_npe: 67`; corpus **1,173** — samples often match Jade **plugin load** / FML DEBUG, not InvWrapper stacks | Ingestion: `jade` **unread** | **census_wrong** on counts; **wt_gap** on blind (blind still real) |
| createfood / KubeJS recipe WARN flood | ~51,694 createfood + ~56,080 kubejs corpus; `should_be_issue: false` posture in prior matrix | Partial ModLogAnalyzer caps; kubejs sidecar unread | **agree** (noise_drown + partial) |
| DISTXFORM ~1,896 + loot_parse ~27,272 | Matches census totals | Partial attribution / noise | **agree** |
| Chronic `Can't keep up` 3,226 (Aug 1 heavy) | Matches | Live tick_lag path (throttled by design) | **agree** (acceptable / no gap) |
| GriefLogger MariaDB / GLRA fail ~70; Jul 29 `-2` MariaDB **1130 host ACL** disables core GriefLogger + LuckPerms SQL | `db_addon_fail: 70`; often flattens recoveries | Partial `LOGGER_ERROR` only; no DB-addon surface | **wt_gap**; census volume OK but underweights ACL narrative |
| kubejs: `client.log` **empty**; `server.log` **1402** recipe WARNs (Aug 2 boot); `startup.log` clean | Sidecars inventoried; flood also mirrored in `latest.log` | Dedicated kubejs paths unread (`partial` / blind) | **wt_gap** |
| `latest.log` = Aug 2 ~**62 s** boot only (not Aug 1 incident day) | Short span vs rotates | Primary LogScanner target — operators looking only at latest miss Aug 1 | **agree** (session-mismatch fact; not a classifier bug by itself) |
| Jul 29 login disconnect storm (`-7`, ~199 login Disconnected) | Weak / underweighted vs joins | Join-clinic / disconnect patterns may underweight login-listener-only failures | **both** (census underweight + WT surface risk) — **new** candidate |
| Jul 29 GriefLogger × Create mounted-storage NPE (`contraption_interact`, menuProvider null) | May land as generic logger_error / create | No dedicated surface; FATAL task without crash-report | **wt_gap** — **new** candidate |

---

## 3. Prior-pass reconciliation

Status legend: **confirmed** | **revised** | **rejected** | **superseded** | **new**

### Gap-matrix ids

| id | Status | Why |
| -- | ------ | --- |
| `crash-0731-spark` | **revised** | Still a real WT wrong_kind/bad_advice gap. Changed: Spark ISE is **crash-report-only** — missing from Jul 31 rotate bodies (gap before `-2`); repeated clean Spark stops never log the ISE |
| `crash-0801-opac-cmd` | **confirmed** | Forensic + replay match prior: primary OK; needs `api_version_mismatch` + version-align Fix |
| `crash-0801-opac-listener` | **confirmed** | Same root as command path; log narrative (party invite → chat → NSM) reinforces |
| `crash-0801-watchdog-2043` | **revised** | Still linkage / wrong_primary / bad_advice. Changed: dump **lacks `"Server thread"`** (249/249 named threads without it) — proves follow-up after tick death, not stuck lag stack |
| `crash-0801-sable` | **confirmed** | Primary `sable_rapier` OK; Fix still misses sublevel-save / Create carriage context |
| `crash-0801-watchdog-2150` | **revised** | Same as 20:43 pair. Changed: **288 threads, no `"Server thread"`** — same chain signal |
| `signal-jade-sidecar` | **revised** | Blind still valid. Changed: not “67 InvWrapper NPEs” — **8 INSTANCE** events / **5** InvWrapper stacks + Lectern / cauldron / Create ClassCast; corpus 1,173 is census overcount (plugin-load / DEBUG matches) |
| `signal-recipe-flood` | **confirmed** | Flood real; kubejs/server.log holds dense WARN set; pattern-mismatch risk vs ModErrorCategory unchanged |
| `signal-distxform-loot` | **confirmed** | Boot noise volumes hold; still noise_drown P3 |
| `signal-tick-lag` | **confirmed** | Still acceptable detection; Aug 1 volume matches hurt amplifier role |
| `signal-db-addon` | **revised** | Still no dedicated surface. Changed: Jul 29 strongest story is MariaDB **host ACL (1130)** disabling core GriefLogger (+ LuckPerms SQL); later boots recover core while **GLRA** keeps failing; attribute to `griefloggerrollbackaddon` not only `grieflogger` |
| `signal-kubejs-sidecar` | **revised** | Blind still valid. Changed: `client.log` empty (no signal); recipe flood lives in `server.log` (+ mirrored in latest); startup clean |

### Fixture backlog FB-01..FB-11

| id | Status | Why |
| -- | ------ | --- |
| FB-01 | **confirmed** | Golden still fails on `mod_runtime` + generic Fix for command-path NSM |
| FB-02 | **confirmed** | Listener-path twin; precursor to FB-03 unchanged |
| FB-03 | **revised** | Acceptance still correct. Changed: add ground-truth check for **absent Server thread** in dump as chain evidence (strengthens vs c2me_base primary) |
| FB-04 | **confirmed** | Primary OK; Fix must include sublevel save / stale body / Create carriage |
| FB-05 | **revised** | Same as FB-03 for Sable pair — add missing-Server-thread expectation |
| FB-06 | **revised** | Still shutdown_noise. Changed: fixture should note rotate-body **absence** of ISE and that clean stops do not reproduce; crash file remains source of truth |
| FB-07 | **revised** | Still blind P2. Changed: ground_truth counts → **8 INSTANCE / multi-exception** Jade sidecar (not 67 InvWrapper-only); expected issue should cover Lectern/cauldron/Create ClassCast, not InvWrapper alone |
| FB-08 | **confirmed** | Recipe flood noise_drown still correct; latest + rotates + kubejs/server.log all show it |
| FB-09 | **revised** | Ingestion blind remains. Changed: empty `client.log` is no-op; prioritize `server.log` (+ startup) in acceptance |
| FB-10 | **confirmed** | DISTXFORM + loot spam still noise_drown P3 |
| FB-11 | **revised** | Still no_surface. Changed: expect MariaDB ACL / GLRA attribution nuance; Jul 29 `-2` is best exemplar (core disable), not only “~70 Database connection failed” |

### Reconciliation counts (matrix + FB)

| Status | Count |
| ------ | ----: |
| confirmed | 11 |
| revised | 12 |
| rejected | 0 |
| superseded | 0 |
| new (candidates only; §4) | 2 |

No prior gap id or FB entry is rejected or superseded. Revisions update facts in place — do not duplicate active findings for the same signal.

---

## 4. Net-new candidates

Prior pass never had dedicated matrix/FB rows for these Jul 29 deep-read signals. **Provisional ids only** — F5 owns gap-matrix edits.

| Provisional id | Status | Ground truth (one line) | Suggested severity |
| -------------- | ------ | ----------------------- | ------------------ |
| `signal-login-storm-0729` | **new** | Jul 29 `2026-07-29-7`: ~199 `ServerLoginPacketListenerImpl` Disconnected with almost no successful joins — server “up” but unplayable | P2–P3 |
| `signal-gl-create-npe-0729` | **new** | Jul 29 `2026-07-29-8` 21:31: GriefLogger `ContainerHandler` NPE (`menuProvider is null`) on Create `contraption_interact` / mounted storage — FATAL task, process continues | P3 |

Optional evidence notes (not separate gaps): Spark rotate-session gap before Jul 31 `-2`; census `jade_invwrapper_npe` overcount on debug/plugin-load lines (feeds **revised** FB-07, not a new product gap).

---

## 5. Recommended F4/F5 edits

F4/F5 should update timeline / gap-matrix / backlog **in place** (no duplicate rows). Suggested edits:

- **Jade counts everywhere** (`timeline`, `gap-matrix` `signal-jade-sidecar`, FB-07, soft-signals table): replace “67 InvWrapper” / “1,173 InvWrapper” framing with **8 INSTANCE events** (5 InvWrapper + Lectern NPE + cauldron ISE + Create Lectern ClassCast); note census 1,173 / sidecar 67 as **overcount** (stack frames + plugin-load / DEBUG false matches).
- **Watchdog FB-03 / FB-05 + matrix rows:** add **no `"Server thread"`** in dumps (249 / 288 threads) as chain evidence; keep `watchdog_followup` + paired prior crash; discourage c2me_base / Chunky MSPT-only advice.
- **Spark FB-06 / `crash-0731-spark`:** note ISE **not present** in Jul 31 rotate bodies (gap before `-2`); clean Spark stops never log the ISE — crash report is the artifact.
- **`latest.log`:** timeline Aug 2 — clarify ~62 s afternoon boot only; Aug 1 evidence lives in dated rotates / crash-reports.
- **`signal-db-addon` / FB-11:** lead with Jul 29 MariaDB **1130 ACL** (core GriefLogger disable + LuckPerms); persistent GLRA fail; logger id `griefloggerrollbackaddon`.
- **`signal-kubejs-sidecar` / FB-09:** `client.log` empty; recipe flood in `server.log`.
- **Jul 29 underweight → new candidates (F5):** add provisional `signal-login-storm-0729` and `signal-gl-create-npe-0729` (or fold GL×Create into an extended FB-11 only if F5 prefers one DB/compat bucket — prefer separate ids to avoid mixing boot config vs runtime NPE).
- **Do not** invent WatchTower Issues/brief output beyond `crash-replay.json` + ingestion checklist.
- **Do not** promote tick-lag to a new gap — remains acceptable.

---

## Cross-check meta

| Field | Value |
| ----- | ----- |
| Role | F3 Cross-Check |
| OUT_DIR | `docs/superpowers/research-runs/2026-08-02-new-samples` |
| Coverage | 47/47 + 1 archive skip + 7 dupes |
| Product code | unchanged |
| Next | F4 timeline polish / F5 gap-matrix + backlog updates from §5 |
