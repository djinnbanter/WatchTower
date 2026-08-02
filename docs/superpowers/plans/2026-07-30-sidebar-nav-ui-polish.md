---
name: sidebar-nav-ui-polish
overview: "Polish the AppShell left rail into a denser, more intentional ops console: quieter inactive items, a distinctive left-beacon active state (not a full blue slab), a stronger brand header, and cleaner footer actions—using a dedicated shell CSS layer that works in light/dark/black and the mobile drawer."
todos:
  - id: rail-bem
    content: "Task 1: BEM hooks on AppShell rail + shell.css stub"
    status: in_progress
  - id: rail-beacon
    content: "Task 2: Beacon active state + denser link CSS; strip conflicting Tailwind"
    status: pending
  - id: rail-brand-foot
    content: "Task 3: Brand header + footer CTA/theme polish"
    status: pending
  - id: rail-verify
    content: "Task 4: Simplify, a11y, three-theme + mobile verify"
    status: pending
isProject: false
---

# Sidebar Nav UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use [subagent-driven-development](c:\Users\DJINN\.agents\skills\subagent-driven-development\SKILL.md) (recommended) or [executing-plans](c:\Users\DJINN\.agents\skills\executing-plans\SKILL.md). Steps use checkbox (`- [ ]`) syntax.
> On approval, copy this plan to [`docs/superpowers/plans/2026-07-30-sidebar-nav-ui-polish.md`](docs/superpowers/plans/2026-07-30-sidebar-nav-ui-polish.md) before Task 1.
> Prefer model **cursor-grok-4.5-high** for subagents if the user has asked to avoid premium LLMs.

**Goal:** Make the WatchTower side nav feel like a polished server-ops rail—clear hierarchy, distinctive active state, quieter chrome—without changing navigation structure or routing.

**Architecture:** Keep all rail markup and behavior in [`web/dashboard/src/app/shell.tsx`](web/dashboard/src/app/shell.tsx); move visual styling into a new [`web/dashboard/src/app/shell.css`](web/dashboard/src/app/shell.css) with `sh-rail-*` classes (same feature-CSS pattern as Session `ss-*`). Active state becomes a soft tint + left “beacon” bar instead of a full-bleed accent fill. Brand header and footer get dedicated blocks; mobile drawer reuses the same `rail` node so one CSS pass covers both.

**Tech Stack:** React 19, Tailwind utility classes where thin, dedicated CSS for the signature rail, existing `--wt-*` tokens from [`web/dashboard/src/index.css`](web/dashboard/src/index.css), Lucide icons via `@/ui/icons`, `cn()` helper.

## Global Constraints

- Do not change tab IDs, `GROUPS`, `registerPage`, or routing (`hrefFor` / `navigate`).
- Keep rail width **220px** (`w-[220px]`).
- Preserve a11y: `aria-label="Main navigation"`, `aria-current="page"`, skip link, mobile open/close labels.
- Respect `prefers-reduced-motion` for any transitions.
- Active/hover must work in **light, dark, and black** themes using `--wt-*` tokens only (no hard-coded blues).
- Capture mode and View-only badge stay out of the rail (header only)—do not move them.
- Copy stays plain: no marketing fluff on footer buttons.
- Prefer **Grok 4.5** for implementation subagents when spawning agents.

## Skills to use

| Skill | When |
| --- | --- |
| [anthropic-frontend-design](c:\Users\DJINN\.agents\skills\anthropic-frontend-design\SKILL.md) | Design token block + build Tasks 2–4 |
| [web-design-guidelines](c:\Users\DJINN\.agents\skills\web-design-guidelines\SKILL.md) | Focus rings, contrast, keyboard |
| [anti-ai-writing-humanizer](c:\Users\DJINN\.agents\skills\anti-ai-writing-humanizer\SKILL.md) | Any label/tooltip copy tweaks |
| [verification-before-completion](c:\Users\DJINN\.agents\skills\verification-before-completion\SKILL.md) | Preview all three themes + mobile before done |
| [simplify](c:\Users\DJINN\.agents\skills\simplify\SKILL.md) | After CSS lands, cut unused Tailwind leftovers |

## Design direction (locked)

**Subject:** WatchTower dashboard rail for Minecraft server operators. **Job:** switch tabs fast with zero visual noise.

**Signature (one risk):** Replace the solid blue slab active state with a **left beacon**—a 2px accent bar + soft `accent-soft` wash + medium weight label. Reads like a status LED on a control panel; fits ops vernacular without looking like generic SaaS “selected row.”

**Density:** Slightly tighter row padding (`py-1.5` → CSS `0.4rem 0.65rem`), group labels with more air above / less below, footer actions as quiet ghost rows (support pack remains the only bordered CTA).

**Brand:** Header keeps icon + WatchTower + hostname; tighten type (wordmark `text-[13px]` semibold, host `text-[11px]` mid), add a faint bottom hairline already present—no new logo.

**Out of scope:** Collapsible rail, icon-only mode, reordering tabs, adding logout to the rail, redesigning the top content header.

```
┌─ brand ─────────────────┐
│ [tower] WatchTower      │
│         hostname        │
├─────────────────────────┤
│ MONITOR                 │
│ ▌ Overview   ← beacon   │
│   Live                  │
│ TRIAGE …                │
├─────────────────────────┤
│ [ ] Build support pack  │  ← primary quiet CTA
│     Dark theme          │  ← ghost
└─────────────────────────┘
```

---

### Task 1: Extract rail structure with BEM hooks (no visual change yet)

**Files:**
- Modify: [`web/dashboard/src/app/shell.tsx`](web/dashboard/src/app/shell.tsx)
- Create: [`web/dashboard/src/app/shell.css`](web/dashboard/src/app/shell.css) (import only + empty section comments)

**Interfaces:**
- Produces: class names `sh-rail`, `sh-rail__brand`, `sh-rail__brand-mark`, `sh-rail__brand-text`, `sh-rail__brand-title`, `sh-rail__brand-host`, `sh-rail__scroll`, `sh-rail__group`, `sh-rail__group-label`, `sh-rail__link`, `sh-rail__link-icon`, `sh-rail__badge`, `sh-rail__foot`, `sh-rail__cta`, `sh-rail__theme` — Tailwind layout utilities may remain alongside until Task 2.

- [ ] **Step 1: Add shell.css stub and import**

```css
/* AppShell rail — brand, nav groups, footer. Tokens: --wt-* */
```

In `shell.tsx` top: `import './shell.css';`

- [ ] **Step 2: Wire BEM classes onto existing markup**

Replace the `rail` JSX structure classes:

```tsx
<nav className="sh-rail flex h-full w-[220px] flex-col border-r border-wt-line bg-wt-bg1" aria-label="Main navigation">
  <div className="sh-rail__brand flex items-center gap-2 border-b border-wt-line px-4 py-3.5">
    <img … className="sh-rail__brand-mark rounded-[2px]" />
    <div className="sh-rail__brand-text min-w-0">
      <div className="sh-rail__brand-title truncate …">WatchTower</div>
      <div className="sh-rail__brand-host truncate …">{hostname}</div>
    </div>
  </div>
  <div className="sh-rail__scroll flex-1 overflow-y-auto px-1.5 py-2">
    <div className="sh-rail__group mb-3">…</div>
    <div className="sh-rail__group-label …">{group.label}</div>
    <a className={cn('sh-rail__link …', active && 'is-active')} …>
      <PageIcon className={cn('sh-rail__link-icon …')} />
      <span className="truncate">{p.title}</span>
      {badge ? <span className="sh-rail__badge …">{badge}</span> : null}
    </a>
  </div>
  <div className="sh-rail__foot space-y-1.5 border-t border-wt-line p-2">
    <button className="sh-rail__cta …">…</button>
    <button className="sh-rail__theme …">…</button>
  </div>
</nav>
```

Keep current active Tailwind (`bg-wt-accent` etc.) temporarily so the preview does not regress.

- [ ] **Step 3: Smoke-check in preview**

Run: `npm run preview --prefix web/dashboard`  
Expected: rail looks unchanged; DevTools shows `sh-rail*` classes.

- [ ] **Step 4: Commit**

```bash
git add web/dashboard/src/app/shell.tsx web/dashboard/src/app/shell.css
git commit --only -m "refactor(shell): add BEM hooks for sidebar rail polish" -- web/dashboard/src/app/shell.tsx web/dashboard/src/app/shell.css
```

---

### Task 2: Signature active state + density (CSS)

**Files:**
- Modify: [`web/dashboard/src/app/shell.css`](web/dashboard/src/app/shell.css)
- Modify: [`web/dashboard/src/app/shell.tsx`](web/dashboard/src/app/shell.tsx) — strip conflicting active/hover Tailwind from links once CSS owns them

**Skills:** anthropic-frontend-design (execute the locked signature)

- [ ] **Step 1: Implement rail link CSS**

```css
.sh-rail__scroll {
  padding: 0.5rem 0.5rem 0.75rem;
}

.sh-rail__group {
  margin-bottom: 0.85rem;
}

.sh-rail__group-label {
  padding: 0.35rem 0.7rem 0.3rem;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--wt-text-low);
}

.sh-rail__link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0.15rem;
  padding: 0.4rem 0.65rem 0.4rem 0.7rem;
  border-radius: var(--radius-wt-sm);
  border: 0;
  border-left: 2px solid transparent;
  font-size: 0.875rem;
  color: var(--wt-text-mid);
  text-decoration: none;
  transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
}

.sh-rail__link:hover {
  background: color-mix(in srgb, var(--wt-bg2) 70%, transparent);
  color: var(--wt-text);
}

.sh-rail__link:focus-visible {
  outline: 2px solid var(--wt-accent);
  outline-offset: 1px;
}

.sh-rail__link.is-active {
  border-left-color: var(--wt-accent);
  background: var(--wt-accent-soft);
  color: var(--wt-text);
  font-weight: 550;
}

.sh-rail__link.is-active .sh-rail__link-icon {
  color: var(--wt-accent);
}

.sh-rail__link-icon {
  color: var(--wt-text-low);
  flex-shrink: 0;
}

.sh-rail__badge {
  margin-left: auto;
  border-radius: 2px;
  background: color-mix(in srgb, var(--wt-danger) 15%, transparent);
  padding: 0 0.35rem;
  font-size: 10px;
  font-weight: 600;
  color: var(--wt-danger);
}

@media (prefers-reduced-motion: reduce) {
  .sh-rail__link { transition: none; }
}
```

- [ ] **Step 2: Simplify link className in shell.tsx**

```tsx
className={cn('sh-rail__link', active && 'is-active')}
```

Remove `border-l-2`, `bg-wt-accent`, `text-wt-accent-ink`, hover Tailwind from the `<a>`. Keep icon size={16}; drop conditional ink color classes (CSS handles `.is-active .sh-rail__link-icon`).

- [ ] **Step 3: Verify themes**

Open preview; cycle Light → Dark → Black; confirm active Overview uses soft wash + left bar (not solid fill), inactive hover is subtle, focus-visible ring works.

- [ ] **Step 4: Commit**

```bash
git commit --only -m "feat(shell): beacon active state and denser rail links" -- web/dashboard/src/app/shell.css web/dashboard/src/app/shell.tsx
```

---

### Task 3: Brand header + footer polish

**Files:**
- Modify: [`web/dashboard/src/app/shell.css`](web/dashboard/src/app/shell.css)
- Modify: [`web/dashboard/src/app/shell.tsx`](web/dashboard/src/app/shell.tsx)

- [ ] **Step 1: Brand CSS**

```css
.sh-rail__brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid var(--wt-line);
}

.sh-rail__brand-mark {
  width: 28px;
  height: 28px;
  border-radius: 2px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--wt-line) 80%, transparent);
}

.sh-rail__brand-title {
  font-size: 13px;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--wt-text);
  line-height: 1.2;
}

.sh-rail__brand-host {
  margin-top: 0.1rem;
  font-size: 11px;
  color: var(--wt-text-low);
  line-height: 1.2;
}
```

Strip redundant Tailwind from brand div once CSS owns it (keep `min-w-0` / `truncate` on text).

- [ ] **Step 2: Footer CSS — CTA elevated, theme ghost**

```css
.sh-rail__foot {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.55rem 0.5rem 0.65rem;
  border-top: 1px solid var(--wt-line);
}

.sh-rail__cta {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.45rem 0.7rem;
  border-radius: var(--radius-wt-sm);
  border: 1px solid color-mix(in srgb, var(--wt-accent) 28%, var(--wt-line));
  background: color-mix(in srgb, var(--wt-accent-soft) 55%, var(--wt-bg2));
  font-size: 0.8125rem;
  font-weight: 550;
  color: var(--wt-text);
  cursor: pointer;
}

.sh-rail__cta:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--wt-accent) 45%, var(--wt-line));
  background: var(--wt-accent-soft);
}

.sh-rail__cta:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sh-rail__theme {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.45rem;
  padding: 0.4rem 0.7rem;
  border: 0;
  border-radius: var(--radius-wt-sm);
  background: transparent;
  font-size: 0.8125rem;
  color: var(--wt-text-mid);
  cursor: pointer;
}

.sh-rail__theme:hover {
  background: color-mix(in srgb, var(--wt-bg2) 80%, transparent);
  color: var(--wt-text);
}

.sh-rail__cta:focus-visible,
.sh-rail__theme:focus-visible {
  outline: 2px solid var(--wt-accent);
  outline-offset: 1px;
}
```

Update footer buttons in `shell.tsx` to `className="sh-rail__cta"` / `className="sh-rail__theme"` (remove old bordered Tailwind stacks). Keep `disabled` / `title` / icons / labels.

- [ ] **Step 3: Preview brand + footer in all themes + mobile drawer**

Confirm mobile overlay still shows polished rail; support CTA disabled state still readable for viewers.

- [ ] **Step 4: Commit**

```bash
git commit --only -m "feat(shell): polish rail brand header and footer actions" -- web/dashboard/src/app/shell.css web/dashboard/src/app/shell.tsx
```

---

### Task 4: Critique pass + simplify + verify

**Files:**
- Possibly touch: `shell.css` / `shell.tsx` only

**Skills:** simplify, web-design-guidelines, verification-before-completion

- [ ] **Step 1: Simplify**

Remove any leftover duplicate Tailwind that fights CSS (padding, colors on brand/scroll/foot). Keep structural flex/overflow utilities on `sh-rail` and `sh-rail__scroll`.

- [ ] **Step 2: A11y checklist**

- Keyboard Tab through rail links → visible focus
- `aria-current="page"` still set on active link
- Contrast: active label vs soft wash ≥ readable mid-text on light and dark
- Reduced motion: no stuck transitions

- [ ] **Step 3: Visual verify**

Preview `http://localhost:8081/` — Overview active, click Issues, cycle themes, open mobile nav (narrow viewport). Optional screenshot via browser tools.

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b --pretty false` from `web/dashboard`  
Expected: no new errors in `shell.tsx`.

- [ ] **Step 5: Commit if cleanup landed**

```bash
git commit --only -m "polish(shell): simplify rail classes after UI pass" -- web/dashboard/src/app/shell.css web/dashboard/src/app/shell.tsx
```

(Skip empty commit if nothing changed.)

---

## Self-review

- **Coverage:** Header, scroll nav, footer, active/hover/focus, themes, mobile drawer, a11y — all tasked. No routing/registry changes.
- **No placeholders:** Exact class names and CSS blocks included.
- **Consistency:** Beacon = `border-left-color` + `accent-soft`; CTA uses accent-soft border; theme is ghost.