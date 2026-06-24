# Security and Access

The dashboard is protected by **username and password**. Treat it like any admin panel — do not expose it to the whole internet without extra care.

---

## At a glance

- **First login:** `watchtower` / `password` — you **must** pick a new password
- **2FA (optional):** **Settings → Security** — recommended on public hosts
- **Public VPS / hosting panel:** use localhost + SSH tunnel — do not open port 8787 to the world
- **Too many wrong passwords:** wait 15 minutes (5 tries per IP)

---

## First login

1. Open `http://<your-server-ip>:8787`
2. Sign in with `watchtower` / `password`
3. Choose a new password (at least 8 characters)
4. Optional: enable 2FA in **Settings → Security**

---

## Two-factor authentication (2FA)

1. **Settings → Security** → Enable 2FA
2. Scan the QR code with Google Authenticator, Authy, or similar
3. **Save the recovery codes** when shown — they appear only once

After that, login needs your password plus a code from the app (or a recovery code).

---

## Locked out?

| Situation | What to do |
|-----------|------------|
| Never changed the default password | Try `watchtower` / `password` |
| Forgot password, 2FA **off** | Someone with OP 4 runs `/watchtower dashboard reset-password` |
| Forgot password, 2FA **on** | Use a **recovery code** at login, then change password in Settings |
| Lost authenticator app | Recovery code at login, or OP 4: `/watchtower dashboard reset-password clear-2fa` |
| Last resort | Stop server, delete `watchtower/dashboard-auth.json`, start server — default account returns |

---

## Connect safely from home (SSH tunnel)

**Recommended** when the dashboard only listens on localhost:

```bash
ssh -L 8787:127.0.0.1:8787 user@your-server
```

Then open **http://127.0.0.1:8787** in your browser on your PC.

### Restrict dashboard to localhost

```toml
# config/watchtower-server.toml
dashboardBindHost = "127.0.0.1"
```

Restart the server after changing this file.

---

## Yellow exposure banner

If the dashboard binds to `0.0.0.0`, you may see a warning that the port could be reached from your network. Login is still required, but anyone who can reach the port can try to sign in.

On **bloom.host**, Pterodactyl, and public VPS hosts: do not forward port 8787 publicly.

---

## Technical details

- Credentials: hashed in `watchtower/dashboard-auth.json`
- Session: 24 hours default; “Remember this device” = 7 days
- Security headers: `X-Frame-Options`, CSP — scripts served locally
- `dashboardAuthToken` in old TOML configs is **ignored** in 1.0.0+

---

## See also

- [[Dashboard Overview]]
- [[Commands]]
- [[Troubleshooting]]
