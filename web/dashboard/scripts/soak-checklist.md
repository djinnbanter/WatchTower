# Live soak checklist (`npm run preview:live`)

Start Watchtower on the server, then:

```bash
cd web/dashboard
WATCHTOWER_ORIGIN=http://127.0.0.1:8787 npm run preview:live
```

Open http://127.0.0.1:8081/

- [ ] Sign in (default `watchtower` / `password` if unchanged)
- [ ] Forced password change / TOTP frames if required
- [ ] First-run wizard (or `?setup=1`): options → discovery → backups → security
- [ ] Live tab charts update
- [ ] Mods → Scan now refreshes list
- [ ] Spark → open a profile
- [ ] Support pack → Build & download produces a zip
- [ ] Settings → Security: password / 2FA / recovery
- [ ] Settings save persists after reload
