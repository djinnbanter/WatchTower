# Quick Start Checklist

Work through these steps **in order** after Watchtower is installed and the server has started once.

---

## At a glance

- **Time:** about 10–15 minutes for a solid setup
- **Goal:** Watching/Scanning healthy, backup location known, password changed
- **Before you start:** [[Installation]] done

---

## Checklist

- [ ] **1. Confirm Watchtower started** — Watchtower lines in the console and a `watchtower/` folder on the server

- [ ] **2. Open the dashboard** — `http://<your-server-ip>:8787` in your browser

- [ ] **3. Sign in and change username/password** — default `watchtower` / `password` → set a new account before continuing

- [ ] **4. Complete Welcome (optional but recommended)** — opens on first visit; skippable anytime
  - Skim live vitals, crash intelligence, attention queue, backups & Spark
  - Reopen anytime from the **Help Center** hub, or open `?tab=wizard` on the dashboard URL

- [ ] **5. Check Sources** — open **Sources** and confirm **Watching** and **Scanning** look fresh (or Waiting on the first tick). See [[Sources]] and [[Understanding-Data-Sources]]

- [ ] **6. Set up backups** — **Backups** tab: pick a folder on this server, a panel webhook, or leave **Not tracking** on purpose

- [ ] **7. Optional: two-factor login (2FA)** — **Settings → Security** if people outside your home network can reach the dashboard

- [ ] **8. On a public host** — see [[Security-and-Access]] (often localhost + tunnel instead of opening port 8787 to the internet)

- [ ] **9. Need a support zip?** — rail **Build support pack**, Overview **Support pack** card, or Help Center hub **Build pack**. **Coming soon:** downloadable zip may still be finishing — the flow still explains what goes in the pack. Details: [[Health-Reports]]

---

## After setup

| I want to… | Go to |
|------------|-------|
| Understand each dashboard tab | [[Dashboard-Tabs]] |
| Use Overview as mission control | [[Dashboard-Overview]] |
| Tune live charts | [[Live-Charts]] |
| Share a snapshot with support | Rail **Build support pack** · [[Health-Reports]] |
| Fix a problem | [[Troubleshooting]] |

---

## Related

- [[Installation]]
- [[Sources]]
- [[Security-and-Access]]
- [[Backups]]
