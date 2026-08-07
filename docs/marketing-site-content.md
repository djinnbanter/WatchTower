# WatchTower marketing site — content dump

Source package: `web/marketing` (Next.js App Router).  
Pulled from content modules and live page copy as of 2026-08-06.

---

## Summary

### What it is

The public marketing site for **WatchTower** — a local-first ops / incident-triage mod with an embedded web dashboard for NeoForge dedicated Minecraft servers. The site’s job is to persuade a skeptical admin to understand the product, try the interactive demo, and install the jar from Modrinth or GitHub.

### What it is showing

- A **feature-first “Shift Log” desk tour** on the home page: Welcome → Live → Issues → Crashes → Overview → Insights → End of shift, with left-column product teaching and right-side dashboard mocks on baked fixtures.
- Secondary pages for **How it works** (collect → analyze → advise pipeline), **Features** (capability catalog), **Install** (three steps + default login warning), **FAQ**, and a **Demo** interstitial for the real dashboard UI on sample data.
- Product truth only: local-first, advisory (no auto-restart), no required cloud, Modrinth as lookup/hints only, GPL free forever on the host.
- Primary CTAs: **Open the demo**, **Get it on Modrinth**.

### Target audience

Skeptical **Minecraft dedicated-server admins** — mostly solo or small-team ops — who want a straight answer to “is the server okay?” and “what should I fix next?” They already use (or sit beside) host panels like Pterodactyl / Crafty / AMP / bare metal. They are not looking for player analytics, a second control panel, or a cloud-required SaaS.

---

## Site chrome

### Meta

- **Default title:** WatchTower  
- **Title template:** `%s · WatchTower`  
- **Description:** tagline + hero overview (see Home → Welcome)

### Primary nav

- How it works  
- Features  
- Install  
- FAQ  
- Social: Modrinth, GitHub  
- CTA: Open the demo  

### Footer

**Blurb:** Local ops dashboard for Minecraft dedicated servers. Runs as a jar on the same machine as the game.

**Product links:** How it works · Features · Install · Demo · FAQ  

**Project links:** Modrinth · GitHub · Wiki · License  

**Footnote:** Free forever on your machine. GPL-3.0-or-later. Runs where the server runs.

### Shared CTAs

- Open the demo  
- Get it on Modrinth  

### Links

| Label | URL |
| --- | --- |
| Modrinth | https://modrinth.com/mod/watchtower |
| GitHub | https://github.com/djinnbanter/WatchTower |
| Releases (latest) | https://github.com/djinnbanter/WatchTower/releases/latest |
| Wiki | https://github.com/djinnbanter/WatchTower/wiki |
| Installation wiki | https://github.com/djinnbanter/WatchTower/wiki/Installation |
| Disaster Recovery wiki | https://github.com/djinnbanter/WatchTower/wiki/Disaster-Recovery |
| License | https://github.com/djinnbanter/WatchTower/blob/main/LICENSE |

---

## Home (`/`) — Shift Log desk tour

Story order: Welcome → Live vitals → Issues Fix inbox → Crashes / OOM review → Overview grade → Insights schedule → demo close.

### Welcome

- **Status:** Live · watching (or Process stopped)  
- **Brand:** WatchTower  
- **Tagline:** What's happening on your Minecraft server, and what to do next.  
- **Overview:** Local ops dashboard for a NeoForge dedicated server. Watches while the game runs, then tells you what to fix. No cloud account. Data stays on the host.  
- **Context strip:** Local-first · dedicated host · no cloud required  
- **CTAs:** Open the demo · Get it on Modrinth · Install  
- **Scroll cue:** Scroll into Live  

*(Also in content module, unused on current Welcome surface: `SUPPORT_LINE` — Local ops dashboard for a dedicated host. Watches while the game runs. Data stays on that machine.)*

### Live

- **Capability:** TPS, lag, memory, players, and host load on charts while the server runs. You do not need latest.log open for the basics.  
- **Note:** dashboard · Live  
- **Brings:**
  - **Game vitals** — TPS, MSPT, memory, and player count, with health colours on the numbers.  
  - **Host and storage** — CPU, disk, and Java heap as their own readouts.  
  - **Network, thermal, world jobs** — Bandwidth, thermals, and background world work when the server reports them.  
  - **Windows you pick** — From 5 minutes out to 30 days. Hover or drag for the exact time and value.  
- **Desk caption:** Live vitals · healthy band  

### Issues

- **Capability:** Ranked inbox for live finds, scan results, boot problems, and crash pointers. Pick a row, see what to do.  
- **Note:** dashboard · Issues  
- **Brings:**
  - **Active / Reviewed** — Open queue and a reviewed state. Reviewed clears the inbox; crash files and jars stay on disk.  
  - **Severity bands** — Critical, Warning, and Info. Jar drift, world pressure, join clinic, silent script fails, and more.  
  - **Fix and Details** — Fix tab for the next step. Details for the evidence. Links into Crashes, Mods, Live, and Sources.  
  - **Tools** — Inbox filters, including boot filters from Startup.  

### Crashes

- **Capability:** Crashes grouped by fingerprint, with Fix, Evidence, and Details tabs.  
- **Note:** dashboard · Crashes  
- **Brings:**
  - **Fingerprint groups** — Matching crash shapes stacked in one group.  
  - **Fix / Evidence / Details** — Next steps, linked stacks and files, then fingerprint metadata.  
  - **Odd shutdowns** — External kill and OOM entries when latest.log stops with no crash dump.  
  - **Reviewed stays on disk** — Mark reviewed clears the Review queue. Files stay under crash-reports/.  

### Overview

- **Capability:** First screen after login: health grade, needs-attention list, and jumps into the rest of the dashboard.  
- **Note:** dashboard · Overview  
- **Brings:**
  - **Health grade** — Letter grade from WatchTower signals, Strong through Poor.  
  - **Needs attention** — Short queue into Issues, crashes, backups, and related surfaces.  
  - **Restart advice** — Safe, Caution, or Wait. Advisory only. WatchTower does not restart the server.  
  - **Jump cards** — Shortcuts into performance insight, weekly digest, storage, Spark, and boot profile.  

### Insights

- **Capability:** Day and week views for busy hours, world pressure, storage trends, and a weekly digest.  
- **Note:** dashboard · Insights  
- **Brings:**
  - **Schedule** — Busy-hour and quiet-hour chart, plus a suggested restart window.  
  - **World pressure** — Live vs busy-hours p95, and the peak minute over 7d or 30d.  
  - **Storage and digest** — Disk trends on Storage, and a weekly ops digest from data already on the host.  
  - **Vs Live** — Live is the current second. Insights is the repeating pattern.  

### End of shift (close)

- **Eyebrow:** End of shift  
- **Headline:** Open the demo, then grab the jar.  
- **Body:** The demo is the real dashboard on sample fixtures. Click around first if you want, then install from Modrinth.  
- **CTAs:** Open the demo · Get it on Modrinth  
- **Footnote:** Free forever on your machine. GPL-3.0-or-later. Runs where the server runs.  

---

## How it works (`/how-it-works`)

**Lede:** WatchTower reads what the server is doing while it runs, then turns that into a short list of what to fix.

### Collect

| Node | Detail |
| --- | --- |
| Vitals | TPS, MSPT, heap, CPU, disk |
| Logs | latest.log tail, crash reports |
| Mods | Jar inventory, checksums |
| World | Chunk load, entity and item counts |
| Backups | Presence, age |

### Understand

- **Label:** Analysis engine  
- **Copy:** Looks for crashes, lag, overloaded worlds, and failed joins in that data, then writes a next step for each one.

### Advise

| Node | Detail |
| --- | --- |
| Fix inbox | Ranked issues, one next step each |
| Overview grade | Health grade, needs-attention list |
| Insights trends | Schedule, load, and storage over time |
| Support pack | Redacted bundle to share |

**Support pack peek labels:** facts.json (Redacted) · brief.md (Plain English) · evidence/ (Logs + crashes)

### Close (same as home)

End of shift · Open the demo, then grab the jar. · demo + Modrinth CTAs · footnote.

---

## Features (`/features`)

**Lede:** What ships under Overview, Live, Issues, and the rest. This is the catalog, not another walk through the home screens.

**Close line:** Open the demo on sample fixtures, or get the jar on Modrinth.

### Lead capabilities

| Title | Tag | Blurb |
| --- | --- | --- |
| Health grade + restart advice | Overview | Letter grade, reasons when it is not Strong, and Safe / Caution / Wait for a restart. Long uptime plus worse GC can point at a quiet maintenance window. WatchTower does not restart the server for you. |
| Fix inbox ranking | Issues | Watching and Scanning fill a ranked inbox. Each issue has a next step. You do not run a big scheduled audit to keep it useful. |
| Join / pack sync clinic | Session | Failed joins map to named mod diffs on Session. Player-safe copy of the fix. Read-only. No jar downloads. |
| World pressure | Insights | Entity, item, and chunk census for item storms, mob spikes, and unattended loaders. |
| Support pack redaction | Support | Build a redacted zip (facts, brief, evidence) for a helper or mod author. Discord copy presets match the pack. |

### Standard capabilities

| Title | Tag | Blurb |
| --- | --- | --- |
| Live vitals charts | Live | TPS, MSPT, players, heap, CPU, and host charts while you watch. Hosted-panel metrics stay honest about what they can see. |
| GC / JVM + RAM advice | Live | GC pause share of wall time, JVM flags profile, and RAM advice that uses your host or container memory limit. Not a one-size guess. |
| Crash fingerprints | Crashes | Crash reports grouped and explained in plain English, with nearby log lines for context. |
| External kill / OOM | Crashes | Host OOM killer vs panel force-kill when there is no crash report, plus which fix path to take. |
| Silent script fails | Issues | KubeJS, CraftTweaker, datapack, and /reload errors that never crash still show up as Issues. |
| Mod inventory + Modrinth hints | Mods | Installed jars, conflicts, Modrinth lookup hints, and mod log errors with Active / Reviewed. Modrinth never downloads jars for you. |
| Pack / jar drift | Mods | Checksum baseline drift and high-confidence client-only jars land on Issues. |
| Soft jar disable / enable | Mods | Rename a mod jar to `*.jar.disabled` so it skips the next boot (or rename it back). Filter All / Enabled / Disabled. High world risk asks you to confirm first. Admins only. No delete. |
| Mods → Configs | Mods | Edit files under the server `config/` folder from the dashboard. TOML gets a form when WatchTower can parse it; otherwise you edit the raw text. Saves create a backup and support undo. Admins only. |
| Schedule + load trends | Insights | Busy vs quiet hours so you plan restarts around actual load. Times follow the timezone you set in the dashboard. |
| Storage + disk runway | Insights | Dimension storage scan, plus roughly how many days of disk left. More than a percent-full bar. |
| Storage space map | Insights | Treemap of what is using disk. Drill into World, Logs, Mods, or Backups. |
| Weekly ops digest | Insights | Local rollup of grade, crashes, disk, and MSPT trend with one next action. Stays on your host. |
| Config audit | Insights | Read-only keep / tweak / why for server.properties and startup flags. |
| Spark lag proof *(alpha)* | Spark | Optional Spark companion turns a profile into what ate the tick. Deep Spark workspace is alpha. |
| Spark Map | Spark | Pan and zoom chunk heat from the selected Spark profile. Click a chunk for details. |
| Backup health | Backups | See whether local backups look present and fresh, then verify zip/tar.gz integrity. Optional test restore only under `watchtower/restore-verify/`. Never into the live world. |
| Activity / incident stories | Activity | Lag spikes, crashes, and missed backups pulled into one incident thread you can read. |
| Log tail | Logs | latest.log triage in the dashboard so you are not jumping to the host panel for every line. |
| Startup watch | Startup | First minutes and boot health when the process comes up. |
| Sources freshness | Sources | Poller freshness and which data pull is next, so you know if Watching is current. |
| Named accounts + audit log | Settings | Owner / admin / viewer logins, optional Minecraft player link on the side rail, Sign out, and a Settings audit log of account and settings changes. |
| Theme + accent | Settings | Light, Dark, Black, or System, plus an accent color. Saved per signed-in account. |
| Secure login + optional 2FA | Settings | Login required by default. Optional 2FA for the dashboard. |
| Help Center | Help | In-app wiki with the same guides as the public GitHub wiki. |
| Disaster-recovery CLI + viewer | CLI | Matching CLI jar and browser viewer when Minecraft will not stay up. |

---

## Install (`/install`)

**Eyebrow:** Three steps  

**Lede:** Drop the jar in `mods/`, restart, then open the dashboard. Longer notes are on the Installation wiki.

### 01 — Get the jar

Download the latest release from Modrinth or GitHub Releases.  
CTAs: Get it on Modrinth · GitHub  

### 02 — Drop it in mods/

Put the jar with your other server mods, then restart so NeoForge picks it up.

**Requirements:**

| Label | Value |
| --- | --- |
| Loader | NeoForge 1.21.x |
| Java | 21 |
| Host | Linux dedicated |

**Server path:** `mods/watchtower-….jar`

### 03 — Open the dashboard

Once the server is up, open the dashboard. Prefer localhost or an SSH tunnel. Don't expose port 8787 to the open internet.

**Local dashboard:** `http://127.0.0.1:8787`  
Hint: Change the default login when you first open it.

### First login

**Badge:** First login  
**Note:** Default login. Change it the first time you open the dashboard.

| Field | Value |
| --- | --- |
| User | `watchtower` |
| Password | `password` |

---

## FAQ (`/faq`)

**Eyebrow:** NN answers (count of items)  
**Lede:** Scope, trust, and what sits on the host. Written for dedicated-server admins.

### Scope — What WatchTower is, and what it leaves alone.

**Is WatchTower a host panel?**  
No. It won't start or stop the server, manage files, or replace the console. Keep Pterodactyl, Crafty, AMP, or bare metal for that. WatchTower sits beside them.

**Is this player analytics?**  
No. No retention, GeoIP, or leaderboards. Seeing who's online during lag or a crash is ops triage, not player tracking.

**Does it support Fabric?**  
Right now it ships for NeoForge 1.21.x on Java 21. Fabric is on the roadmap. We are not claiming Fabric support yet.

**Do I need Spark?**  
No. Spark is optional. Install it when you want lag profiles broken into next steps. The deep Spark workspace is still alpha.

**Does Modrinth download jars for me?**  
No. Modrinth is lookup and hints only. WatchTower never downloads mod jars for you.

### Trust — Control, data, and money.

**Do I need a cloud account?**  
No. WatchTower is local-first. Watchtower Cloud is a future paid option and is not required for the dashboard on your host.

**Does it upload my logs?**  
Not by default. No telemetry either. Data stays on the host. Anything that talks to the network is opt-in.

**Will it restart my server?**  
No. Overview can say Safe, Caution, or Wait. WatchTower only advises. It never restarts the server for you and never quietly edits mods or the world.

**Is it free?**  
The local dashboard stays free forever under GPL-3.0-or-later. Get the jar from Modrinth or GitHub Releases.

### On the host — Port, login, disk, and when the game will not boot.

**How do I open the dashboard safely?**  
After install it listens on port 8787. Prefer localhost or an SSH tunnel. Don't expose 8787 to the open internet. Default login is watchtower / password. Change it on first open.

**Where does my data live?**  
On the server, under the watchtower/ folder (ops-cache, state, Spark uploads, support zips). Nothing leaves the host unless you choose to share it.

**What if Minecraft won't boot?**  
Keep the matching CLI jar next to WatchTower in mods/. Run it with java -jar over SSH to build a local disaster-recovery bundle. It is not loaded as a Minecraft mod.

### FAQ foot

More detail on the wiki. Feature votes and bugs go on GitHub Issues.  
Links: Wiki · GitHub Issues · Install  

---

## Demo (`/demo`)

**Headline:** Demo  

**Lead:** Real WatchTower dashboard UI on sample fixtures. Open any tab. Clicks work; nothing is saved.

| Label | Copy |
| --- | --- |
| Data | Sample fixtures. Not your server. |
| Tabs | Every surface opens. |
| Live | No live Minecraft process behind it. |

CTAs: Open the demo (when `NEXT_PUBLIC_DEMO_URL` is set) · Get it on Modrinth  

---

## Content modules not currently on the home Shift Log

These live in `web/marketing/content` / section components and may appear in alternate layouts or unused entries.

### Two questions

1. **Is the server okay right now?** — Health grade, live vitals, and restart advice. WatchTower never restarts anything for you.  
2. **What should I fix next?** — Issues, crashes, mods, backups, and world pressure. Each row says what to do next.

### Watching / Scanning / Fix inbox loop

**Headline:** Watching feeds the fix inbox.  
**Support:** No daily homework report. The loop is already running while you play.  
**Badge:** Live loop  

| Label | Value | Blurb |
| --- | --- | --- |
| Watching | while the game runs | Runs the whole time the game does. |
| Scanning | logs, mods, crashes, disk | Logs, mods, crashes, and disk in the background. |
| Fix inbox | ranked, with next steps | Ranked findings. Each one has a next step. |

### Home showcases (bento highlights)

| Title | Blurb | Readout |
| --- | --- | --- |
| Charts while ticks land | TPS, lag, and memory while the server runs. Numbers first, decoration second. | tps / mspt / heap |
| Crash reports, grouped | Matching crashes stacked together with nearby log context, so you are not grepping latest.log at 2am. | grouped / explained |
| A fix inbox | Watching and scanning already found these. Each row has a next step. No daily audit report to remember to run. | ranked / next step |
| Week patterns | Busy hours, load, world pressure, storage, and a weekly digest. Useful after the bad minute is over. | schedule / load / storage / digest |

### Promises that don't change

1. **Your data stays yours** — Files stay on your server. We don't upload logs by default. Anonymous diagnostics and Cloud sync are opt-in.  
2. **You're in control** — Network features are opt-in. Risky actions show a preview and an undo. Nothing quietly edits your mods or world.  
3. **Ops, not surveillance** — Helps you run the server. Does not track players like an analytics product.  
4. **Drop-in beside your host** — A jar in mods/. Not a second control panel you have to keep running.

### Not our job

| We don't | Detail | Use instead |
| --- | --- | --- |
| Host panels | Start, stop, files, console | Pterodactyl, Crafty, AMP, bare metal |
| Player analytics | Retention, GeoIP, leaderboards | Plan and similar |
| Client GPU crash tooling | Graphics driver and renderer faults | Does not apply to headless dedicated servers |

**Section framing:** Not our job. / On purpose. Use the tools built for these jobs.  
**Standing orders entry framing:** Field manual · Standing orders. · Promises that stick, and work we refuse. · Boundaries  

---

## Voice / constraints (from site brief)

- Product truth only; display brand spelling **WatchTower**  
- No AI-SaaS chrome, no testimonials, no hardcoded versions in copy  
- Plain ops English for dedicated-server admins  
- Proof: real screenshots, interactive demo on baked fixtures, verbatim Promises / Not our job from `docs/ROADMAP.md`
