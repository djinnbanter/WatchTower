## Learned User Preferences

- Plan feature/version work first in deep detail; end with a plain-English summary of what the end user gets. Ask when unsure. Prefer `/writing-plans` / Small-LLM blueprints (1 step = 1 file = 1 action, anchors, checkboxes, circuit breaker) when a cheaper model will implement.
- When executing an attached plan: do not edit the plan file; use the existing todos (do not recreate them) and finish them.
- UI work should iterate on the current React dashboard identity — no full rip/rewrite. Keep Bklit + React Bits; cut generic SaaS / “AI-looking” chrome (over-rounding, glass/periwinkle clichés); make it feel like WatchTower’s own product.
- Motion should make the app feel alive (number flow, page enters, chart/bar growth), but Live charts must prioritize correctness and calm over flashy animation.
- Primary UX copy, crash explanations, changelogs, and release/marketing text should be plain English; use `/human-writing` or anti-AI humanizer when asked. Do not invent features that are not in the product or recent chats.
- Preview/mock data is how the user validates UI: keep fixtures realistic (numbers that add up, real Spark profiles, varied issues/mods) and update mock data when shipping visible features.
- File cleanups: reorganize and clarify the tree; do not delete files unless explicitly told.
- Do not invent new product behavior on ports/parity work — match existing behavior first, then polish visuals/motion.
- Competitive research (Crash Assistant, host panels, etc.) is welcome to find gaps; learn from gaps, do not copy code.
- Near-term platform order preference when expanding loaders: Fabric first, then newer MC lines (e.g. 26.x), then NeoForge 1.20.x backport; treat Watchtower Cloud as a dependency for multi-server fleet, not a substitute for the local dashboard.
- Packaging matters: after dashboard/feature work, verify the embedded JAR path — preview can look fine while the jar-served UI (wizard CSS, assets) is broken.

## Learned Workspace Facts

- Watchtower is a local-first ops/incident triage mod + embedded web dashboard for NeoForge dedicated servers (primary: 1.21.x / Java 21). It answers “is the server okay?” and “what should I fix next?” — not player analytics, not a host-panel replacement, not cloud-required.
- Repo layout: `watchtower-core`, `watchtower-neoforge-common`, `mods/neoforge-1.21` (+ `mods/neoforge-1.20`), `watchtower-cli` (DR when the game won’t boot), `web/dashboard` (current React+Vite UI embedded in the NeoForge JAR), `web/dashboard-archive` (legacy), `web/dr-viewer`, `tools/`, `samples/` + `fixtures/`.
- Runtime data lives under the server’s `watchtower/` folder (ops-cache, state, Spark uploads, support zips). Dashboard default port is **8787**; prefer localhost/SSH tunnel — do not expose 8787 to the open internet. Default login `watchtower` / `password` must be changed.
- Product constraints: advisory only (no auto-restart / silent world or mod mutation); Modrinth is lookup/hints only and never downloads jars; Spark is an optional companion for lag proof (deep Spark workspace still alpha); Support packs must redact consistently (facts/brief vs evidence).
- Daily path is continuous Watching/Scanning into Issues/Overview, not giant scheduled “deep audit homework.” Status can fragment across Overview grade, `issues_live`, brief/AT A GLANCE, and crash review state — keep those aligned.
- Brand/product sources of truth: `PRODUCT.md`; marketing `DESIGN.md` (Industrial Ops Print; Archivo Black + Inter + JetBrains Mono; hazard red / lantern); dashboard still Night Watch Desk in `docs/design/night-watch-desk-dashboard.md`. Display brand spelling in UI chrome: **WatchTower**. License: GPL-3.0-or-later. Public: Modrinth + GitHub `djinnbanter/WatchTower`.
- Maintainer roadmap lives under `docs/dev/roadmap/` (especially `versions/`); public promises/“Not our job” in `README.md` and `docs/ROADMAP.md`. Wiki sources under `docs/wiki/`.
- Local dashboard preview: `cd web/dashboard && npm ci && npm run preview` (Vite **:8081**). Packaging/parity audits: `tools/audit-dashboard-packaging.mjs`, `tools/audit-dashboard-parity.mjs`. Core tests: `./gradlew :watchtower-core:test :neoforge-1.21:build`.
- Heavy fixture use for analyzers/UI: Spark profiles, crash inbox, issues-live, join-clinic, world-pressure, external-kill, ops-cache samples under `samples/fixtures/` (and related `fixtures/`).
- Recurring feature areas in active development: Join/pack sync clinic, weekly ops digest, storage treemap, world pressure, external-kill/OOM postmortems, multi-admin roles/audit log, session activity, sidebar/rail account UX, Insights schedule trends.
