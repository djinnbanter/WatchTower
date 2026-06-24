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
  - **Initial audit** scans logs, crashes, mods, and backups, then runs a 30-day baseline report
  - **Backups** — automatic scan for backup files; configure later in Settings if none found
  - **Scheduled reports** — twice daily (recommended), hourly, or off
  - **Security** (optional) — enable 2FA if the dashboard is reachable from the internet
  - Reopen anytime: **Help → Run setup wizard again**, or add `?setup=1` to the dashboard URL

- [ ] **5. Set up backups** (if skipped in wizard)
  - **Settings → Backups** — folder on this server, panel webhook, or hybrid

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
