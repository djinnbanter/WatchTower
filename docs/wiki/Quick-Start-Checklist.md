# Quick Start Checklist

Work through these steps **in order** after Watchtower is installed and the server has started once.

---

## At a glance

- **Time:** about 15 minutes for a solid setup
- **Goal:** first health report, backup location, optional automatic reports and 2FA
- **Before you start:** [[Installation]] done

---

## Checklist

- [ ] **1. Confirm Watchtower started** — look for Watchtower lines in the console and a `watchtower/` folder on the server

- [ ] **2. Open the dashboard** — `http://<your-server-ip>:8787` in your browser

- [ ] **3. Sign in and change password** — username `watchtower`, password `password` → pick a new password when asked

- [ ] **4. Complete the setup wizard** — opens automatically on first visit
  - **Initial audit** — live discovery of activity, crashes, mods, and whether backups are configured (does **not** start a long report by itself)
  - **Optional 30-day baseline** — start a full health report from the wizard; you can continue setup while it runs
  - **Backups** — open the Backups tab to configure a folder or panel heartbeat (no silent defaults; no automatic folder guess)
  - **Scheduled reports** — default is twice daily (midnight and noon, server time); change or turn off in the wizard or Settings → General
  - **Security** (optional) — confirm password change and enable 2FA if the dashboard is reachable beyond localhost
  - Reopen anytime: **Docs → Run again**, or add `?setup=1` to the dashboard URL

- [ ] **5. Set up backups** (if skipped in the wizard)
  - **Backups** tab — folder on this server, panel webhook, or hybrid

- [ ] **6. Turn on scheduled reports** (if skipped in wizard) — **Settings** → **General** → e.g. twice daily or every hour

- [ ] **7. Optional: two-factor login (2FA)** — **Settings → Security** — recommended if people outside your home network can reach the dashboard

- [ ] **8. On a public host** — see [[Security and Access]] for how to connect safely (often localhost + tunnel instead of opening port 8787 to the internet)

---

## After setup

| I want to… | Go to |
|------------|-------|
| Understand each dashboard tab | [[Dashboard Tabs]] |
| Tune live charts | [[Live Charts]] |
| Learn useful commands | [[Commands]] |
| Fix a problem | [[Troubleshooting]] |

---

## Replay the guided tour

Click **Help (?)** → **Tour**, or open **Settings → About** → **Start guided tour**.
