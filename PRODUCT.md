# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are Minecraft dedicated-server admins — solo operators and small teams sharing one server’s ops desk. Day-to-day they open WatchTower when something feels wrong (lag, crash, failed join, disk pressure, odd shutdown) or for a regular check that the machine is healthy. Audience spans any and all MC admins/teams on supported platforms; multi-server fleet is a later product bet, not the current UI’s primary scene.

## Product Purpose

WatchTower answers two questions on a modded dedicated server: **is the server okay right now?** and **what should I fix next?** It is a local ops dashboard that watches while the game runs, turns lag / crashes / mods / backups / world pressure into plain next steps, and keeps data on the host. Success means an admin can triage without bouncing between the host panel, `latest.log`, crash folders, and backup paths — and without needing a cloud account.

## Positioning

Runs **on the machine** as a jar in `mods/` plus an embedded web dashboard (and an optional CLI when Minecraft won’t boot). Neighboring tools either replace the host panel, do player analytics, or require a cloud service; WatchTower does none of those. Mechanism: continuous Watching + Scanning into a Fix inbox and Insights, with Support packs when you need to share evidence — not scheduled “deep audit homework” as the daily path.

## Operating Context

- NeoForge dedicated servers (primary: **1.21.x**, Java **21**); Linux dedicated hosts common; hosted panels (Pterodactyl, Crafty, AMP, etc.) coexist but are not replaced.
- Browser dashboard typically `http://<server-ip>:8787` (prefer localhost / SSH tunnel; do not expose 8787 to the open internet).
- Local disk under the server’s `watchtower/` folder (ops-cache, state, Spark uploads, support zips).
- Optional companion tooling: [Spark](https://modrinth.com/mod/spark) for lag proof; Modrinth lookups for mod identity/updates (never downloads jars for the operator).
- Rituals: first-run wizard (account → options → Initial discovery → backups → security); day-to-day Overview / Live / Issues / Crashes; Support pack when sharing with a helper or mod author; CLI disaster-recovery when the game process won’t stay up.

## Capabilities and Constraints

**Confirmed capabilities (shipped product surface):** Overview (grade, vitals, attention, restart advice), Live charts, Issues Fix inbox, Crashes, Mods (+ optional Modrinth), Insights (Schedule, Load, World pressure, Storage, Digest, Configs, …), Session, Startup, Logs, Backups, Activity, Sources, Spark workspace (alpha depth), Support Bundle Builder, Settings (incl. timezone preference, monitoring toggles), Help Center / in-app wiki, Roadmap tab, login + optional 2FA, disaster-recovery CLI/viewer.

**Hard constraints future UI/product work must honor:**

- Local-first: no required cloud account; no telemetry / log upload by default (opt-in diagnostics or future Cloud are explicit and separate).
- Advisory ops desk: does **not** restart the server, schedule restarts, kill entities/unload chunks, or quietly edit mods/worlds; Modrinth path does **not** download jars.
- Not player analytics / GeoIP / retention surveillance; online roster during lag/crash is ops triage only.
- Does not replace host panels (start/stop, files, console) or client GPU crash tooling.
- Kill-switches and conf keys for many detectors live in `watchtower.conf`; UI should not imply irreversible automation where the product is read-only.

**Undecided (do not invent):** exact fleet / Watchtower Cloud UX; Fabric and NeoForge 1.20.x shipping shape; how aggressive guided “apply settings” becomes when that ships.

## Brand Commitments

- **Name spelling:** **WatchTower** (product mark); avoid “Watchtower” as the display brand in UI chrome where the official spelling applies.
- **Mark:** lantern / stone-tower logo — keep `watchtower-logo` (and light variant) assets; night-watch / sentinel ops personality, not playful consumer SaaS.
- **Voice:** plain-English ops — concrete next steps, honest confidence, no inflated marketing.
- **Anti-pattern binding:** no generic “AI SaaS” chrome (periwinkle-on-glass clichés, sparkle spam, empty hero marketing, fake significance copy). Brand lives in precise instrument-panel details.
- Public positioning already published in `README.md` and `docs/ROADMAP.md` (“Promises that don’t change”, “Not our job”).

## Evidence on Hand

- Product copy and promises: `README.md`, `docs/ROADMAP.md`, GitHub wiki / `docs/wiki/`.
- Screenshots: `docs/assets/screenshots/` (Overview, Live, Insights, Mods, Issues, Crashes, Spark, Backups, …).
- Logo assets: dashboard build assets `watchtower-logo.png` / `watchtower-logo-light.png` (see `web/dashboard` static/copy pipeline).
- Release history: `CHANGELOG.md` (incl. Unreleased + 1.1.3–1.1.9 detail).
- Do **not** fabricate testimonials, download counts beyond badges, or customer quotes not in-repo.

## Product Principles

1. **Triage over spectacle** — every screen should make “what’s wrong / what next” faster; decoration never outranks scanability.
2. **Local trust** — data stays on the host; network features are opt-in and labeled; redaction is part of Support, not an afterthought.
3. **Advise, don’t seize control** — recommend restarts, RAM, jar checks, and quiet windows; never silently mutate the server or pack.
4. **Plain English over jargon** — prefer operator language; technical ids/kill-switches stay available without owning the primary copy.
5. **Stay in the ops lane** — don’t become a host panel, analytics suite, or cloud-required product; defer fleet/Cloud as optional later bets.

## Accessibility & Inclusion

Target **WCAG 2.2 AA** for the web dashboard: keyboard operable primary flows, visible focus, sufficient contrast (including charts/status colours vs channel colours), and respect for `prefers-reduced-motion`. Dashboard is used under stress (outages at odd hours); clarity and contrast outrank novelty.
