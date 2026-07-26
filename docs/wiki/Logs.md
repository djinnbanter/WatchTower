# Logs

**Logs** browses server log files with severity filters and search — raw lines, not crash summaries.

---

## When to open it

- Fix / Evidence asked for a raw file
- You need to search spam or a specific exception
- Crash groups are not enough context

Use [[Crashes]] for fingerprinted crash groups and Fix steps.

---

## Logs vs Crashes

| Logs | Crashes |
|------|---------|
| File list + filtered viewer | Fingerprint groups |
| Tail / search / severity | Fix / Evidence / Details |
| Any log noise | Crash-shaped incidents |

---

## What you’ll see

- Sidebar of available log files
- Severity filters and search
- Tail-style viewing of recent lines

---

## What to do next

1. Pick the file Fix named (often `latest.log` or a crash-adjacent log)
2. Filter to ERROR/WARN before reading everything
3. Jump back to [[Crashes]] or [[Issues]] with what you found

---

## Related

- [[Crashes]]
- [[Troubleshooting]]
- [[Mods]]
