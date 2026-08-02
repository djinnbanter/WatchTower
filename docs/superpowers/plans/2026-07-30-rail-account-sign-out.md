---
name: rail-account-sign-out
overview: Add a compact signed-in account strip to the AppShell rail footer (username, role, Sign out) wired to the existing logout API and session store reset, so multi-admin users can see who they are and leave cleanly.
todos:
  - id: signout-store
    content: "Task 1: resetToLogin on session store + test"
    status: in_progress
  - id: signout-ui
    content: "Task 2: role/username helpers + rail account strip + Sign out wiring"
    status: pending
  - id: signout-docs
    content: "Task 3: wiki + changelog note for Sign out"
    status: pending
isProject: false
---

# Rail Account Strip and Sign Out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use [subagent-driven-development](c:\Users\DJINN\.agents\skills\subagent-driven-development\SKILL.md) (recommended) or [executing-plans](c:\Users\DJINN\.agents\skills\executing-plans\SKILL.md). Steps use checkbox (`- [ ]`) syntax.
> On approval, copy to [`docs/superpowers/plans/2026-07-30-rail-account-sign-out.md`](docs/superpowers/plans/2026-07-30-rail-account-sign-out.md) before Task 1.
> Prefer **cursor-grok-4.5-high** for subagents when the user wants to avoid premium LLMs.

**Goal:** Show who is signed in on the side rail and let them sign out in one click, now that multiple dashboard accounts exist.

**Architecture:** Add a `signOut()` action on the Zustand session store that calls `api.logout()`, clears React Query cache, and returns the app to the login gate. Render a compact account strip at the top of the polished rail footer in [`shell.tsx`](web/dashboard/src/app/shell.tsx) / [`shell.css`](web/dashboard/src/app/shell.css). Fixture preview keeps Sign out as a no-op that still resets UI to login-looking state only if live auth would; in fixture mode Sign out reloads preview as signed-in still is odd — instead in fixture preview, Sign out is disabled with title "Not available in fixture preview" (preview has no real cookie session).

**Tech Stack:** React 19, Zustand [`session-store.ts`](web/dashboard/src/app/session-store.ts), TanStack Query (`useQueryClient`), existing `api.logout`, `sh-rail-*` CSS tokens, Lucide icons already in `@/ui/icons`.

## Global Constraints

- Match the existing rail language (`sh-rail-*`, `--wt-*`); do not invent a new visual system.
- **design-taste-frontend** is for landings/portfolios, not dashboards — use it only for anti-slop restraint (no glass account card, no avatar stack, no marketing copy). Follow WatchTower ops chrome.
- Copy via **anti-ai-writing-humanizer** (light): labels like **Sign out**, role words `Owner` / `Admin` / `Viewer`, no "Securely terminate your session".
- Always-visible strip (no dropdown menu) so who-you-are is obvious on a shared machine.
- Width stays 220px; truncate long usernames.
- Preserve a11y: button type, focus-visible, `aria-label` on Sign out.
- Do not move View only pill off the content header.

## Design read (locked)

Reading this as: **ops dashboard chrome** for multi-admin Minecraft hosts, quiet control-panel language, matching the polished rail (beacon links, ghost theme, accent CTA).

**Placement (locked):** Rail footer, **above** Build support pack / theme toggle:

```
│ … nav …                 │
├─────────────────────────┤
│ [E] ella                │
│     Owner      Sign out │
│ [ ] Build support pack  │
│     Dark theme          │
└─────────────────────────┘
```

Initial square from first letter of username; role as small muted text (not a loud pill cluster); Sign out as a quiet text button aligned right on the second line (or same row if space — prefer two-line: name+initial / role + Sign out).

**Fixture preview:** Sign out disabled (`title="Not available in fixture preview"`) because there is no real session cookie; still show username/role from session store so the strip is reviewable with `?role=`.

---

### Task 1: `signOut` on the session store

**Files:**
- Modify: [`web/dashboard/src/app/session-store.ts`](web/dashboard/src/app/session-store.ts)
- Create: [`web/dashboard/src/app/session-store.test.ts`](web/dashboard/src/app/session-store.test.ts) (or extend if one exists — today only `permissions.test.ts` nearby; test pure helpers if `signOut` itself is hard to unit without mocks)

**Interfaces:**
- Produces:
```ts
signOut: () => Promise<void>;
```
Implementation (inside the store, **without** React Query — shell will clear the cache then call this, OR signOut accepts an optional `onAfterLogout` — cleaner: shell does:

```ts
await api.logout().catch(() => {}); // still clear local state if network fails
queryClient.clear();
useSessionStore.getState().resetToLogin();
```

Prefer splitting:
```ts
resetToLogin: () => void; // sets bootPhase:'auth', gate:'login', session:null, bootError:null
```
and shell orchestrates logout + clear + resetToLogin. That keeps the store free of QueryClient imports.

- [ ] **Step 1: Write a failing test for `resetToLogin`**

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { useSessionStore } from './session-store';

describe('resetToLogin', () => {
  it('clears session and shows the login gate', () => {
    useSessionStore.setState({
      bootPhase: 'ready',
      gate: 'none',
      session: { authenticated: true, username: 'ella', role: 'owner' },
      bootError: null,
    });
    useSessionStore.getState().resetToLogin();
    const s = useSessionStore.getState();
    assert.equal(s.bootPhase, 'auth');
    assert.equal(s.gate, 'login');
    assert.equal(s.session, null);
    assert.equal(s.bootError, null);
  });
});
```

Add `"test:session-store"` or fold into `test:settings` / a small `tsx --test src/app/session-store.test.ts` in package.json.

- [ ] **Step 2: Run — expect fail** (`resetToLogin` missing)

- [ ] **Step 3: Implement `resetToLogin` on the store**

```ts
resetToLogin: () =>
  set({ bootPhase: 'auth', gate: 'login', session: null, bootError: null }),
```

- [ ] **Step 4: Run test — expect pass**

- [ ] **Step 5: Commit**

```bash
git commit --only -m "feat(auth): reset session store to login after sign-out" -- web/dashboard/src/app/session-store.ts web/dashboard/src/app/session-store.test.ts web/dashboard/package.json
```

---

### Task 2: Role label helper + account strip UI

**Files:**
- Modify: [`web/dashboard/src/app/permissions.ts`](web/dashboard/src/app/permissions.ts) — add `roleLabel(role: Role): string`
- Modify: [`web/dashboard/src/app/permissions.test.ts`](web/dashboard/src/app/permissions.test.ts)
- Modify: [`web/dashboard/src/app/shell.tsx`](web/dashboard/src/app/shell.tsx)
- Modify: [`web/dashboard/src/app/shell.css`](web/dashboard/src/app/shell.css)

**Interfaces:**
```ts
export function roleLabel(role: Role): string; // 'Owner' | 'Admin' | 'Viewer'
export function usernameFromSession(session): string; // str fallback 'Signed in'
```
Keep `usernameFromSession` in shell or permissions — prefer permissions next to role helpers:

```ts
export function usernameFromSession(session: Record<string, unknown> | null | undefined): string {
  const raw = session?.username;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : 'Signed in';
}
```

- [ ] **Step 1: Failing tests for `roleLabel` / `usernameFromSession`**

```ts
assert.equal(roleLabel('owner'), 'Owner');
assert.equal(usernameFromSession({ username: 'ella' }), 'ella');
assert.equal(usernameFromSession({}), 'Signed in');
```

- [ ] **Step 2: Implement helpers; tests pass**

- [ ] **Step 3: CSS for account strip**

Append to `shell.css`:

```css
.sh-rail__account {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.45rem 0.55rem 0.55rem;
  margin-bottom: 0.15rem;
  border-bottom: 1px solid var(--wt-line);
}

.sh-rail__account-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.sh-rail__account-mark {
  display: flex;
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  background: var(--wt-accent-soft);
  color: var(--wt-accent);
  font-size: 11px;
  font-weight: 650;
  line-height: 1;
}

.sh-rail__account-name {
  min-width: 0;
  flex: 1;
  truncate via overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  font-size: 0.8125rem;
  font-weight: 550;
  color: var(--wt-text);
}

.sh-rail__account-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-left: 2rem; /* align under name, past the mark */
}

.sh-rail__account-role {
  font-size: 11px;
  color: var(--wt-text-low);
}

.sh-rail__sign-out {
  border: 0;
  background: transparent;
  padding: 0.15rem 0.25rem;
  border-radius: var(--radius-wt-sm);
  font-size: 11px;
  font-weight: 550;
  color: var(--wt-text-mid);
  cursor: pointer;
}

.sh-rail__sign-out:hover:not(:disabled) {
  color: var(--wt-text);
  background: color-mix(in srgb, var(--wt-bg2) 80%, transparent);
}

.sh-rail__sign-out:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.sh-rail__sign-out:focus-visible {
  outline: 2px solid var(--wt-accent);
  outline-offset: 1px;
}
```

(Write real CSS properties, not the "truncate via" comment.)

- [ ] **Step 4: Wire strip in `shell.tsx` footer**

```tsx
const session = useSessionStore((s) => s.session);
const resetToLogin = useSessionStore((s) => s.resetToLogin);
const queryClient = useQueryClient();
const role = useRole();
const username = usernameFromSession(session);
const initial = username.slice(0, 1).toUpperCase();
const fixture = isFixturePreview();
const [signingOut, setSigningOut] = useState(false);

async function onSignOut() {
  if (fixture || signingOut) return;
  setSigningOut(true);
  try {
    await api.logout();
  } catch {
    // Cookie may already be gone; still clear local UI.
  }
  queryClient.clear();
  resetToLogin();
  setSigningOut(false);
}

// Inside sh-rail__foot, first child:
<div className="sh-rail__account">
  <div className="sh-rail__account-row">
    <span className="sh-rail__account-mark" aria-hidden>{initial}</span>
    <span className="sh-rail__account-name" title={username}>{username}</span>
  </div>
  <div className="sh-rail__account-meta">
    <span className="sh-rail__account-role">{roleLabel(role)}</span>
    <button
      type="button"
      className="sh-rail__sign-out"
      disabled={fixture || signingOut}
      title={fixture ? 'Not available in fixture preview' : undefined}
      aria-label={signingOut ? 'Signing out' : 'Sign out'}
      onClick={() => void onSignOut()}
    >
      {signingOut ? 'Signing out…' : 'Sign out'}
    </button>
  </div>
</div>
```

Import `api`, `useQueryClient`, `useRole`, `roleLabel`, `usernameFromSession`, `useSessionStore` as needed. Keep support CTA and theme below the account strip.

- [ ] **Step 5: Preview check**

`npm run preview` — strip shows `admin` / Owner (or `?role=viewer`); Sign out disabled in fixture. Live: Sign out returns to login screen.

- [ ] **Step 6: Commit**

```bash
git commit --only -m "feat(shell): show signed-in account and Sign out on the rail" -- web/dashboard/src/app/shell.tsx web/dashboard/src/app/shell.css web/dashboard/src/app/permissions.ts web/dashboard/src/app/permissions.test.ts
```

---

### Task 3: Docs touch (minimal)

**Files:**
- Modify: [`docs/wiki/Accounts-And-Audit-Log.md`](docs/wiki/Accounts-And-Audit-Log.md) — one short "Sign out" note under where you see roles
- Modify: [`CHANGELOG.md`](CHANGELOG.md) Unreleased — one Changed/Added line: rail shows signed-in account + Sign out

Copy (humanizer light): "The bottom of the side rail shows who is signed in. Use **Sign out** when you are done, especially on a shared PC."

- [ ] **Step 1: Edit wiki + changelog**
- [ ] **Step 2: Commit**

```bash
git commit --only -m "docs: note Sign out on the side rail" -- docs/wiki/Accounts-And-Audit-Log.md CHANGELOG.md
```

---

## Self-review

- Multi-admin need covered: identity visible + leave without closing the browser.
- Logout path clears cookie (API) + client cache + gate (no stale data after switch user).
- Fixture-safe: no broken logout in preview.
- No dashboard design-taste landing patterns; matches rail CSS.