import{j as e,a as p,n as w,bR as V,aI as Y,ac as y,Y as b,aH as k,ae as Q,y as N,C as X,aF as A,aK as Z,A as M,aQ as x,c as O,bA as F,S as $,Z as H,ah as ee,P,M as ne,ax as B,an as U,U as se,bu as I,aJ as te,b as G,a2 as v,aR as ae,B as C,bv as oe,aA as re,aL as ie}from"./index-BRmulcck.js";const m={nav:[{id:"start",label:"Start here",pages:[{slug:"Home",title:"Watchtower"},{slug:"Installation",title:"Installation"},{slug:"Quick-Start-Checklist",title:"Quick Start Checklist"},{slug:"Understanding-Data-Sources",title:"Understanding Data Sources"},{slug:"Dashboard-Tabs",title:"Dashboard Tabs"},{slug:"Dashboard-Overview",title:"Dashboard Overview"},{slug:"Live-Charts",title:"Live Charts"}]},{id:"use",label:"Use the dashboard",pages:[{slug:"Insights",title:"Insights"},{slug:"Session",title:"Session"},{slug:"Startup",title:"Startup"},{slug:"Issues",title:"Issues"},{slug:"Crashes",title:"Crashes"},{slug:"Logs",title:"Logs"},{slug:"Using-Spark-with-Watchtower",title:"Using Spark with Watchtower"},{slug:"Mods",title:"Mods"},{slug:"Backups",title:"Backups"},{slug:"Activity",title:"Activity"},{slug:"Sources",title:"Sources"}]},{id:"wrong",label:"When things go wrong",pages:[{slug:"Troubleshooting",title:"Troubleshooting"},{slug:"Disaster-Recovery",title:"Disaster Recovery"},{slug:"DR-CLI-Reference",title:"DR CLI Reference"},{slug:"DR-Viewer",title:"DR Viewer"}]},{id:"ref",label:"Reference",pages:[{slug:"Configuration",title:"Configuration"},{slug:"Security-and-Access",title:"Security and Access"},{slug:"Commands",title:"Commands"},{slug:"Health-Reports",title:"Health Reports"},{slug:"Hosting-Panels",title:"Hosting Panels"},{slug:"Reading-Metrics-on-Hosted-Servers",title:"Reading Metrics on Hosted Servers"},{slug:"Crash-Rule-Packs",title:"Crash Rule Packs"},{slug:"On-disk-Files",title:"On-disk Files"},{slug:"HTTP-API",title:"HTTP API"},{slug:"Downloads-and-Releases",title:"Downloads and Releases"},{slug:"Roadmap",title:"Roadmap"},{slug:"Changelog",title:"Changelog"}]}],pages:{"Accounts-And-Audit-Log":{slug:"Accounts-And-Audit-Log",title:"Accounts and audit log",markdown:`# Accounts and audit log

Named logins for people who share a dashboard, plus a short ledger of who changed what. Three roles only — not a full permission matrix.

---

## Roles

| Role | Can do |
|------|--------|
| **owner** | Everything, including add / change / remove accounts |
| **admin** | Operate the dashboard (settings, acks, suppressions, scans). Cannot manage accounts |
| **viewer** | Read-only. Any write returns 403 \`read_only_account\` |

Viewers do not see **Settings → Accounts** or **Settings → Audit log**. Admins see the audit log but not Accounts.

Only the **owner** runs the full setup wizard. Other accounts sign in, change their temporary password, and go straight to the dashboard.

The bottom of the side rail shows who is signed in. Use **Sign out** when you are done, especially on a shared PC.

---

## Adding someone

1. Sign in as **owner**.
2. Open **Settings → Accounts**.
3. Pick a username and role (\`admin\` or \`viewer\`; you can promote to \`owner\` later).
4. Watchtower shows a **temporary password once**. Copy it and hand it to that person out of band (chat, password manager share — not the public server log).
5. They sign in, change the password, and optionally set up 2FA under **Settings → Security**.

Changing someone’s role (or disabling them) ends that person’s sessions immediately. They must sign in again.

---

## Minecraft player link

You can link a Minecraft player to a dashboard account. The side rail then shows that player's skin. Linking is optional and does not replace the dashboard password.

- **Owner:** **Settings → Accounts** — pick a player from the server roster for any account.
- **Anyone:** **Settings → Security** — link or clear your own player.

Skins load from Crafthead using the linked UUID. If the image fails, the rail falls back to a letter mark.

---

## Recover the owner

Forgot the owner password, or locked out of 2FA:

| Situation | What to do |
|-----------|------------|
| Password forgotten, 2FA off | OP 4: \`/watchtower dashboard reset-password\` |
| Lost authenticator | Recovery code at login, or OP 4: \`/watchtower dashboard reset-password clear-2fa\` |
| Last resort | Stop the server, delete \`watchtower/dashboard-auth.json\`, start again — default \`watchtower\` / \`password\` returns and must be changed |

Reset rebuilds a usable owner. Extra accounts may need adding again if the auth file was wiped.

See also [[Security-and-Access]].

---

## Audit log

**Settings → Audit log** (owner and admin). Newest first.

It records:

- Settings saves
- Issue / crash acknowledgements and suppressions
- Account create / role change / disable / delete / password reset
- Sign-ins and failures, logout, 2FA enable/disable, password change
- Blocked writes (\`write_denied\` when a viewer tries a POST)

Retention: newest **2000** entries, max age **90 days**. Older rows are pruned when a new row is appended.

File: \`watchtower/audit-log.jsonl\` (one JSON object per line). Do not put this in support packs — it holds usernames and client IPs.

---

## File locations

| Path | Purpose |
|------|---------|
| \`watchtower/dashboard-auth.json\` | Schema 2 accounts (hashed passwords, roles, optional 2FA). Do not edit by hand |
| \`watchtower/dashboard-auth.json.pre-1.1.18.bak\` | One-time copy of the pre-upgrade credential file |
| \`watchtower/audit-log.jsonl\` | Append-only audit ledger |
| \`watchtower/.auth-key\` | Encrypts TOTP secrets — keep with the auth file |

Use **Settings → Security** for your own password / 2FA, and **Settings → Accounts** for other people.

---

## Updating from an older Watchtower

Your existing username and password keep working. That account becomes the **owner**. No config edit and no password reset.

Everyone signs in again after the restart (sessions are in memory — same as any restart).

Before the first schema 2 write, Watchtower copies the old file to \`dashboard-auth.json.pre-1.1.18.bak\` once (never overwritten if it already exists).

**Rollback caveat:** a rolled-back (pre-1.1.18) jar can still log in the owner because schema 2 keeps a top-level mirror of the owner credential. If you then **change the password on the old jar**, that build rewrites the file without the \`accounts\` list. Extra accounts are gone. After you upgrade again, only the owner is recovered — add the others once more.

---

## Related

- [[Security-and-Access]] — first login, 2FA, SSH tunnel
- [[Configuration]] — Settings panels
- [[On-disk-Files]] — auth + audit paths
- [[HTTP-API]] — \`/api/accounts\`, \`/api/audit-log\`, role 403 codes
`},Activity:{slug:"Activity",title:"Activity",markdown:`# Activity

**Activity** is the server diary — a timeline of pack changes (jars, soft-disable, config touches) plus commands, joins, lag, and jobs from the latest ops scan. Use it for “what changed on this box?” and “what happened around then?”

It is **not** player analytics (no chat, kills, or playtime).

---

## When to open it

- Someone dropped or removed a mod jar and you want the timestamp
- A config file was touched and you need the path
- Overview’s incident story needs more detail
- Correlating a lag window with joins/commands
- Checking whether background jobs ran

---

## Activity vs Insights vs Issues vs Audit

| Tab | Job |
|-----|-----|
| **Activity** | Event timeline / server diary |
| **Insights** | Patterns over days/weeks |
| **Issues** | Fix inbox to act on |
| **Settings → Audit** | Who did WatchTower writes (logins, settings, soft-disable actor) |

---

## What you’ll see

- KPI summary including **Pack changes**
- Typed timeline with filter chips (including **Changes** to hide player noise)
- Deep links into Mods, Issues, Backups, and Logs

### Pack-change event types (1.1.24)

| Type | Meaning |
|------|---------|
| \`mod_jar_added\` / \`mod_jar_removed\` / \`mod_jar_updated\` | Jar appeared, left, or size/mtime changed under \`mods/\` |
| \`mod_disabled\` / \`mod_enabled\` | Soft-toggle from the dashboard (\`*.jar\` ↔ \`*.jar.disabled\`) |
| \`config_changed\` | File under \`config/\` touched (path only; no diff) |

Jar/config rows come from a snapshot poll on the ops cadence (~60s). The first poll after start only seeds a baseline (no flood of “changed”). Config rows use a short per-path cooldown so save-spam does not fill the feed.

### Other event types

Joins, leaves, commands, tick lag, lag incidents, backup jobs, restart notices, performance spikes — still from log scanning and related writers.

---

## Retention

Events live in \`ops-cache.json\` under \`activity.events\`, capped at **1500**. Busy join/command traffic can push older diary rows out — use the **Changes** filter when you only care about pack edits.

---

## What to do next

1. Click **Changes** (or search) to focus on jar/config rows
2. Follow deep links into [[Mods]], [[Crashes]], or [[Backups]]
3. If the timeline is thin, wait for Scanning or the next ops poll

---

## Related

- [[Dashboard-Overview]]
- [[Insights]]
- [[Issues]]
- [[Crashes]]
- [[Mods]]
- [[Backups]]
`},Backups:{slug:"Backups",title:"Backups",markdown:`# Backups

Watchtower does **not** guess where your backups live — you choose a folder and/or connect panel/cloud signals.

---

## Quick pick

| Your backups are… | Do this | Time |
|-------------------|---------|------|
| **Folder on this server** | **Backups** → Step A → choose folder → Save | ~1 min |
| **On your host panel or cloud** | **Backups** → Step B → heartbeat / marker | ~2 min |
| **Both** | Step A + Step B; mode **Both** | ~2 min |
| **Not tracking** | Step B → **Not tracking** → Save | ~30 sec |

Until you configure something (or choose **Not tracking**), the tab shows setup help and [[Issues]] may say backups are not set up. **Settings → Backups** shows status and links back here.

**Not tracking** stops backup Issues, Overview backup alerts, and folder polling. Saved folder paths stay so you can re-enable later.

---

## Step A — Local folder

1. Open **Backups**
2. Under **Local folder**, **Browse** (or type a path)
3. Pick the directory that contains backup archives
4. **Save folder**

Watchtower never auto-fills a guessed path.

---

## Step B — External / cloud / panel

**Alpha:** panel / cloud tracking is experimental and may not work reliably on every host. Prefer a local folder (Step A) when you can.

1. Open **External / cloud**
2. Choose mode: **Folder** · **Heartbeat** · **Both** · **Not tracking**
3. Optional marker file path
4. Copy webhook URLs into your panel/script
5. Save

**Cloud-only:** skip Step A; heartbeat/marker still drive last-backup health.

---

## What you see

- Hero KPIs for freshness
- Archives list/detail (when a local folder is configured)
- **Integrity chips** (Verified / Suspicious / Broken / Not checked) from light archive checks
- **Verify now** and optional **Test restore** (admin/owner) — test restore extracts only under \`watchtower/restore-verify/\`, never the live world
- Setup checklist
- Storage locations summary

Rescan refreshes local inventory without Support compose. New archives are light-verified in the background when the server is quiet (defer if players online or MSPT is high).

**Job freshness:** open [[Sources]] → **Backup scan** to see when the poller last ran and when the next pull is due.

---

## Related

- [[Sources]]
- [[Issues]]
- [[Quick-Start-Checklist]]
- [[Configuration]]
- [[HTTP-API]] (\`/api/backups/*\`)
`},Changelog:{slug:"Changelog",title:"Changelog",markdown:`# Changelog

**What changed in each Watchtower version** — new features and fixes that affect you as a server owner.

Full downloads: [GitHub Releases](https://github.com/djinnbanter/WatchTower/releases) · Maintainer copy: [CHANGELOG.md](https://github.com/djinnbanter/WatchTower/blob/main/CHANGELOG.md)

---

## Unreleased

Operator-facing notes for work after **1.1.9** and the Jul 28–30 polish that sat beside the 1.1.3–1.1.9 feature line. Full maintainer detail: root [CHANGELOG.md](https://github.com/djinnbanter/WatchTower/blob/main/CHANGELOG.md) Unreleased.

> **Updating from 1.1.x:** your existing dashboard login keeps working and becomes the **owner** — no reset. Everyone signs in again after the restart. Pre-upgrade file kept as \`watchtower/dashboard-auth.json.pre-1.1.18.bak\`.

- **Backup integrity verify** — Backups list shows Verified / Suspicious / Broken; Verify now; optional test restore into \`watchtower/restore-verify/\` only (never the live world)
- **Soft jar Disable / Enable** — Mods can rename a jar to \`*.jar.disabled\` (and back). Disabled jars stay in the list; filters All / Enabled / Disabled. Restart chip on Overview until you reboot. Admin/owner only — no Delete
- **World risk** — Badge when the save may depend on a mod (dimension folders / jar data). Extra confirm before disable. Issue if a disabled mod still has world dimension folders left behind
- **Named admin accounts** — owner / admin / viewer; Settings → Accounts (owner adds people and hands over a one-time temp password)
- **Audit log** — Settings → Audit log records settings, acks, suppressions, accounts, and sign-ins (\`watchtower/audit-log.jsonl\`, newest 2000 / 90 days)
- **Join & pack sync clinic** — rejects for mismatched channels / missing / wrong-version mods from \`latest.log\`; Issues \`JOIN_SYNC\` + Session → **Session activity** (joins / leaves / failed joins with **Copy fix**)
- **Session activity plate** — replaces Join clinic + Recent sessions with one right-column feed
- **Dashboard look** — bold blue accent, tighter corners, clearer gauge colours (metric vs healthy/warn), shared hero plates; less generic dark-SaaS chrome
- **React dashboard is the real app** — old Preact/alpha UI archived; packaging and docs follow \`web/dashboard\`
- **Insights → Storage Space map** — treemap of where disk goes (world / mods / logs / backups drill-in); meters and tables stay
- **Insights → World** depth — dimension cards, compare bars, forceload + players (ties to 1.1.9 world pressure)
- **Live charts** — less jump/flash; calmer hover; better downsample
- **Snappier shell** — lazy routes, less query thrash, tabs scroll to top on change
- **Issues inbox** — severity groups only (Critical / Warning / Info); drift / silent-fail / world-pressure still show as Issues with the right Fix actions
- **Mods → Log errors** — Active / Reviewed + Mark reviewed
- **Support packs** — chooser is pack type + optional note + size; Customize files stays optional; tighter redaction and size accounting
- **Screenshots** — docs assets recaptured for Overview, Live, Insights, Mods, Issues, Crashes, Spark, Backups

## [1.1.9] — 2026-07-29

**Artifacts:** \`watchtower-neoforge-1.1.9+mc1.21.jar\` · \`watchtower-cli-1.1.9.jar\`

Release: [v1.1.9](https://github.com/djinnbanter/WatchTower/releases/tag/v1.1.9)

> 1.1.8 (pack pin storytelling) is deferred — this release skips that number.

- **World pressure** — continuous entity/chunk census by dimension; item-storm / mob-spike classifiers vs quiet hours; Insights → World dimension cards show forceload share + players; Issues band (\`WORLD_PRESSURE_ENABLED\`). Never auto-cleans entities/chunks; Spark World still owns per-chunk hotspots

## [1.1.7] — 2026-07-29

**Artifacts:** \`watchtower-neoforge-1.1.7+mc1.21.jar\` · \`watchtower-cli-1.1.7.jar\`

Release: [v1.1.7](https://github.com/djinnbanter/WatchTower/releases/tag/v1.1.7)

- **Silent script / datapack failures** — KubeJS, CraftTweaker, datapack JSON, and \`/reload\` errors that never crash become Issues (with a path when on the same log line); Active band **Script & datapack failures** (\`SILENT_FAIL_DETECT_ENABLED\`)

## [1.1.6] — 2026-07-28

**Artifacts:** \`watchtower-neoforge-1.1.6+mc1.21.jar\` · \`watchtower-cli-1.1.6.jar\`

Release: [v1.1.6](https://github.com/djinnbanter/WatchTower/releases/tag/v1.1.6)

- **Uptime & restart hygiene** — Overview suggests a maintenance restart when uptime is long and GC/heap is worsening, plus the next quiet window from Schedule evidence; never auto-restarts (\`RESTART_HYGIENE_ENABLED\`)
- **Dashboard timezone** — Settings → Timezone (this browser only) shows Schedule and quiet-window times in your zone; stored data stays UTC

## [1.1.5] — 2026-07-28

**Artifacts:** \`watchtower-neoforge-1.1.5+mc1.21.jar\` · \`watchtower-cli-1.1.5.jar\`

Release: [v1.1.5](https://github.com/djinnbanter/WatchTower/releases/tag/v1.1.5)

- **Watchdog and OOM force-kill detection** — when the previous session was killed from outside the JVM (OS/container OOM-killer or panel force-kill) with no Minecraft crash report, Crashes shows a **Killed** entry with the right fix (raise memory limit vs raise panel stop timeout); kill-switch \`EXTERNAL_KILL_DETECT_ENABLED\`

## [1.1.4] — 2026-07-28

**Artifacts:** \`watchtower-neoforge-1.1.4+mc1.21.jar\` · \`watchtower-cli-1.1.4.jar\`

Release: [v1.1.4](https://github.com/djinnbanter/WatchTower/releases/tag/v1.1.4)

- **Pack drift lock** — same jar name + version with a different checksum shows as Jar drift on Issues (verify intentional — not labeled corrupted)
- **Client-only jars on Issues** — high-confidence likely-removable client mods appear under Client-only jars (not only Mods filters)

## [1.1.3] — 2026-07-28

**Artifacts:** \`watchtower-neoforge-1.1.3+mc1.21.jar\` · \`watchtower-cli-1.1.3.jar\`

Release: [v1.1.3](https://github.com/djinnbanter/WatchTower/releases/tag/v1.1.3)

- **Weekly ops digest** — Insights → Digest (and a dismissible Overview card) summarizes the week: grade, crashes, disk change, MSPT trend, mod churn, and one “do this next” action; history stays local in \`ops-cache.json\`; optional kill-switch / cadence keys in \`watchtower.conf\` (\`WEEKLY_DIGEST_*\`); no email or webhooks

## [1.1.2] — 2026-07-26

**Artifacts:** \`watchtower-neoforge-1.1.2+mc1.21.jar\` · \`watchtower-cli-1.1.2.jar\`

Release: [v1.1.2](https://github.com/djinnbanter/WatchTower/releases/tag/v1.1.2)



- **Setup 2FA QR code** — setup wizard and Settings Security show the server QR (\`qr_data_url\`) next to the manual key
- **Wizard discovery crash/issue counts** — finished discovery shows real crash and issue totals (not blank dashes)
- **Support Bundle Builder** — rail Support opens a chooser (presets, logs Off/Tail/Full, crashes, Spark, extras); async compose; redacted pack v4 (\`environment.json\`, recipe, budgets); Settings Quick download + Customize; Copy for Discord; Add to support pack from Logs/Spark
- **Zero-BAU Pass 4** — reviewing disk-fill / tick-lag Issues no longer reopens on daily days-until-full drift or lag entry-count changes (stable fingerprints)
- **Zero-BAU Pass 3** — action queue gates on ops backups/crashes; Issues Hidden works without facts; ops-first Backups/crash drivers; empty Mods/Insights/Startup/Overview + wiki retarget Scanning / Support (Initial discovery stays the one-time baseline)
- **Zero-BAU Pass 2** — Support facts stay out of the BAU report index; Overview no longer forever-stale with schedule Off; Mods tree + \`/watchtower issues\` use Scanning when no legacy facts; brief/status wording matches Support compose
- **Zero-BAU Pass 1** — ops-cache/state path locks on remaining writers; Issues ledger contracts (log stale \`active\`, disk projection fields, skip resolved lag, stable backup fingerprints); backup scans refresh Issues; Acknowledge all syncs \`issues_live\`
- **Backup Issues “lookback window”** — BAU Issues use a **24-hour** freshness gate (not report lookback); missing archive vs older-than-24h messages updated
- **Crash Scan stuck on Unknown** — manual Scan force-reclassifies all crash reports; ops enrich overrides weak facts labels
- **Crash groups showing Unknown** — NeoForge stacks classify as loader when no mod id; titles prefer exception/display label; continuous enrich no longer sticks on Unknown
- **Modrinth update blockers** — missing required dependencies show the Modrinth project title (not the raw project id)
- **First-login account setup** — username/password change gate runs before the wizard/audit (login no longer skipped it)
- **Wizard Options** — enable Modrinth lookup before Initial discovery
- **Wizard discovery progress** — live counts for logs / crashes / mods / issues when discovery finishes (dashes only while unknown)
- **Settings without Deep audit schedule** — General no longer shows schedule / lookback / incremental; optional legacy schedule is conf or \`/watchtower schedule\` only
- **Preview mode on live servers** — fixed embedded flag injection so the dashboard no longer shows fixture Preview mode when served from the mod
- **Fresh install empty dashboard** — Initial discovery runs a full deep audit baseline again (facts + brief); empty live \`latest: {}\` no longer blocks Overview; wizard hydrates stores when discovery finishes
- **Wizard Initial discovery** — blocking first-run deep audit baseline with ReportEngine stage progress; Next locked until complete; Watching + Scanning keep deltas after that
- **Wizard without Support schedule** — no scheduled-bundle step; use rail Support when you need a zip
- **Zero-BAU audit fixes** — scheduled tick runs Support compose (not full ReportEngine); ops-cache delta writes synchronized; Modrinth scan works without legacy facts; Modrinth/Updates tabs ungated; Sources shows last support compose time; \`MODS_DEEP_MAX_JARS_PER_WAKE\` enforced
- **Zero-BAU wiki (Z10)** — in-app Docs: Understanding Data Sources, Health Reports, Commands, dashboard guides, HTTP API, Configuration; Support compose is the operator ask
- **Zero-BAU hardening (Z11)** — preview fixture includes continuous \`issues_live\` + \`mods_deep\`; ops tick regression test (no StagingBuilder on 60s path)
- **SupportComposer (Z7–Z8)** — Support zip and \`/watchtower run\` / \`/watchtower diagnostics\` compose from continuous ops + rollups; \`watchtower-facts-support-*\` is for the zip only (BAU ignores \`-support-\` artifacts)
- **Session tab (Z6)** — live online roster poll + stats mtime cursor; no deep-audit CTAs
- **Activity gap backfill (Z5)** — large \`latest.log\` gaps backfill into ops activity asynchronously (\`ACTIVITY_GAP_*\`)
- **Post-continuous UX** — no Catch-up on the rail; Support compose for shareable zips; schedule defaults **Off** on new installs
- **Spark hardening** — auto-capture failure cooldown (~60s) instead of burning the full 15m window; list cache for unchanged profiles; lag↔Spark correlation window 60 minutes; Overview shows Spark summary; Issues Fix panel **Open in Spark**; sub-tab/profile remembered in the browser; import size limit 64 MB; docs/conf.example match reality (\`SPARK_*\`, no dead \`RCON_SPARK_TPS\`)
- **Modrinth cache** — fixed cache wipe after every scan (timestamps + update deps now persist); update labels match Fabric/Quilt/Forge/NeoForge; Overview banner respects lookup off; Ops KPIs fill after a scan
- **Continuous Issues** — background scans keep an Issues ledger so Active stays useful with schedule Off; provenance chips (Live / Scanning / Event / Deep audit); Issues UI no longer requires a facts file
- **Startup without report** — boot timeline can appear after the server finishes starting (ops-cache \`startup_profile\`)
- **Crash enrich on mtime** — new crash files get a light summary without a deep audit (\`CRASH_ENRICH_ON_MTIME\`)
- **Mods light on jar change** — jar add/remove refreshes side scores into ops-cache; Mods Overview prefers them when fresher than the last report
- **Spark Overview without report** — fresh on-disk / auto-capture profiles show on Overview even before a deep audit
- **Support zip sooner** — download a support pack (dashboard or \`/watchtower diagnostics\`) from ops data before the first deep audit
- **New installs** — scheduled deep audits default Off
- **Data sources copy** — Watching / Scanning / Deep audit framing; Issues peeks + background scan cover day-to-day without a full audit
- **Internal docs** — continuous data-flow + post-continuous UX roadmaps — maintainer \`docs/dev/roadmap/versions/\`
- **Internal docs** — continuous data-flow study expanded (chunked jobs, cadences, catch-up-only deep audit) — maintainer \`docs/dev/roadmap/studies/\`
- **Mods UI consistency** — catalog rows match Issues/Crashes inbox; secondary-tab search in chrome; Forensics EmptyState
- **Crashes inbox** — list rows match the Issues inbox look
- **Overview Storage UX** — dropped RAM free; tighter dial + World/RSS layout, dimension share %, Classic Sass polish
- **Live RAM used** — toolbar + chart show host RAM used instead of free
- **Live toolbar vitals** — CPU, RAM used, and temps join TPS / MSPT / Players in the top bar
- **Overview storage dial** — “Disk used” above the dial; center shows only the %
- **Live temp dials** — title above the dial; center shows only the temperature
- **Live network / host temps on large screens** — Network and Host temperatures sit side-by-side from 1200px
- **Live network layout** — Receive / Send stack like host temps: graph left, animated Mbps on the right
- **Live disk read/write charts** — preview again fills Disk read/write (and net) history from envelope I/O; write-latency chip moved out of the chart grid
- **Live host temps** — CPU package and Ambient stack one above the other; dial on the right of each graph
- **Sass rail width** — side nav matches Aero width (no longer wider)
- **Live chart readout** — current value sits in the card header next to the title (not on the plot); hover still updates it
- **Live toolbar UX** — status + vitals sit together; Window / Poll / Pin lag stay on the right; freshness age only (no second “Live”); Sass Classic vitals and window chrome
- **Live 5m window** — range picker now includes **5m** before 15m
- **Sass Live chart polish** — taller plots; smaller left/bottom axis gutters
- **Sass Live thermal + network** — temp gauges and network strip match Classic cards (no aero glow / hard cyan)
- **Sass Insights heatmaps** — Patterns → Schedule maps follow the skin palette (orange accent under Sass, not blue); tighter Classic cell chrome
- **Sass chart wells** — Live/Overview graphs no longer show a harsh black inset border; plot blends with the card
- **Sass skin polish** — darker OLED black theme; mission tone washes fixed; Classic vitals/trust chrome cleaned up
- **Overview mission band** — denser two-row layout: compact grade + verdict on top, full-width live vitals strip below; KPI chips as a tight wrap
- **Sass skin (Classic v1.0 look)** — rail **Skin** cycles Aero (default glass) ↔ Sass (Deep Orange \`#FF5722\`, Inter + JetBrains Mono, glass cards, solid orange active rail, pill Run Report, left severity bars); pairs with Theme (dark / light / black)
- **Config and launch audit** — Startup shows a read-only Launch & config audit for \`server.properties\` (consider raising/lowering); Insights → Configs lists the same rows next to JVM flag advice; dismiss per key in the browser; \`GET /api/config-audit\`; padded Card/ListRow layout on Startup and Configs
- **Incident story timeline** — Activity shows a stitched “what happened” card when lag, crash, mod change, and backup signals line up; Overview teasers the latest story with a jump to Activity (demo fixture includes a sample story); Activity page layout cleaned up for clearer hierarchy
- **Blank dashboard after motion revival** — fixed Overview crash (\`DUR is not defined\` in vitals) and bad \`AnimatedNumber\` import paths
- **Motion revival** — mount-once page enters (no Overview/Live poll flash), metric count-ups from 0 on tab open and tween on change, animated gauges, one-shot chart reveals, bar grow-in, heatmap stagger, tab transitions, and safer button press feedback; respects \`prefers-reduced-motion\`
- **Spark profile subtabs** — Overview / Mods / World / Over time / Technical: plain labels, glossed tick rate/time, numbered next steps, mod spotlight, friendly entity names; section headers and cards get real padding
- **Spark tab UX polish** — padded Refresh/Import buttons; collapsible capture help; clearer empty + import chrome; profile meta row
- **Spark tab Refresh + Import from URL** — toolbar Refresh rescans disk; paste a \`spark.lucko.me\` link to download once into \`watchtower/spark-upload/\`; unreadable profiles show a skipped notice; \`source_path\` stays relative for deep links
- **Modrinth false updates** — no longer flags an older parent-MC build (e.g. Farmer’s Delight \`1.21-1.2.4\`) as an update over a newer \`1.21.1-*\` install; pack MC prefers patch-level jar/version votes
- **Empty Minecraft version on live reports** — server now always stamps MC + loader into snapshot/\`platform.json\` (with \`VERSION_STRING\` fallback); Modrinth uses that before guessing from jars
- **Server won't start with C2ME** — fixed JPMS split-package crash (\`watchtower\` vs jar-in-jar common both exporting \`dev.mcstatus.watchtower\`); drop in a fresh jar from \`releases/latest\`
- **Disk fill projection** — Overview/Insights Storage show days-until-full; Live write latency; Issue \`DISK_FILL_PROJECTED\` when runway is short; MSPT↔disk write correlation
- **Performance baseline** — Insights → Patterns: freeze a known-good window, flag when the last 7 days are ≥10% slower; **Set new baseline**; Overview teaser; Settings → Monitoring toggles
- **1.1.x quality pass** — Monitoring settings stick after save; baseline healthy gate ~30 min; Configs prefers report JVM health; Restart uses unreviewed crash time
- **RAM right-sizing** — Insights → **Configs**: conservative “do I need more RAM?” card from 7d+ heap history vs \`-Xmx\` (blocks “add RAM” when single-thread bound; GC-bound only when pressure is not already high)
- **Live chart order** — GC pause % wall sits after Players online
- **Backup false “failure” + Scan now** — lookback alone no longer shows **Backup failure** (warn days drive stale); hybrid fresh local or external is OK; Backups **Scan now** refreshes inventory / Overview / Issues without a full report
- **Safe to restart** — Overview Restart card: Safe / Caution / Wait from backups, pregen, players, disk, and recent crashes (informational only)
- **GC / JVM health** — Live shows GC pause % of wall, heap pressure, and flags profile; **Insights → Configs** recommends the best Aikar / flags.sh baseline for this Java/Minecraft/heap, lists missing flags worth adding, and shows a paste box when useful (card spacing fixed so padding is visible); Insights Load adds heap/GC columns; Issues can raise **GC / heap pressure** when the heap is full or GC is eating wall time — without shaming custom/ZGC setups
- **Issues / Crashes selection** — clicking another row switches the detail pane; leaving the tab is no longer blocked (selection no longer fights URL navigation or freezes a stale Issues tree)
- **Dashboard thrash while offline** — connection-lost no longer freezes tab switching (was re-rendering the shell on every failed poll)
- **Dashboard UI polish** — clearer glass cards, shared Issues/Crashes/Mods search chrome, honest Live/report freshness stamps, Fix-first queue details, \`/\` j/k \`r\` shortcuts on queues, Modrinth links show they open in a new tab
- **v2 ALPHA concept preview removed** — interactive mock on \`:8081\` scrapped; 1.x dashboard unchanged
- **Auto-Spark lag capture** — opt-in in Settings → Monitoring (off by default): on critical lag, Watchtower can run Spark ~45s, save a profile on disk, and show which mod was chewing the tick in Issues + Spark
- **Auto-Spark lag peek** — attaching Spark to a lag incident no longer reopens a resolved Issues row
- **Roadmap page** — rebuilt to match the share poster (legend, situation panels, promises)
- **Roadmap share image** — neo-Frutiger Aero poster of the public roadmap
- **Roadmap** — rewritten for clarity (today / coming next by situation / later / not our job); wiki + in-app tab match
- **Navigation** — rail tabs and page subtabs update immediately again (no F5); same root-render stall as Live charts
- **Live charts** — fixed blank charts when navigating to Live (no more F5); uPlot survives dashboard re-renders and samples fetch immediately on entry
- **Overview layout** — healthy/steady Overview keeps a 2-column layout (instruments stacked + triage side), matching incident mode at the same width
- **Modrinth updates** — fixed false “0 updates” on NeoForge when Minecraft version wasn’t on the mods list; scan now resolves MC from snapshot/Spark/NeoForge mapping
- **Mods list** — only top-level jars in mods/; nested jar-in-jar mods show on the parent Details pane
- **Report Retry** — failed Run Report modal now shows Retry (and Run again after success)
- **Dashboard updates stick** — live HTML/JS/CSS no longer cached aggressively, so Overview layout matches the jar after refresh
- **Startup boot phases** — fixed absurd phase durations when a log line lacked a timestamp; phases stay within total boot time
- **Spark preview** — five fixture profiles load on the Spark tab in preview (selector + Summary/Mods/World/Window/Advanced use parser-shaped mock data)
- **Roadmap page** — new System rail tab with a glass showcase of what’s coming next (Live today, vision themes, fleet/alerts horizons, trust chips, GitHub CTA)
- **Instrument plate across pages** — Overview-style glass + tone wash + top gradient hairline on featured cards, Live charts/thermals, Session/Startup heroes, Sources, Mods forensics KPIs, and other verdict surfaces
- **Overview Storage** — Heap tile removed from Storage (still in vitals); smaller disk used % readout
- **Live charts** — paint filled immediately again (no empty stagger/reveal; samples prefetch at boot)
- **Dashboard navigation** — rail clicks and back/forward now switch pages reliably again (signals SCU patch + root re-render on route changes)
- **Overview vivid & alive** — glowing grade beacon, channel-coloured live vitals (clear numbers, no sparklines), one consolidated status chip strip (MC / loader / Java / session / mods / backup), colour-washed instruments, and triage as a flush glass list; Heap vital restored; honours reduced-motion
- **Overview mission control** — grade + vitals hero band, trust chips, instrument cards (Storage dial, Boot strip); less duplicated status chrome
- **Rail brand header** — glass plate + icon cradle, stronger WatchTower wordmark, quiet “Server ops” tagline
- **Rail + topbar UX** — Reports glass plate; System label; Theme/Collapse tool row; collapse restores on boot; mobile drawer always expanded; short Live/Offline + freshness chips; Search primary then quiet Inbox; theme stays on the rail
- **Issues / Crashes / Mods chrome parity** — shared glass search+filter strip; Mods detail uses Crashes panel chrome; sticky detail panes without nested scrollbars
- **Issues tab overhaul** — Active / Reviewed / Tools; list+detail with Fix | Details (same panel/step chrome as Crashes); Hidden under Tools; deep links via \`view\` + \`issue\`
- **Crashes subtabs** — Review / Reviewed / Tools; list+detail with Fix | Evidence | Details; Tools for Scan, Mark all, Find owning jar
- **Crashes inbox list** — collapsible day groups; Today expanded by default
- **Crashes Fix pane** — numbered step cards, clearer action tiers, confidence in header
- **Crashes Evidence & Details** — shared panel chrome with Fix; grouped Details sections; richer Evidence layout
- **Crashes list layout** — styles.css rebuild so list rows render as a proper stack (not overlapping bare buttons)
- **Mods → Modrinth** — dedicated scan tab (KPIs, progress/ETA, Overview banner); reports no longer call Modrinth (cache-only); optional auto-scan after mod changes
- **Mods Overview catalog** — paginated full list (25 per page, First/Prev/Next/Last) with sort (Name, Mod ID, Server→Client, Updates first, Version); remembered in the browser
- **Mods list/details** — 50/50 split; details pane two columns; pagination instead of nested list scroll
- **Mods Client/server signals** — Modrinth logo + plain labels (Server required / Client only) instead of raw \`modrinth:…\` keys
- **Mods subtabs** — removed Client-only and Dependencies pages; dependency trees now live in an expandable section on Overview / Updates detail panes
- **Mods → Updates** — pack-impact verdicts for Modrinth-compatible outdated jars (see main [CHANGELOG.md](https://github.com/djinnbanter/WatchTower/blob/main/CHANGELOG.md))
- **Themed scrollbars** — soft sky-glass thumbs across the dashboard

---

## [1.1.0] — 2026-07-13

**Artifacts:** \`watchtower-neoforge-1.1.0+mc1.21.jar\` · \`watchtower-cli-1.1.0.jar\`

Release: [v1.1.0](https://github.com/djinnbanter/WatchTower/releases/tag/v1.1.0)

Watchtower **1.1.0** builds on **1.0.0** / **1.0.0a** with a large ops toolkit upgrade:

### Dashboard

- **Overview welcome** — personalized greeting with hostname and a short live status summary
- **Session** — cleaner player roster (vitals → top playtime → directory; online-first sort)
- **Insights Patterns** — Overview / Schedule / Load / Incidents sub-panels with Schedule heatmaps
- **Setup wizard** — live discovery audit, optional 30-day baseline, actionable Backups / schedule / Security steps
- **Backups Not tracking** — opt out of backup age Issues and nudges while keeping folder paths
- **UI polish** — clearer type scale, tooltips, loading spinners, Crashes/Spark/Logs chrome

### Intelligence & triage

- Crash fix advice is evidence-first (Create/watchdog/OOM and related playbooks)
- Declarative crash rule packs, mod forensics, and CA parity crash kinds
- Crash inbox groups, Startup boot profile, Logs viewer, Issues acknowledge / Reviewed
- Modrinth identity + update hints (opt-in; never downloads jars)

### Live & chrome

- Live chart windows through 30d, collapsible sections, System temps-only dials
- Neo-Frutiger Aero glass themes; Run Report stage progress
- Short guided tour: one card per rail page

---

## [1.0.0] — First public release — 2026-06-24

**Artifacts:** \`watchtower-neoforge-1.0.0+mc1.21.jar\` · \`watchtower-cli-1.0.0.jar\`

Watchtower **1.0.0** is the complete ops toolkit for NeoForge **1.21.x** Linux servers:

### Core

- Live dashboard at \`:8787\` with login + optional 2FA
- Scheduled health reports (default twice daily) with plain-English **brief** + **facts** JSON
- Disaster recovery CLI + browser DR viewer when the server will not boot
- **GPL-3.0-or-later** · one mod JAR for Minecraft **1.21.1** through latest **1.21.x** (\`+mc1.21\`)

### Dashboard tabs

- **Overview** — vitals, server health peek, performance insights teaser, setup resume card
- **Live** — TPS, MSPT, CPU, RAM, disk, network charts with linked time range
- **Insights** — busy/quiet hours, lag patterns, mod changes, storage trends, CSV export
- **Issues** — prioritized fix list from reports + live lag/mod peek
- **Crashes** — crash review with pre-crash context
- **Mods** — full mod list, log errors, conflict guidance
- **Backups** — folder inventory + panel/cloud heartbeat tracking
- **Activity** — live event ledger and lag spike incidents
- **Session** — roster, peak players, search/sort, copy UUID
- **Spark** — profiler workflow, profile picker, five detail sub-tabs
- **Sources** — freshness matrix for live vs scan vs report data
- **Docs** — full operator wiki built into the dashboard

### Operator tools

- **Setup wizard** — first-run audit, backups, schedule, optional 2FA (\`?setup=1\` to reopen)
- **Settings → Backups** — 2-step panel backup setup with test heartbeat
- **Settings → Monitoring** — read-only poll intervals and retention
- Always-on background scan (~60s) for logs, crashes, mod errors, and activity
- Version chip + update banner (GitHub / Modrinth check)
- Hosted-panel metrics honesty (cgroup labels, trust badges)

### Commands

\`/watchtower run\`, \`brief\`, \`status\`, \`issues\`, \`schedule\`, \`diagnostics\`, \`url\`, \`pin\`, \`dashboard reset-password\`

---

## Links

- [Release v1.1.0](https://github.com/djinnbanter/WatchTower/releases/tag/v1.1.0)
- [Release v1.0.0](https://github.com/djinnbanter/WatchTower/releases/tag/v1.0.0)
- [[Roadmap]] — what is planned next
`},Commands:{slug:"Commands",title:"Commands",markdown:`# Commands

Use these in the **server console** or **in-game** (if you have permission). Most commands need **OP level 2** unless noted.

All commands start with **\`/watchtower\`**.

---

## Commands you will use most

| Command | What it does |
|---------|----------------|
| \`/watchtower run\` | Compose a **support bundle** (Quick preset) from Watching + Scanning |
| \`/watchtower diagnostics\` | Same Support compose path — share with host / mod authors |
| \`/watchtower brief\` | Print latest **legacy** report summary when a non-support facts file exists |
| \`/watchtower issues\` | List up to 12 active problems |
| \`/watchtower status\` | Quick snapshot: TPS, lag, players, mods, issue counts |
| \`/watchtower url\` | Print dashboard URL |

For presets and log pickers, prefer the dashboard rail **Build support pack** — [[Health-Reports]]. Day-to-day tabs do **not** require \`/watchtower run\`.

---

## Optional schedule (legacy)

Legacy deep audits — see [[Health-Reports]]. New installs default **Off**.

| Command | What it does |
|---------|----------------|
| \`/watchtower schedule show\` | Show current schedule |
| \`/watchtower schedule set 60\` | Interval example (minutes) |
| \`/watchtower schedule off\` | Turn off |

Not exposed in Settings — use commands or \`watchtower.conf\`.

---

## Dashboard login (OP level 4)

| Command | What it does |
|---------|----------------|
| \`/watchtower dashboard reset-password\` | Reset to \`watchtower\` / \`password\` |
| \`/watchtower dashboard reset-password clear-2fa\` | Same, and turns off 2FA |

See [[Security-and-Access]].

---

## Files on disk

\`\`\`text
<server>/watchtower/watchtower-support-<timestamp>.zip   ← Support compose
<server>/watchtower/watchtower-facts-support-*.json      ← Compose / zip only
<server>/watchtower/watchtower-brief-*.txt               ← Legacy (optional)
<server>/watchtower/watchtower-facts-*.json              ← Legacy (optional)
\`\`\`

---

## Related

- [[Health-Reports]]
- [[Configuration]]
- [[Disaster-Recovery]]
`},Configuration:{slug:"Configuration",title:"Configuration",markdown:`# Configuration

Most settings live in the dashboard **Settings** menu. A few advanced options live in files on disk.

---

## Two places settings live

| Where | Restart needed? | How to edit |
|-------|-----------------|-------------|
| **Settings** (gear) | Usually no | Dashboard UI |
| \`watchtower/watchtower.conf\` | No | Settings or text editor |
| \`config/watchtower-server.toml\` | **Yes** | Text editor only |

**Rule of thumb:** backups and warnings → Settings or \`watchtower.conf\`. Optional legacy schedule → conf or \`/watchtower schedule\`. Dashboard port and live chart speed → TOML + restart.

---

## Settings panels

| Panel | What you can do |
|-------|-----------------|
| **General** | Identity (read-only), update check, metrics banner, legacy lookback / incremental |
| **Monitoring** | TPS / MSPT thresholds, performance baseline, Spark auto-capture on lag, ops/log scan intervals |
| **Backups** | Local folder + external panel tracking |
| **Alerts** | Disk warn / fill / write latency, report retention |
| **Security** | Your password, username, 2FA |
| **Accounts** | Owner-only: add people, change roles, reset passwords ([[Accounts-And-Audit-Log]]) |
| **Audit log** | Who changed settings, acks, suppressions, accounts, and sign-ins (owner/admin) |
| **Integrations** | Modrinth lookup / auto-scan, Spark enabled |
| **About** | Install facts + relaunch setup wizard |

Deep link: \`?tab=settings&panel=monitoring\` (and other panel ids). Older links \`panel=rules\` / \`panel=advanced\` redirect to **Alerts** / **Integrations**.

Monitoring cadence also surfaces from [[Sources]] → Open monitoring settings.

---

## What needs a server restart

Edit \`config/watchtower-server.toml\` for:

| Setting | What it controls |
|---------|------------------|
| \`dashboardPort\` | Dashboard port (default 8787) |
| \`dashboardBindHost\` | \`127.0.0.1\` on public servers; \`0.0.0.0\` on LAN |
| \`liveSampleIntervalSeconds\` | How often live metrics are recorded |
| \`liveRetentionHours\` | How long chart history is kept |
| \`commandPermissionLevel\` | Minimum OP level for \`/watchtower\` commands |

Restart Minecraft after editing TOML.

---

## Optional legacy schedule

New installs default schedule **Off**. Day-to-day uses Watching + Scanning. If you still want legacy deep audits, see [[Health-Reports#Optional schedule (legacy deep audits)]].

---

## Weekly ops digest

Local weekly summary on [[Insights]] → Digest and a dismissible [[Dashboard-Overview]] teaser. Keys live in \`watchtower/watchtower.conf\` (defaults are fine for most servers):

| Key | Default | Meaning |
|-----|---------|---------|
| \`WEEKLY_DIGEST_ENABLED\` | \`true\` | Kill-switch — set \`false\` to stop auto and manual generate |
| \`WEEKLY_DIGEST_INTERVAL_DAYS\` | \`7\` | Minimum days between automatic digests |
| \`WEEKLY_DIGEST_HISTORY_MAX\` | \`8\` | Max digests kept in \`ops-cache.json\` (newest first) |

HTTP: \`GET\` / \`POST /api/weekly-digest\` — see [[HTTP-API]].

---

## Pack drift and client-only Issues

| Key | Default | Meaning |
|-----|---------|---------|
| \`MOD_JAR_DRIFT_ENABLED\` | \`true\` | Hash jars (SHA-512) and raise \`MOD_JAR_DRIFT\` when the same filename + version gets a different hash |
| \`CLIENT_ON_SERVER_ISSUES_ENABLED\` | \`true\` | Promote high-confidence \`likely_removable\` side scores into continuous Issues (\`CLIENT_ON_SERVER:{mod_id}\`) |

See [[Issues]] (Jar drift / Client-only jars) and [[Mods]].

---

## External kill detection

| Key | Default | Meaning |
|-----|---------|---------|
| \`EXTERNAL_KILL_DETECT_ENABLED\` | \`true\` | After an abrupt stop (no clean shutdown, no crash report), classify OS OOM-killer vs panel force-kill on the next boot |

Surfaces on the Crashes tab as \`failure_kind: external_kill\` (Killed chip) and as Issues \`EXTERNAL_KILL:{subtype}\`. Fix text for OOM points at Insights → Configs (RAM advisor); panel subtype points at stop/watchdog timeout settings.

---

## Restart hygiene advisor

| Key | Default | Meaning |
|-----|---------|---------|
| \`RESTART_HYGIENE_ENABLED\` | \`true\` | Correlate long JVM uptime with rising GC/heap vs the prior 12h and suggest the next quiet window on Overview |

Advisory only — Watchtower never starts or schedules a restart. Suppresses when uptime is under 36h, metrics look healthy, or sample coverage is thin. Quiet-window timestamps in the API are UTC ISO instants.

### Dashboard timezone (browser-local)

Settings → **Timezone** stores \`{ mode, zone }\` under \`wt-timezone\` in the browser (modes: \`browser\`, \`utc\`, \`iana\`). It does **not** change server config or rollup storage — Insights Schedule heatmaps and Overview restart-hygiene times convert UTC cells for display. Invalid IANA values fall back to the browser zone. Relative ages (“3h ago”) are unchanged.

---

## Silent-fail detection (scripts / datapacks)

| Key | Default | Meaning |
|-----|---------|---------|
| \`SILENT_FAIL_DETECT_ENABLED\` | \`true\` | Raise continuous Issues for KubeJS, CraftTweaker, datapack JSON parse, and \`/reload\` failure signatures in \`latest.log\` |

Surfaces on Issues as \`SILENT_FAIL:{kind}:…\` under **Script & datapack failures**. Path/line is captured only when present on the same trigger line. Does not edit scripts. See [[Script-Failed-Silently]].

---

## World pressure (entity / chunk census)

| Key | Default | Meaning |
|-----|---------|---------|
| \`WORLD_PRESSURE_ENABLED\` | \`true\` | Per-dimension entity/chunk census + farm/chunk-loader classifiers as Issues and Insights → World |

## Join clinic (pack sync rejections)

| Key | Default | Meaning |
|-----|---------|---------|
| \`JOIN_CLINIC_ENABLED\` | \`true\` | Surfaces Forge/NeoForge/Fabric join rejections as Session → Join clinic + Issues (\`JOIN_SYNC\`) — read-only |
| \`liveWorldCensusIntervalSeconds\` | \`60\` | NeoForge mod config — how often the tick-thread census runs (30–600) |

Read-only: never kills entities or unloads chunks. Classifiers use sustained windows vs quiet-hours baselines. See [[World-Pressure]].

---

## Related

- [[Sources]]
- [[Backups]]
- [[Security-and-Access]]
- [[Accounts-And-Audit-Log]]
- [[On-disk-Files]]
- [[Commands]]
`},"Crash-Rule-Packs":{slug:"Crash-Rule-Packs",title:"Crash Rule Packs",markdown:'# Crash Rule Packs\n\nOptional YAML matchers for pack-specific crash patterns. Built-in Java classifiers always run first; YAML packs run after and record hits. Most owners never need a custom pack — start on [[Crashes]].\n\nOperators who maintain a modpack can drop packs under `config/watchtower/rules/` so Fix hints match your pack’s known failure modes.\n\n## Where packs live\n\n| Source | Path |\n|--------|------|\n| Builtin (JAR) | `builtin-rules/*.yaml` inside Watchtower |\n| Operator | `config/watchtower/rules/*.yaml` on the server |\n\nConf flags (in `watchtower/watchtower.conf`):\n\n```ini\nCRASH_RULE_PACKS=true\nCRASH_RULE_BUILTIN=true\nISSUE_SUPPRESSIONS=CLIENT_ON_SERVER\nISSUE_SUPPRESSION_REGEX=\n```\n\nBad packs are skipped with a warning — the server still boots.\n\n## Limits\n\n- Regex ≤ 500 characters\n- ≤ 64 rules per pack\n- ≤ 10 packs loaded\n- **No** `exec`, JEXL, HTTP, shell, or file-write predicates\n\n## Minimal example\n\n```yaml\nschema_version: 1\npack: { id: my-pack, name: "My pack", priority: 100 }\n\nrules:\n  - id: kubejs-startup-syntax\n    priority: 180\n    when:\n      all:\n        - { source: log_excerpt, log_type: latest, regex: "KubeJS startup script syntax errors" }\n        - { mod_present: kubejs }\n    emit:\n      failure_kind: mod_load_script\n      primary_mod_id: kubejs\n      fix_hints: ["Fix kubejs/server_scripts syntax"]\n```\n\n## Predicate vocabulary (v1)\n\n| Key | Meaning |\n| --- | ------- |\n| `source` | `crash_report` \\| `log_excerpt` \\| `stack` \\| `fml_issue` \\| `description` |\n| `regex` | Java regex |\n| `mod_present` / `mod_absent` | Mod list check |\n| `all` / `any` | Composites |\n| `log_type` | For `log_excerpt`: `latest` \\| `stderr` \\| `pre_crash` |\n| `field` | For `fml_issue`: `mod_id` \\| `message` \\| `file` |\n\n## Emit merge policy\n\n- Every match is recorded in `crash_rule_hits[]`\n- `failure_kind` / `primary_mod_id` apply only when Java kind is `unknown`, or when `emit.override: true` and the rule priority wins\n- `fix_hints` append (dedupe) unless `override: true`\n\n## Validate before deploy\n\n```bash\njava -jar watchtower-cli.jar rules validate config/watchtower/rules/my-pack.yaml\njava -jar watchtower-cli.jar rules list --server /path/to/server\n```\n\nDashboard: crash rule packs are still configured via `watchtower.conf` and files under `config/watchtower/rules/` (Settings → Alerts is disk/retention only in the current dashboard).\n\n## Issue suppressions\n\nHide noisy Issues inbox ids without touching Crashes:\n\n```ini\nISSUE_SUPPRESSIONS=CLIENT_ON_SERVER,LOOT_PARSE_SPAM\n```\n\nOr use **Suppress** on an Issues card (stored in `.watchtower-state.json`). Suppressed items appear under **Hidden** and can be restored with **Unsuppress**. Suppressions never change crash Fix headlines.\n'},Crashes:{slug:"Crashes",title:"Crashes",markdown:`# Crashes

**Crashes** groups crash reports by fingerprint and gives clear next steps — Fix, Evidence, and Details.

---

## When to open it

- The server crashed or restarted unexpectedly
- Issues pointed at a crash card
- You need to share crash context with a mod author

---

## What you’ll see

| View | Job |
|------|-----|
| **Review** | Open crash groups to work |
| **Reviewed** | Groups you already handled |
| **Tools** | Scan / utilities |

| Panel | Job |
|-------|-----|
| **Fix** | Prioritized next steps |
| **Evidence** | Stacks, excerpts, linked files |
| **Details** | Metadata and fingerprint info |

**Mark reviewed** clears the group from Review without deleting files on disk.

Background **Scan** refreshes crash folders. That is separate from **Support compose** (shareable zip) — see [[Health-Reports]].

---

## What to do next

1. Open the newest group in **Review**
2. Read **Fix**, then **Evidence** if you need proof
3. Jump to [[Mods]] Forensics or [[Logs]] for raw files when Fix says so
4. Build a Support pack when asking a host or mod author for help

---

## Healthy vs problem

| Healthy | Problem |
|---------|---------|
| Review empty / quiet | Repeating fingerprint after “fixes” |
| Scanning fresh on [[Sources]] | Empty Crashes while \`crash-reports/\` has new files — click Refresh |

---

## Related

- [[Logs]]
- [[Mods]]
- [[Crash-Rule-Packs]]
- [[Health-Reports]]
- [[Issues]]
- [[Troubleshooting]]
`},"Dashboard-Overview":{slug:"Dashboard-Overview",title:"Dashboard Overview",markdown:`# Dashboard Overview

**Overview** is mission control — health grade, vitals, what needs attention, and shortcuts to the right tab.

---

## At a glance

- **You must sign in** — visitors without a login only see the sign-in screen
- **First login:** \`watchtower\` / \`password\` — change it right away ([[Security-and-Access]])
- **Side rail** — Monitor / Triage / Ops plus System (**Help Center**, Settings, Roadmap)
- **Top bar** — hostname, Live/Offline, freshness, Search (⌘K), inbox
- **Support pack** — rail **Build support pack**, Overview card, or Help Center hub (not Settings → Advanced as the primary path)

---

## First visit

1. Sign in and change your password
2. Optional **Welcome** tour (\`?tab=wizard\` or Help Center hub)
3. Check [[Sources]] — Watching + Scanning fresh (or Waiting)
4. Skim **Needs attention** and the grade on Overview
5. Configure [[Backups]] or leave Not tracking on purpose

---

## What you’ll see

| Area | Meaning |
|------|---------|
| **Health grade** | Snapshot of overall server health from Watchtower’s signals |
| **Needs attention** | Queue of things to open next (Issues, crashes, backups, …) |
| **Right now** | Live vitals (TPS, lag, players, …) |
| **Incident story** | Recent narrative of what happened — deeper on [[Activity]] |
| **Lag incidents** | Detected lag windows |
| **Performance insight** | Teaser into [[Insights]] |
| **Weekly ops digest** | Dismissible week summary (grade, crashes, disk, next action) — full history on [[Insights]] → Digest |
| **Spark** | Short summary + Open Spark when a fresh profile exists |
| **Boot profile** | Teaser into [[Startup]] |
| **Restart** | Safe / Caution / Wait — informational only |
| **Storage** | Disk used %, world size, runway — detail on Insights → Storage |
| **First-run cards** | Setup nudges (backups, Support pack, …) |

### What the grade means

| Tone | Operator takeaway |
|------|-------------------|
| Strong / OK | Keep the daily check short — Overview → Issues → Sources |
| Caution | Open Needs attention and the linked tab before peak hours |
| Poor | Treat as an incident — Issues / Crashes / Live first |

Exact letter or label wording follows what Overview shows on your build.

---

## Restart checklist

| Verdict | Meaning |
|---------|---------|
| **Safe** | Fresh backup, no active pregen, disk OK |
| **Caution** | Restart possible — check listed notes first |
| **Wait** | Pause — e.g. pregen mid-run, backup too old, disk critical |

Each reason can **Open** the relevant tab. The card never blocks \`/stop\` or your host panel.

---

## Chrome — rail and top bar

| Control | What it does |
|---------|----------------|
| Monitor / Triage / Ops | Primary tabs — [[Dashboard-Tabs]] |
| **Build support pack** | Support compose ([[Health-Reports]]) |
| **Help Center** | This wiki |
| **Settings** | Thresholds, backups, security |
| Theme / Collapse | Appearance and rail width |
| **Search** | Command palette (Ctrl/Cmd+K) |
| **Inbox** | Unreviewed crashes and update nudges |

---

## Settings (gear)

| Panel | What you can do |
|-------|-----------------|
| **General** | TPS/lag warning levels |
| **Monitoring** | How often things are checked |
| **Backups** | Where backups live |
| **Rules** | Crash / issue rules |
| **Security** | Password, username, 2FA |
| **Advanced** | Advanced options |
| **About** | Version and tour entry |

Most changes apply immediately. A few need a server restart — Settings says which.

---

## Banners you might see

| Banner | Meaning |
|--------|---------|
| **Exposure warning** | Dashboard may be reachable from outside — [[Security-and-Access]] |
| **Update available** | Newer Watchtower release |
| **Environment** | Hosted server context (e.g. CPU limits) |
| **Legacy facts stale** | Old on-disk facts — day-to-day tabs still use Scanning |

---

## Related

- [[Dashboard-Tabs]] — map of every tab
- [[Issues]] — fix inbox
- [[Sources]] — is Watchtower working?
- [[Live-Charts]] — right-now charts
- [[Activity]] — incident story detail
- [[Using-Spark-with-Watchtower]] — lag proof
- [[Understanding-Data-Sources]] — Watching vs Scanning vs Support
`},"Dashboard-Tabs":{slug:"Dashboard-Tabs",title:"Dashboard Tabs",markdown:`# Dashboard Tabs

Find the right rail tab in under 30 seconds. Each row links to a dedicated guide where one exists.

---

## Rail map

Tabs are grouped as **Monitor**, **Triage**, **Ops**, and **System**. Theme, skin, and collapse sit under System tools. **Visual Lab** is a developer gallery — not covered here. **Welcome** is a skippable tour (\`?tab=wizard\`); see [[Quick-Start-Checklist]].

---

## When to open

| If you need… | Open |
|--------------|------|
| Health grade, attention queue, where to look next | [[Dashboard-Overview|Overview]] |
| TPS / lag / host right now | [[Live-Charts|Live]] |
| Patterns, weekly digest, world pressure, config health, mod churn, storage trends | [[Insights]] |
| Who is online, peaks, playtime directory, session activity | [[Session]] · [[Join-Clinic]] |
| Last boot verdict and phases | [[Startup]] |
| Fix inbox | [[Issues]] |
| Crash groups and next steps | [[Crashes]] |
| Lag proof from a profiler capture | [[Using-Spark-with-Watchtower|Spark]] |
| Raw log files with filters | [[Logs]] |
| Mod inventory, updates, conflicts | [[Mods]] |
| Backup freshness and setup | [[Backups]] |
| Commands, joins, lag, jobs timeline | [[Activity]] |
| Poller health / next data pull | [[Sources]] |
| Guides and troubleshooting | **Help Center** (this wiki) |
| Thresholds, retention, security, accounts | **Settings** |

---

## Monitor

| Tab | One-line job | Guide |
|-----|--------------|-------|
| **Overview** | Mission control — grade, attention, teasers | [[Dashboard-Overview]] |
| **Live** | Right-now ops console for tick and host signals | [[Live-Charts]] |
| **Insights** | Patterns over a window — not the live second. Sub-views include Patterns, Configs, Mod changes, **World** (entity/chunk pressure), Storage, Digest | [[Insights]] · [[World-Pressure]] |
| **Session** | Online roster, peaks, directory, **Session activity** (joins / leaves / pack-sync rejects) | [[Session]] · [[Join-Clinic]] |
| **Startup** | Last boot, phases, history | [[Startup]] |

---

## Triage

| Tab | One-line job | Guide |
|-----|--------------|-------|
| **Issues** | Active fix inbox | [[Issues]] |
| **Crashes** | Fingerprint groups + Fix / Evidence | [[Crashes]] |
| **Spark** | Read \`.sparkprofile\` captures during lag | [[Using-Spark-with-Watchtower]] |
| **Logs** | Browse server log files | [[Logs]] |

---

## Ops

| Tab | One-line job | Guide |
|-----|--------------|-------|
| **Mods** | Inventory, updates, conflicts, Modrinth, forensics | [[Mods]] |
| **Backups** | Freshness, archives, Step A/B checklist | [[Backups]] |
| **Activity** | Timeline of commands, joins, lag, jobs | [[Activity]] |
| **Sources** | Watching / Scanning / Support pollers | [[Sources]] |

> **Name clash:** Ops **Sources** = poller health. Spark → **Sources** = which mod owns profile time. Different places.

---

## System — Help Center

| Tab / tool | Job |
|------------|-----|
| **Help Center** | Guides, search, Support pack shortcut |
| Theme / Collapse | Rail **Customize** popover (Light / Dark / Black / System + accent) and rail width |
| **Settings** | General (incl. Appearance), Monitoring, Backups, Alerts, Security, Accounts, Audit log, Integrations, About |

**Settings panels:** General (Appearance + dashboard prefs) · Monitoring · Backups · Alerts · Security · Accounts · Audit log · Integrations · About (\`?tab=settings&panel=<id>\`). Appearance theme/accent syncs per signed-in account. Accounts is owner-only; Audit log is owner/admin. See [[Accounts-And-Audit-Log]].

---

## Related

- [[Understanding-Data-Sources]] — Watching vs Scanning vs Support
- [[Troubleshooting]] — symptom → tab
- [[Dashboard-Overview]] — first stop after login
`},"Disaster-Recovery":{slug:"Disaster-Recovery",title:"Disaster Recovery",markdown:`# Disaster Recovery

Use this when **Minecraft will not start** — crash loop, mod error on boot, or the panel keeps restarting. The dashboard is not available; you work over **SSH** on the host.

---

## Quick steps

| Step | What to do |
|------|------------|
| 1 | SSH to your server, go to the **\`mods/\`** folder |
| 2 | Run \`java -jar watchtower-cli-<version>.jar dr\` (match [[Downloads-and-Releases]]) |
| 3 | Download the zip it creates |
| 4 | Prefer reading the zip contents / logs first. Optionally open [[DR-Viewer]] — **Coming soon** for full Fix-tab reliability |

---

## When to use this

| Situation | Use recovery tools? |
|-----------|---------------------|
| Server crash loop, won't stay up | **Yes** |
| Mod won't load on boot | **Yes** |
| Server running fine | **No** — use the dashboard + Watching/Scanning |
| Want live charts | **No** — recovery path has no Live tab |

---

## Run the recovery tool

\`\`\`bash
cd /path/to/your/server/mods
java -jar watchtower-cli-<version>.jar dr
\`\`\`

Creates **\`watchtower-dr-bundle-<timestamp>.zip\`** in the current folder.

Analysis in [[DR-Viewer]] runs **in your browser** — nothing is sent to Watchtower servers. If the viewer is incomplete, open the zip and inspect logs / crash-reports directly. Full CLI flags: [[DR-CLI-Reference]].

---

## Before problems happen

Successful Support / legacy report flows update \`watchtower/DR-README.txt\` with the exact command for your path. Keep **\`watchtower-cli-*.jar\`** in \`mods/\` ahead of time.

---

## Panel won't let you save the zip?

\`\`\`bash
java -jar watchtower-cli-<version>.jar dr --out /tmp
\`\`\`

Download from \`/tmp\` via SFTP.

---

## No CLI? Manual files

Drop into the viewer (or inspect locally):

- \`logs/latest.log\` (required)
- \`crash-reports/*.txt\` (recommended)
- \`mods/*.jar\` (optional)

---

## Privacy

Bundle review is **local to your browser** when using the viewer. Optional cache stays on your machine.

---

## Related

- [[DR-CLI-Reference]]
- [[DR-Viewer]]
- [[Troubleshooting]]
- [[Downloads-and-Releases]]
`},"Downloads-and-Releases":{slug:"Downloads-and-Releases",title:"Downloads and Releases",markdown:`# Downloads and Releases

Watchtower ships **two files** per version: the mod (for your server) and a recovery tool (for when the server won't boot).

---

## Which file goes where

| File pattern | Where to put it |
|--------------|-----------------|
| \`watchtower-neoforge-*+mc1.21.jar\` | Server **\`mods/\`** — **required** |
| \`watchtower-cli-*.jar\` | Same **\`mods/\`** — **recommended** (not loaded as a mod; \`java -jar\` over SSH) |

Always take the **current release** from the links below — filenames include the version number.

---

## Download

| Source | Link |
|--------|------|
| **GitHub Releases** | https://github.com/djinnbanter/WatchTower/releases |
| **Modrinth** | https://modrinth.com/mod/watchtower |

JARs are not stored in the git repo — download from releases or build from source.

---

## After download

1. Install per [[Installation]]
2. First login per [[Quick-Start-Checklist]]
3. Keep the CLI jar for [[Disaster-Recovery]]

Match CLI version to mod version when possible.

---

## Related

- [[Installation]]
- [[Changelog]]
- [[Roadmap]]
`},"DR-CLI-Reference":{slug:"DR-CLI-Reference",title:"DR CLI Reference",markdown:`# DR CLI Reference

**When you need this:** the game server **will not boot** and you have SSH access. This tool builds a recovery zip. Open it yourself or try [[DR-Viewer]] (**Coming soon** for complete Fix guidance).

---

## Quick usage

\`\`\`bash
cd /path/to/your/server/mods
java -jar watchtower-cli-<version>.jar dr
\`\`\`

Output: **\`watchtower-dr-bundle-<timestamp>.zip\`**

Use the same version as your mod when possible — [[Downloads-and-Releases]].

---

## Common options

| Flag | What it does |
|------|----------------|
| \`--server <path>\` | Server root if not running from \`mods/\` |
| \`--out /tmp\` | Write zip somewhere the panel allows |
| \`--minutes 720\` | Log window if no boot time found (default 24h) |

### Examples

\`\`\`bash
java -jar watchtower-cli-<version>.jar dr
java -jar watchtower-cli-<version>.jar dr --server /home/container
java -jar watchtower-cli-<version>.jar dr --out /tmp
\`\`\`

---

## What's in the zip

- Summary JSON and brief text
- Log excerpts around the last start attempt
- Crash summaries
- Mod list and changes vs prior report (when available)

---

## Where to put the JAR

**Recommended:** \`mods/\` next to the Watchtower mod. NeoForge does not load it as a mod — you only run it with \`java -jar\` over SSH.

---

## Related

- [[Disaster-Recovery]]
- [[DR-Viewer]]
- [[Commands]]
`},"DR-Viewer":{slug:"DR-Viewer",title:"DR Viewer",markdown:`# DR Viewer

A **web page in your browser** to understand a recovery zip when the server will not boot. No login, no live dashboard — diagnosis from the bundle only.

> **Coming soon:** some Fix-tab guidance, upload flows, and tabs may still be incomplete. Prefer the **DR CLI** zip plus manual log review when you need a reliable path today. Report issues on [GitHub](https://github.com/djinnbanter/WatchTower/issues).

---

## At a glance

- **Upload:** \`watchtower-dr-bundle-*.zip\` from [[Disaster-Recovery]]
- **Or:** drop log folders / old facts JSON manually
- **Privacy:** runs in your browser — files are not uploaded to a remote Watchtower server

---

## How to use it

1. Get a bundle zip ([[Disaster-Recovery]] / [[DR-CLI-Reference]])
2. Open the DR viewer URL (often in \`DR-README.txt\`)
3. Upload the zip
4. Start on **Fix** when available — otherwise open Logs / files in the zip
5. Use **Logs**, **Mods**, **Report** tabs as they appear on your build

### No zip?

Expand **Advanced: analyze log files locally** and drop a folder with \`logs/\`, \`crash-reports/\`, and \`mods/\`.

---

## Host it yourself (optional)

Publish the \`web/dr-viewer/\` folder to any static host.

Optional in \`watchtower.conf\`:

\`\`\`ini
DR_VIEWER_URL=https://your-site.example/watchtower-dr/
\`\`\`

---

## What's not included

No Live charts, no Backups tab, no sign-in — this is recovery-only.

---

## Related

- [[Disaster-Recovery]]
- [[DR-CLI-Reference]]
`},"Health-Reports":{slug:"Health-Reports",title:"Health Reports",markdown:`# Health Reports

Day-to-day tabs stay current via **Watching** and **Scanning** — [[Understanding-Data-Sources]]. This page is about **Support packs** (shareable zips) and an **optional** legacy schedule.

---

## At a glance

| Mode | Plain English |
|------|----------------|
| **Day-to-day** | Watching + Scanning — no homework |
| **Support pack** | Zip when you need to share with a host or mod author |
| **Optional schedule** | Legacy deep audits — off on new installs |

---

## Day-to-day vs share

| Day-to-day | Share |
|------------|-------|
| Live, Issues, Crashes, Mods stay current | Frozen zip + brief for someone else |
| Open [[Sources]] for freshness | Rail **Build support pack** |

---

## Support pack entry points

Use these (Support lives on the rail — not under Settings → Integrations):

1. Rail footer **Build support pack**
2. Overview **Support pack** card
3. Help Center hub **Build pack**
4. Console: \`/watchtower run\` or \`/watchtower diagnostics\`

> **Coming soon:** the in-app downloadable zip may still be finishing on some builds. Console compose and on-disk outputs remain the reliable path when the UI download is not ready yet.

### Chooser (dashboard)

Pick a **pack type** (Quick, Server issue, WatchTower bug, or Full evidence), add an optional note for whoever opens the zip, and download. **Customize files…** is optional if you need specific logs or crashes. There is no separate "what's going on?" step — the pack type is the decision.

Before download, WatchTower checks for a log, mod list, and crash coverage when relevant. Yellow warnings don't block you; **Download anyway** notes them in the zip.

### What goes in a pack (intent)

Environment, redacted ops/config, optional logs/crashes/Spark, synthesized support facts + brief **for the zip only**. Never includes dashboard auth, world data, backups, or mod jars. Spark profiles are binary and unredacted when included.

**How to read the zip:** server issues → \`PROBLEM.txt\` → \`report/brief.txt\` → \`evidence/\`; Watchtower bugs → \`environment.json\` → redacted conf → ops-cache.

---

## Problem types you might see

In [[Issues]] and \`/watchtower issues\` (examples):

| ID | Plain English |
|----|----------------|
| \`SERVER_DOWN\` | Server not running |
| \`OOM\` | Ran out of memory |
| \`CRASH_REPORT\` | Crash files on disk |
| \`DISK_HIGH\` | Disk almost full |
| \`TICK_LAG\` / \`MSPT_HIGH\` / \`TPS_LOW\` | Server struggling |
| \`SOFT_HANG\` | Process up but ticks frozen |
| \`BACKUP_*\` | Backup not configured / missing / stale |
| \`MOD_UPDATE_CONFLICT\` | Mod version problems |

---

## Optional schedule (legacy deep audits)

Automatic legacy deep audits are **optional**. New installs default schedule **Off**. Watching / Scanning cover day-to-day — you do not configure a deep audit schedule in Settings.

| Command | Effect |
|---------|--------|
| \`/watchtower schedule show\` | Show current mode |
| \`/watchtower schedule set 60\` | Interval example (minutes) |
| \`/watchtower schedule off\` | Turn off |

Needs OP level 2 by default. Or edit \`watchtower/watchtower.conf\`:

| Key | Default (new installs) | Notes |
|-----|------------------------|-------|
| \`REPORT_SCHEDULE_MODE\` | \`off\` | \`wall_clock\`, \`interval\`, or \`off\` |
| \`REPORT_WALL_CLOCK_HOURS\` | \`0,12\` | Hours 0–23, server local time |
| \`REPORT_INTERVAL_MINUTES\` | \`720\` | When mode is \`interval\` |

Scheduled runs write legacy \`watchtower-facts-*.json\` / \`watchtower-brief-*.txt\`. They do **not** replace Live charts. Upgrades keep existing schedules unless you turn them off.

---

## Related

- [[Understanding-Data-Sources]]
- [[Sources]]
- [[Commands]]
- [[Configuration]]
- [[Troubleshooting]]
`},Home:{slug:"Home",title:"Watchtower",markdown:`# Watchtower

Watchtower watches your Minecraft server and shows what to fix — on your machine. It checks logs, crashes, mods, backups, and how hard the host is working, then shows the results in a web dashboard. No cloud accounts, no AI, no data sent elsewhere.

---

## What you get

| Feature | In plain English |
|---------|------------------|
| **Watching + Scanning** | Charts and continuous Issues stay current without homework |
| **Live dashboard** | Server speed, lag, players, memory, and CPU with charts |
| **Fix list** | Prioritized problems from continuous Scanning ([[Issues]]) |
| **Support compose** | A zip snapshot when you need to share with your host or mod authors |
| **Recovery tools** | Help when the server will not start (separate command-line tool) |
| **Built-in guides** | **Help Center** in the dashboard — search and browse without leaving the UI |

---

## How data works

| Layer | Plain English |
|-------|----------------|
| **Watching** | Live charts and vitals while the server runs |
| **Scanning** | Logs, crashes, Issues, mods — about once a minute |
| **Support compose** | Frozen zip when you ask — not day-to-day tab truth |

Full detail: [[Understanding-Data-Sources]]. Day-to-day freshness: [[Sources]].

---

## First hour

1. [[Installation]] — download and add the mod
2. [[Quick-Start-Checklist]] — sign in, first-run setup wizard, Sources check, backups
3. [[Dashboard-Overview]] — mission control
4. [[Dashboard-Tabs]] — where to click next

**Server will not start?** → [[Disaster-Recovery]]

**Something not working?** → [[Troubleshooting]]

**Is Watchtower working?** → [[Sources]]

---

## Download

Get the **current release** jars from [[Downloads-and-Releases]] (GitHub Releases and Modrinth). Put the NeoForge jar in \`mods/\`; keep the CLI jar nearby for recovery.

---

## Related

- [[Roadmap]] — what is planned next
- [[Changelog]] — what changed
- [CONTRIBUTING.md](https://github.com/djinnbanter/WatchTower/blob/main/CONTRIBUTING.md) — build and contribute
`},"Hosting-Panels":{slug:"Hosting-Panels",title:"Hosting Panels",markdown:`# Hosting Panels

If you use a **hosting panel** (Crafty, Pterodactyl, bloom, AMP, and others), Watchtower can detect it and show helpful context. It still will **not** find your backups automatically — you set those separately.

---

## At a glance

- **Default:** automatic detection (\`PANEL=auto\`)
- **Wrong panel shown?** Set \`PANEL=none\` or the correct panel name in config
- **Backups:** always set up manually — [[Backups]]

---

## Panels Watchtower recognizes

When set to auto, Watchtower looks for common setups including:

Crafty, Pterodactyl / Pelican, PufferPanel, MCSManager, AMP, Multicraft, MineOS, Docker, and bare-metal installs.

Some panels must be set manually (TCAdmin, WISP, PebbleHost).

---

## bloom.host / VPS / containers

| Concern | What to do |
|---------|------------|
| Dashboard on public IP | Bind to localhost + SSH tunnel — [[Security-and-Access]] |
| Temperature missing on charts | Normal on VPS — not always available |
| Cannot see backup folder | Use **Settings → Backups** for panel-only backups |
| Recovery tool cannot write | Run CLI with output to \`/tmp\` |

---

## Backup hints

Watchtower may suggest where backups *might* live, but you confirm the path:

- **Backups** tab → **Choose backup folder** if files are on this server
- **Settings → Backups** if backups stay on the panel or cloud only

Issue messages: \`BACKUP_NOT_CONFIGURED\`, \`BACKUP_NOT_FOUND\`, \`BACKUP_STALE\` — see [[Backups]].

---

## Technical details

### Force or disable panel detection

\`\`\`ini
PANEL=auto          # default
PANEL=none          # disable integration
PANEL=crafty        # force a panel
CRAFTY_ROOT=/path/to/crafty
\`\`\`

Common root keys: \`CRAFTY_ROOT\`, \`PTERODACTYL_ROOT\`, \`AMP_ROOT\`, \`MINEOS_ROOT\`.

### Crafty API (when RCON unavailable)

\`\`\`ini
CRAFTY_URL=https://your-panel:8443
CRAFTY_API_TOKEN=your-token
CRAFTY_SERVER_UUID=server-uuid
\`\`\`

See [watchtower.conf.example](https://github.com/djinnbanter/WatchTower/blob/main/tools/watchtower.conf.example).

---

## See also

- [[Configuration]]
- [[Backups]]
- [[Security and Access]]
`},"HTTP-API":{slug:"HTTP-API",title:"HTTP API",markdown:'# HTTP API\n\n**Most owners can skip this page.** Use the dashboard and `/watchtower` commands for normal ops. This API is for developers, scripts, and automation.\n\nThe dashboard exposes a REST API on the same port as the UI (default **8787**). All endpoints except `/api/config` and `/api/auth/*` require a valid session after login (+ 2FA if enabled).\n\n---\n\n## At a glance\n\n- **Base URL:** `http://<server>:8787`\n- **Auth:** session cookie after `POST /api/auth/login`\n- **Public:** `/api/config`, `/api/auth/session`, login/logout flows\n- **Rate limit:** 5 failed logins per IP per 15 minutes → HTTP 429\n\n---\n\n## Authentication\n\n| Endpoint | Method | Purpose |\n|----------|--------|---------|\n| `/api/auth/session` | GET | Session status (public) |\n| `/api/auth/login` | POST | `{ username, password, remember? }` |\n| `/api/auth/totp` | POST | `{ code, recovery? }` — complete 2FA |\n| `/api/auth/logout` | POST | End session |\n| `/api/auth/change-password` | POST | `{ current_password, new_password }` |\n| `/api/auth/change-username` | POST | `{ username }` |\n| `/api/auth/totp/setup` | POST | Begin 2FA — returns QR |\n| `/api/auth/totp/confirm` | POST | `{ code }` — enable 2FA + recovery codes |\n| `/api/auth/totp/disable` | POST | `{ password, code }` |\n| `/api/auth/recovery/regenerate` | POST | `{ password, code }` — new recovery codes |\n\nSession JSON (`GET /api/auth/session` and login responses) includes `role` (`owner` / `admin` / `viewer`) when authenticated. When a Minecraft player is linked, it also includes `minecraft_uuid` and `minecraft_name`. Appearance prefs (`ui_theme`, `ui_accent`) are included when set on the account. Viewers get 403 `read_only_account` on every non-GET `/api/*` write except self-service routes such as `/api/accounts/me/minecraft` and `/api/accounts/me/appearance`. Account-management routes need `owner` or return 403 `owner_required`. If auth failed to initialize, protected routes return 503 `auth_unavailable` (recovery: `/watchtower dashboard reset-password`).\n\n---\n\n## Accounts & audit log (1.1.18)\n\n| Endpoint | Method | Who | Purpose |\n|----------|--------|-----|---------|\n| `/api/accounts` | GET | owner | `{ accounts: [{ id, username, role, disabled, totp_enabled, created_at, last_login_at, is_you, minecraft_uuid?, minecraft_name? }] }` |\n| `/api/accounts` | POST | owner | `{ username, role }` → `{ ok, id, username, role, temp_password }` (temp password shown once) |\n| `/api/accounts/update` | POST | owner | `{ id, role?, disabled?, minecraft_uuid?, minecraft_name?, clear_minecraft? }` — role/disable ends sessions; Minecraft fields are optional |\n| `/api/accounts/me/minecraft` | POST | any signed-in | `{ uuid, name }` or `{ clear: true }` — link/unlink self only (viewers allowed) |\n| `/api/accounts/me/appearance` | PUT | any signed-in | `{ theme, accent }` — `theme`: `light`\\|`dark`\\|`black`\\|`system`; `accent`: `signal`\\|`amber`\\|`teal`\\|`violet`\\|`rose`\\|`green`\\|`coral`\\|`slate` (viewers allowed) |\n| `/api/accounts/reset-password` | POST | owner | `{ id, clear_2fa? }` → `{ ok, temp_password }`; ends that account’s sessions |\n| `/api/accounts/delete` | POST | owner | `{ id }` — refuses self-delete and last owner |\n| `/api/audit-log` | GET | owner or admin | `?limit=` (default 200, max 2000) → `{ entries, truncated, retention_days: 90, max_entries: 2000 }` |\n\nSee [[Accounts-And-Audit-Log]].\n\n---\n\n## Config & settings\n\n| Endpoint | Method | Purpose |\n|----------|--------|---------|\n| `/api/config` | GET | `live_sample_interval_sec`, `live_retention_hours`, `embedded`, `hostname`, `bind_exposed` |\n| `/api/settings` | GET | Schedule, lookback, incremental, `modrinth_lookup`, `modrinth_auto_scan_on_mod_changes`, `spark_enabled`, `spark_mod_loaded`, `spark_auto_capture_on_lag`, `spark_auto_capture_window_sec`, `spark_auto_capture_cooldown_sec`, backup dirs, external tracking mode, panel, `ops_poll_sec`, `ops_log_scan_sec`, `report_retention_count`, `report_retention_days`, `live_sample_interval_seconds` |\n| `/api/settings` | POST | `{ reportIntervalMinutes?, lookbackHours?, incremental?, modrinthLookup?, modrinthAutoScanOnModChanges?, sparkAutoCaptureOnLag?, … }` |\n| `/api/data-sources` | GET | Freshness timestamps for Sources tab: `live_at`, `ops_scan_at`, `full_report_at`, `issues_live_at`, `next_scheduled_minutes`, `ops_log_scan_sec`, `ops_poll_sec` |\n| `/api/update/check` | GET | Read-only version check against GitHub Releases / Modrinth |\n\n---\n\n## Onboarding (setup wizard)\n\n| Endpoint | Method | Purpose |\n|----------|--------|---------|\n| `/api/onboarding/discovery/start` | POST | Start blocking Initial discovery (**deep audit baseline**). Returns 202 / 409 if already running. |\n| `/api/onboarding/discovery/status` | GET | Discovery progress: `stage`, `stage_label`, `stage_detail`, `progress`, `counts`, `running`, `success`. |\n| `/api/onboarding/audit` | POST | Alias that starts Initial discovery (prefer `/discovery/*` for progress). |\n| `/api/config-audit` | GET | Read-only launch & config audit (`server.properties` verdicts + JVM summary from live/report). Same shape as facts `optional.config_launch_audit`. Kill-switch: `CONFIG_AUDIT_ENABLED=false` → `status: disabled`. |\n| `/api/weekly-digest` | GET | Bounded weekly ops digest history from `ops-cache.json` → `weekly_digest` (`history[]` newest-first, capped by `WEEKLY_DIGEST_HISTORY_MAX`). Empty `{ "history": [] }` when none yet. |\n| `/api/weekly-digest` | POST | Body `{ "action": "generate_now" }` — build and persist a digest now (`trigger: "manual"`). Returns `{ "ok": true, "digest": … }` or `409` with `{ "ok": false, "reason": "disabled" }` when `WEEKLY_DIGEST_ENABLED=false`. |\n\n---\n\n## Live & samples\n\n| Endpoint | Method | Query | Purpose |\n|----------|--------|-------|---------|\n| `/api/live` | GET | — | Latest snapshot, bandwidth, thermal, pregen |\n| `/api/players` | GET | — | Online player roster |\n| `/api/samples` | GET | `minutes=` or `hours=`, `max_points=` | Chart time series (TPS, MSPT, CPU, heap, etc.) |\n\nDefault `max_points` is 2000 (clamped 100–5000). Client typically requests ~500 for charts.\n\n`/api/samples` includes `mem_used_gb` series (host RAM used, not free) where host metrics exist. RAM charts plot **used** GB on Overview and Live. When thermal sensors are available, samples also include `thermal_package` and `thermal_ambient` (°C) for Live System dials. Live snapshots may include `jvm_gc` (pause % of wall), `heap_mb.pressure_pct`, `gc_pause_pct` series, and `jvm_health_live` (flags profile, verdict, advice, optional `recommended_flags`). Live may also include root-level `ram_envelope` (`envelope` = `ok|low|critical`, plus `host_mem_gb`, `xmx_gb`, `outside_headroom_gb`, `ram_source`) when host memory and `-Xmx` are known — Overview teasers use `critical` only. L1 rollup rows may include `heap_pressure_pct_avg`, `heap_pressure_pct_max`, `heap_used_gb_max`, `gc_pause_pct_avg`, and disk fields `disk_use_pct_avg`, `disk_free_gb_avg`, `disk_write_mb_s_avg`, `disk_write_await_ms_avg`. Live `disk_io` may include `write_await_ms` and `latency_source` (`diskstats` | `fsync_probe` | `unavailable`). Report facts expose `optional.jvm_health`, `optional.disk_projection`, and may raise issues `GC_PRESSURE` and `DISK_FILL_PROJECTED`. `GET /api/performance/dashboard` includes `ram_sizing` (heap window + host envelope fields: `envelope`, `host_mem_gb`, `outside_headroom_gb`, `ram_source`; verdict may be `envelope_tight`), `baseline_regression`, and `disk_projection` plus optional `disk_io_lag_align` insight.\n\n---\n\n## Performance rollups\n\n**L1 minute history** — `GET /api/performance/rollups?hours=24`\n\n| Endpoint | Method | Query | Purpose |\n|----------|--------|-------|---------|\n| `/api/performance/rollups` | GET | `hours=1`–`2160` (capped by L1 retention) | Summary + minute rows from `performance-rollups.json` |\n\nResponse shape:\n\n```json\n{\n  "enabled": true,\n  "hours": 24,\n  "summary": { "tps_avg": 18.4, "mspt_avg": 41.0, "low_tps_minutes": 3, "sample_minutes": 1440 },\n  "rows": [ { "ts": "…", "tps_avg": 19.2, "mspt_avg": 8.1, "entities_max": 4210, "chunks_max": 1180, "unattended_chunks_max": 800, "low_tps_flag": false } ]\n}\n```\n\nMinute rows may also include `entities_max`, `chunks_max`, and `unattended_chunks_max` when the world-pressure census has run (see [[World-Pressure]]). Ops-cache `world_pressure` (same `/api/ops-cache` payload) holds the latest census dimensions, quiet-hours baseline (classifier-only), MSPT correlation, and sustained classifiers. `GET /api/performance/dashboard` also includes `world_pressure_compare` (`busy` p95 + window `peak`) for the selected `7d`/`30d` Insights window.\n\nReads **L1 local JSON only** — not health-report facts. Also serves `/api/performance/insights`, CSV export, and the **Insights** tab dashboard.\n\n---\n\n## Performance insights (Insights tab)\n\n| Endpoint | Method | Query | Purpose |\n|----------|--------|-------|---------|\n| `/api/performance/insights` | GET | `window=7d\\|30d` | Busy/quiet hours, player bins, outlier minutes, sticky lag episodes, ranked insights (Overview poll) |\n| `/api/performance/dashboard` | GET | `window=7d\\|30d` | Full **Insights** tab payload: insights + `hour_of_week`, `daily_series`, `period_compare`, `correlations`, `related_events`, `scorecard_perf`, `ram_sizing`, `baseline_regression`, `disk_projection`, `world_pressure_compare` |\n| `/api/performance/baseline` | POST | `{ "action": "set_now" }` | Freeze a new performance baseline from recent L1 history; returns `baseline` + fresh `baseline_regression` |\n| `/api/performance/export` | GET | `window=7d`, `format=csv` | Download minute rollup rows as CSV |\n\n---\n\n## Spark profiles\n\n| Endpoint | Method | Query / body | Purpose |\n|----------|--------|--------------|---------|\n| `/api/spark/profiles` | GET | — | List `.sparkprofile` files on disk (newest first, capped). Includes `profiles`, `skipped`, `search_dirs`, report/auto-selected paths, and the `auto_capture` status envelope |\n| `/api/spark/profile` | GET | `path=` | Parse one profile on demand. Parsed results are cached by normalized path + mtime + size |\n| `/api/spark/tree` | GET | `path=`, optional `thread`, `window`, `source`, `search`, `min_share`, `max_nodes` | Return the bounded v2 call tree or a legacy flat-method fallback, with truncation metadata |\n| `/api/spark/compare` | GET | `baseline=`, `target=` | Deterministic normalized comparison. `compatible=false` explains sampler-mode or thread-scope mismatches |\n| `/api/spark/import` | POST | `{ "url": "https://spark.lucko.me/…" }` | Download a bytebin sampler into `watchtower/spark-upload/{key}.sparkprofile` (allowlisted hosts only) |\n| `/api/spark/upload` | POST | `name=` and raw `.sparkprofile` request body | Validate and save a local profile under the configured upload directory (64 MB maximum) |\n\nThe parsed profile keeps legacy summary aliases while adding `analysis_version: 2`, mode-aware units, source own/involvement shares, deterministic evidence, and bounded tree data. See [[Using-Spark-with-Watchtower]] for capture and interpretation rules.\n\n---\n\n## Reports & support\n\n| Endpoint | Method | Purpose |\n|----------|--------|---------|\n| `/api/reports/latest` | GET | Newest legacy facts + brief (excludes `-support-` artifacts) |\n| `/api/reports/index` | GET | Report history list |\n| `/api/reports/get` | GET | `?facts=<filename>` |\n| `/api/reports/status` | GET | Compose status (`running`, `zip_ready`, `zip_path`, `success`, `message`) |\n| `/api/reports/run` | POST | Alias for support compose (Quick preset unless body has `preset`) → 202 |\n| `/api/support/catalog` | GET | Builder catalog (logs, crashes, spark, stores, presets, budgets) |\n| `/api/support/compose` | POST | Start async support compose with builder options JSON → 202 / 409 |\n| `/api/support/bundle` | GET | Download ready support zip (`?path=` optional basename under `watchtower/`) |\n| `/api/modrinth/status` | GET | Dedicated Modrinth scan status (`enabled`, `running`, `stage`, `stage_label`, `stage_detail`, `progress`, `batch`, `eta_seconds`, `last_run`, `stats`, `success`, `error`) |\n| `/api/modrinth/scan` | POST | Start Modrinth scan → 202 started; 400 if lookup disabled; 409 if already running |\n\n### Facts `optional` — crash intelligence (1.0.13)\n\nReport JSON (`/api/reports/latest`, `/api/reports/get`) may include these blocks under `optional`:\n\n**`optional.crash_summaries[]`** — classified crash rows (also drives the Crashes tab):\n\n```json\n{\n  "file": "crash-2026-06-20_06.53.26-server.txt",\n  "failure_kind": "watchdog_pregen",\n  "primary_mod_id": "squaremap",\n  "stall_mod_id": "squaremap",\n  "watchdog_tick_ms": 60000,\n  "confidence": "high",\n  "fix_hints": [\n    "Pause Chunky pregen or reduce radius",\n    "Defer squaremap full render until pregen completes"\n  ],\n  "incident_id": null,\n  "paired_primary_file": null\n}\n```\n\nCanonical `failure_kind` values: `mod_runtime`, `mod_load_dependency`, `mod_load_script`, `mod_load_mixin`, `mod_load_mixin_conflict`, `mod_load_duplicate`, `mod_load_config`, `mod_load_asset`, `mod_load_worldgen`, `mod_load_compat`, `mod_load_ecosystem`, `platform_mismatch`, `env_lock`, `world_nbt_corrupt`, `watchdog`, `watchdog_followup`, `watchdog_pregen`, `host_resource`, `external_kill`, `loader`, `unknown`.\n\n`external_kill` rows may include `details.external_kill_subtype` of `oom` or `panel_watchdog` (no crash report on disk — synthetic Crashes entry).\n\n**`optional.startup_profile`** — last boot window (Startup tab / Overview boot card):\n\n```json\n{\n  "total_sec": 142.3,\n  "done_at": "2026-06-20T00:37:12Z",\n  "status": "warnings",\n  "phases": [\n    { "id": "registry", "label": "Registry freeze", "sec": 38.1 }\n  ],\n  "slowest": [{ "phase": "registry", "sec": 38.1 }],\n  "warnings": [{ "id": "loot_parse", "count": 538 }],\n  "errors": [{ "mod_id": "pride", "kind": "mod_corrupt", "blocking": false }],\n  "compare_to_last_boot": { "delta_sec": 12.4, "direction": "slower" }\n}\n```\n\n**`optional.fml_issues[]`** — ranked NeoForge `-- Mod loading issue --` blocks:\n\n```json\n[\n  {\n    "rank": 1,\n    "mod_id": "examplemod",\n    "kind": "mod_load_dependency",\n    "message": "Missing dependency: cloth_config",\n    "file": "examplemod-1.0.jar"\n  }\n]\n```\n\n---\n\n## Activity, crashes, mods\n\n| Endpoint | Method | Purpose |\n|----------|--------|---------|\n| `/api/activity` | GET | `?hours=` — timeline events (ops-cache ledger merged with report events when fresher) plus `incident_stories[]` when correlated |\n| `/api/activity/scan` | POST | Incremental log tail → update `ops-cache.json` activity ledger (also rebuilds incident stories) |\n| `/api/issues/peek` | GET | Live lag + mod issues from ops cache (`lag_issues[]`, `mod_issues[]`); optional `log_stale` when live stale |\n| `/api/issues/acks` | GET | Acknowledged Issues-tab keys (`acknowledged_issues`) |\n| `/api/issues/ack` | POST | `{ id, reviewed?: true }` — mark/unmark an issue reviewed (`issue:…`, `lag:…`, `mod:…`, `backup:…`, `modrinth:…`, `log_stale`) |\n| `/api/issues/acknowledge-all` | POST | `{ ids: string[] }` — bulk mark reviewed |\n| `/api/issues/suppressions` | GET | Conf ∪ state issue suppressions |\n| `/api/issues/suppress` | POST | `{ issue_id }` — hide from Issues Active (persisted in state) |\n| `/api/issues/unsuppress` | POST | `{ issue_id }` — restore |\n| `/api/rules` | GET | Loaded crash rule packs + rule ids + priorities |\n| `/api/rules/get` | GET | `?id=` rule id or `packId/ruleId` (sanitized detail) |\n| `/api/rules/validate` | POST | Body YAML or `{ yaml }` → `{ valid, errors[] }` |\n| `/api/mods/scan` | POST | Force unified log scan + running mods → updates ops-cache; returns `{ scanned_at, mod_error_count, running_mod_count, mod_log_errors[], running_mods[], kubejs_failures[] }` |\n| `/api/mods/disable` | POST | Soft-disable top-level jar under `mods/` — `{ jar, confirm_world_risk? }` → rename to `*.jar.disabled` (admin+; `MOD_DISABLE_ENABLED`; 400 `world_risk_confirm_required` when high risk and confirm missing) |\n| `/api/mods/enable` | POST | Re-enable — `{ jar }` basename of `*.jar.disabled` (or `*.disabled`) → rename back to `*.jar` |\n| `/api/mods/configs` | GET | List files under `config/` (`files[]`: `path`, `size`, `mtime`, `has_backup`, `secret_hint`). With `?path=` — read one file (`content`, `mtime`, `parse_warnings[]`, `editor`: `form`\\|`raw`, and `fields[]` when `editor=form`). Requires `MOD_CONFIG_EDIT_ENABLED` (default true); otherwise 403 |\n| `/api/mods/configs` | PUT | Save — `{ path, expected_mtime, content? }` or `{ path, expected_mtime, fields? }` → backup then write (admin+). Prefer `fields` for TOML form saves (server serializes). `409` on mtime conflict; max 512 KiB. Audit `config_saved` (path only) |\n| `/api/mods/configs/undo` | POST | `{ path }` — restore newest backup (admin+). Audit `config_undone` |\n| `/api/mods/tree` | GET | `?mod_id=` — nested dependency tree from latest report (`dependents` + `dependencies`, max depth 6) |\n| `/api/mods/forensics/status` | GET | Mod forensics index/status (`index.state`: `ready`\\|`idle`\\|`skipped`\\|`error`; `config.mod_forensics_scan` / `corrupt_jar_walk`; stale cache reported without jar walk) |\n| `/api/mods/forensics/find-class` | POST | `{ class, include_nested? }` → owning jar matches (rate limit 10/min); builds cache on demand |\n| `/api/mods/forensics/find-package` | POST | `{ package, mode?: prefix\\|exact_package }` → package ownership matches |\n| `/api/mods/forensics/scan-corrupt` | POST | Top-level zip walk when `FORENSICS_CORRUPT_JAR_WALK=true` |\n| `/api/mods/forensics/config-health` | GET | Last L3 `config_health[]` (or live scan fallback) |\n| `/api/incidents` | GET | List auto + manual lag incident summaries |\n| `/api/incidents/get` | GET | `?id=` — full incident JSON |\n| `/api/incidents/pin` | POST | `{ note? }` — manual lag pin (same as `/watchtower pin`) |\n| `/api/crashes` | GET | Fingerprint-grouped crashes (`groups[]`, `count`, `unreviewed`, `unreviewed_groups`, `scanned_at?`) |\n| `/api/crashes/acks` | GET | Acknowledged crash files |\n| `/api/crashes/ack` | POST | Mark crash reviewed |\n| `/api/crashes/acknowledge-all` | POST | `{ scope?: "unreviewed", fingerprint? }` — bulk mark reviewed |\n| `/api/crashes/scan` | POST | Scan `crash-reports/` → update `ops-cache.json`; returns `{ scanned_at, new_count, unreviewed, crashes[] }` |\n| `/api/crashes/context` | GET | `?file=&minutes=` — pre-crash TPS/log context |\n| `/api/crashes/report` | GET | `?file=` — raw crash report text (`{ file, content, truncated, size }`) |\n| `/api/inbox` | GET | Notification inbox items (`crash_group`, `update_check`) |\n| `/api/inbox/dismiss` | POST | `{ id }` — dismiss inbox item → `state.json` |\n| `/api/logs/list` | GET | List `logs/latest.log`, `debug.log`, and `*.log.gz` (`{ files:[{ name, size, mtime, gz }] }`) |\n| `/api/logs/index` | GET | Alias of `/api/logs/list` (older dashboard builds) |\n| `/api/logs/content` | GET | `?file=&tail=` — tail of a log file (plain or gzip); returns `{ file, content, truncated, size, lines }` |\n| `/api/ops-cache` | GET | L2.5 ops cache (`crashes`, `scorecard`, `activity`, `lag_issues`, `incident_stories`, `mod_log_errors`, `running_mods`, `mod_issues`, `silent_fails`, `join_clinic`, `world_pressure`, `right_now`, `log_stale`, `backups_live`, `issues_live[]` continuous issue ledger, `startup_profile`, `mods_light`, `player_directory`, reconcile timestamps) |\n| `/api/client-mods/ignores` | GET | Ignored client-only mods |\n| `/api/client-mods/ignore` | POST | Ignore/unignore client mod |\n\n---\n\n## Backups & filesystem\n\n| Endpoint | Method | Purpose |\n|----------|--------|---------|\n| `/api/backups/scan` | POST | Rescan backup inventory; persists `backups_live` in ops-cache |\n| `/api/backups/verify` | POST | Light integrity verify — `{ path }` under configured backup dirs; updates inventory `verify` (admin+) |\n| `/api/backups/test-restore` | POST | Start async extract under `watchtower/restore-verify/<id>/` — `{ path }` (`BACKUP_TEST_RESTORE_ENABLED`) |\n| `/api/backups/test-restore/status` | GET | Current test-restore job |\n| `/api/backups/test-restore/cleanup` | POST | Delete sandbox — `{ id? }` |\n| `/api/backups/dirs` | POST | `{ dirs: ["path"] }` — save paths + scan + `backups_live` |\n| `/api/backups/heartbeat` | POST | External backup webhook — requires `BACKUP_WEBHOOK_TOKEN`; Bearer or `X-Watchtower-Backup-Token` |\n| `/api/backups/external` | POST | External backup setup — session auth; `{ trackingEnabled?, trackingMode?, generateWebhookToken?, backupExternalMarker?, backupSuppressLocalMissing? }`. `trackingEnabled: false` writes `BACKUP_TRACKING_ENABLED=false`, clears external signals, and silences backup Issues/alerts (dirs kept). |\n| `/api/backups/external/test` | POST | Test panel backup signal from dashboard — **Settings → Backups: Test it worked**; session auth; updates `backup_external` ops-cache |\n| `/api/fs/roots` | GET | Browse roots for folder picker |\n| `/api/fs/list` | GET | `?path=` — directory listing |\n\n**Ops scans:**\n\n- **Always-on** — `OPS_LOG_SCAN_SEC` runs unified log tail, running mod list, log-stale check, and crash folder mtime scan\n- **Performance insights** — `GET /api/performance/insights`, `GET /api/performance/dashboard`, and CSV export read minute rollups\n- **External backup poll** — reads `backup-heartbeat.json` / webhook → `backup_external` ops-cache\n- **Backup slow poll** — `BACKUP_POLL_MIN` rescans backup folders → `backups_live`\n- **Session-gated (optional)** — `OPS_POLL_SEC` runs extra crash folder refreshes while ≥1 dashboard session is open\n\n`GET /api/overview/meta` adds `mod_tldr`, `right_now`, `performance_insights_tldr`, `baseline_regression_tldr` (when active; also prefers into `performance_insights_tldr`), `safe_restart`, `restart_hygiene`, `log_stale_tldr`, `mods_changed_tldr`, `disk_jump_tldr`, `disk_projection` / `disk_projection_tldr`, `backup_mode`, `backup_external_tldr`, `backup_poll_active`, `backups_scanned_at`, and related ops fields.\n\n### `restart_hygiene` (1.1.6)\n\nAdvisory payload on overview meta. Never mutates the server.\n\nWhen suppressed:\n\n```json\n{ "active": false, "suppressed_reason": "disabled|low_uptime|healthy_metrics|insufficient_metrics", "checked_at": "2026-07-28T19:00:00Z" }\n```\n\nWhen active:\n\n```json\n{\n  "active": true,\n  "severity": "info",\n  "headline": "Consider a maintenance restart",\n  "uptime_sec": 136800,\n  "signals": [\n    { "id": "gc_rising", "current": 4.2, "prior": 2.8, "delta_pct": 50.0 },\n    { "id": "heap_stable", "current": 71.0 }\n  ],\n  "quiet_window": {\n    "next_start_at": "2026-07-29T03:00:00Z",\n    "next_end_at": "2026-07-29T05:00:00Z",\n    "avg_players": 0.2,\n    "avg_mspt": 24.0,\n    "sample_minutes": 42\n  },\n  "checked_at": "2026-07-28T19:00:00Z"\n}\n```\n\n`quiet_window.next_start_at` / `next_end_at` are UTC ISO-8601 instants (no local-time formatting from the API). Dashboard Settings timezone preference converts them for display. Kill-switch: `RESTART_HYGIENE_ENABLED`.\n\n---\n\n## Security headers\n\nResponses include `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and Content-Security-Policy restricting scripts to same origin.\n\n### Common auth error codes\n\n| HTTP | `error` code | Meaning |\n|------|--------------|---------|\n| 403 | `read_only_account` | Viewer tried a write |\n| 403 | `owner_required` | Non-owner hit an `/api/accounts*` route |\n| 503 | `auth_unavailable` | Auth store did not initialize — use `/watchtower dashboard reset-password` |\n\n---\n\n## See also\n\n- [[Dashboard Overview]]\n- [[Security and Access]]\n- [[Accounts And Audit Log]]\n- [[Live Charts]]\n- [[Using-Spark-with-Watchtower]]\n'},Insights:{slug:"Insights",title:"Insights",markdown:`# Insights

**Insights** shows patterns over a window — config health, mod churn, storage trends, and the weekly ops digest — not the live second.

---

## When to open it

- You want busy/quiet hours or recurring lag patterns
- Disk runway / RAM sizing questions
- After Overview’s performance, storage, or weekly-digest teaser
- You want a one-screen “how was this week?” summary

Use [[Live-Charts]] for right-now TPS and tick lag.

---

## What you’ll see

| Nav | Job |
|-----|-----|
| **Overview** (patterns) | Window summary |
| **Digest** | Weekly ops rollup — grade, crashes, disk, MSPT trend, mod changes, one next action |
| **Schedule** | Busy/quiet timing in your selected dashboard timezone |
| **Load** | Load patterns |
| **Incidents** | Recurring incident shape |
| **Configs** | Config / JVM health notes |
| **Mod changes** | Pack churn over the window |
| **World** | Live entity/chunk pressure vs busy-hours p95 and window peak; quiet hours still drive Issues |
| **Storage** | Disk projection, dimension breakdown, and space map (treemap) |

### Schedule & quiet windows

Heatmaps and busy/quiet cards use canonical UTC \`hour_of_week\` cells from the API, then convert to the timezone chosen under Settings → Timezone (browser-local \`wt-timezone\`). Changing the picker updates Schedule labels without reloading the page.

Overview **Restart hygiene** (when active) links here for evidence of the next quiet window. Watchtower only suggests a window — it does not schedule or run a restart; your panel or \`/stop\` still controls that.

### World pressure comparisons

Insights → **World** charts compare **live now** against **busy-hours p95** and the **peak minute** in the selected **7d / 30d** window (same toggle as Schedule). Those baselines come from \`world_pressure_compare\` on the performance dashboard payload. Quiet-hour baselines remain classifier-only for Issue detection — see [[World-Pressure]].

### Configs / RAM sizing

Insights → **Configs** includes a **RAM sizing** card. WatchTower compares **host/container memory** (cgroup when available) to **\`-Xmx\`**, then heap history over the window. If the heap leaves too little room outside Java, advice is to **lower \`-Xmx\` or raise the plan** — not “add more RAM on this box” (that path invites an external OOM kill). Heap peak/pressure advice still applies when the host has room.

### Weekly ops digest

Built from data Watchtower already has (no outbound mail or webhooks). Auto-refreshes about every \`WEEKLY_DIGEST_INTERVAL_DAYS\` days (default **7**). Use **Generate now** on the Digest panel when you want a fresh card. Prior weeks stay in a short history (default **8**). Kill-switch and caps: [[Configuration#Weekly ops digest]]. Overview shows a dismissible teaser when a digest exists.

### Patterns vs right now

| Insights | Live |
|----------|------|
| Last days/weeks of behavior | Last minutes/hours of vitals |
| DISK_FILL / RAM sizing in plain language | Instant heap and TPS |

---

## What to do next

1. Pick the window that matches your question
2. Follow storage runway into host disk planning
3. Open [[Configuration]] if Configs flags restart-needed keys
4. Return to [[Issues]] if a pattern becomes an active problem

---

## Related

- [[Live-Charts]]
- [[Dashboard-Overview]]
- [[Configuration]]
- [[Activity]]
`},Installation:{slug:"Installation",title:"Installation",markdown:`# Installation

Install Watchtower on a **Linux** server running **NeoForge** for Minecraft **1.21.x**.

**NeoForge** is the mod loader for your Minecraft server (the folder that already has \`mods/\`).

---

## At a glance

- **Download:** current NeoForge jar from [[Downloads-and-Releases]] (GitHub Releases or Modrinth)
- **Where it goes:** server **\`mods/\`** folder
- **Recovery tool (optional):** matching \`watchtower-cli-*.jar\` in the same folder
- **After start:** a **\`watchtower/\`** folder appears on the server
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

1. Download the current **\`watchtower-neoforge-*+mc1.21.jar\`** from [[Downloads-and-Releases]]
2. Copy it into your server's **\`mods/\`** folder
3. Start (or restart) the server
4. Confirm Watchtower messages in the console and a **\`watchtower/\`** folder
5. Open **\`http://<your-server-ip>:8787\`** and sign in — [[Dashboard-Overview]]

### You're done when

- [ ] Mod jar is in \`mods/\`
- [ ] Server started without Watchtower load errors
- [ ] \`watchtower/\` exists
- [ ] Dashboard sign-in page loads

---

## What gets created

On first start, Watchtower creates **\`watchtower/\`** with settings, history, and related files. You do not create this yourself. See [[On-disk-Files]].

---

## Privacy (optional Modrinth lookup)

By default Watchtower stays local — dashboard and day-to-day Scanning do not need Modrinth.

If you enable **Modrinth lookup** (Welcome options or **Settings → Monitoring**):

- Watchtower may send **SHA-512 hashes of jar files** to \`api.modrinth.com\` (capped; cached)
- No world, logs, or player data are sent
- Watchtower **never downloads jars** into \`mods/\`
- Leave it off for zero Modrinth network traffic

More detail: [[Mods]].

---

## Related

- [[Quick-Start-Checklist]]
- [[Security-and-Access]]
- [[Downloads-and-Releases]]
- [[Crash-Rule-Packs]]
- [[Dashboard-Overview]]`},Issues:{slug:"Issues",title:"Issues",markdown:`# Issues

**Issues** is your fix inbox — live peeks, scanning ledger, boot findings, and crash pointers in one place.

---

## When to open it

- Daily check after Overview
- Something feels wrong but you are not sure where to start
- Boot or lag cards appeared in Overview’s attention queue

---

## What you’ll see

| View | Job |
|------|-----|
| **Active** | Open problems to work |
| **Reviewed** | Items you already handled |
| **Tools** | Filters and inbox utilities |

On a card, open **Fix** for recommended next steps or **Details** for evidence. Boot-related filters help when Startup flagged config or launch problems.

Active groups by severity only (**Critical** → **Warning** → **Info**). Pack-trust findings still appear in those bands by their severity:

| Finding | Typical severity | Meaning |
|---------|------------------|---------|
| **Jar drift** | Warning | Same jar filename + version, different checksum since last baseline — verify the file swap was intentional ([[Mods]] → Changes) |
| **Client-only jars** | Info | High-confidence likely-removable client mods on this dedicated server ([[Mods]] → Overview, Client filter) |
| **Script & datapack failures** | Warning | KubeJS / CraftTweaker / datapack JSON / \`/reload\` silent fails from the live log — see [[Script-Failed-Silently]] |
| **World pressure** | Warning | Sustained item storms, mob spikes, and chunk write / pregen disk pressure — see [[World-Pressure]] |
| **Join clinic** | Warning / Info | Pack sync join rejections (\`JOIN_SYNC\`) — see [[Join-Clinic]] |
| **Server tick frozen** | Critical | Process up but ticks stalled (\`SOFT_HANG\`) - optional dump under \`watchtower/hangs/\` when \`SOFT_HANG_THREAD_DUMP=true\` |

Kill-switches: \`MOD_JAR_DRIFT_ENABLED\`, \`CLIENT_ON_SERVER_ISSUES_ENABLED\`, \`SILENT_FAIL_DETECT_ENABLED\`, \`WORLD_PRESSURE_ENABLED\`, \`CHUNK_WRITE_PRESSURE_ENABLED\`, \`JOIN_CLINIC_ENABLED\`, \`SOFT_HANG_ENABLED\` in \`watchtower.conf\` — see [[Configuration]].


If the server process is up but ticks stop, WatchTower raises **Server tick frozen** (\`SOFT_HANG\`) with phase and how long it has been stuck. Optional hang dumps land under \`watchtower/hangs/\` when \`SOFT_HANG_THREAD_DUMP=true\`. When a hang dump is available, WatchTower also shows a likely cause category and may hint at a suspect mod — treat that as a lead, not proof. WatchTower never restarts the server for you.
---

## What to do next

1. Sort by severity — tackle Active top cards first
2. Follow **Fix** links into [[Crashes]], [[Mods]], [[Live-Charts]], or [[Sources]] as needed
3. Mark reviewed when done so the inbox stays honest

Dismissing / reviewing does **not** delete underlying crash files or mod jars — it only clears your inbox state.

---

## Healthy vs problem

| Healthy | Problem |
|---------|---------|
| Active empty or only low-noise items | Repeated high-severity lag, crash, disk, or backup cards |
| Fresh Scanning on [[Sources]] | Stale Sources while Issues look empty |

Issues is not a replacement for deep crash work ([[Crashes]]) or mod forensics ([[Mods]]).

---

## Related

- [[Crashes]]
- [[Mods]]
- [[Sources]]
- [[Script-Failed-Silently]]
- [[Troubleshooting]]
- [[Dashboard-Overview]]
- [[Startup]]
`},"Join-Clinic":{slug:"Join-Clinic",title:"Join clinic",markdown:`# Join clinic

**A friend can't join** and the admin spends Friday night diffing \`mods/\` folders by hand. Join clinic watches \`latest.log\` for Forge/NeoForge/Fabric pack-sync rejections, names the mods involved, and gives you a player-safe Copy fix list.

Watchtower **never** changes \`mods/\` or the world for you — advice and copy only.

---

## What it detects

On the usual ops log scan (same cadence as activity / silent fails), Watchtower looks for disconnect lines whose reason is pack-related:

| Kind | Typical log language |
|------|----------------------|
| **mismatched_channel** | Incompatible mod set / mismatched channels |
| **missing_mod** | Mod rejection / missing required mods |
| **wrong_version** | Mod mismatch with required vs client version |
| **registry** | Registry incompatibility |
| **unknown_pack** | Other pack/network mismatch wording |

Ordinary timeouts, kicks, whitelist denials, and auth failures are ignored.

Named mod ids come from channel/registry namespaces and rejection lists on the **server log only** (no client-log paste). Confidence is \`high\` when mod ids were captured, otherwise \`medium\`/\`low\`.

---

## Diff labels

Each rejection is compared to the server's running mods (or jar inventory):

| Label | Meaning |
|-------|---------|
| **missing** | Log named a mod the server has — client likely lacks it |
| **wrong_version** | Log named both required and client versions for a mod |
| **extra** | Log named a mod the server does not have |
| **suppressed_client_only** | Would be “extra”, but already scored \`likely_removable\` / \`client_library\` — not shown as a false positive |

If jar drift is present on the inventory baseline, the entry may set **vs known-good** so Copy fix mentions pack drift.

---

## Where you see it

- **Session → Session activity** — failed joins appear in the right-column feed with joins and leaves; expand a failed row for named mod chips and **Copy fix**
- **Issues** — open \`JOIN_SYNC:…\` rows; primary action **Open Session activity**
- **Overview** — attention queue picks up open Issues automatically

Issue ids look like \`JOIN_SYNC:mismatched_channel|PlayerName|create,flywheel\`.

---

## What to do

1. Open **Session → Session activity** (or the Issue’s **Open Session activity** action).
2. Expand the failed join, hit **Copy fix**, and paste to the player (IPs/tokens are redacted).
3. Have them install/update the listed mods (or remove extras), then retry join.
4. If the pack drifted on the server, confirm the jar baseline before blaming the client.

---

## Kill-switch

| Key | Default | Effect |
|-----|---------|--------|
| \`JOIN_CLINIC_ENABLED\` | \`true\` | When false, join rejections are not raised as Issues (scanner/analyzer still follow ops-cache merge when enabled paths run — Issues evaluator respects the flag) |

See [[Configuration]].

---

## Related

- [[Session]] — roster + Session activity plate
- [[Issues]] — \`JOIN_SYNC\` findings
- [[Mods]] — jar inventory / drift
- [[HTTP-API]] — \`ops-cache.join_clinic\`
- [[Script Failed Silently]] — similar log → Issue pipeline
`},"Live-Charts":{slug:"Live-Charts",title:"Live Charts",markdown:`# Live Charts

The **Live** tab is the ops console for tick health, host load, and right-now signals. **Overview** shares a shorter vitals window.

---

## At a glance

- **Live windows:** **5m → 30d** (within saved history)
- **Overview:** **1h / 6h / 24h** for main vitals
- **Sections on Live:** Game vitals · Host & storage · Network · Thermal · World background jobs
- **Hover** (or drag on touch) for exact time and value

---

## Where charts appear

| Location | What you see |
|----------|----------------|
| **Overview** | TPS, CPU, memory, players — shared 1h / 6h / 24h |
| **Live** | TPS, tick lag, memory, players, CPU, disk, network, thermal, world jobs |
| **Crashes** | Small TPS chart for minutes before a crash |

Long-term patterns (busy hours, heatmaps) live on [[Insights]] — not Live.

---

## Chart controls

| Control | Meaning |
|---------|---------|
| **Time range** | How far back the line goes (5m … 30d on Live) |
| **Display refresh (Poll)** | How often the latest number updates (separate from stored history) |
| **Pin lag** | Keep lag focused while you work |

Longer ranges may refresh less often to keep the page smooth.

---

## Reading the lines

- **Green / yellow / red** on the header readout — latest TPS, lag, CPU health
- **Dashed guides** — e.g. 20 TPS target, 50 ms lag budget
- Empty after an update? Hard-refresh (\`Ctrl+Shift+R\`)

---

## Hosted servers and memory

On some hosts, “free RAM” is misleading in containers. Watchtower charts show **memory in use** where possible and labels Java heap separately. See [[Reading-Metrics-on-Hosted-Servers]].

---

## GC health (Java heap vs garbage collection)

Under Java Heap on Live:

| KPI | Meaning |
| --- | ------- |
| **GC pause % of wall** | Share of real time in GC pauses (not “% of a Minecraft tick”) |
| **Heap pressure** | Heap used ÷ max |
| **Flags** | Detected JVM profile |
| **Java** | Running major version |

**How to read it**

- Heap full, GC calm → often need more \`-Xmx\` (or a leak)
- GC pause % high, heap not full → fix flags / Java before buying RAM
- Heap and GC fine but tick lag high → mod/tick work; more RAM will not fix it

**Copy recommended flags** lives on [[Insights]] → Configs. Confirm with \`/spark gc\` on the server when needed.

---

## Technical details

| Setting | File | Effect |
|---------|------|--------|
| \`liveSampleIntervalSeconds\` | \`watchtower-server.toml\` | How often metrics are recorded |
| \`liveRetentionHours\` | \`watchtower-server.toml\` | Max history kept |

Restart required for TOML changes. See [[Configuration]].

---

## Related

- [[Insights]]
- [[Dashboard-Overview]]
- [[Using-Spark-with-Watchtower]]
- [[Reading-Metrics-on-Hosted-Servers]]
- [[Troubleshooting]]
`},Logs:{slug:"Logs",title:"Logs",markdown:`# Logs

**Logs** browses server log files with severity filters and search — raw lines, not crash summaries.

---

## When to open it

- Fix / Evidence asked for a raw file
- You need to search spam or a specific exception
- Crash groups are not enough context

Use [[Crashes]] for fingerprinted crash groups and Fix steps.

---

## Logs vs Crashes

| Logs | Crashes |
|------|---------|
| File list + filtered viewer | Fingerprint groups |
| Tail / search / severity | Fix / Evidence / Details |
| Any log noise | Crash-shaped incidents |

---

## What you’ll see

- Sidebar of available log files
- Severity filters and search
- Tail-style viewing of recent lines

---

## What to do next

1. Pick the file Fix named (often \`latest.log\` or a crash-adjacent log)
2. Filter to ERROR/WARN before reading everything
3. Jump back to [[Crashes]] or [[Issues]] with what you found

---

## Related

- [[Crashes]]
- [[Troubleshooting]]
- [[Mods]]
`},Mods:{slug:"Mods",title:"Mods",markdown:`# Mods

**Mods** is inventory, updates, conflicts, Modrinth metadata, and forensic diagnostics for your pack.

---

## When to open it

- After a crash or Issues card names a mod
- Checking for updates or known conflicts
- Investigating jar problems (forensics — not day-to-day)

---

## What you’ll see

| View | One-line job |
|------|----------------|
| **Overview** | Pack inventory and status |
| **Updates** | Newer versions Watchtower knows about |
| **Conflicts** | Version / dependency clashes |
| **Log errors** | Mod-related errors from Scanning |
| **Changes** | What changed in the pack recently |
| **Configs** | Form edit for clean \`.toml\` under \`config/\` (raw fallback; backup + undo) |
| **Modrinth** | Online metadata (optional; privacy below) |
| **Forensics** | Deep jar / package ownership — use when debugging, not daily |

Client vs server chips tell you where a mod is expected to run. High-confidence **likely removable** client jars also appear on [[Issues]] under **Client-only jars**.

**Disable / Enable** (admin/owner): soft-rename a top-level jar under \`mods/\` to \`name.jar.disabled\` (Modrinth-style) or back. Disabled jars stay in the catalog with a **Disabled** badge — filter **All / Enabled / Disabled**. Nested jar-in-jar cannot be disabled this way. No Delete from the dashboard.

**World risk** badges appear when WatchTower finds evidence that disabling the mod may break the save (world dimension folders for that mod id, live dimension namespaces, or jar \`data/<modId>/dimension/\` paths). High risk requires an extra confirm. Overview shows a **Restart needed** chip until the server restarts after a jar change.

**Configs** (admin/owner to save): open a file under \`config/\`. Clean \`.toml\` files open as a **form** (sections, toggles, numbers, strings) with a **Form | Raw** toggle; other formats and unparseable TOML stay raw-only. Review a simple diff, then save. Form saves only change setting values in place — comments, blank lines, and layout stay as they were. WatchTower writes a timestamped backup under \`watchtower/config-backups/\` first and keeps the last 10 per file. **Undo** restores the newest backup. Viewers can read but not save. Kill-switch: \`MOD_CONFIG_EDIT_ENABLED=false\` hides the API. Does not edit \`server.properties\`, \`world/serverconfig/\`, or jars. After a save, restart if the mod only reloads config on boot. Paths from Forensics → Config health that start with \`config/\` deep-link here.

**Changes** shows pack add/remove/update. If a jar’s contents change **without** a version bump, Watchtower raises **Jar drift** on [[Issues]] (checksum lock) — confirm the swap was intentional.

---

## Modrinth privacy

Modrinth lookup is **optional**. When enabled (Welcome options or Settings), Watchtower may query Modrinth for project metadata. It does not upload your world or player data. Turn it off if your policy forbids outbound lookups.

---

## What to do next

1. Start on **Overview** / **Conflicts** for day-to-day
2. Use **Updates** when planning a pack bump
3. Open **Forensics** only when Fix/Crashes asks for package ownership
4. Cross-check lag suspects with Spark → **Sources** (profile share — not Ops [[Sources]])

---

## Healthy vs problem

| Healthy | Problem |
|---------|---------|
| Conflicts quiet, inventory matches disk | Unresolved conflicts after every boot |
| Modrinth disabled or fresh | Forensics error state — see Tools / status |

---

## Related

- [[Issues]]
- [[Crashes]]
- [[Installation]] — privacy on first setup
- [[Using-Spark-with-Watchtower]]
- [[Configuration]]
`},"On-disk-Files":{slug:"On-disk-Files",title:"On-disk Files",markdown:`# On-disk Files

**Where Watchtower saves things** on your server. Most files live in \`<server>/watchtower/\`. You rarely need to edit them by hand — use the dashboard and Settings instead.

---

## Quick reference

| Path | In plain English |
|------|------------------|
| \`watchtower/watchtower.conf\` | Backups, warnings, optional legacy schedule — most keys via **Settings**; schedule via conf or \`/watchtower schedule\` |
| \`config/watchtower/rules/*.yaml\` | Optional crash rule packs — [[Crash-Rule-Packs]] |
| \`config/watchtower-server.toml\` | Dashboard port, chart speed — needs restart |
| \`watchtower/watchtower-facts-*.json\` | Health report data for the dashboard |
| \`watchtower/watchtower-brief-*.txt\` | Human-readable report summary |
| \`watchtower/live-history.json\` | Live chart history (seconds) |
| \`watchtower/performance-rollups.json\` | Minute-by-minute history for **Insights** |
| \`watchtower/dashboard-auth.json\` | Named accounts (schema 2, hashed) — **Settings → Security** / **Accounts** |
| \`watchtower/audit-log.jsonl\` | Settings / ack / account / sign-in / mod disable ledger — **Settings → Audit log** |
| \`mods/*.jar.disabled\` | Soft-disabled jars (WatchTower **Mods → Disable**; loader ignores until Enable + restart) |
| \`watchtower/restore-verify/\` | Test-restore sandboxes only (1.1.20); never the live world |
| \`watchtower/DR-README.txt\` | Emergency recovery command — updated each report |

---

## \`watchtower/\` folder layout

\`\`\`text
watchtower/
  dashboard-auth.json       # Schema 2 accounts + 2FA (do not edit by hand)
  audit-log.jsonl           # Append-only audit ledger (2000 / 90 days)
  watchtower.conf           # Settings file
  snapshot.json             # Quick TPS/lag snapshot
  live-history.json         # Live chart data
  performance-rollups.json  # Insights history
  watchtower-brief-*.txt    # Report summaries
  watchtower-facts-*.json   # Report data for dashboard
  ops-cache.json            # Background scan cache (incl. weekly_digest history, external_kill verdict)
  DR-README.txt             # Recovery instructions
  .watchtower-state.json    # Internal state (acks, cursors)
\`\`\`

---

## What not to delete casually

| File | If deleted |
|------|------------|
| \`dashboard-auth.json\` | Default owner login recreated on next start |
| \`audit-log.jsonl\` | Audit history starts empty |
| \`.watchtower-state.json\` | Loses crash review marks, incremental progress |
| \`live-history.json\` | Live charts start empty (rebuild over time) |
| \`watchtower-facts-*.json\` | That report disappears from dashboard history |

---

## Technical details

### \`dashboard-auth.json\`

Schema 2: \`accounts[]\` with per-person username, role (\`owner\` / \`admin\` / \`viewer\`), PBKDF2 password hash, optional encrypted TOTP secret, recovery codes. Top-level fields still mirror the owner so a rolled-back pre-1.1.18 jar can sign that person in. First upgrade also writes \`dashboard-auth.json.pre-1.1.18.bak\` once. See [[Accounts-And-Audit-Log]].

### \`audit-log.jsonl\`

Append-only JSON lines for settings changes, acknowledgements, suppressions, account management, and auth events. Pruned to newest 2000 entries and 90 days on append. Not included in support packs.

### \`snapshot.json\`

Lightweight TPS/MSPT snapshot every ~60s (\`sampleIntervalSeconds\` in TOML).

### \`live-history.json\`

One sample per second with tiered retention; flushed per \`liveFlushIntervalSeconds\`.

### \`.watchtower-state.json\`

Last report time for incremental scans, acknowledged crashes, ignored client mods, trend samples for \`/watchtower status\`.

### \`config/watchtower-server.toml\`

NeoForge mod config — restart required. See [[Configuration]].

---

## See also

- [[Configuration]]
- [[Health Reports]]
- [[Security and Access]]
- [[Accounts And Audit Log]]
`},"Quick-Start-Checklist":{slug:"Quick-Start-Checklist",title:"Quick Start Checklist",markdown:`# Quick Start Checklist

Work through these steps **in order** after Watchtower is installed and the server has started once.

---

## At a glance

- **Time:** about 10–15 minutes for a solid setup
- **Goal:** Watching/Scanning healthy, backup location known, password changed
- **Before you start:** [[Installation]] done

---

## Checklist

- [ ] **1. Confirm Watchtower started** — Watchtower lines in the console and a \`watchtower/\` folder on the server

- [ ] **2. Open the dashboard** — \`http://<your-server-ip>:8787\` in your browser

- [ ] **3. Sign in and change username/password** — default \`watchtower\` / \`password\` → set a new account before continuing

- [ ] **4. Complete Welcome (optional but recommended)** — opens on first visit; skippable anytime
  - Skim live vitals, crash intelligence, attention queue, backups & Spark
  - Reopen anytime from the **Help Center** hub, or open \`?tab=wizard\` on the dashboard URL

- [ ] **5. Check Sources** — open **Sources** and confirm **Watching** and **Scanning** look fresh (or Waiting on the first tick). See [[Sources]] and [[Understanding-Data-Sources]]

- [ ] **6. Set up backups** — **Backups** tab: pick a folder on this server, a panel webhook, or leave **Not tracking** on purpose

- [ ] **7. Optional: two-factor login (2FA)** — **Settings → Security** if people outside your home network can reach the dashboard

- [ ] **8. On a public host** — see [[Security-and-Access]] (often localhost + tunnel instead of opening port 8787 to the internet)

- [ ] **9. Need a support zip?** — rail **Build support pack**, Overview **Support pack** card, or Help Center hub **Build pack**. **Coming soon:** downloadable zip may still be finishing — the flow still explains what goes in the pack. Details: [[Health-Reports]]

---

## After setup

| I want to… | Go to |
|------------|-------|
| Understand each dashboard tab | [[Dashboard-Tabs]] |
| Use Overview as mission control | [[Dashboard-Overview]] |
| Tune live charts | [[Live-Charts]] |
| Share a snapshot with support | Rail **Build support pack** · [[Health-Reports]] |
| Fix a problem | [[Troubleshooting]] |

---

## Related

- [[Installation]]
- [[Sources]]
- [[Security-and-Access]]
- [[Backups]]
`},"Reading-Metrics-on-Hosted-Servers":{slug:"Reading-Metrics-on-Hosted-Servers",title:"Reading Metrics on Hosted Servers",markdown:`# Reading Metrics on Hosted Servers

On **bloom.host**, **Pterodactyl**, **Crafty**, and similar hosts, Minecraft often runs **inside a container**. Some numbers are from **inside the game**; others are from the **host machine**. Without labels, it is easy to misread memory — especially when setting **\`-Xmx\`**.

Watchtower labels metrics so you know what to trust. **Charts show memory in use**, not misleading “free GB” on panels.

---

## Always trustworthy

| Metric | Why |
|--------|-----|
| **TPS** | Measured from the game |
| **Tick lag (MSPT)** | Measured from the game |
| **Players online** | From the player list |
| **Java heap** | Memory inside your Minecraft process (\`-Xmx\`) |
| **Entities / chunks** | From the running server |

---

## Easy to misread on containers

| Metric | Common mistake | What Watchtower does |
|--------|----------------|----------------------|
| **Host RAM** | Looks like you have tons of free RAM | Shows **Java heap** on Overview; **used/total** on Live |
| **Host CPU %** | Hard to compare without core count | Shows quota when known |
| **Temperature** | Often missing in Docker | Clear “unavailable” message |
| **Backups** | Panel backups may be outside the container | Badge + [[Backups]] tab / Settings → Backups |

---

## Three different “memory” numbers

Do not mix these up:

1. **Java heap** — room before \`OutOfMemoryError\` inside the game (your \`-Xmx\`).
2. **Container / host RAM** — the limit the host gives your server (can kill the process before heap fills).
3. **Spark heap report** — which mods hold memory during a profile (optional, see [[Using-Spark-with-Watchtower]]).

---

## See also

- [[Live Charts]]
- [[Understanding-Data-Sources]]
- [[Configuration]]
`},Roadmap:{slug:"Roadmap",title:"Roadmap",markdown:`# Roadmap

Watchtower is ops software for **modded Minecraft servers**. Drop a jar in \`mods/\`, open the dashboard on your machine, and see what to fix — without a cloud account, and without homework every time you log in.

Releases ship when they’re ready (no fake dates). Grab jars from [[Downloads-and-Releases]] · see what changed in [[Changelog]].

**Platform today:** NeoForge **1.21.x** (**1.1.9**) · **Coming later:** Fabric and NeoForge **1.20.x**

---

## How to read this

| Column | Meaning |
|--------|---------|
| **Works today** | Already in the jar you can download |
| **Coming next** | What we’re building next, by the problem it solves |
| **Later** | Bigger bets once the single-server experience is rock solid |
| **Not our job** | Things other tools do better — we stay out of the way |

Nothing here is a contract. Loud community requests move up the list. The same four columns live on the in-app **Roadmap** rail tab.

Canonical engineering copy: [docs/ROADMAP.md](https://github.com/djinnbanter/WatchTower/blob/main/docs/ROADMAP.md).

---

## Works today

Install Watchtower now and you already get a full ops desk for one server:

| You get | Why it matters |
|---------|----------------|
| **Live dashboard** | TPS, tick lag, CPU, memory, and players updating while you watch |
| **Watching + Scanning** | Charts and Issues stay current without running a report every visit |
| **Fix inbox ([[Issues]])** | Prioritized problems from continuous Scanning — what to tackle next |
| **Crash intelligence** | Groups crashes, names the likely mod, and points at a fix in plain English |
| **Smart mod list** | Inventory, Modrinth lookups, pack-impact updates, conflicts, client-vs-server hints |
| **Performance Insights** | Busy vs quiet hours, storage trends, config health, baseline “slower than normal” |
| **Spark integration** | Turn a profiler capture into “what ate the tick,” plus opt-in auto-capture on critical lag |
| **GC / JVM + RAM advice** | Live GC pause % of wall, flags profile, and a conservative “do I need more RAM?” card |
| **Config audit** | Read-only keep / tweak / why for \`server.properties\` and startup flags |
| **Safe to restart? + incident stories** | Overview checklist before \`/stop\`; Activity stitches lag → crash → missed backup |
| **Uptime & restart hygiene** | Suggests a maintenance restart from long uptime + rising GC/heap, plus the next quiet window — never auto-restarts |
| **Dashboard timezone display** | Browser-local Settings picker localizes Schedule and quiet-window times; backend data stays UTC |
| **Weekly ops digest** | Insights → Digest + Overview teaser — grade, crashes, disk, MSPT trend, one next action (local only) |
| **Pack drift lock + client-only Issues** | Checksum drift when a jar changes without a version bump; high-confidence client-only jars on the Issues inbox |
| **External kill detection** | Distinguishes OS OOM-killer vs panel force-kill when there is no crash report — Crashes **Killed** chip + correct fix text |
| **Silent script / datapack failures** | KubeJS, CraftTweaker, datapack JSON, and \`/reload\` errors that never crash become Issues (path when on the same log line) |
| **World pressure / farm storytelling** | Continuous entity & chunk census by dimension; item storms, mob spikes, and unattended loaders as Issues + Insights → World |
| **Join & pack sync clinic** | Failed join → named mod diffs on Session → Join clinic + Issues; player-safe Copy fix ([[Join-Clinic]]) |
| **Named admin accounts + audit log** | Owner / admin / viewer logins; Settings → Accounts and Audit log ([[Accounts-And-Audit-Log]]) |
| **Disk runway** | Roughly how many days left — not just percent full |
| **Sources** | See if Watchtower itself is fresh — pollers, next pull, layer health |
| **Ops extras** | Backups (local + Alpha panel/cloud), Session, Activity, Logs, Startup, Settings, Help Center |
| **Support packs** | Redacted zip builder (presets, logs/crashes/Spark, Copy for Discord) for hosts and mod authors |
| **Secure by default** | Sign-in, optional 2FA, honest metrics on hosted panels |
| **Disaster recovery** | CLI + browser viewer path when the server will not boot |

Day-to-day truth is **Watching** (live) + **Scanning** (~every minute). **Support compose** is for sharing — not a daily chore. Details: [[Understanding-Data-Sources]].

---

## Coming next

Grouped by situations every modded-server admin hits. Each line is one planned capability.

### When the server lags

*(World pressure / farms shipped in 1.1.9 — see Works today.)*

### When you need to trust a restart or understand an outage

*(Restart hygiene and timezone display shipped in 1.1.6 — see Works today.)*

### When players can’t join or the pack drifts

*(Join clinic shipped in 1.1.10 — see Works today / [[Join-Clinic]].)*

- **Pin a known-good pack** — freeze a good modlist; banner + named diff when jars drift

### When the world itself is the problem

- **Corrupt chunk playbook** — guided stop → backup → repair (no silent world wipes)

*(Farm / item-storm storytelling and silent script failures shipped in 1.1.9 / 1.1.7 — see Works today.)*

### For teams and checking in on the go

*(Named accounts + audit log shipped in 1.1.18 — see Works today / [[Accounts-And-Audit-Log]].)*

- **Public status page** — “are we up?” for Discord, without exposing the dashboard
- **Maintenance windows** — scheduled restarts stop looking like mystery outages
- **Mobile glance** — a fast phone-friendly health check you can pin

### When you need to act or ask for help

- **Live command bridge** — preview and run safe triage commands from the dashboard
- **Optional anonymous diagnostics** — opt-in, previewable, cooldown’d packages so Watchtower can learn real failures (off by default; no continuous streaming)

---

## Later (bigger bets)

Parked for now (still wanted):

- **First-hour sanity check** — Java / loader / client-only jars / missing deps
- **Safe guided fixes** — vetted settings apply with preview + undo
- **Jar quarantine** / **Assisted safe updates** — move jars aside; Modrinth Safe swap path
- **Player-safe ops context** / **player-safe explain** — Discord paste and lag-vs-timeout hints
- **Did that update help?** — before/after after a mod change

Once one server feels effortless:

- **Insights schedule intelligence** — richer habit trends beyond the shipped timezone picker and restart-hygiene quiet window
- **Fleet view** — TPS, crashes, and backups across many servers (local hub first)
- **Watchtower Cloud (paid, optional)** — remote ops desk, pairing code, history, alerts — Local stays free forever
- **Alerts that reach you** — Discord / webhook for crashes, lag, stale backups
- **More platforms** — Fabric and NeoForge **1.20.x**, same dashboard and workflow

---

## Not our job

We stay focused so the product stays clear:

| We don’t replace… | Use instead |
|-------------------|-------------|
| Host panels (start/stop, files, console) | Pterodactyl, Crafty, AMP, bare metal, … |
| Full player analytics (retention, GeoIP, leaderboards) | [Plan](https://www.playeranalytics.net/) and similar |
| Client GPU / graphics crash tooling | Doesn’t apply to headless dedicated servers |
| Generic APM / log warehouses | Watchtower is opinionated about Minecraft ops |

Watchtower **does** show who’s online during lag or crashes — that’s ops triage, not surveillance.

---

## Promises that don’t change

- **Your data stays yours** — local-first; nothing leaves your host unless you choose
- **You’re in control** — opt-in network features; preview and undo for risky actions
- **Ops, not surveillance** — help run the server; don’t track players like an analytics product
- **Drop-in beside your host** — a jar in \`mods/\`, not a second control panel

---

## Help shape it

- Vote and request on [GitHub Issues](https://github.com/djinnbanter/WatchTower/issues)
- Get running: [[Installation]] · [[Quick-Start-Checklist]] · [[Troubleshooting]]
- Full engineering notes: [docs/ROADMAP.md](https://github.com/djinnbanter/WatchTower/blob/main/docs/ROADMAP.md)
`},"Scheduled-Reports":{slug:"Scheduled-Reports",title:"Scheduled Reports",markdown:`# Scheduled Reports

This page moved.

**Optional legacy schedules** now live under [[Health-Reports#Optional schedule (legacy deep audits)|Health Reports — Optional schedule]].

Day-to-day Watching / Scanning do not require a schedule. Support packs use rail **Build support pack** — see [[Health-Reports]].
`},"Script-Failed-Silently":{slug:"Script-Failed-Silently",title:"Script failed silently",markdown:`# Script failed silently

**Script / datapack / KubeJS errors that never crash the server** often scroll off \`latest.log\` within minutes. Watchtower watches the log on the usual Scanning cadence and raises them as continuous [[Issues]] so they stay visible.

---

## What gets detected

| Kind | Typical trigger | Severity |
|------|-----------------|----------|
| **KubeJS** | \`[KubeJS…/]\` ERROR / Exception / failed | warning |
| **CraftTweaker** | \`[CraftTweaker…]\` ERROR lines | warning |
| **Datapack JSON** | \`Couldn't parse data file\` / \`Couldn't parse element\` | warning |
| **/reload failed** | \`Failed to execute reload\` / \`Reload failed\` | info |

When the failing **path** (and optional **line**) appears on the **same log line** as the trigger, the Issue message includes it — for example:

> KubeJS script error — \`kubejs/server_scripts/machines.js:42\`

Path capture is best-effort and same-line only. If the script path only appears on a later stack-trace line, the Issue is still raised, but without a path.

Watchtower does **not** edit scripts or datapacks for you.

---

## Where you see it

- [[Issues]] → Active → **Warning** (script & datapack failures land here by severity)
- Primary action opens [[Logs]]
- Issue id shape: \`SILENT_FAIL:{kind}:{path-or-hash}\`

Entries age out of ops-cache after about **7 days** without a re-hit, then the continuous Issue resolves.

---

## What to do

1. Open the reported path (when present) and fix the syntax / missing item / bad JSON
2. Run \`/reload\` (or the mod’s reload command) and confirm the error is gone from Logs
3. Mark the Issue **Reviewed** or **Hide** if you already handled it

Kill-switch: \`SILENT_FAIL_DETECT_ENABLED\` (default \`true\`) — see [[Configuration]].

---

## Related

- [[Issues]]
- [[Logs]]
- [[Mods]]
- [[Configuration]]
`},"Security-and-Access":{slug:"Security-and-Access",title:"Security and Access",markdown:`# Security and Access

The dashboard is protected by **username and password**. Treat it like any admin panel — do not expose it to the whole internet without extra care.

---

## At a glance

- **First login:** \`watchtower\` / \`password\` — you **must** pick a new password
- **2FA (optional):** **Settings → Security** — recommended on public hosts
- **Public VPS / hosting panel:** use localhost + SSH tunnel — do not open port 8787 to the world
- **Too many wrong passwords:** wait 15 minutes (5 tries per IP)

---

## First login

1. Open \`http://<your-server-ip>:8787\`
2. Sign in with \`watchtower\` / \`password\`
3. Choose a new password (at least 8 characters)
4. Optional: enable 2FA in **Settings → Security**

---

## Two-factor authentication (2FA)

1. **Settings → Security** → Enable 2FA
2. Scan the QR code with Google Authenticator, Authy, or similar
3. **Save the recovery codes** when shown — they appear only once

After that, login needs your password plus a code from the app (or a recovery code).

> **Coming soon:** some enrollment UI steps may still be illustrative on unfinished builds. If Enable 2FA is incomplete on your install, keep the dashboard on localhost + SSH tunnel and change the password first.

---

## Locked out?

| Situation | What to do |
|-----------|------------|
| Never changed the default password | Try \`watchtower\` / \`password\` |
| Forgot password, 2FA **off** | Someone with OP 4 runs \`/watchtower dashboard reset-password\` |
| Forgot password, 2FA **on** | Use a **recovery code** at login, then change password in Settings |
| Lost authenticator app | Recovery code at login, or OP 4: \`/watchtower dashboard reset-password clear-2fa\` |
| Last resort | Stop server, delete \`watchtower/dashboard-auth.json\`, start server — default account returns |

---

## Connect safely from home (SSH tunnel)

**Recommended** when the dashboard only listens on localhost:

\`\`\`bash
ssh -L 8787:127.0.0.1:8787 user@your-server
\`\`\`

Then open **http://127.0.0.1:8787** in your browser on your PC.

### Restrict dashboard to localhost

\`\`\`toml
# config/watchtower-server.toml
dashboardBindHost = "127.0.0.1"
\`\`\`

Restart the server after changing this file.

---

## Yellow exposure banner

If the dashboard binds to \`0.0.0.0\`, you may see a warning that the port could be reached from your network. Login is still required, but anyone who can reach the port can try to sign in.

On **bloom.host**, Pterodactyl, and public VPS hosts: do not forward port 8787 publicly.

---

## Technical details

- Credentials: hashed in \`watchtower/dashboard-auth.json\`
- Session: 24 hours default; “Remember this device” = 7 days
- Security headers: \`X-Frame-Options\`, CSP — scripts served locally
- \`dashboardAuthToken\` in old TOML configs is **ignored** in 1.0.0+

---

## See also

- [[Dashboard Overview]]
- [[Commands]]
- [[Troubleshooting]]
`},Session:{slug:"Session",title:"Session",markdown:`# Session

**Session** shows who is online, peaks, playtime, and the player directory.

---

## When to open it

- Checking who is on before a restart
- Reviewing peaks or playtime
- Finding a player in the directory

This is **not** a ban tool — use your server’s moderation mods/commands for that.

---

## What you’ll see

| Area | Job |
|------|-----|
| **Who's here** | Online roster / vitals |
| **Average daily players** | Peak-oriented summary |
| **Player directory** | Searchable known players |
| **Session activity** | Joins, leaves, and pack-sync rejects (**Copy fix** on failures) |

| Data | Layer |
|------|-------|
| Online now | Watching / live poll |
| Playtime depth | Scanning (player stats) |
| Session activity | Watching / ops-cache activity + join clinic |

---

## What to do next

1. Confirm the server is online if the roster is empty
2. Use directory search before pinging players in-game
3. Cross-check restart timing with Overview’s Restart card

---

## Related

- [[Dashboard-Overview]]
- [[Understanding-Data-Sources]]
- [[Activity]]
- [[Join-Clinic]]
`},Sources:{slug:"Sources",title:"Sources",markdown:`# Sources

**Sources** is Watchtower’s self-health page — pollers, feed freshness, and when the next data pull is due.

> Theory of Watching / Scanning / Support lives on [[Understanding-Data-Sources]]. This page is the how-to for the Ops **Sources** tab.

> **Name clash:** Ops **Sources** (this page) ≠ Spark → **Sources** (profile mod attribution). See [[Using-Spark-with-Watchtower]].

---

## When to open it

- “Is Watchtower working?”
- Overview / Issues look empty or stale
- After changing **Settings → Monitoring**

---

## What you’ll see

### Hero verdict

A short status for overall freshness (healthy, waiting, stale, degraded — as shown on your build).

### Layers

| Layer | Plain English |
|-------|----------------|
| **Watching** | Live charts / vitals |
| **Scanning** | ~60s ops (logs, crashes, Issues, mods, …) |
| **Support compose** | On-demand zip — not a continuous poller |

### Job grid

| Job | What it feeds |
|-----|----------------|
| **Live telemetry** | Watching / charts |
| **Ops cache** | Core Scanning store |
| **Activity / log scan** | [[Activity]] / log-derived events |
| **Mod scan** | [[Mods]] deltas |
| **Backup scan** | [[Backups]] freshness |
| **Modrinth lookup** | Optional online metadata |
| **Issues live** | [[Issues]] continuous ledger |
| **Support compose** | On-request pack build |

Cards show idle vs active, last success, and **next pull** / **Due now**.

---

## What to do next

1. Confirm Watching + Scanning are fresh (or Waiting on first tick after boot)
2. If a job is stale, wait one interval or check server console errors
3. Open **Monitoring settings** (Sources CTA → **Settings → Monitoring**) to review cadence
4. For sharing with a host, use rail **Build support pack** — not this job grid alone ([[Health-Reports]])

---

## Healthy vs problem

| Healthy | Problem |
|---------|---------|
| Watching Just now / recent; Scanning within ~1–2 min | Stale / Degraded while the server is online |
| Jobs Idle between pulls | Stuck Due now with no progress |

---

## Related

- [[Understanding-Data-Sources]]
- [[Troubleshooting]]
- [[Configuration]]
- [[Dashboard-Overview]]
- [[Backups]]
`},Startup:{slug:"Startup",title:"Startup",markdown:`# Startup

**Startup** shows the last boot verdict — phases, warnings/errors, and boot-time history.

---

## When to open it

- After a restart or crash loop
- Overview boot teaser looked wrong
- Issues filtered to boot findings

---

## What you’ll see

| Area | Job |
|------|-----|
| **Last boot** hero | Overall verdict |
| **Warnings / Errors** | What failed or looked risky |
| **Boot phases** | Timed stages of launch |
| **Boot times** | History across restarts |
| Launch / config audit | JVM and config notes (browser-local dismissals stay in this browser) |

---

## What to do next

1. Read warnings/errors first
2. Open [[Issues]] with boot filters if cards were created
3. Use [[Insights]] → Configs for longer JVM/config patterns
4. For crash loops that never reach the dashboard, use [[Disaster-Recovery]]

---

## Related

- [[Issues]]
- [[Insights]]
- [[Configuration]]
- [[Crashes]]
`},Troubleshooting:{slug:"Troubleshooting",title:"Troubleshooting",markdown:`# Troubleshooting

Symptom → where to click. Prefer the linked tab guide after you land.

---

## Quick index

| If you see… | Open first |
|-------------|------------|
| Lag / low TPS right now | [[Live-Charts|Live]] → [[Issues]] → [[Using-Spark-with-Watchtower|Spark]] |
| Crash / restart loop | [[Crashes]] → [[Logs]] |
| Empty or stale Overview / Issues | [[Sources]] → refresh browser |
| “Is Watchtower working?” | [[Sources]] |
| Login / password / 2FA | Below + [[Security-and-Access]] |
| Backup worry | [[Backups]] → Sources → Backup scan |
| Blank charts | Live + hard-refresh; see [[Live-Charts]] |
| Need to share with host | Rail **Build support pack** · [[Health-Reports]] |
| Server will not start | [[Disaster-Recovery]] |
| Lost in the UI | [[Dashboard-Tabs]] · **Help Center** |

---

## Can't log in

### Default password doesn't work

Try \`watchtower\` / \`password\`. If someone already changed it, use that password or ask an admin to run \`/watchtower dashboard reset-password\` (OP 4).

### Forgot password

| 2FA on? | Fix |
|---------|-----|
| No | \`/watchtower dashboard reset-password\` → back to \`password\` |
| Yes | Recovery code at login, then change password in **Settings → Security** |
| Lost 2FA device | \`/watchtower dashboard reset-password clear-2fa\` (OP 4) |

### Too many wrong attempts

Wait **15 minutes** (5 tries per IP).

### Stuck on "Checking session…"

Hard-refresh the browser (\`Ctrl+Shift+R\`) after updating the mod.

---

## Dashboard looks empty or stale

### Overview / Issues empty

**Usually:** Watching/Scanning still warming up, or the browser needs a refresh.

**Fix:** Open [[Sources]] for freshness. Open [[Live-Charts|Live]] and [[Issues]] — Scanning fills Issues without a deep audit. Resume Welcome if setup is unfinished. For a shareable snapshot: rail **Build support pack** or [[Health-Reports]].

### Crashes tab empty

Open [[Crashes]] and wait for Scanning, or click **Refresh** (background folder scan).

### Activity tab has few events

Activity fills from Scanning and gap backfill. **Refresh** on [[Activity]] helps without a full audit.

### Live numbers work but charts are blank

Replace the mod JAR if needed, hard-refresh the browser. See [[Live-Charts]].

### Charts slow on long ranges

Normal — long ranges refresh less often. Try a shorter window.

### Session tab empty

Server must be **online**. Playtime deepens from Scanning. See [[Session]].

---

## Support compose / diagnostics

### \`/watchtower diagnostics\` or Support download fails

Wait for Scanning to write \`ops-cache.json\` (usually within a minute after boot). Retry rail **Build support pack** or \`/watchtower diagnostics\`. Compose builds from continuous data — no legacy facts file required.

> **Coming soon:** the in-app zip download may still be finishing. You can still use console commands and the DR CLI when you need a bundle today.

---

## Backups

| Symptom | Fix |
|---------|-----|
| “Not tracking” and you expected a folder | [[Backups]] — complete Step A (folder) and optional Step B (webhook) |
| Freshness looks wrong | [[Sources]] → Backup scan job; Settings → Backups |

---

## Performance

| Symptom | Path |
|---------|------|
| Lag spike now | Live → Issues → Spark profile |
| Patterns over days | [[Insights]] |
| Suspect a mod | [[Mods]] + Spark Sources (profile share — not Ops Sources) |

---

## When to escalate

1. [[Health-Reports]] — Support pack for your host or a mod author  
2. [[Disaster-Recovery]] — server will not start  
3. [[DR-CLI-Reference]] — recovery tool flags  

---

## Related

- [[Dashboard-Tabs]]
- [[Understanding-Data-Sources]]
- [[Sources]]
- [[Commands]]
`},"Understanding-Data-Sources":{slug:"Understanding-Data-Sources",title:"Understanding Data Sources",markdown:`# Understanding Data Sources

Watchtower updates information in **two continuous layers**, plus **Support compose** when you ask for a zip. You do **not** need a manual deep audit for day-to-day dashboard use.

---

## At a glance

| Kind | Plain English | When it updates |
| ---- | ------------- | --------------- |
| **Watching** | Charts and vitals | Every ~1 second while the **server** runs (dashboard open or not) |
| **Scanning** | Logs, crashes, activity, continuous Issues, mods deltas | About once a minute while the server runs |
| **Support compose** | Frozen support zip + synthesized brief for sharing | On request — rail **Build support pack**, Overview / Help Center **Support pack**, \`/watchtower run\`, or \`/watchtower diagnostics\` |

**Short version:** Watching + Scanning keep the dashboard useful. Support compose is for sharing a snapshot with your host or mod authors — not day-to-day tab truth.

Open the **Sources** tab to see when each layer and job last updated, and when the next pull is due. How-to: [[Sources]]. Theory lives on this page.

### First-run Initial discovery

On first setup, after you change the default account, Welcome can enable Modrinth (optional), then may run a **blocking Initial discovery** — a full deep audit baseline before you continue. **Next** stays locked until it finishes. After that, Watching + Scanning keep tabs current with deltas.

---

## Which tabs use which layer?

| Tab / feature | Watching | Scanning | Support compose |
| ------------- | -------- | -------- | --------------- |
| Live charts / Overview vitals | Yes | — | No |
| Issues Active fix list | Live peeks | Ledger | Optional export |
| Crashes list + Fix hints | — | Yes | Zip adds extra context |
| Activity timeline | — | Yes | Optional |
| Mods inventory / updates | — | Yes | Optional |
| Session online roster | Poll | Playtime deepens | Optional |
| Backups freshness | — | Scan job | Optional |
| Share zip with host | — | — | **Yes** |

Legacy deep-audit facts on disk (older installs or optional schedule) are still read when present, but day-to-day tabs do not depend on them. Optional schedule: [[Health-Reports]].

---

## In the dashboard

| Where to look | What it shows |
| ------------- | ------------- |
| **Sources** tab | Watching / Scanning / Support compose freshness + job grid |
| Badges on cards | Live / Scanning / Mixed |
| Rail **Build support pack** | Compose a support bundle |
| Help Center / Overview Support card | Same compose flow |
| **Settings → Monitoring** | Lag thresholds, baseline, Spark auto-capture, scan intervals |
| **Settings → Alerts** | Disk warnings and report retention |

> **Do not confuse** Ops **Sources** (pollers) with Spark → **Sources** (which mod owns profile time). Spark details: [[Using-Spark-with-Watchtower]].

---

## Technical details

### Files on disk

| File | Layer | Written by |
| ---- | ----- | ---------- |
| \`live-history.json\` | Watching | Metrics while server samples |
| \`performance-rollups.json\` | Minute history | Once per minute |
| \`ops-cache.json\` | Scanning | Log/crash/issues_live (~60s) + delta jobs |
| \`incidents/*.json\` | Lag snapshots | Auto lag detection |
| \`watchtower-facts-support-*.json\` | Support compose only | Not BAU dashboard master |
| \`watchtower-facts-*.json\` (legacy) | Old deep audits | Upgrades / optional schedule only |

### Settings that control timing

| What | Where to change |
| ---- | --------------- |
| Live chart sample rate | \`config/watchtower-server.toml\` (restart required) |
| Background scan interval | \`watchtower/watchtower.conf\` or Settings → Monitoring |
| Activity gap backfill | \`ACTIVITY_GAP_*\` in \`watchtower.conf\` |
| Mods deep delta jobs | \`MODS_DEEP_*\` in \`watchtower.conf\` |
| Legacy report schedule | \`watchtower.conf\` or \`/watchtower schedule\` (new installs default **Off**) |

---

## Glossary (short)

| Term | Meaning |
| ---- | ------- |
| **Watching** | Live telemetry layer for charts and vitals |
| **Scanning** | ~60s ops layer for logs, crashes, Issues, mods |
| **Support compose** | On-demand zip for sharing |
| **Help Center** | Built-in guides (rail tab) |
| **TPS** | Ticks per second — 20 is healthy |
| **Tick lag (MSPT)** | Milliseconds per tick — lower is better |
| **Heap** | Java memory the game uses |
| **Issues** | Fix inbox from continuous Scanning |
| **Sources (Ops)** | Poller health and next pull |
| **Spark profile** | Capture of where server time went during lag |
| **Spark Sources** | Profile sub-tab — mod/source attribution (not Ops Sources) |
| **Freshness** | How recently a layer or job updated |
| **Poller** | Background job that pulls one kind of data |
| **Welcome tour** | Skippable first-run walkthrough (\`?tab=wizard\`) |
| **Backup tracking** | Folder / webhook Watchtower watches — or Not tracking |
| **Crash group** | Fingerprinted crash family on Crashes |
| **Modrinth lookup** | Optional online mod metadata |
| **Config audit** | Startup / Insights check of JVM and conf |
| **Weekly ops digest** | Local week rollup on Insights → Digest (ops-cache \`weekly_digest\`) |
| **DR bundle** | Disaster-recovery zip from the CLI tool |
| **Ops scan** | One Scanning cycle writing ops-cache |

---

## Related

- [[Sources]] — freshness how-to
- [[Health-Reports]] — Support packs & optional schedule
- [[Dashboard-Tabs]] — where to click
- [[Commands]] — \`/watchtower run\` and diagnostics
`},"Using-Spark-with-Watchtower":{slug:"Using-Spark-with-Watchtower",title:"Using Spark with Watchtower",markdown:`# Using Spark with Watchtower

Spark records **what is using server time** when lag happens. Watchtower reads Spark’s saved profile and turns it into plain advice on the **Spark** tab — which mods and code paths are slowing ticks down.

---

## What you need

- [Spark](https://modrinth.com/mod/spark) installed on the server
- Current Watchtower release from [[Downloads-and-Releases]] (Spark tab + on-demand parse)
- A saved \`.sparkprofile\` file (see below)

---

## Quick workflow (Spark tab)

1. **Capture while lagging:** \`/spark profiler start\` → wait **30–60 seconds** → \`/spark profiler stop --save-to-file\`
2. **Open the Spark tab** and click **Refresh** if you just saved a new profile, then use the **profile dropdown** to pick the file
3. **Or** click **Import from URL** and paste a \`https://spark.lucko.me/…\` link (downloads once into \`watchtower/spark-upload/\`)
4. **Read the evidence** — Overview, Findings, World, **Sources** (profile share), Timeline, Call paths, Technical, Compare

Day-to-day lag triage starts on [[Live-Charts]] and [[Issues]]. Spark is for proof when you need it — not a required daily “run report” step.

---

## Capture a profile while the server is lagging

1. \`/spark profiler start\`
2. Wait **30–60 seconds** while lag is happening
3. \`/spark profiler stop --save-to-file\`

Spark saves a file like \`config/spark/profile-….sparkprofile\`.

**Optional:** copy the file to \`<server>/watchtower/spark-upload/\` so it appears first in the dropdown.

---

## Pick a profile

On the **Spark** tab:

- Use the **Profile** dropdown (newest first)
- Click **Refresh** to rescan \`watchtower/spark-upload/\` and \`config/spark/\`
- Click **Import from URL** for a spark.lucko.me link or 10-character key
- Unreadable files show a short notice instead of failing silently
- Last selected path is remembered in this browser

Watchtower lists up to **25** profiles. To turn Spark ingest off, set \`SPARK_ENABLED=false\` in \`watchtower.conf\` and restart.

---

## Read the Spark tab

| Sub-tab | What it shows |
| -------- | ----------------- |
| **Overview** | Capture health, findings, next actions, quality limits |
| **Findings** | Ranked evidence |
| **World** | Entity/chunk context when present |
| **Sources** | **Profile** source/mod attribution (own-time vs stack involvement) |
| **Timeline** | One-minute windows for TPS, MSPT, CPU, players, entities, chunks |
| **Call paths** | Searchable thread trees |
| **Technical** | Sampler settings, JVM metadata, provenance |
| **Compare** | Baseline vs target deltas |

> **Name clash:** Spark → **Sources** explains which mod owns time in a **profile**. Ops → [[Sources]] explains Watchtower **pollers**. They are different tabs.

### When Spark helps / when it doesn’t

| Helps | Does not prove |
|-------|----------------|
| Which mods dominate tick time during a capture | That a mod is “bad” forever |
| Call paths for a lag window | Network or client-only issues |
| Compare two captures | Memory leaks from allocation mode alone |

---

## How Watchtower interprets a profile

- **Execution mode** — where CPU/wall time was spent (milliseconds)
- **Allocation mode** — newly allocated memory (bytes); not CPU time; cannot alone prove a leak
- **Inclusive** vs **Self / own** — whole stack vs this frame only
- **Source involvement** — inclusive weight at each source’s entry points (not double-counted nested frames)
- Timeline windows describe the capture; rolling TPS/MSPT metadata is labeled separately

Watchtower labels jar-index attribution as a fallback when Spark’s class sources are missing. Unknown and native frames stay visible. Evidence limits are shown on Overview — trust the quality notes.

---

## Overview teaser

When a fresh profile exists, [[Dashboard-Overview]] may show a short Spark summary with **Open Spark**. That is a shortcut into this tab — not a separate “run report” button for day-to-day use.

Optional Support compose can attach Spark context when you share a pack ([[Health-Reports]]).

---

## Related

- [[Issues]] — fix inbox during lag
- [[Live-Charts]] — right-now TPS / tick lag
- [[Mods]] — inventory and conflicts
- [[Sources]] — Ops pollers (not Spark Sources)
- [[Troubleshooting]]
`},"World-Pressure":{slug:"World-Pressure",title:"World pressure",markdown:`# World pressure

**Farms, item storms, and chunk loaders** often look like “the server needs more RAM” when the real problem is vanilla entity/chunk pressure. Watchtower keeps a continuous per-dimension census and raises plain-English classifiers when pressure holds — without replacing Spark’s per-chunk proof.

Watchtower **never** kills entities or unloads chunks for you.

---

## What the census measures

About once a minute (default \`liveWorldCensusIntervalSeconds=60\`), on the server tick thread, Watchtower walks loaded entities **once** (folded into the existing entity count) and records, per dimension (including mod dimensions, capped at 24):

| Field | Meaning |
|-------|---------|
| **entities** | Total loaded entities |
| **items** / **living** | ItemEntity vs LivingEntity split |
| **top_types** | Top 8 entity type ids by count |
| **loaded_chunks** | \`getLoadedChunksCount()\` |
| **forced_chunks** | Vanilla \`/forceload\` set size |
| **spawn_chunks** | Estimated spawn ticket footprint from \`spawnChunkRadius\` (Overworld only; 0 elsewhere) |
| **mod_forced_chunks** | Unique chunks in NeoForge \`ForcedChunksSavedData\` block/entity force-load trackers |
| **players** | Players currently in that dimension |
| **unattended** | Loaded chunks with zero players (UI context only) |

Counting must stay on the tick thread (Minecraft world state is not thread-safe). All baseline math, classifiers, and Issues merge run **off-thread** on the usual ops scan cadence.

L1 performance rollups also store \`entities_max\`, \`chunks_max\`, and \`unattended_chunks_max\` per minute so Insights can compare live load against busy hours and the window peak. Quiet-hour percentiles still drive Issue classifiers only.

### Chunk-load buckets (not the same thing)

| Bucket | What it is | What it is not |
|--------|------------|----------------|
| **Spawn** | Estimate of vanilla START tickets around world spawn | Live ticket walk; non-Overworld dims |
| **Vanilla /forceload** | \`ServerLevel.getForcedChunks()\` | Mod loaders |
| **Mod force-loads** | NeoForge TicketController / \`ForcedChunksSavedData\` trackers | Every custom \`DistanceManager\` ticket or per-mod brand name |

Loaded can stay high with **0 players** because spawn + these force-load sources (and other tickets) keep areas awake.

---

## Comparison bars (Insights → World)

Alert cards show four bars:

| Bar | Meaning | Source |
|-----|---------|--------|
| **Now** | Live census for that dimension / classifier evidence | \`ops-cache\` → \`world_pressure\` |
| **Quiet hours (p95)** | 95th percentile of \`entities_max\` during Schedule’s typically quiet UTC hours | \`GET /api/performance/dashboard\` → \`world_pressure_compare.quiet\` |
| **Busy hours (p95)** | 95th percentile of \`entities_max\` during Schedule’s typically busy UTC hours | \`world_pressure_compare.busy\` |
| **{7d\\|30d} peak** | Highest single minute in the selected Insights window | \`world_pressure_compare.peak\` |

The Insights **7d / 30d** toggle refreshes \`world_pressure_compare\` with the same window split as Schedule.

---

## Dimension cards

Each **By dimension** card is labeled **\`Dimension · {name}\`** so custom worlds (e.g. Mining) read as places.

| Element | Meaning |
|---------|---------|
| **0 players** pill | That dimension currently has zero players online |
| **Chunk-load bar** | Stacked **Spawn · /forceload · Mod loaders** share of loaded (scaled if counts overlap) |
| **Force-kept flag** | UI-only when \`(vanilla + mod) ≥ 8\` **and** \`(vanilla + mod) / loaded ≥ 5%\` — spawn excluded; not an Issue |
| **Entity mix pie** | Top entity types in that dimension |
| **Players gauge** | Player count in that dimension (scale at least 8) |

Hero **Force-kept** = sum of vanilla \`/forceload\` + mod force-loads across dimensions.

---

## Classifiers

| Kind | When it fires | Sustained |
|------|---------------|-----------|
| **item_storm** | ≥1200 items **and** (items ≥40% of entities **or** entities ≥2× quiet-hours p95) | ≥3 scans |
| **mob_spike** | ≥900 living **and** entities ≥2× quiet-hours p95 | ≥3 scans |
| **pregen_outrunning_disk** | Pregen (Chunky/DH) active **and** disk write latency ≥ \`DISK_IO_LATENCY_WARN_MS\` | ≥ \`CHUNK_WRITE_SUSTAINED_SCANS\` (default 3) |
| **chunk_save_backlog** | Disk write latency sustained high **without** active pregen | ≥ \`CHUNK_WRITE_SUSTAINED_SCANS\` (default 3) |
| **heavy_chunk_generation** | Players online **and** loaded chunks grew by ≥ \`CHUNK_WRITE_GROWTH_CHUNKS\` (default 48) vs last scan | ≥ \`CHUNK_WRITE_SUSTAINED_SCANS\` (default 3) |

**Chunk write / pregen (1.1.23):** WatchTower also watches disk write latency and Chunky/DH pregen. Sustained save backlog, pregen outrunning disk, or heavy chunk growth while players are online raise Issues with advice to pause pregen and wait for saves — WatchTower will not pause pregen for you. Insights → World shows a **disk write pressure** bar (latency vs warn / ~3× critical) plus write/pregen evidence when \`CHUNK_WRITE_PRESSURE_ENABLED\` is on (default). WatchTower cannot read JVM save-queue depth — latency is the signal.

Tune thresholds in **Settings → Alerts → Chunk write / pregen** (or conf):

| Setting | Conf key | Default |
|---------|----------|---------|
| Enable classifiers | \`CHUNK_WRITE_PRESSURE_ENABLED\` | \`true\` |
| Disk write latency warn | \`DISK_IO_LATENCY_WARN_MS\` | \`50\` |
| Heavy growth (chunks / scan) | \`CHUNK_WRITE_GROWTH_CHUNKS\` | \`48\` |
| Sustained scans before Issue | \`CHUNK_WRITE_SUSTAINED_SCANS\` | \`3\` |

\`item_storm\` becomes **critical** when items ≥3000 **or** entity load correlates with MSPT (top vs bottom entity quartile over ~24h of rollups).

While Watchtower is still **learning** quiet hours (&lt;360 sample minutes with entity columns), baseline-only classifiers like \`mob_spike\` stay quiet; absolute item-share storms can still fire, without “× quiet normal” wording.

Temporary bursts (TNT farms, brief mob waves) should not open Issues — that is what the sustained-scan windows are for.

---

## Where you see it

- [[Dashboard-Tabs]] → Insights → **World** — hero totals, classifier cards, per-dimension cards (chunk-load breakdown + players gauge)
- [[Issues]] → Active → **Warning** (item storms / mob spikes land here by severity)
- Primary action: **Open World pressure** (\`tab=insights&view=world\`)
- Issue id shape: \`WORLD_PRESSURE:{kind}:{dimension}\`

For precise busy-chunk coordinates, open a Spark profile → **World** (Watchtower deep-links there from the classifier card). Per-chunk hotspots remain Spark’s job.

---

## What to do

1. Read the classifier detail (dimension + counts + quiet-hours ratio in the Issue copy when available)
2. Use the Now / Quiet / Busy / Peak bars to see whether entity load is above a typical quiet or busy evening, or near the window peak
3. On dimension cards, check spawn / /forceload / mod loader share and player count
4. Fly to the busy area / check hoppers, spawners, \`/forceload\`, and mod chunk loaders
5. Capture Spark if you need chunk-level proof
6. Mark the Issue **Reviewed** or **Hide** once handled

Kill-switch: \`WORLD_PRESSURE_ENABLED\` (default \`true\`) — see [[Configuration]].

---

## Related

- [[Issues]]
- [[Insights]]
- [[Dashboard-Tabs]]
- [[Configuration]]
- Spark World (dashboard Spark tab)
`}}};function le(s){return String(s??"").split("#")[0].trim().replace(/\s+/g,"-")}function T(s){const n=s.trim();return n.startsWith("|")&&n.includes("|",1)}function R(s){const n=s.trim();return n.includes("-")?/^\|?[\s:|-]+\|?$/.test(n):!1}function L(s){let n=s.trim();return n.startsWith("|")&&(n=n.slice(1)),n.endsWith("|")&&(n=n.slice(0,-1)),n.split("|").map(t=>t.trim())}function de({slug:s,label:n}){const t=le(s);return e.jsx("a",{className:"wiki-link",href:V("docs",{wiki:t}),onClick:r=>{r.preventDefault(),w({tab:"docs",wiki:t})},children:n})}function u(s){if(!s)return null;const n=[],t=/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g;let r=0,i,a=0;for(;(i=t.exec(s))!==null;){if(i.index>r&&n.push(s.slice(r,i.index)),i[1]!=null){const l=i[1].trim(),o=(i[2]||i[1].split("#")[0]).trim();n.push(e.jsx(de,{slug:l,label:o},a++))}else if(i[3]!=null)n.push(e.jsx("code",{className:"wiki-inline-code",children:i[3]},a++));else if(i[4]!=null)n.push(e.jsx("strong",{children:i[4]},a++));else if(i[5]!=null)n.push(e.jsx("em",{children:i[5]},a++));else if(i[6]!=null){const l=i[7],o=/^https?:\/\//.test(l);n.push(e.jsx("a",{className:"wiki-ext-link",href:l,target:o?"_blank":void 0,rel:o?"noopener noreferrer":void 0,children:i[6]},a++))}r=t.lastIndex}return r<s.length&&n.push(s.slice(r)),n.length===1?n[0]:n}function ce(s){const n=[];let t=0,r=0;for(;t<s.length;){const i=s[t];if(!i.trim()){t++;continue}if(i.startsWith("```")){const o=i.slice(3).trim(),d=[];for(t++;t<s.length&&!s[t].startsWith("```");)d.push(s[t]),t++;t++,n.push(e.jsx("pre",{className:`wiki-code-block${o?` lang-${o}`:""}`,children:e.jsx("code",{children:d.join(`
`)})},r++));continue}const a=i.match(/^(#{1,6})\s+(.+)$/);if(a){const o=a[1].length,d=a[2].trim(),c=d.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");n.push(p.createElement(`h${o}`,{key:r++,id:c,className:`wiki-h${o}`},u(d))),t++;continue}if(/^[-*_]{3,}\s*$/.test(i)&&!i.includes("|")){n.push(e.jsx("hr",{className:"wiki-hr"},r++)),t++;continue}if(T(i)&&t+1<s.length&&R(s[t+1])){const o=L(i);t+=2;const d=[];for(;t<s.length&&T(s[t])&&!R(s[t]);)d.push(L(s[t])),t++;n.push(e.jsx("div",{className:"wiki-table-wrap",children:e.jsxs("table",{className:"wiki-table",children:[e.jsx("thead",{children:e.jsx("tr",{children:o.map((c,h)=>e.jsx("th",{children:u(c)},h))})}),e.jsx("tbody",{children:d.map((c,h)=>e.jsx("tr",{children:c.map((S,_)=>e.jsx("td",{children:u(S)},_))},h))})]})},r++));continue}if(/^>\s?/.test(i)){const o=[];for(;t<s.length&&/^>\s?/.test(s[t]);)o.push(s[t].replace(/^>\s?/,"")),t++;n.push(e.jsx("blockquote",{className:"wiki-callout wiki-blockquote",children:u(o.join(" "))},r++));continue}if(/^[-*+]\s+\[[ xX]\]\s/.test(i)){const o=[];for(;t<s.length&&/^[-*+]\s+\[[ xX]\]\s/.test(s[t]);){const d=/\[[xX]\]/.test(s[t]),c=s[t].replace(/^[-*+]\s+\[[ xX]\]\s/,"");o.push(e.jsxs("li",{className:d?"wiki-checklist__item wiki-checklist__item--done":"wiki-checklist__item",children:[e.jsx("input",{type:"checkbox",disabled:!0,checked:d,"aria-hidden":!0}),e.jsx("span",{children:u(c)})]},o.length)),t++}n.push(e.jsx("ul",{className:"wiki-checklist",children:o},r++));continue}if(/^[-*+]\s/.test(i)){const o=[];for(;t<s.length&&/^[-*+]\s/.test(s[t])&&!/^[-*+]\s+\[[ xX]\]\s/.test(s[t]);)o.push(e.jsx("li",{children:u(s[t].replace(/^[-*+]\s/,""))},o.length)),t++;n.push(e.jsx("ul",{className:"wiki-ul",children:o},r++));continue}if(/^\d+\.\s/.test(i)){const o=[];for(;t<s.length&&/^\d+\.\s/.test(s[t]);)o.push(e.jsx("li",{children:u(s[t].replace(/^\d+\.\s/,""))},o.length)),t++;n.push(e.jsx("ol",{className:"wiki-ol wiki-ol--steps",children:o},r++));continue}const l=[];for(;t<s.length&&s[t].trim()&&!/^#{1,6}\s/.test(s[t])&&!/^[-*+]\s/.test(s[t])&&!/^\d+\.\s/.test(s[t])&&!s[t].startsWith("```")&&!(/^[-*_]{3,}\s*$/.test(s[t])&&!s[t].includes("|"))&&!/^>\s?/.test(s[t])&&!(T(s[t])&&t+1<s.length&&R(s[t+1]));)l.push(s[t]),t++;l.length?n.push(e.jsx("p",{className:"wiki-p",children:u(l.join(" "))},r++)):t++}return n}function he(s){if(!s)return{lead:null,body:""};const n=s.replace(/\r\n/g,`
`).replace(/\r/g,`
`),t=n.split(`
`);let r=-1;for(let l=0;l<t.length;l++)if(/^---\s*$/.test(t[l])){r=l;break}if(r<0)return{lead:null,body:n};const i=t.slice(0,r).join(`
`).trim(),a=t.slice(r+1).join(`
`).trim();return{lead:i||null,body:a||""}}function E(s){if(!s)return[];const n=s.replace(/\r\n/g,`
`).replace(/\r/g,`
`);return ce(n.split(`
`))}function pe({children:s}){return e.jsxs("div",{className:"docs-widget docs-widget-callout docs-widget-callout--tip",children:[e.jsx(X,{size:18}),e.jsx("div",{className:"docs-widget-callout__body",children:s})]})}function W({children:s}){return e.jsxs("div",{className:"docs-widget docs-widget-callout docs-widget-callout--info",children:[e.jsx(Y,{size:18}),e.jsx("div",{className:"docs-widget-callout__body",children:s})]})}function ue(){const s=[{kind:"live",tone:"ok",label:"Watching",sub:"Charts while you watch",Icon:H},{kind:"scanned",tone:"info",label:"Scanning",sub:"Logs, Issues, crashes",Icon:b},{kind:"report",tone:"info",label:"Support",sub:"Zip when you ask",Icon:k}];return e.jsx("div",{className:"docs-widget docs-widget--flow","aria-hidden":!0,children:s.map((n,t)=>e.jsxs(p.Fragment,{children:[e.jsxs("div",{className:`docs-widget-flow__node docs-widget-flow__node--${n.kind}`,children:[e.jsx("span",{className:"docs-widget-flow__icon",children:e.jsx(n.Icon,{size:18})}),e.jsx(N,{tone:n.tone,children:n.label}),e.jsx("span",{className:"docs-widget-flow__sub",children:n.sub})]}),t<s.length-1?e.jsx("span",{className:"docs-widget-flow__arrow","aria-hidden":!0,children:"→"}):null]},n.kind))})}function D(){const s=[{kind:"live",tone:"ok",Icon:y,label:"Watching",value:"Just now",hint:"Charts while the server runs"},{kind:"scanned",tone:"info",Icon:b,label:"Scanning",value:"42s ago",hint:"About once a minute on the server"},{kind:"report",tone:"info",Icon:k,label:"Support compose",value:"On demand",hint:"Rail Build support pack, Overview, or Help Center"},{kind:"neutral",tone:"neutral",Icon:Q,label:"Optional schedule",value:"Off",hint:"watchtower.conf /watchtower schedule",muted:!0}];return e.jsxs("div",{className:"docs-widget docs-widget--freshness",children:[e.jsxs("p",{className:"docs-widget__caption",children:["Example — open the ",e.jsx("strong",{children:"Sources"})," tab for real times on your server"]}),e.jsx("div",{className:"docs-widget-freshness",children:s.map(n=>e.jsxs("article",{className:`docs-widget-freshness__card docs-widget-freshness__card--${n.kind}`,children:[e.jsxs("div",{className:"docs-widget-freshness__top",children:[e.jsx("span",{className:"docs-widget-freshness__icon",children:e.jsx(n.Icon,{size:18})}),n.muted?null:e.jsx(N,{tone:n.tone,children:n.kind==="live"?"Watching":n.kind==="scanned"?"Scanning":"Support"})]}),e.jsx("span",{className:"docs-widget-freshness__label",children:n.label}),e.jsx("span",{className:"docs-widget-freshness__value",children:n.value}),e.jsx("span",{className:"docs-widget-freshness__hint",children:n.hint})]},n.label))})]})}function ge(){const s=[{label:"Monitor",tabs:["Overview","Live","Insights","Session","Startup"]},{label:"Triage",tabs:["Issues","Crashes","Logs","Spark"]},{label:"Ops",tabs:["Mods","Backups","Activity","Sources"]},{label:"System",tabs:["Help Center","Settings","Theme","Collapse"]}];return e.jsx("div",{className:"docs-widget docs-widget--rail","aria-hidden":!0,children:s.map(n=>e.jsxs("div",{className:"docs-widget-rail__group",children:[e.jsx("span",{className:"docs-widget-rail__label",children:n.label}),e.jsx("div",{className:"docs-widget-rail__tabs",children:n.tabs.map(t=>e.jsx("span",{className:"docs-widget-rail__tab",children:t},t))})]},n.label))})}function we(){return e.jsxs("div",{className:"docs-widget docs-widget--config",children:[e.jsxs("article",{className:"docs-widget-config__card",children:[e.jsxs("div",{className:"docs-widget-config__head",children:[e.jsx(F,{size:16}),e.jsx("code",{children:"config/watchtower-server.toml"})]}),e.jsxs("p",{children:[e.jsx("strong",{children:"Needs a server restart."})," Dashboard port and how often live charts refresh."]}),e.jsxs("ul",{children:[e.jsx("li",{children:"dashboardBindHost"}),e.jsx("li",{children:"liveSampleIntervalSeconds"}),e.jsx("li",{children:"liveRetentionHours"})]})]}),e.jsxs("article",{className:"docs-widget-config__card",children:[e.jsxs("div",{className:"docs-widget-config__head",children:[e.jsx($,{size:16}),e.jsx("code",{children:"watchtower/watchtower.conf"})]}),e.jsxs("p",{children:[e.jsx("strong",{children:"Change in Settings — no restart."})," Warning levels, backup paths, and related conf keys."]}),e.jsxs("ul",{children:[e.jsx("li",{children:"REPORT_INTERVAL_MINUTES"}),e.jsx("li",{children:"OPS_LOG_SCAN_SEC"}),e.jsx("li",{children:"BACKUP_DIRS"})]})]})]})}function me(){const s=[{Icon:O,title:"Sign in",body:e.jsxs(e.Fragment,{children:["First time: ",e.jsx("code",{children:"watchtower"})," / ",e.jsx("code",{children:"password"})," — you will be asked to pick a new password."]})},{Icon:O,title:"Turn on 2FA",body:e.jsxs(e.Fragment,{children:[e.jsx("strong",{children:"Settings → Security"})," — scan the QR code with an authenticator app on your phone."]})},{Icon:F,title:"Public server?",body:"Do not expose the dashboard to the internet. Use localhost plus a secure tunnel (SSH) instead."}];return e.jsx("div",{className:"docs-widget docs-widget--steps",children:s.map((n,t)=>e.jsxs("div",{className:"docs-widget-step",children:[e.jsx("span",{className:"docs-widget-step__num",children:t+1}),e.jsxs("div",{className:"docs-widget-step__body",children:[e.jsxs("h4",{className:"docs-widget-step__title",children:[e.jsx(n.Icon,{size:14}),n.title]}),e.jsx("p",{children:n.body})]})]},n.title))})}function fe(){const s=[{Icon:A,label:"Server will not start"},{Icon:Z,label:"Run recovery tool"},{Icon:M,label:"Get a zip bundle"},{Icon:x,label:"Open in your browser"}];return e.jsx("div",{className:"docs-widget docs-widget--dr","aria-hidden":!0,children:s.map((n,t)=>e.jsxs(p.Fragment,{children:[e.jsxs("div",{className:"docs-widget-dr__node",children:[e.jsx(n.Icon,{size:18}),e.jsx("span",{children:n.label})]}),t<s.length-1?e.jsx("span",{className:"docs-widget-dr__arrow",children:"→"}):null]},n.label))})}function ve(){const s=[{Icon:b,title:"Watching + Scanning",sub:"Charts and continuous Issues without homework"},{Icon:y,title:"Live dashboard",sub:"See speed, lag, CPU, and memory — with history"},{Icon:k,title:"Fix list",sub:"What to tackle first from continuous Scanning"},{Icon:ee,title:"Support compose",sub:"Zip when you need to share with your host"}];return e.jsx("div",{className:"docs-widget docs-widget--features",children:s.map(n=>e.jsxs("article",{className:"docs-widget-feature",children:[e.jsx("span",{className:"docs-widget-feature__icon",children:e.jsx(n.Icon,{size:20})}),e.jsx("h4",{className:"docs-widget-feature__title",children:n.title}),e.jsx("p",{className:"docs-widget-feature__sub",children:n.sub})]},n.title))})}function ye(s){switch(s){case"Home":return e.jsx(ve,{});case"Understanding-Data-Sources":return e.jsxs(e.Fragment,{children:[e.jsx(ue,{}),e.jsx(D,{})]});case"Dashboard-Overview":case"Dashboard-Tabs":return e.jsx(ge,{});case"Configuration":return e.jsx(we,{});case"Security-and-Access":return e.jsx(me,{});case"Disaster-Recovery":return e.jsx(fe,{});case"Quick-Start-Checklist":return e.jsx(pe,{children:e.jsxs("p",{children:["Work through the list below in order — about ",e.jsx("strong",{children:"15 minutes"})," for a solid start. Checkboxes are for your notes (they are not saved)."]})});case"Live-Charts":return e.jsx(W,{children:e.jsxs("p",{children:[e.jsx("strong",{children:"Tip:"})," On ",e.jsx("strong",{children:"Live"}),", the vitals range goes from"," ",e.jsx("strong",{children:"5 minutes"})," up to ",e.jsx("strong",{children:"30 days"})," (within saved history)."," ",e.jsx("strong",{children:"Overview"})," uses a quick ",e.jsx("strong",{children:"1h / 6h / 24h"})," picker."]})});case"Sources":return e.jsx(D,{});case"HTTP-API":return e.jsx(W,{children:e.jsxs("p",{children:[e.jsx("strong",{children:"For developers."})," Most endpoints need you to be logged in. Base URL:"," ",e.jsx("code",{children:"http://<your-server>:8787"})]})});default:return null}}const z=[{id:"quick-start",Icon:B,title:"Quick start",body:"Solid first setup in about 15 minutes.",wiki:"Quick-Start-Checklist"},{id:"install",Icon:U,title:"Installation",body:"Drop the mod in, open the dashboard.",wiki:"Installation"}],J=[{id:"data-sources",Icon:b,title:"Data sources",body:"Watching, Scanning, Support — and the Sources tab.",wiki:"Understanding-Data-Sources"},{id:"tabs",Icon:se,title:"Dashboard tabs",body:"Rail map — when to open each tab.",wiki:"Dashboard-Tabs"},{id:"overview",Icon:I,title:"Overview",body:"Health grade, vitals, and what needs attention.",wiki:"Dashboard-Overview"},{id:"live-charts",Icon:y,title:"Live charts",body:"TPS, tick lag, heap, and players right now.",wiki:"Live-Charts"},{id:"insights",Icon:I,title:"Insights",body:"Patterns, configs, mod churn, and storage trends.",wiki:"Insights"},{id:"session",Icon:y,title:"Session",body:"Who is online, peaks, and the player directory.",wiki:"Session"},{id:"startup",Icon:B,title:"Startup",body:"Last boot verdict, phases, and history.",wiki:"Startup"},{id:"health-reports",Icon:k,title:"Support packs",body:"Support packs and optional scheduled reports.",wiki:"Health-Reports"}],K=[{id:"issues",Icon:k,title:"Issues",body:"Fix inbox — what to tackle next.",wiki:"Issues"},{id:"crashes",Icon:A,title:"Crashes",body:"Fingerprint groups with Fix and Evidence.",wiki:"Crashes"},{id:"logs",Icon:x,title:"Logs",body:"Browse server logs with filters and search.",wiki:"Logs"},{id:"mods",Icon:U,title:"Mods",body:"Inventory, updates, conflicts, and forensics.",wiki:"Mods"},{id:"sources",Icon:b,title:"Sources",body:"Pollers, freshness, and next data pulls.",wiki:"Sources"},{id:"activity",Icon:y,title:"Activity",body:"Timeline of commands, joins, lag, and jobs.",wiki:"Activity"},{id:"backups",Icon:M,title:"Backups",body:"Folder health and heartbeat webhooks.",wiki:"Backups"},{id:"spark",Icon:H,title:"Spark profiler",body:"Attach profiles for deep lag analysis.",wiki:"Using-Spark-with-Watchtower"},{id:"security",Icon:O,title:"Security",body:"Passwords, 2FA, and dashboard access.",wiki:"Security-and-Access"},{id:"dr",Icon:A,title:"Disaster recovery",body:"When the server will not start.",wiki:"Disaster-Recovery"},{id:"troubleshooting",Icon:te,title:"Troubleshooting",body:"Common issues and fixes.",wiki:"Troubleshooting"}],be=[{title:"HTTP API",wiki:"HTTP-API",hint:"Endpoints for tooling"},{title:"Commands",wiki:"Commands",hint:"In-game / console"},{title:"On-disk files",wiki:"On-disk-Files",hint:"Config & data paths"},{title:"Configuration",wiki:"Configuration",hint:"TOML and .conf"},{title:"Crash rule packs",wiki:"Crash-Rule-Packs",hint:"Optional YAML matchers"},{title:"DR CLI",wiki:"DR-CLI-Reference",hint:"Recovery tool flags"},{title:"Changelog",wiki:"Changelog",hint:"What changed"}],ke=[...z,...J,...K];function Se(){window.dispatchEvent(new Event("wt:open-support"))}function g(s){w({tab:"docs",wiki:s})}function j({Icon:s,title:n,body:t,wiki:r}){return e.jsxs("button",{type:"button",className:"help-guide-card",onClick:()=>g(r),"aria-label":`Read: ${n}`,children:[e.jsx("span",{className:"help-guide-card__icon",children:e.jsx(s,{size:20})}),e.jsx("span",{className:"help-guide-card__title",children:n}),e.jsx("span",{className:"help-guide-card__body",children:t})]})}function _e(){const[s,n]=p.useState(""),t=p.useMemo(()=>{const a=s.trim().toLowerCase();if(!a)return[];const l=[];for(const o of m.nav)for(const d of o.pages)(d.title.toLowerCase().includes(a)||d.slug.toLowerCase().includes(a))&&l.push({...d,category:o.label});return l},[s]),r=p.useMemo(()=>{const a=s.trim().toLowerCase();return a?ke.filter(l=>l.title.toLowerCase().includes(a)||l.body.toLowerCase().includes(a)):null},[s]),i=s.trim().length>0;return e.jsxs("div",{className:"docs-hub",children:[e.jsxs("div",{className:"docs-hub__hero",children:[e.jsx("h2",{className:"docs-hub__title",children:"How can we help?"}),e.jsx("p",{className:"docs-hub__lead",children:"Learn how WatchTower watches your server — from first install to disaster recovery. Search guides below, or open the full article tree anytime."}),e.jsxs("div",{className:"docs-hub__search",children:[e.jsx(G,{size:16,className:"docs-hub__search-icon"}),e.jsx("input",{type:"search",className:"docs-hub__search-input",placeholder:"Search guides and articles…",value:s,onChange:a=>n(a.target.value),"aria-label":"Search documentation"})]})]}),i?e.jsx(v,{title:`Results (${(r?.length??0)+t.length})`,children:r?.length||t.length?e.jsxs("div",{className:"docs-hub-results",children:[r?.map(a=>e.jsxs("button",{type:"button",className:"docs-hub-result",onClick:()=>g(a.wiki),children:[e.jsx(a.Icon,{size:16}),e.jsx("span",{className:"docs-hub-result__title",children:a.title}),e.jsx("span",{className:"docs-hub-result__hint",children:a.body})]},a.id)),t.map(a=>e.jsxs("button",{type:"button",className:"docs-hub-result",onClick:()=>g(a.slug),children:[e.jsx(x,{size:16}),e.jsx("span",{className:"docs-hub-result__title",children:a.title}),e.jsx("span",{className:"docs-hub-result__hint",children:a.category})]},a.slug))]}):e.jsxs("p",{className:"docs-hub__empty",children:["No matches for “",s.trim(),"”."]})}):e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"help-actions",children:[e.jsxs("div",{className:"help-actions__card",children:[e.jsx(ae,{size:22}),e.jsxs("div",{className:"help-actions__card-text",children:[e.jsx("strong",{children:"Welcome tour"}),e.jsx("p",{children:"Reopen the setup walkthrough from Settings → About."})]}),e.jsx(C,{kind:"default",onClick:()=>w({tab:"settings",panel:"about"}),children:"Open About"})]}),e.jsxs("div",{className:"help-actions__card",children:[e.jsx(x,{size:22}),e.jsxs("div",{className:"help-actions__card-text",children:[e.jsx("strong",{children:"Browse all articles"}),e.jsx("p",{children:"Open the wiki from Home."})]}),e.jsx(C,{kind:"default",onClick:()=>g("Home"),children:"Open Home"})]}),e.jsxs("div",{className:"help-actions__card",children:[e.jsx(oe,{size:22}),e.jsxs("div",{className:"help-actions__card-text",children:[e.jsx("strong",{children:"Support pack"}),e.jsx("p",{children:"Build a redacted zip when something’s wrong."})]}),e.jsx(C,{kind:"default",onClick:Se,children:"Build pack"})]})]}),e.jsx(v,{title:"Get started",children:e.jsx("div",{className:"help-guide-grid",children:z.map(a=>e.jsx(j,{...a},a.id))})}),e.jsx(v,{title:"Learn the dashboard",children:e.jsx("div",{className:"help-guide-grid",children:J.map(a=>e.jsx(j,{...a},a.id))})}),e.jsx(v,{title:"Ops & recovery",children:e.jsx("div",{className:"help-guide-grid",children:K.map(a=>e.jsx(j,{...a},a.id))})}),e.jsx(v,{title:"Reference",children:e.jsx("div",{className:"docs-hub-ref",children:be.map(a=>e.jsxs("button",{type:"button",className:"docs-hub-ref__item",onClick:()=>g(a.wiki),children:[e.jsx("span",{className:"docs-hub-ref__title",children:a.title}),e.jsx("span",{className:"docs-hub-ref__hint",children:a.hint}),e.jsx(re,{size:14,className:"docs-hub-ref__chev"})]},a.wiki))})})]})]})}function Ce(s){const n=[];for(const t of s)for(const r of t.pages)n.push(r);return n}function xe({activeSlug:s,search:n,onSearch:t,onSelect:r,onHome:i}){const a=p.useMemo(()=>{if(!n.trim())return m.nav;const l=n.toLowerCase();return m.nav.map(o=>({...o,pages:o.pages.filter(d=>d.title.toLowerCase().includes(l)||d.slug.toLowerCase().includes(l))})).filter(o=>o.pages.length>0)},[n]);return e.jsxs("nav",{className:"docs-nav","aria-label":"Documentation navigation",children:[e.jsxs("button",{type:"button",className:"docs-nav__home",onClick:i,children:[e.jsx(I,{size:14}),"Help home"]}),e.jsxs("div",{className:"docs-nav__search",children:[e.jsx(G,{size:14,className:"docs-nav__search-icon"}),e.jsx("input",{type:"search",className:"docs-nav__search-input",placeholder:"Search docs…",value:n,onChange:l=>t(l.target.value),"aria-label":"Search documentation"})]}),e.jsx("div",{className:"docs-nav__tree",children:a.length===0?e.jsx("p",{className:"docs-nav__empty",children:"No results"}):a.map(l=>e.jsxs("div",{className:"docs-nav__group",children:[e.jsx("div",{className:"docs-nav__group-label",children:l.label}),l.pages.map(o=>e.jsx("button",{type:"button",className:`docs-nav__item${o.slug===s?" docs-nav__item--active":""}`,onClick:()=>r(o.slug),"aria-current":o.slug===s?"page":void 0,children:o.title},o.slug))]},l.id))})]})}function Ie({slug:s}){const n=m.pages[s],t=p.useMemo(()=>Ce(m.nav),[]),r=t.findIndex(f=>f.slug===s),i=r>0?t[r-1]:null,a=r>=0&&r<t.length-1?t[r+1]:null;if(!n)return e.jsxs("div",{className:"docs-article docs-article--missing",children:[e.jsx("h2",{className:"docs-article__title",children:"Page not found"}),e.jsxs("p",{children:["No wiki page found for ",e.jsx("code",{children:s}),"."]}),e.jsx(C,{kind:"default",onClick:()=>w({tab:"docs",wiki:null}),children:"Back to Help home"})]});const{lead:l,body:o}=he(n.markdown);let d=o||n.markdown;const c=d.match(/^#\s+(.+)\n?/);c&&c[1].trim()===n.title&&(d=d.slice(c[0].length).replace(/^\n+/,""));let h=l;if(h){const f=h.match(/^#\s+(.+)\n?/);f&&f[1].trim()===n.title&&(h=h.slice(f[0].length).trim()||null)}const S=ye(s),_=h?E(h):null,q=E(d);return e.jsxs("article",{className:"docs-article","aria-label":n.title,children:[e.jsxs("header",{className:"docs-article__header",children:[e.jsxs("button",{type:"button",className:"docs-article__back",onClick:()=>w({tab:"docs",wiki:null}),children:[e.jsx(I,{size:14}),"Help home"]}),e.jsx("h2",{className:"docs-article__title",children:n.title}),e.jsxs("a",{href:`https://github.com/djinnbanter/WatchTower/wiki/${n.slug}`,target:"_blank",rel:"noreferrer",className:"docs-article__ext",children:["GitHub wiki ",e.jsx(ie,{size:13})]})]}),S?e.jsx("div",{className:"docs-article__widgets",children:S}):null,_?e.jsx("div",{className:"docs-article__lead wiki-content",children:_}):null,e.jsx("div",{className:"docs-article__body wiki-content",children:q}),e.jsxs("nav",{className:"docs-article__pager","aria-label":"Adjacent articles",children:[i?e.jsxs("button",{type:"button",className:"docs-article__pager-btn docs-article__pager-btn--prev",onClick:()=>g(i.slug),children:[e.jsx("span",{className:"docs-article__pager-label",children:"Previous"}),e.jsx("span",{className:"docs-article__pager-title",children:i.title})]}):e.jsx("span",{}),a?e.jsxs("button",{type:"button",className:"docs-article__pager-btn docs-article__pager-btn--next",onClick:()=>g(a.slug),children:[e.jsx("span",{className:"docs-article__pager-label",children:"Next"}),e.jsx("span",{className:"docs-article__pager-title",children:a.title})]}):e.jsx("span",{})]})]})}function Re({route:s}){const n=s.wiki??"",[t,r]=p.useState(""),i=m.nav.length>0;return n?i?e.jsxs(P,{className:"docs-shell",children:[e.jsx(xe,{activeSlug:n,search:t,onSearch:r,onSelect:a=>{g(a),r("")},onHome:()=>w({tab:"docs",wiki:null})}),e.jsx("div",{className:"docs-content",children:e.jsx(Ie,{slug:n})})]}):e.jsxs(ne,{title:"Documentation not built",children:["Run ",e.jsx("code",{children:"npm run build:wiki"})," to generate the wiki bundle."]}):e.jsx(P,{children:e.jsx(_e,{})})}export{Re as PageView};
