# 1.1.20 Backup integrity verify (+ test restore) — Design

**Status:** Approved 2026-08-01  
**Roadmap:** [`docs/dev/roadmap/versions/1.1.19-1.1.29-change-safety-and-recovery.md`](../../dev/roadmap/versions/1.1.19-1.1.29-change-safety-and-recovery.md) §1.1.20  
**Plan:** [`docs/superpowers/plans/2026-08-01-backup-integrity-verify.md`](../plans/2026-08-01-backup-integrity-verify.md)

## Goal

Admins can trust backup inventory: light-verify each archive, see status chips, re-check with Verify now, optionally run a sandboxed test restore, and get an Issue when the newest backup fails light verify.

## Locked decisions

| Decision | Choice |
| -------- | ------ |
| Scope | Full 1.1.20: light + chips + Verify now + manual test restore |
| Persistence | `backups_live.inventory[].verify` (Approach A); not sidecar files |
| Light “verified” | Opens + `level.dat` or `level.dat_old` + ≥1 `**/region/*.mca` |
| Missing region only | `suspicious` |
| Unreadable / truncated | `broken` |
| Formats v1 | `.zip`, `.tar.gz`/`.tgz`; else `not_checked` |
| Auto verify | Queue on new inventory path; max 1 concurrent; defer if players>0 or MSPT > threshold |
| Manual Verify now | Bypasses defer |
| Test restore | Async job; free disk ≥ size × 1.5; only under `watchtower/restore-verify/<id>/` |
| Issue | Newest `broken` or `suspicious` → `BACKUP_VERIFY_FAILED` when tracking on |
| Naming | New `BackupVerifier` / attacher / scheduler — do not overload freshness `BackupStatusResolver` |

## Architecture

- Pure verifier in `watchtower-core` (`BackupVerifier.lightVerify`).
- Results merge onto inventory; preserved across rescan by absolute `path`.
- Daemon `BackupVerifyScheduler` (`watchtower-backup-verify`) — never tick thread.
- HTTP: sync light verify; async test-restore start/status/cleanup.
- UI: chips + findings + actions behind `useCanWrite`.

## Conf

| Key | Default |
| --- | ------- |
| `BACKUP_VERIFY_AUTO` | `true` |
| `BACKUP_VERIFY_DEFER_WHEN_PLAYERS` | `true` |
| `BACKUP_VERIFY_MAX_MSPT` | `40` |
| `BACKUP_TEST_RESTORE_ENABLED` | `true` |

## Out of scope

Panel restore APIs, auto full-extract, deep byte hashing, `.7z` support, verify sidecars in backup folders.
