# Dashboard UI Consistency Pass — Design

**Date:** 2026-08-02  
**Status:** Approved (brainstorming §§1–4); implemented  
**Surface:** `web/dashboard` React ops app  
**Canonical system after this pass:** [`DESIGN.md`](../../../DESIGN.md) (deep design system — call this back for all future dashboard UI).

## Goal

Make every in-scope dashboard surface feel like one Night Watch Desk product: matching plate chrome (radius, shadow, border), shared heroes/metric tiles/buttons/empty states, and no soft SaaS one-offs — without rewriting page layouts or inventing new product behavior.

## Decisions (locked)

| Axis | Choice |
|---|---|
| Depth | Polish + shared-primitive unification |
| Scope | All rail pages + boot, auth gate, wizard, support-pack modal |
| Out of scope | Visuals/lab, marketing (`web/marketing`), dashboard-archive, DR viewer |
| Approach | System-first, then consume by rail group |
| QA | Fixture preview walk every in-scope surface (dark primary); light + black spot-check on Overview, Settings, Spark, Auth |
| Identity | Enforce `DESIGN.md` — do **not** apply generic high-end SaaS glass/pill defaults |

## Cohesion contract

### Plate chrome

- Resting cards/wells use `.wt-plate` or equivalent: `bg-wt-bg1`, `border-wt-line`, `rounded-[var(--radius-wt)]`, `shadow-[var(--wt-shadow)]`.
- Flat-at-rest: one inset hairline + one soft drop. No local multi-layer marketing shadows on ordinary cards.

### Radii

- Default plates/buttons/inputs: `--radius-wt` (4px). Small chips/rail: `--radius-wt-sm` (2px). Larger shells only: `--radius-wt-lg` (6px).
- Ban on in-scope surfaces: `rounded-xl`, `rounded-2xl`, rem-soup radii (`.85rem`, `14px`, `0.45rem` as card chrome), and forks that fight `--radius-wt*`.

### Allowed exceptions

- Full-round (`999px`): Insights `PillNav` segment control, scroll thumbs, true toggles — **not** cards.
- `StatusPill` uses tight `--radius-wt-sm` (current shared implementation) — do not restyle to full pills.
- Hero status glow: `HeroCard` / BorderGlow only (~0.55 intensity).
- Specular CTA multi-layer shadow: primary CTAs only (`.wt-specular-cta`).

### Type and buttons

- Geist for UI; JetBrains Mono + tabular for metrics.
- Prefer shared `Button` / `SpecularCtaButton`; no raw `rounded-xl` button/input chrome on in-scope surfaces.
- Spell **WatchTower** in chrome touched by this pass.

### Navigation (intentional split)

- Mission/inbox tabs (Issues, Crashes, Mods, Spark): `HeroTabNav`.
- Insights filter segments: keep `PillNav` (documented in `DESIGN.md`).
- Settings: keep left panel list IA; restyle panels/rows to plate tokens.

## Shared primitives

### `VitalTile` (extract to `ui/patterns`)

Today duplicated in Issues, Crashes, Mods, Startup, Session. Unify as one component wrapping `MetricReadout` with:

- `label: string`
- `value?: number | null` — null/non-finite → em dash `—`
- `format?: (n: number) => string`
- `tone?: 'default' | 'ok' | 'warn' | 'danger'`
- `size?: 'sm' | 'md'`
- `text?: string | null` — string override (Startup uses this)
- `className?: string` — page CSS hooks (`is-vital`, `cr-vital`, `md-vital`, `su-vital`, `ss-vital`)

Leave non-VitalTile KPI widgets alone (e.g. Backups/Activity `Kpi`).

### Hero migration

Wrap outer shell with shared `HeroCard` (keep page-inner layout/CSS):

- Backups, Session, Activity, Sources

Insights section banners (storage, digest, mod-changes, configs):

- Status-toned → `HeroCard`
- Quiet → `.wt-plate` (no custom glow CSS)

Pages already on `HeroCard`: Overview, Live, Issues, Crashes, Mods, Spark, Startup (inner only; keep).

### Empty / error / buttons

Prefer `EmptyState` / `ErrorState` / `Button` / `SpecularCtaButton` where a page hand-rolls the same chrome. Do not invent new empty-state variants (YAGNI).

### Settings / form row recipe

Add a shared CSS class (e.g. `.wt-form-row`) for the repeated `rounded-xl border border-wt-line bg-wt-bg2/50 …` pattern in Settings and Wizard — tokens only, no settings IA rewrite.

## Rollout order

0. Foundation — `VitalTile`, `.wt-form-row`, banlist regression test  
1. Monitor — Overview/Live spot-check, Insights plates/skeletons, Session `HeroCard` + `VitalTile`, Startup `VitalTile`  
2. Triage — Issues/Crashes `VitalTile`, Spark CSS radii/shadows, Logs plate/skeleton chrome  
3. Ops — Mods `VitalTile`, Backups/Activity/Sources `HeroCard` + plate pass  
4. System — Docs fallback radii, Roadmap light touch, Settings form rows  
5. Chrome — Boot, Auth gate, Wizard, Support modal  
6. QA — preview walk + banlist + light/black spot-check  

## Success criteria

- In-scope surfaces share plate radius/shadow/border vocabulary and shared button/empty/error primitives where applicable.
- Hero stragglers (Backups, Session, Activity, Sources) use `HeroCard`.
- One shared `VitalTile`; no local copies on Issues/Crashes/Mods/Startup/Session.
- Banlist clean on in-scope paths for `rounded-xl` / `rounded-2xl` on plates/forms/buttons.
- Spark/Logs rem-soup card radii replaced with `--radius-wt*`; resting shadows use `--wt-shadow` (not `--wt-shadow-lg` forks).
- Dark preview walkthrough complete; light + black spot-check on Overview, Settings, Spark, Auth.

## Craft quality bar (skills synthesis)

Night Watch Desk (`DESIGN.md`) remains the visual law. The attached design skills raise the **craft bar** for this pass; they do **not** replace the brand with a generic agency look.

### Keep (apply on every surface we touch)

From **anthropic-frontend-design**
- Subject-grounded identity: night-shift ops desk — instruments, lantern, Signal Blue control chrome.
- Signature element stays `HeroCard` / mission vitals (one bold thing; everything else quiet).
- Restraint: when a page has decorative glow, soft multi-shadow, or a second card recipe, remove the accessory — do not add a new style.
- Empty/error copy: active voice, what happened + what to do next (use shared `EmptyState` / `ErrorState`; do not invent apologetic mood copy).

From **high-end-visual-design** (craft only — see Reject list)
- Motion: animate `transform` / `opacity` only; no layout-property animation when editing motion CSS.
- No `backdrop-blur` on scrolling page content (blur stays on fixed/sticky chrome if already present).
- Obsessive micro-parity: shared buttons/plates/heroes must match hover, active, and focus across pages.
- Spring/custom easing only where motion already exists — do not invent new page-enter systems in this pass.

From **ui-ux-pro-max**
- Accessibility first: visible `:focus-visible`, icon-only controls need `aria-label`, decorative icons `aria-hidden`.
- Touch/interaction: `cursor-pointer` on clickable controls we restyle; disable primary buttons while their mutation is pending.
- Loading: skeletons use plate radii; loading copy ends with `…` not `...`.
- Light + dark (+ black) contrast spot-check — glass/transparent rows must remain readable in light theme.
- No emoji-as-icons; keep existing SVG icon set.

From **web-design-guidelines** (Vercel WIG)
- Never `outline-none` without a `:focus-visible` replacement on controls we touch.
- Never add `transition: all` — list properties explicitly.
- Auth/wizard forms: real `<label>`s, sensible `autoComplete` / `name`, `spellCheck={false}` on codes/usernames.
- Support modal: `overscroll-behavior: contain` if missing.
- Metrics: `tabular-nums` / mono (already `MetricReadout` / `VitalTile`).
- Flex text rows we touch: `min-w-0` + truncate/break so long mod names/paths do not blow layout.
- Product voice override: WatchTower uses plain-English **sentence case** in UI — do **not** rewrite chrome to Title Case just to match WIG copy prefs.

From **vercel-react-best-practices**
- Extracting shared `VitalTile` removes repeated inline page helpers (good).
- Do not add `useMemo` / `useCallback` / new data-fetch waterfalls in this pass.
- Do not introduce heavy new dependencies or dynamic-import churn for CSS token work.
- Do not define new components inside `PageView` while wrapping heroes — import shared `HeroCard` / `VitalTile` / `Button`.

### Reject (explicitly out — would fight Night Watch Desk)

These are common “premium” defaults from high-end / SaaS playbooks. **Do not ship them** in this pass:

- Double-bezel / `rounded-[2rem]` squircles, floating island nav, full-pill primary CTAs
- Ethereal glass: purple/indigo orbs, heavy `backdrop-blur` cards, frosted marketing plates
- Macro marketing whitespace (`py-24`–`py-40` section padding) — ops desk stays dense
- Soft Structuralism / Editorial Luxury cream-serif looks
- New display fonts, icon-set swaps, or chart-library rewrites

**One aesthetic risk (justified):** ruthlessly identical plate + hero chrome across every tab so the product feels like one machined instrument cluster — not a collage of page-local “premium” experiments.

## Small-details checklist (every surface)

- Section gaps: `8 / 12 / 16 / 24`
- Skeleton pulse radii match plates (`--radius-wt`, not `rounded-xl`)
- Hairline borders (`border-wt-line`), not thick frames
- Status vs channel colour misuse
- Focus rings visible (`:focus-visible`); no bare `outline-none`
- Hover/active feedback on buttons/links we touch
- Reduced-motion: hero glow / enters respect preference; no `transition: all`
- Icon-only buttons: `aria-label`; decorative icons: `aria-hidden`
- Loading / pending: button disabled + `…` ellipsis in labels
- Long text: `min-w-0` / truncate or break on flex rows we touch
- **WatchTower** spelling in chrome touched

## Non-goals / risks

- No layout IA changes, no marketing, no Visuals/lab, no new product behavior
- Do not force Insights onto `HeroTabNav`
- Do not unify Backups/Activity `Kpi` into `VitalTile`
- Do not apply high-end Double-Bezel / pill-CTA / glass-orb aesthetics
- Packaging audit only if wizard/auth CSS asset paths break jar serving

## Plain English

Every dashboard screen and the login/setup/support chrome will feel like the same Night Watch Desk: matching card corners and shadows, shared hero and metric tiles, and fewer one-off soft form styles — especially in Settings, Spark, and the wizard — without rebuilding how each page works. Craft details (focus, motion, forms, contrast) get the same care as the visual tokens.

## Follow-through: deepen `DESIGN.md`

After the pass ships and preview QA passes, expand root [`DESIGN.md`](DESIGN.md) into the **canonical deep design system** agents and humans call back on. It must describe WatchTower **as it then looks** (post-consistency), not a parallel aspirational brand.

Keep YAML frontmatter tokens in sync with `web/dashboard/src/index.css`. Expand prose to cover at least:

1. North star + personality (existing, tighten)
2. Color / type / radius / spacing / elevation (existing + CSS var map)
3. Themes (light / dark / black) + accent presets
4. Shared primitives catalog: `.wt-plate`, `.wt-form-row`, `HeroCard`, `HeroTabNav`, `PillNav`, `VitalTile`, `MetricReadout`, `Button` / `SpecularCtaButton`, `EmptyState` / `ErrorState`, `StatusPill`, `Section`
5. Page patterns: mission hero, list+detail inbox, Insights segments, Settings form rows, operator chrome (boot/auth/wizard/support)
6. Motion & accessibility craft (focus-visible, reduced-motion, no `transition: all`, no scroll blur)
7. Explicit **Allowed exceptions** and **Reject** lists (SaaS glass / 2rem / pill CTAs / etc.)
8. Do / Don't + copy voice (sentence case, **WatchTower** spelling, advisory product constraint)
9. File map: where tokens and patterns live in the repo

Future UI work treats updated `DESIGN.md` as law — no fighting it with generic high-end/SaaS playbooks.
