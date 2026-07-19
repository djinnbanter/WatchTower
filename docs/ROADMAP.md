# Watchtower roadmap

**Know what's happening on your server — and exactly what to do next.**

Watchtower is a live ops command center for your modded Minecraft server: real-time dashboard, health reports, crash intelligence, and disaster recovery — **all running on your own machine.** No cloud account. No analytics database. Nothing leaves your server.

This page is where we get you hyped about what's coming. Below is everything on the workbench — grouped by what it does for *you*, the person keeping the server alive.

**Runs on:** NeoForge **1.21.x** today · Fabric and NeoForge **1.20.x** on the way  
[Get it on Modrinth](https://modrinth.com/mod/watchtower) · [Changelog](../CHANGELOG.md) · [Installation](https://github.com/djinnbanter/WatchTower/wiki/Installation)

---

## What you already get

The dashboard is live and packed today:

- **Live dashboard** (`:8787`) — TPS, MSPT, CPU, memory, and players updating second by second
- **Crash intelligence** — parses crashes, names the mod at fault, and tells you the fix in plain English
- **Smart mod list** — Create-aware protection, Modrinth lookups, dependency trees, client-vs-server detection
- **Health reports & scorecards** — scheduled or on demand, with a full prioritized fix queue
- **Performance Insights** — busy vs quiet hours, heatmaps, sticky-lag detection, CSV export
- **Spark integration** — turn a profile into per-mod "what ate the tick" answers
- **Disaster recovery** — CLI + browser viewer to diagnose a server that won't boot
- **Backups, Sessions, Activity, Logs, Docs** — the whole ops picture in one place
- **Secure by default** — login, optional 2FA, hosted-panel-aware metrics, honest trust badges

Everything below builds on this. Now for the fun part.

---

## Coming next — the vision

### Never get caught off guard by lag again

The dream: your server tells *you* what's wrong before you even go looking.

- **Lag auto-forensics** — the instant your server stutters, Watchtower fires off a profile automatically and hands you the culprit mod. No more "I have to be watching at the exact moment it lags" — it catches the moment for you.
- **Entity & chunk hotspot radar** — that laggy farm, that runaway chunk loader, that mob grinder someone built overnight — spotted and mapped, separate from mod lag.
- **Baseline & regression alerts** — Watchtower learns what "normal" looks like on *your* server and pings you the moment it drifts: *"You're running 15% slower than usual — and it started Tuesday."*

### Stop guessing about RAM and settings

Save real money and real headaches.

- **The "do I actually need more RAM?" answer** — a plain-English read on GC, heap pressure, JVM flags, and Java version that tells you whether more RAM will help… or whether you're about to waste money on it.
- **RAM right-sizing** — see what your server *actually* uses and stop paying for headroom you never touch.
- **Launch & config coach** — a friendly review of your `server.properties` and startup flags: keep this, tweak that, here's why.
- **Guided one-click fixes** — for the settings that are safe to change, apply the fix from the dashboard with a preview and instant undo. No terminal, no fear.

### One glance, total confidence

Less clicking around, more knowing.

- **"Safe to restart?"** — one button before you type `/stop` that checks your backups, pregen, and who's mid-adventure, so a routine restart never becomes a disaster.
- **The incident story** — instead of piecing together four tabs at 2 AM, get one clean timeline: *"Lag spike → crash (Create) → backup missed because the server was down."*
- **Know why it *really* died** — tell a genuine mod crash apart from an out-of-memory kill or a host/panel watchdog timeout, so you fix the actual cause instead of chasing the wrong mod.
- **Weekly digest** — a friendly recap: your grade, crashes, disk trend, and the single most useful thing to do next.
- **Disk runway** — not just "82% full," but *"about 12 days left at this rate"* — with the dimension that's eating it.

### Keep your mods healthy

Your modpack, under control.

- **Did that update help or hurt?** — every mod update gets a before/after performance report, so you actually know if it was worth it.
- **Tamper & corruption detection** — catch a jar that quietly changed without a version bump: a corrupted upload, a bad restore, an unexpected swap.
- **Bigger mod brain** — CurseForge lookups joining the existing Modrinth smarts for even better coverage.
- **Shareable crash-rule packs** — export your hard-won fixes and swap them with other admins running the same pack. Community knowledge, no cloud required.

### Built for teams and communities

Because most servers aren't a one-person show.

- **Real admin accounts** — give every co-admin their own login instead of one shared password, with a log of who changed what.
- **A public status page** — a clean "are we up?" page you can drop in your Discord, without ever exposing your dashboard.
- **"Copy for Discord"** — a tidy, auto-redacted summary for support channels, so asking for help takes ten seconds, not ten screenshots.
- **Maintenance windows** — schedule restarts and stop them being reported as scary "unexpected outages."

### Check in from anywhere

- **Mobile glance view** — a fast, phone-friendly health check you can pin to your home screen. Peace of mind from the bus stop.

---

## Bigger horizons

The larger bets we're building toward:

- **Fleet command** — running more than one server? See TPS, crashes, and backups for your *entire* network in a single view, without opening a dozen ports. Proxy-network aware, so Velocity/Bungee setups map their backends automatically.
- **Alerts that reach you** — Discord and webhook notifications for crashes, lag, stale backups, and pregen stalls, so you don't have to keep the dashboard open to stay in the loop.
- **More platforms** — a Fabric build and a NeoForge **1.20.x** build, same dashboard and workflow, so more packs get to play.

---

## Always true, no matter what ships

- **Your data stays yours** — everything runs on your server. No telemetry, no log uploads, no accounts we hold.
- **You're in control** — network features are opt-in, fixes are previewed and undoable, and Watchtower will never quietly change your world or your mods.
- **Ops, not surveillance** — Watchtower helps you *run* the server. Player retention analytics, GeoIP, and leaderboards aren't our thing — [Plan](https://www.playeranalytics.net/) already does those well.

---

## Help shape it

This roadmap is a conversation, not a contract — the loudest, most-wanted ideas move to the front of the line.

- **Vote and request:** [GitHub Issues](https://github.com/djinnbanter/WatchTower/issues)
- **Get it running:** [Installation](https://github.com/djinnbanter/WatchTower/wiki/Installation) · [Troubleshooting](https://github.com/djinnbanter/WatchTower/wiki/Troubleshooting)

*Releases ship when they're ready — no fake dates, no vaporware. When something lands, you'll see it in the [Changelog](../CHANGELOG.md).*
