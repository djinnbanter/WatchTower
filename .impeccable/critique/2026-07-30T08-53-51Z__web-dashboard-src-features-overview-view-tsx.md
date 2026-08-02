---
target: Overview
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
p2_count: 2
timestamp: 2026-07-30T08-53-51Z
slug: web-dashboard-src-features-overview-view-tsx
---
# Critique — Overview (`web/dashboard/src/features/overview/view.tsx`)

Method: dual-agent (A: 8c278088-beb2-443c-a73d-d98785366116 · B: 1ae20508-a29b-4327-a3d7-2178c8facb9b)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Grade + live vitals strong; missing freshness / “why F while TPS≈20” cue |
| 2 | Match System / Real World | 3 | MC ops vernacular; letter grade “F” lacks on-page legend |
| 3 | User Control and Freedom | 3 | Collapses / dismiss / free nav; digest dismiss not obviously reversible |
| 4 | Consistency and Standards | 2 | QueueRow≈Issues good; rail active ≠ DESIGN; lag overflow target inconsistent |
| 5 | Error Prevention | 3 | Advisory restart copy prevents false agency |
| 6 | Recognition Rather Than Recall | 3 | Labeled rail/actions; grade scoring & vital thresholds not on-page |
| 7 | Flexibility and Efficiency | 2 | No accelerator to top attention / Issues; click-per-row |
| 8 | Aesthetic and Minimalist Design | 2 | Mission band earns pixels; incident instrument column is CTA chrome noise |
| 9 | Error Recovery | 3 | Attention explains grade; ErrorState + first-run; recovery = Open elsewhere |
| 10 | Help and Documentation | 2 | Help Center in rail only; no contextual “what this grade means” |
| **Total** | | **26/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment:** Authored for WatchTower — not category-interchangeable at the mission band (grade plate, channel-coded vitals, restart hygiene, advisory footer). Below-the-fold peer cards with equal Signal Blue “Open X” CTAs drift toward generic ops-console chrome. Character lives in the instruments; incident mode dilutes it.

**Deterministic scan (CLI):** `detect.mjs --json web/dashboard/src/features/overview` → exit 0, **0 findings** (`[]`). Static markup scan is clean for Overview sources.

**Visual overlays:** Injection succeeded on `http://localhost:8081/?tab=overview`. Overlay/banner reported **26 labels**: low contrast text ×9, nested cards ×7, undersized functional text ×4, clipped positioned children ×2, tiny body text ×2, plus hairline+shadow / first-viewport stretch. Decorative banner: gradient text, glow accents, radial halo, repeating stripes. Several (nested cards, viewport stretch, muted hierarchy) are likely intentional Operate density or shell chrome — treat as prompts, not automatic P0s. **CLI vs browser gap is expected** (static vs live DOM).

## Overall Impression

The mission band is the product: honest CRITICAL peak, channel≠status vitals, advisory restart trust. The single biggest opportunity is incident-mode choice overload — one next step buried under equal-weight primaries, story, and digest.

## What's Working

1. **Mission band as the product answer** — Grade + headline + channel-coded vitals + uptime answer “is it okay?” in one Night Watch Desk composition.
2. **Incident vs steady layout intelligence** — Triage-first when hurt; steady collapses extra instruments — correct Operate progressive disclosure.
3. **Advisory Restart with quiet window** — Verdict + reasons + “panel or /stop” footer makes the advise-don’t-seize principle visible.

## Priority Issues

### [P1] Incident mode piles competing primary jobs
**Why it matters:** Under CRITICAL, admins choose among `ov-next`, Needs attention, Right now, Incident story, Digest, and 4+ instrument Opens — violates triage-over-spectacle and fails 5/8 cognitive-load checks.
**Fix:** In `layoutMode === 'incident'`, promote only mission → `ov-next` → Needs attention. Demote story + digest below instruments or behind “History / week.” One Signal Blue primary on `ov-next`; other Opens → ghost/text.
**Suggested command:** `/impeccable distill` (or `/impeccable quieter` for CTA weight)

### [P1] Peer Specular primary CTAs dilute the Fix path
**Why it matters:** Performance / Spark / Boot / Activity shout “primary” at the same weight as Open Issues — Scarce Accent + single-next-step fail. Browser nested-card / first-viewport stretch overlays reinforce “dashboard of equals.”
**Fix:** Keep Specular/primary only on `ov-next` (and first-run Live). Instrument footers → ghost links or one “Related instruments” menu.
**Suggested command:** `/impeccable quieter`

### [P2] Grade letter is opaque under stress
**Why it matters:** Morgan sees **F** while TPS reads ~20 — without grade_reasons the letter feels arbitrary. Heuristic 2/6/10 weak.
**Fix:** Under mission subcopy or grade tooltip, surface 1–2 plain `grade_reasons` + “How grading works” Help link.
**Suggested command:** `/impeccable clarify`

### [P2] Incident story default-open vs Lag default-collapsed
**Why it matters:** Narrative history outranks lag incidents in crisis IA; old stories create an emotional valley before Restart advice.
**Fix:** Default story collapsed in incident mode (or only auto-open if within lookback); default-expand Lag when incident.
**Suggested command:** `/impeccable layout`

### [P3] Rail active state drifts from DESIGN.md
**Why it matters:** Shell uses border-l + bg2, not solid Signal Blue fill — weakens branded control chrome vs Overview’s strong accent CTAs. Browser also flagged undersized/low-contrast nav text (shell, not Overview-only).
**Fix:** Align `shell.tsx` active rail with DESIGN `rail-nav-active`; spot-check muted rail contrast.
**Suggested command:** `/impeccable polish` (or `/impeccable audit` for contrast)

## Persona Red Flags

**Alex (Power User):** No shortcut to jump top attention → Issues; click-per-row Opens; equal-weight primaries slow the known path.

**Sam (Accessibility):** Collapse toggles lack `aria-expanded`; sparklines `aria-hidden`; ticking NumberFlow uptime may chatter; grade meaning still color/glyph-weighted. Browser: 9× low contrast text labels — verify AA on muted secondary copy.

**Morgan (stressed solo MC admin, 2am):** Peak works (F / CRITICAL + OOM next action). Valley: story / digest / Insight / Spark / Boot before calm Restart. “Needs attention” duplicated. Fine vitals vs F without reconciliation = “is WatchTower wrong?”

## Cognitive Load

5/8 checklist failures → **high** in incident mode. Four decision points with >4 visible options (rail, triage column, vitals strip, restart plate reasons).

## Minor Observations

- Identity chips compete with KPIs in mission top; Session may be better long-term home.
- Lag overflow “+N more” → Issues while row → Insights incidents — teach one destination.
- Shell `VIEW_ONLY_TITLE` “Watchtower” vs chrome “WatchTower.”
- First-run empty state is clear and on-brand.
- Issues “Fix queue” vs Overview “Needs attention” — rename to “Fix now” would tighten IA.

## Questions to Consider

1. If Overview’s job is **one next step**, why does every instrument still ship its own Signal Blue primary?
2. During CRITICAL, should Incident story and Weekly digest be above the fold at all?
3. What if the grade plate explained itself in one sentence and identity chips moved to Session?
