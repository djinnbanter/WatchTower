# Accounts and audit log

Named logins for people who share a dashboard, plus a short ledger of who changed what. Three roles only — not a full permission matrix.

---

## Roles

| Role | Can do |
|------|--------|
| **owner** | Everything, including add / change / remove accounts |
| **admin** | Operate the dashboard (settings, acks, suppressions, scans). Cannot manage accounts |
| **viewer** | Read-only. Any write returns 403 `read_only_account` |

Viewers do not see **Settings → Accounts** or **Settings → Audit log**. Admins see the audit log but not Accounts.

Only the **owner** runs the full setup wizard. Other accounts sign in, change their temporary password, and go straight to the dashboard.

The bottom of the side rail shows who is signed in. Use **Sign out** when you are done, especially on a shared PC.

---

## Adding someone

1. Sign in as **owner**.
2. Open **Settings → Accounts**.
3. Pick a username and role (`admin` or `viewer`; you can promote to `owner` later).
4. Watchtower shows a **temporary password once**. Copy it and hand it to that person out of band (chat, password manager share — not the public server log).
5. They sign in, change the password, and optionally set up 2FA under **Settings → Security**.

Changing someone’s role (or disabling them) ends that person’s sessions immediately. They must sign in again.

---

## Recover the owner

Forgot the owner password, or locked out of 2FA:

| Situation | What to do |
|-----------|------------|
| Password forgotten, 2FA off | OP 4: `/watchtower dashboard reset-password` |
| Lost authenticator | Recovery code at login, or OP 4: `/watchtower dashboard reset-password clear-2fa` |
| Last resort | Stop the server, delete `watchtower/dashboard-auth.json`, start again — default `watchtower` / `password` returns and must be changed |

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
- Blocked writes (`write_denied` when a viewer tries a POST)

Retention: newest **2000** entries, max age **90 days**. Older rows are pruned when a new row is appended.

File: `watchtower/audit-log.jsonl` (one JSON object per line). Do not put this in support packs — it holds usernames and client IPs.

---

## File locations

| Path | Purpose |
|------|---------|
| `watchtower/dashboard-auth.json` | Schema 2 accounts (hashed passwords, roles, optional 2FA). Do not edit by hand |
| `watchtower/dashboard-auth.json.pre-1.1.18.bak` | One-time copy of the pre-upgrade credential file |
| `watchtower/audit-log.jsonl` | Append-only audit ledger |
| `watchtower/.auth-key` | Encrypts TOTP secrets — keep with the auth file |

Use **Settings → Security** for your own password / 2FA, and **Settings → Accounts** for other people.

---

## Updating from an older Watchtower

Your existing username and password keep working. That account becomes the **owner**. No config edit and no password reset.

Everyone signs in again after the restart (sessions are in memory — same as any restart).

Before the first schema 2 write, Watchtower copies the old file to `dashboard-auth.json.pre-1.1.18.bak` once (never overwritten if it already exists).

**Rollback caveat:** a rolled-back (pre-1.1.18) jar can still log in the owner because schema 2 keeps a top-level mirror of the owner credential. If you then **change the password on the old jar**, that build rewrites the file without the `accounts` list. Extra accounts are gone. After you upgrade again, only the owner is recovered — add the others once more.

---

## Related

- [[Security-and-Access]] — first login, 2FA, SSH tunnel
- [[Configuration]] — Settings panels
- [[On-disk-Files]] — auth + audit paths
- [[HTTP-API]] — `/api/accounts`, `/api/audit-log`, role 403 codes
