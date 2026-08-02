# Features 1.2.0-beta.1 catalog refresh

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Canonical path for this plan. Spec: `docs/superpowers/specs/2026-08-02-marketing-features-1.2-beta1-design.md`.

**Goal:** Bring `/features` up to date with 1.2.0-beta.1 shipped insides without redesigning the page.

**Architecture:** Data lives in `web/marketing/content/features.ts` (copy) and `web/marketing/content/features-bento.ts` (layout ids + spans). `CapabilityCatalog` joins them; every bento id must exist in capabilities and in `featurePeek` (missing peek **throws**). Showcase stays the same seven cells; new tiles land only in `FEATURE_BENTO_MORE`.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind 4, existing MagicBento + bento-peeks (Night Watch Desk).

**Spec:** `docs/superpowers/specs/2026-08-02-marketing-features-1.2-beta1-design.md`

## Global Constraints

- Content-only catalog pass — no layout/CSS redesign, no "new in 1.2" badge, no showcase swaps
- Hyphens only; plain proper English (young-readable, no slang); no Fabric claims; no invented features
- Alpha only where already true (`spark` deep workspace)
- Night Watch Desk craft from DESIGN.md / PRODUCT.md — Signal Blue scarce; no purple-glass / cream-serif / broadsheet defaults from generic design skills
- Do not change homepage Shift Log, How it works, Install, FAQ
- Prefer existing `FeatureTone` values; add per-id marks + peeks for the five new ids (parity with neighbors; peeks are mandatory)

## Skills playbook (while building)

| When | Skill | Use |
| --- | --- | --- |
| Before UI/peek edits | anthropic-frontend-design + high-end-visual-design | Desk POV only; borrow easing/restraint, not vibe variance |
| All blurbs | human-writing / anti-ai light | Keep approved copy; surgical if drift |
| After `/features` up | web-design-guidelines | Focus/contrast only if something looks off |
| Bundle/RSC | vercel-react-best-practices | No new deps; no barrel churn; peeks stay client where they already are |
| Before "done" | verification-before-completion | Audit script + browser evidence |

## File map

| File | Responsibility |
| --- | --- |
| `web/marketing/content/features.ts` | Add 5 capabilities; rewrite 7 blurbs |
| `web/marketing/content/features-bento.ts` | Insert 5 MORE cells; locked spans below |
| `web/marketing/components/features/capability-marks.tsx` | Glyphs for 5 new ids |
| `web/marketing/components/features/bento-peeks.tsx` | Peek components + switch cases for 5 new ids |
| `web/marketing/scripts/audit-features-catalog.mjs` | Row-sum + id coverage audit (new) |
| `web/marketing/app/features/page.tsx` | No structural change |

## Locked MORE grid (6-col rows)

Replace `FEATURE_BENTO_MORE` with:

```ts
export const FEATURE_BENTO_MORE: FeatureBentoMoreCell[] = [
  { id: 'gc-ram', media: 'chart', span: 'half' },
  { id: 'crash-fingerprints', media: 'overlay', span: 'half' },

  { id: 'mods-modrinth', media: 'overlay', span: 'two' },
  { id: 'jar-drift', media: 'overlay', span: 'one' },

  { id: 'jar-disable', media: 'overlay', span: 'half' },
  { id: 'mod-configs', media: 'overlay', span: 'half' },

  { id: 'external-kill', media: 'overlay', span: 'one' },
  { id: 'silent-fails', media: 'overlay', span: 'one' },
  { id: 'logs', media: 'overlay', span: 'one' },

  { id: 'schedule-load', media: 'chart', span: 'one' },
  { id: 'storage-runway', media: 'chart', span: 'one' },
  { id: 'storage-space-map', media: 'overlay', span: 'one' },

  { id: 'activity', media: 'overlay', span: 'two' },
  { id: 'weekly-digest', media: 'overlay', span: 'one' },

  { id: 'config-audit', media: 'overlay', span: 'one' },
  { id: 'backups', media: 'overlay', span: 'two' },

  { id: 'spark-map', media: 'overlay', span: 'one' },
  { id: 'startup', media: 'overlay', span: 'one' },
  { id: 'sources', media: 'overlay', span: 'one' },

  { id: 'accounts', media: 'overlay', span: 'one' },
  { id: 'theme-accent', media: 'overlay', span: 'one' },
  { id: 'auth', media: 'overlay', span: 'one' },

  { id: 'help', media: 'overlay', span: 'one' },
  { id: 'cli-dr', media: 'overlay', span: 'two' },
];
```

`FEATURE_BENTO_SHOWCASE` unchanged.

## Approved copy (paste verbatim)

**New (standard):**

- `jar-disable` / Soft jar disable / enable / Mods / `warn` — Rename a mod jar to `*.jar.disabled` so it skips the next boot (or rename it back). Filter All / Enabled / Disabled. High world risk asks you to confirm first. Admins only - no delete.
- `mod-configs` / Mods → Configs / Mods / `accent` — Edit files under the server `config/` folder from the dashboard. TOML gets a form when WatchTower can parse it; otherwise you edit the raw text. Saves create a backup and support undo. Admins only.
- `storage-space-map` / Storage space map / Insights / `disk` — A treemap of what is using disk space. Drill into World, Logs, Mods, or Backups.
- `spark-map` / Spark Map / Spark / `lantern` — Pan and zoom chunk heat from the selected Spark profile. Click a chunk for details.
- `theme-accent` / Theme + accent / Settings / `info` — Light, Dark, Black, or System, plus an accent color. Saved per signed-in account.

**Rewrites:**

- `backups` — See whether local backups look present and fresh, then verify zip/tar.gz integrity. Optional test restore only under `watchtower/restore-verify/` - never into the live world.
- `health-grade` — Letter grade, plain reasons when it is not Strong, and Safe / Caution / Wait restart advice. Long uptime plus worse GC can suggest a quiet maintenance window. WatchTower does not restart the server for you.
- `gc-ram` — GC pause share of wall time, JVM flags profile, and RAM advice that uses your host or container memory limit - not a one-size guess.
- `schedule-load` — Busy vs quiet hours so you plan restarts around real load. Times follow the timezone you set in the dashboard.
- `mods-modrinth` — Installed jars, conflicts, Modrinth lookup hints, and mod log errors with Active / Reviewed. Modrinth never downloads jars for you.
- `accounts` — Owner / admin / viewer logins, optional Minecraft player link on the side rail, Sign out, and a Settings audit log of account and settings changes.
- `spark` — Optional Spark companion turns a profile into what ate the tick. Deep Spark workspace is Alpha.

---

### Task 1: Catalog content + bento placement + audit script

**Files:**
- Modify: `web/marketing/content/features.ts`
- Modify: `web/marketing/content/features-bento.ts`
- Create: `web/marketing/scripts/audit-features-catalog.mjs`

**Interfaces:**
- Produces: five new `FeatureCapability` ids; updated blurbs; locked `FEATURE_BENTO_MORE`
- Consumes: existing `FeatureCapability` / `FeatureBentoMoreCell` types

- [ ] **Step 1: Write the audit script (failing until peeks exist is OK later; content coverage first)**

Create `web/marketing/scripts/audit-features-catalog.mjs` that:

1. Plain Node script that `fs.readFileSync`s both content files and asserts with regex/string checks:
   - Every `FEATURE_BENTO_SHOWCASE` / `MORE` `id: '…'` appears as `id: '…'` in `FEATURE_CAPABILITIES`
   - MORE spans walk in order; `half=3`, `one=2`, `two=4`; every partial sum hitting multiples of 6 ends a row; final sum % 6 === 0
   - Showcase ids unchanged set of seven
   - New ids `jar-disable`, `mod-configs`, `storage-space-map`, `spark-map`, `theme-accent` present in capabilities and MORE
2. Exit `1` with a clear message on failure

- [ ] **Step 2: Run audit (expect fail on missing new ids)**

```bash
node web/marketing/scripts/audit-features-catalog.mjs
```

Expected: FAIL mentioning missing new ids (or empty MORE placements).

- [ ] **Step 3: Update `features.ts`**

Insert the five new capability objects (standard weight) after related neighbors. Apply the seven blurb rewrites verbatim. Leave `FEATURE_LEDE` unchanged.

- [ ] **Step 4: Replace `FEATURE_BENTO_MORE` with the locked array above**

Do not touch `FEATURE_BENTO_SHOWCASE`.

- [ ] **Step 5: Re-run audit**

Expected: PASS on id coverage + row math.

- [ ] **Step 6: Commit**

```bash
git add web/marketing/content/features.ts web/marketing/content/features-bento.ts web/marketing/scripts/audit-features-catalog.mjs
git commit -m "feat(marketing): refresh Features catalog for 1.2.0-beta.1"
```

---

### Task 2: Instrument marks + peeks for five new ids

**Files:**
- Modify: `web/marketing/components/features/capability-marks.tsx`
- Modify: `web/marketing/components/features/bento-peeks.tsx`

**Interfaces:**
- Consumes: new feature ids from Task 1
- Produces: `CapabilityMark` glyphs; `featurePeek('jar-disable'|…)` React nodes (no throw)

Peek design (match existing overlay peeks; reuse `Plate` / `bento-peek__*` classes):

| id | Peek idea |
| --- | --- |
| `jar-disable` | List row: `create-*.jar` → `create-*.jar.disabled` + filter chips All / Enabled / Disabled |
| `mod-configs` | Mini TOML form rows (boolean + number) labeled `config/` |
| `storage-space-map` | Nested rectangle blocks labeled World / Mods / Logs / Backups (treemap fake) |
| `spark-map` | Small chunk heat grid + "chunk 3, -12" readout |
| `theme-accent` | Four theme swatches + accent chip row |

- [ ] **Step 1: Add mark cases for the five ids**
- [ ] **Step 2: Add Peek components + switch cases**
- [ ] **Step 3: Browser check** on `/features`
- [ ] **Step 4: Re-run audit + typecheck**
- [ ] **Step 5: Commit**

```bash
git add web/marketing/components/features/capability-marks.tsx web/marketing/components/features/bento-peeks.tsx
git commit -m "feat(marketing): peeks and marks for 1.2 Features tiles"
```

---

### Task 3: Visual / a11y smoke (no redesign)

- [ ] **Step 1: Desktop + mobile screenshot pass on `/features`**
- [ ] **Step 2: Fix only peek bugs found (if any), then commit** — skip empty commit if nothing to fix

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| Five new tiles + tones | Task 1 |
| Seven blurb rewrites | Task 1 |
| Showcase unchanged | Task 1 (locked) |
| MORE placement / 6-col | Task 1 locked array |
| No page redesign | Global + Task 3 |
| Marks/peeks for new ids | Task 2 (required — peek throws) |
| Verification | Tasks 1–3 |

**Out of scope (do not do):** homepage, How it works, Install, release callout, promoting new tiles into showcase, redesigning mark system.
