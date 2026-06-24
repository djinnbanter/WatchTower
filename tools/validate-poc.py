#!/usr/bin/env python3
"""Offline PoC validation — regression fixtures (no Linux required)."""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENGINE = ROOT / "legacy"
BUILD = ENGINE / "mc-status-build-staging.py"
ANALYZE = ENGINE / "mc-status-analyze.py"
RCON = ENGINE / "mc-status-rcon.py"
EXTRAS = ENGINE / "mc-status-extras.py"
EXAMPLE_SERVER_UUID = "00000000-0000-0000-0000-000000000001"
EXAMPLE_SERVER_DIR = f"/var/opt/minecraft/crafty/crafty-4/servers/{EXAMPLE_SERVER_UUID}"
REPORTS = ROOT / "fixtures" / "validation"


def load_build_module():
    spec = importlib.util.spec_from_file_location("build", BUILD)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_analyze_module():
    spec = importlib.util.spec_from_file_location("analyze", ANALYZE)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def run_pipeline(staging_data: dict, label: str) -> tuple[Path, Path, str]:
    REPORTS.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    staging = REPORTS / f"validate-staging-{label}-{ts}.json"
    facts = REPORTS / f"validate-facts-{label}-{ts}.json"
    brief = REPORTS / f"validate-brief-{label}-{ts}.txt"

    staging.write_text(json.dumps(staging_data, indent=2), encoding="utf-8")
    subprocess.run([sys.executable, str(ANALYZE), "build", str(staging), str(facts)], check=True)
    subprocess.run([sys.executable, str(ANALYZE), str(facts), str(brief)], check=True)
    return facts, brief, brief.read_text(encoding="utf-8")


def test_panel_incident() -> list[str]:
    data = {
        "meta": {
            "generated": datetime.now(timezone.utc).astimezone().isoformat(),
            "hostname": "example-host-validate",
            "lookback_hours": 24,
            "window_start": "2026-06-15T09:55:00+01:00",
            "incremental": False,
            "server_dir": "/var/opt/minecraft/crafty/servers/example-host",
            "panel": "crafty",
            "loader": "neoforge",
        },
        "flags": {"java_running": False, "panel_running": False},
        "thresholds": {
            "disk_warn_pct": 85,
            "mem_warn_avail_gb": 2,
            "log_stale_minutes": 15,
            "cant_keep_up_warn": 5,
        },
        "system": {
            "uptime_seconds": 3600,
            "mem_available_gb": 28.5,
            "disk_use_pct": 5,
            "swap_used_mb": 0,
            "load_avg": [0.1, 0.2, 0.3],
        },
        "events": [
            {
                "time": "2026-06-16T02:08:56+01:00",
                "type": "session_close",
                "subtype": "su_crafty",
                "source": "journal",
                "detail": "su crafty session closed",
                "importance": 9,
            },
        ],
        "minecraft": {
            "clean_shutdown_seen": False,
            "oom_in_logs": False,
            "cant_keep_up_count": 0,
            "new_crash_reports": [],
            "last_log_line": "[16Jun2026 02:08:54.123] DH pregen progress",
            "last_log_file": "logs/latest.log",
            "last_log_line_no": 999,
            "last_log_time": "2026-06-16T02:08:54+01:00",
            "log_had_activity_in_window": True,
            "tick_lag_evidence": [],
            "oom_evidence": [],
        },
        "health_log_gap_minutes": 380,
        "kernel_oom_evidence": [],
        "optional": {
            "dh_pregen": {
                "first": {"chunks": 650.0, "total": 3126, "cps": 31, "time": "2026-06-16T00:00:00+01:00"},
                "last": {
                    "chunks": 680.7,
                    "total": 3126,
                    "cps": 31,
                    "time": "2026-06-16T02:08:54+01:00",
                },
                "cps_avg": 31.0,
            }
        },
    }
    _, _, text = run_pipeline(data, "incident")
    checks = [
        ("CRITICAL" in text, "status reflects incident"),
        ("NOT RUNNING" in text, "Java down"),
        ("TL;DR" in text, "TLDR section"),
        ("DH pregen" in text, "pregen in summary"),
        ("680.7" in text, "pregen progress"),
        ("NOTABLE TIMELINE" in text, "ranked timeline section"),
    ]
    return [msg for ok, msg in checks if not ok]


def test_recovered_server() -> list[str]:
    """Java up, historical crashes — Now: OK, Overall: CRITICAL."""
    now = datetime.now(timezone.utc).astimezone()
    data = {
        "meta": {
            "lookback_hours": 24,
            "incremental": False,
            "window_start": "2026-06-15T10:00:00+01:00",
            "panel": "crafty",
            "loader": "neoforge",
        },
        "flags": {"java_running": True, "panel_running": True},
        "thresholds": {"disk_warn_pct": 85, "mem_warn_avail_gb": 2, "log_stale_minutes": 15, "cant_keep_up_warn": 5},
        "system": {"uptime_seconds": 5000, "mem_available_gb": 10, "disk_use_pct": 5, "java_rss_gb": 15, "java_xmx_gb": 20},
        "events": [{"time": "2026-06-16T08:28:00+01:00", "type": "reboot", "detail": "reboot", "importance": 10}],
        "minecraft": {
            "clean_shutdown_seen": True,
            "oom_in_logs": False,
            "cant_keep_up_count": 0,
            "new_crash_reports": [{
                "file": "crash-old.txt",
                "time": "2026-06-15T21:00:00+01:00",
                "quote": "---- Minecraft Crash Report ----",
            }],
            "log_had_activity_in_window": True,
            "last_log_time": now.isoformat(),
            "server_started": "2026-06-16T08:55:00+01:00",
            "tick_lag_evidence": [],
            "oom_evidence": [],
        },
        "health_log_gap_minutes": 1,
        "kernel_oom_evidence": [],
        "optional": {
            "dh_pregen": {
                "first": {"chunks": 100, "total": 3126, "cps": 30, "time": "2026-06-15T22:00:00+01:00"},
                "last": {"chunks": 681, "total": 3126, "cps": 29, "time": "2026-06-16T08:55:00+01:00"},
                "pregen_paused": True,
                "pregen_active": False,
                "hours_since_last": 0.5,
            }
        },
    }
    facts, _, text = run_pipeline(data, "recovered")
    facts_data = json.loads(facts.read_text(encoding="utf-8"))
    failed = []
    if facts_data.get("health", {}).get("current_status") != "ok":
        failed.append("current_status should be ok")
    if "Now: OK" not in text:
        failed.append("brief should show Now: OK")
    if "TL;DR" not in text:
        failed.append("brief should have TLDR")
    if "HISTORICAL" not in text:
        failed.append("brief should split historical issues")
    if "3 GB" in text:
        failed.append("should not show false 3GB xmx")
    if "JAVA_HEAP_HIGH" in text or "90% of -Xmx" in text:
        failed.append("should not warn on RSS vs Xmx when host RAM is fine")
    return failed


def test_mem_low_alert() -> list[str]:
    data = {
        "meta": {"lookback_hours": 24, "incremental": False, "panel": "crafty", "loader": "neoforge"},
        "flags": {"java_running": True, "panel_running": True},
        "thresholds": {"disk_warn_pct": 85, "mem_warn_avail_gb": 2, "log_stale_minutes": 15, "cant_keep_up_warn": 5},
        "system": {"uptime_seconds": 100, "mem_available_gb": 1.5, "disk_use_pct": 5, "java_rss_gb": 23, "java_xmx_gb": 20},
        "events": [],
        "minecraft": {
            "log_had_activity_in_window": True,
            "last_log_time": datetime.now(timezone.utc).astimezone().isoformat(),
            "cant_keep_up_count": 0,
            "new_crash_reports": [],
            "oom_in_logs": False,
            "tick_lag_evidence": [],
            "oom_evidence": [],
        },
        "health_log_gap_minutes": 1,
        "kernel_oom_evidence": [],
        "optional": {},
    }
    facts, _, text = run_pipeline(data, "mem-low")
    facts_data = json.loads(facts.read_text(encoding="utf-8"))
    failed = []
    if not any(i.get("id") == "MEM_LOW" for i in facts_data.get("issues", [])):
        failed.append("MEM_LOW should fire when avail < 2GB")
    if "off-heap" not in text:
        failed.append("RSS line should mention off-heap")
    return failed


def test_player_join_regex() -> list[str]:
    mod = load_build_module()
    line = (
        "[15Jun2026 22:38:26.278] [Server thread/INFO] "
        "[net.minecraft.server.MinecraftServer/]: TESTPLAYER joined the game"
    )
    m = mod.PLAYER_JOIN.search(line)
    failed = []
    if not m:
        failed.append("PLAYER_JOIN should match NeoForge log line")
    elif m.group(1) != "TESTPLAYER":
        failed.append(f"expected TESTPLAYER, got {m.group(1)!r}")
    return failed


def test_player_session_boundaries() -> list[str]:
    mod = load_build_module()
    tz = datetime.now().astimezone().tzinfo
    end = datetime(2026, 6, 16, 12, 0, 0, tzinfo=tz)
    t = mod.PlayerTracker(end)
    events = [
        (datetime(2026, 6, 16, 10, 0, 0, tzinfo=tz), "join", "Alice"),
        (datetime(2026, 6, 16, 10, 30, 0, tzinfo=tz), "server_stop", ""),
        (datetime(2026, 6, 16, 11, 0, 0, tzinfo=tz), "join", "Bob"),
    ]
    mod.replay_player_events(t, events)
    stats = t.finalize()
    failed = []
    alice_sessions = [s for s in stats["sessions"] if s["player"] == "Alice"]
    if not alice_sessions or alice_sessions[0]["minutes"] > 35:
        failed.append(
            f"Alice session should end at stop (~30 min), got {alice_sessions[0]['minutes'] if alice_sessions else 'none'}"
        )
    if stats["unique_players"] != 2:
        failed.append(f"expected 2 unique players, got {stats['unique_players']}")
    return failed


def test_backup_nested_scan() -> list[str]:
    import tempfile

    mod = load_build_module()
    failed = []
    with tempfile.TemporaryDirectory() as tmp:
        backup_root = Path(tmp) / "backups"
        server_uuid = EXAMPLE_SERVER_UUID
        nested = backup_root / server_uuid
        nested.mkdir(parents=True)
        archive = nested / f"backup-{server_uuid[:8]}.tar.gz"
        archive.write_bytes(b"x" * 1024)
        server_dir = str(Path(tmp) / "servers" / server_uuid)
        dirs = mod.backup_search_dirs(backup_root, server_dir)
        if len(dirs) < 2:
            failed.append("backup_search_dirs should include nested UUID folder")
        candidates = mod.iter_backup_candidates(dirs, server_dir)
        if not candidates:
            failed.append("should find archive in nested backup dir")
    return failed


def test_cpu_snapshot() -> list[str]:
    mod = load_build_module()
    calls = [
        (100, 1000),
        (150, 1200),
    ]

    def fake_read():
        return calls.pop(0)

    mod.read_proc_stat_cpu = fake_read  # type: ignore[attr-defined]
    mod.time.sleep = lambda _x: None  # type: ignore[attr-defined]
    pct = mod.host_cpu_pct_now()
    failed = []
    # idle went 100->150 (+50), total 1000->1200 (+200), util = 1 - 50/200 = 75%
    if pct != 75.0:
        failed.append(f"expected 75% host CPU, got {pct}")
    return failed


def test_cpu_brief_format() -> list[str]:
    data = {
        "meta": {"lookback_hours": 24, "incremental": False, "panel": "crafty", "loader": "neoforge"},
        "flags": {"java_running": True, "panel_running": True},
        "thresholds": {"disk_warn_pct": 85, "mem_warn_avail_gb": 2, "log_stale_minutes": 15, "cant_keep_up_warn": 5},
        "system": {
            "uptime_seconds": 5000,
            "mem_available_gb": 10,
            "disk_use_pct": 5,
            "load_avg": [26.4, 25.2, 23.6],
            "cpu_count": 20,
            "load_1m_per_core": 1.32,
            "host_cpu_pct_now": 72.0,
            "host_cpu_pct_avg": 58.0,
            "host_cpu_avg_source": "sar",
            "java_cpu_pct_avg": 340.0,
            "java_cpu_cores_equiv": 3.4,
            "java_cpu_pct_of_machine": 17.0,
        },
        "events": [],
        "minecraft": {
            "log_had_activity_in_window": True,
            "last_log_time": datetime.now(timezone.utc).astimezone().isoformat(),
            "cant_keep_up_count": 0,
            "new_crash_reports": [],
            "oom_in_logs": False,
            "tick_lag_evidence": [],
            "oom_evidence": [],
        },
        "health_log_gap_minutes": 1,
        "kernel_oom_evidence": [],
        "optional": {},
    }
    _, _, text = run_pipeline(data, "cpu-brief")
    failed = []
    if "Host utilization" not in text:
        failed.append("brief should show host utilization")
    if "queue depth" not in text:
        failed.append("load should be labeled queue depth")
    if "utilization" not in text.lower():
        failed.append("brief should mention utilization")
    util_pos = text.find("Host utilization")
    load_pos = text.find("queue depth")
    if util_pos < 0 or load_pos < 0 or util_pos > load_pos:
        failed.append("utilization should appear before load queue depth")
    return failed


def test_player_tracker() -> list[str]:
    mod = load_build_module()
    tz = datetime.now().astimezone().tzinfo
    end = datetime(2026, 6, 16, 12, 0, 0, tzinfo=tz)
    t = mod.PlayerTracker(end)
    t.join("Alice", datetime(2026, 6, 16, 10, 0, 0, tzinfo=tz))
    t.join("Bob", datetime(2026, 6, 16, 10, 30, 0, tzinfo=tz))
    t.leave("Alice", datetime(2026, 6, 16, 11, 0, 0, tzinfo=tz))
    stats = t.finalize()
    failed = []
    if stats["peak_concurrent"] != 2:
        failed.append(f"peak should be 2, got {stats['peak_concurrent']}")
    if stats["unique_players"] != 2:
        failed.append(f"unique should be 2, got {stats['unique_players']}")
    if stats["player_hours"] < 1.4:
        failed.append(f"player_hours too low: {stats['player_hours']}")
    return failed


def test_timeline_chronological() -> list[str]:
    spec = importlib.util.spec_from_file_location("analyze", ANALYZE)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    events = [
        {"time": "2026-06-16T10:47:44+01:00", "type": "session_close", "subtype": "sshd", "detail": "ssh"},
        {"time": "2026-06-16T10:30:58+01:00", "type": "panel_command", "detail": "pregen"},
        {"time": "2026-06-16T08:56:28+01:00", "type": "server_start", "detail": "start"},
        {"time": "2026-06-16T08:28:35+01:00", "type": "reboot", "detail": "reboot now"},
        {"time": "2026-06-16T08:28:35+01:00", "type": "reboot", "detail": "rebooting"},
        {"time": "2026-06-15T22:19:23+01:00", "type": "crash_report", "detail": "crash-b"},
        {"time": "2026-06-15T21:36:38+01:00", "type": "crash_report", "detail": "crash-a"},
    ]
    ranked = mod.ranked_timeline(events)
    failed = []
    times = [mod.time_sort_key(e.get("time")) for e in ranked]
    if times != sorted(times, reverse=True):
        failed.append("timeline not reverse chronological")
    if ranked[0].get("type") != "session_close":
        failed.append("newest event should be first")
    crash_count = sum(1 for e in ranked if e.get("type") == "crash_report")
    if crash_count != 2:
        failed.append(f"both crashes should appear, got {crash_count}")
    reboot_count = sum(1 for e in ranked if e.get("type") == "reboot")
    if reboot_count != 1:
        failed.append(f"same-second reboots should dedupe to 1, got {reboot_count}")
    return failed


def test_v22_formatting() -> list[str]:
    data = {
        "meta": {
            "lookback_hours": 24,
            "incremental": False,
            "panel": "crafty",
            "loader": "neoforge",
            "server_dir": EXAMPLE_SERVER_DIR,
        },
        "flags": {"java_running": True, "panel_running": True},
        "thresholds": {"disk_warn_pct": 85, "mem_warn_avail_gb": 2, "log_stale_minutes": 15, "cant_keep_up_warn": 5},
        "system": {
            "uptime_seconds": 5000,
            "mem_available_gb": 10,
            "disk_use_pct": 5,
            "load_avg": [20.91, 20.31, 14.24],
            "cpu_count": 16,
        },
        "events": [
            {"time": "2026-06-16T02:08:56+01:00", "type": "session_close", "subtype": "su_crafty", "detail": "su1"},
            {"time": "2026-06-16T08:45:44+01:00", "type": "session_close", "subtype": "su_crafty", "detail": "su2"},
        ],
        "minecraft": {
            "log_had_activity_in_window": True,
            "last_log_time": datetime.now(timezone.utc).astimezone().isoformat(),
            "cant_keep_up_count": 0,
            "new_crash_reports": [],
            "oom_in_logs": False,
            "tick_lag_evidence": [],
            "oom_evidence": [],
            "player_stats": {"peak_concurrent": 2, "unique_players": 3, "player_hours": 4.5},
        },
        "health_log_gap_minutes": 1,
        "kernel_oom_evidence": [],
        "optional": {
            "last_backup": {
                "status": "success",
                "size_gb": 3.4,
                "time": "2026-06-16T04:00:00+01:00",
            }
        },
    }
    facts, _, text = run_pipeline(data, "v22")
    facts_data = json.loads(facts.read_text(encoding="utf-8"))
    failed = []
    if "00000000..." not in text:
        failed.append("UUID should be truncated in header")
    if "16 cores" not in text and "20 cores" not in text:
        failed.append("load line should show core count")
    if "Backup: SUCCESS (3.4 GB)" not in text:
        failed.append("backup line missing")
    if "PLAYER STATISTICS" not in text:
        failed.append("player statistics section missing")
    su = [i for i in facts_data.get("issues", []) if i.get("id") == "SESSION_ATTACH_HISTORICAL"]
    if not su or "2 instances" not in su[0].get("message", ""):
        failed.append("su crafty should be collapsed with count")
    return failed


def test_containerd_not_oom() -> list[str]:
    data = {
        "meta": {"lookback_hours": 24, "incremental": False, "panel": "none", "loader": "unknown"},
        "flags": {"java_running": True, "panel_running": False},
        "thresholds": {"disk_warn_pct": 85, "mem_warn_avail_gb": 2, "log_stale_minutes": 15, "cant_keep_up_warn": 5},
        "system": {"uptime_seconds": 100, "mem_available_gb": 10, "disk_use_pct": 5, "swap_used_mb": 0},
        "events": [],
        "minecraft": {
            "clean_shutdown_seen": False,
            "oom_in_logs": False,
            "cant_keep_up_count": 0,
            "new_crash_reports": [],
            "log_had_activity_in_window": True,
            "last_log_time": datetime.now(timezone.utc).astimezone().isoformat(),
            "tick_lag_evidence": [],
            "oom_evidence": [],
        },
        "health_log_gap_minutes": 1,
        "kernel_oom_evidence": [],
        "optional": {},
    }
    facts, _, text = run_pipeline(data, "no-oom")
    facts_data = json.loads(facts.read_text(encoding="utf-8"))
    failed = []
    if any(i.get("id") == "OOM" for i in facts_data.get("issues", [])):
        failed.append("should not trigger OOM")
    return failed


def test_issue_evidence() -> list[str]:
    data = {
        "meta": {"lookback_hours": 24, "incremental": False, "panel": "crafty", "loader": "neoforge"},
        "flags": {"java_running": True, "panel_running": True},
        "thresholds": {"disk_warn_pct": 85, "mem_warn_avail_gb": 2, "log_stale_minutes": 15, "cant_keep_up_warn": 2},
        "system": {"uptime_seconds": 100, "mem_available_gb": 10, "disk_use_pct": 5, "swap_used_mb": 0},
        "events": [],
        "minecraft": {
            "clean_shutdown_seen": False,
            "oom_in_logs": False,
            "cant_keep_up_count": 3,
            "new_crash_reports": [{
                "file": "crash-test.txt",
                "time": "2026-06-15T22:00:00+01:00",
                "quote": "---- Minecraft Crash Report ----",
            }],
            "log_had_activity_in_window": True,
            "last_log_time": datetime.now(timezone.utc).astimezone().isoformat(),
            "server_started": "2026-06-16T08:00:00+01:00",
            "tick_lag_evidence": [{
                "file": "logs/debug.log",
                "line": 42,
                "quote": "Can't keep up! Running 2005ms or 40 ticks behind",
            }],
            "oom_evidence": [],
        },
        "health_log_gap_minutes": 1,
        "kernel_oom_evidence": [],
        "optional": {},
    }
    _, _, text = run_pipeline(data, "evidence")
    failed = []
    if "source: logs/debug.log:42" not in text:
        failed.append("tick lag evidence missing file:line")
    if "Can't keep up" not in text:
        failed.append("tick lag quote missing")
    return failed


def test_build_staging_journal_filter() -> list[str]:
    mod = load_build_module()
    staging: dict = {
        "meta": {},
        "flags": {},
        "thresholds": {},
        "events": [],
        "minecraft": {},
        "optional": {},
        "kernel_oom_evidence": [],
    }
    fake_journal = (
        '2026-06-16T08:29:09+0100 example-host containerd[1038]: msg="Start cri plugin"\n'
        '2026-06-16T08:30:00+0100 example-host kernel: Out of memory: Killed process 1234 (java)\n'
        '2026-06-15T12:45:07+0100 example-host sudo[10160]: pam_unix(sudo:session): session closed for user root\n'
        '2026-06-16T02:08:56+0100 example-host su[1101]: pam_unix(su:session): session closed for user crafty\n'
    )

    import subprocess
    orig = subprocess.check_output

    def fake_check_output(cmd, **kwargs):
        if cmd[0] == "journalctl":
            return fake_journal
        return orig(cmd, **kwargs)

    mod.subprocess.check_output = fake_check_output  # type: ignore[attr-defined]
    mod.scan_host_events(staging, "2026-06-16", time.time() - 86400)

    failed = []
    types = [e.get("type") for e in staging["events"]]
    if types.count("kernel_oom") != 1:
        failed.append(f"expected 1 kernel_oom, got {types.count('kernel_oom')}")
    sessions = [e for e in staging["events"] if e.get("type") == "session_close"]
    if len(sessions) != 1:
        failed.append(f"expected 1 session_close (su crafty), got {len(sessions)}")
    elif sessions[0].get("subtype") != "su_crafty":
        failed.append("expected su_crafty subtype")
    if any("sudo" in e.get("detail", "").lower() for e in sessions):
        failed.append("sudo should not be session_close")
    return failed


def test_parse_jvm_heap() -> list[str]:
    mod = load_build_module()
    text = """# For example, to set the maximum to 3GB: -Xmx3G
# -Xms2500M
-Xms20G -Xmx20G
"""
    xms, xmx = mod.parse_jvm_heap_gb(text)
    failed = []
    if xmx != 20:
        failed.append(f"expected xmx 20, got {xmx}")
    if xms != 20:
        failed.append(f"expected xms 20, got {xms}")
    return failed


def test_pregen_meaningful() -> list[str]:
    mod = load_build_module()
    failed = []
    if mod.pregen_meaningful({"chunks": 2, "cps": 0}):
        failed.append("2 chunks 0 cps should not be meaningful")
    if not mod.pregen_meaningful({"chunks": 50, "cps": 0}):
        failed.append("50 chunks should be meaningful")
    if not mod.pregen_meaningful({"chunks": 2, "cps": 31}):
        failed.append("2 chunks with cps should be meaningful")
    return failed


def test_pregen_pct_parse() -> list[str]:
    mod = load_build_module()
    line = (
        "[16Jun2026 10:49:33.770] [DH-World Gen Thread[1]/INFO] "
        "[DistantHorizons-DistantHorizons-com.seibel.distanthorizons.core.generation.PregenManager/]: "
        "Generated radius: 687.55 / 3126 chunks (33 cps, 4.838%), ETA: 311h 53m 32s"
    )
    m = mod.PREGEN_RE.search(line)
    failed = []
    if not m:
        failed.append("pregen regex should match DH line")
        return failed
    if float(m.group(1)) != 687.55:
        failed.append(f"radius mismatch: {m.group(1)}")
    if m.group(4) != "4.838":
        failed.append(f"pct mismatch: {m.group(4)}")
    if "311h 53m 32s" not in (m.group(5) or ""):
        failed.append(f"eta mismatch: {m.group(5)}")
    return failed


def test_pregen_brief_pct() -> list[str]:
    """Brief must use DH-reported %, not radius/target ratio."""
    data = {
        "meta": {"lookback_hours": 24, "incremental": False, "panel": "crafty", "loader": "neoforge"},
        "flags": {"java_running": True, "panel_running": True},
        "thresholds": {"disk_warn_pct": 85, "mem_warn_avail_gb": 2, "log_stale_minutes": 15, "cant_keep_up_warn": 5},
        "system": {"uptime_seconds": 5000, "mem_available_gb": 10, "disk_use_pct": 5, "java_rss_gb": 15, "java_xmx_gb": 20},
        "events": [],
        "minecraft": {
            "log_had_activity_in_window": True,
            "last_log_time": datetime.now(timezone.utc).astimezone().isoformat(),
            "server_started": "2026-06-16T08:55:00+01:00",
            "new_crash_reports": [],
            "cant_keep_up_count": 0,
            "oom_in_logs": False,
            "tick_lag_evidence": [],
            "oom_evidence": [],
        },
        "health_log_gap_minutes": 1,
        "kernel_oom_evidence": [],
        "optional": {
            "dh_pregen": {
                "first": {"chunks": 614.08, "total": 3126, "cps": 33, "pct": 3.865, "time": "2026-06-16T00:00:00+01:00"},
                "last": {
                    "chunks": 687.55,
                    "total": 3126,
                    "cps": 33,
                    "pct": 4.838,
                    "eta": "311h 53m 32s",
                    "time": datetime.now(timezone.utc).astimezone().isoformat(),
                    "file": "logs/latest.log",
                    "line": 4234,
                    "quote": "Generated radius: 687.55 / 3126 chunks (33 cps, 4.838%), ETA: 311h 53m 32s",
                },
                "pregen_active": True,
                "pregen_paused": False,
                "cps_avg": 33.0,
            }
        },
    }
    _, _, text = run_pipeline(data, "pregen-pct")
    failed = []
    if "22.0%" in text or "22%" in text:
        failed.append("brief must not show radius/total as percent")
    if "4.838%" not in text:
        failed.append("brief should show DH-reported 4.838%")
    if "ETA: 311h 53m 32s" not in text:
        failed.append("pregen quote should include full ETA")
    return failed


    return failed


def load_rcon_module():
    spec = importlib.util.spec_from_file_location("rcon", RCON)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_rcon_parse_tps() -> list[str]:
    mod = load_rcon_module()
    text = (
        "Dimension minecraft:overworld: 20.00 TPS, 45.2 MSPT\n"
        "Dimension minecraft:the_nether: 20.00 TPS, 12.0 MSPT"
    )
    parsed = mod.parse_tps_output(text)
    failed = []
    ow = parsed.get("overworld") or {}
    if ow.get("tps") != 20.0:
        failed.append(f"expected tps 20.0, got {ow.get('tps')}")
    if ow.get("mspt") != 45.2:
        failed.append(f"expected mspt 45.2, got {ow.get('mspt')}")
    return failed


def test_session_scoped_tick_lag() -> list[str]:
    """Historical tick lag should not trigger active TICK_LAG when session count is below threshold."""
    data = {
        "meta": {"lookback_hours": 24, "incremental": False, "panel": "crafty", "loader": "neoforge"},
        "flags": {"java_running": True, "panel_running": True},
        "thresholds": {
            "disk_warn_pct": 85, "mem_warn_avail_gb": 2, "log_stale_minutes": 15,
            "cant_keep_up_warn": 5, "mspt_warn": 50, "tps_warn": 19.5,
            "cpu_throttle_pct": 95, "tick_lag_throttle_ms": 5000,
        },
        "system": {"uptime_seconds": 5000, "mem_available_gb": 10, "disk_use_pct": 5},
        "events": [],
        "minecraft": {
            "log_had_activity_in_window": True,
            "last_log_time": datetime.now(timezone.utc).astimezone().isoformat(),
            "server_started": "2026-06-16T08:56:00+01:00",
            "cant_keep_up_count": 4,
            "cant_keep_up_session_count": 1,
            "cant_keep_up_historical_count": 3,
            "new_crash_reports": [],
            "oom_in_logs": False,
            "tick_lag_evidence": [],
            "tick_lag_session_evidence": [],
            "worst_tick_lag_ms": 5100,
            "tps": {
                "source": "log-estimate",
                "overworld": {"tps": 18.0, "mspt": 5100},
                "peak_mspt_24h": 5100,
                "peak_mspt_24h_source": "log",
            },
        },
        "health_log_gap_minutes": 1,
        "kernel_oom_evidence": [],
        "optional": {
            "dh_pregen": {
                "pregen_active": True,
                "last": {"chunks": 700, "total": 3126, "cps": 33, "time": datetime.now(timezone.utc).astimezone().isoformat()},
            },
            "load_attribution": {"verdict": "likely_pregen", "dh_pregen_active": True, "concurrent_at_worst_lag": 0},
        },
    }
    facts, brief, text = run_pipeline(data, "session-ticklag")
    facts_data = json.loads(facts.read_text(encoding="utf-8"))
    failed = []
    tick_issues = [i for i in facts_data.get("issues", []) if i.get("id") == "TICK_LAG"]
    active_tick = [i for i in tick_issues if not i.get("historical")]
    if active_tick:
        failed.append("TICK_LAG should not be active when session count < threshold")
    if "IN-GAME PERFORMANCE" not in text:
        failed.append("brief missing IN-GAME PERFORMANCE section")
    if "likely pregen" not in text:
        failed.append("brief missing load attribution")
    throttle = [i for i in facts_data.get("issues", []) if i.get("id") == "DH_PREGEN_THROTTLE"]
    if not throttle:
        failed.append("expected DH_PREGEN_THROTTLE for high lag during pregen")
    return failed


def test_tick_lag_historical_count_uses_historical_count() -> list[str]:
    """Historical 'before current session' wording must use cant_keep_up_historical_count."""
    data = {
        "meta": {"lookback_hours": 24, "incremental": False, "panel": "crafty", "loader": "neoforge"},
        "flags": {"java_running": True, "panel_running": True},
        "thresholds": {
            "disk_warn_pct": 85,
            "mem_warn_avail_gb": 2,
            "log_stale_minutes": 15,
            "cant_keep_up_warn": 5,
            "mspt_warn": 50,
            "tps_warn": 19.5,
            "cpu_throttle_pct": 95,
            "tick_lag_throttle_ms": 5000,
        },
        "system": {
            "uptime_seconds": 5000,
            "mem_available_gb": 10,
            "disk_use_pct": 5,
            "host_cpu_pct_now": 40,
        },
        "events": [],
        "minecraft": {
            "log_had_activity_in_window": True,
            "last_log_time": datetime.now(timezone.utc).astimezone().isoformat(),
            "server_started": "2026-06-16T08:56:00+01:00",
            "cant_keep_up_count": 7,
            "cant_keep_up_session_count": 1,
            "cant_keep_up_historical_count": 6,
            "tick_lag_evidence": [],
            "tick_lag_session_evidence": [],
            "tick_lag_historical_evidence": [],
            "worst_tick_lag_ms": 2000,
            "tps": {
                "source": "log-estimate",
                "overworld": {"tps": 20.0, "mspt": 40},
                "peak_mspt_24h": 40,
                "peak_mspt_24h_source": "log",
            },
            "new_crash_reports": [],
            "oom_in_logs": False,
        },
        "health_log_gap_minutes": 1,
        "kernel_oom_evidence": [],
        "optional": {
            "dh_pregen": {
                "pregen_active": True,
                "last": {"chunks": 700, "total": 3126, "cps": 33, "time": datetime.now(timezone.utc).astimezone().isoformat()},
            },
            "load_attribution": {"verdict": "likely_pregen", "dh_pregen_active": True, "concurrent_at_worst_lag": 0},
        },
    }
    facts, _brief, text = run_pipeline(data, "ticklag-historical-count")
    facts_data = json.loads(facts.read_text(encoding="utf-8"))
    tick_issues = [i for i in facts_data.get("issues", []) if i.get("id") == "TICK_LAG"]
    historical = [i for i in tick_issues if i.get("historical")]
    failed: list[str] = []
    if not historical:
        failed.append("expected historical TICK_LAG issue")
    else:
        msg = historical[0].get("message", "")
        if "appeared 6 time(s)" not in msg:
            failed.append(f"expected message to mention 6 events, got: {msg}")
        if "appeared 7 time(s)" in msg:
            failed.append("message incorrectly used cant_keep_up_count total")
    if "IN-GAME PERFORMANCE" not in text:
        failed.append("brief missing IN-GAME PERFORMANCE section")
    return failed


def test_v30_mspt_high() -> list[str]:
    data = {
        "meta": {"lookback_hours": 24, "incremental": False, "panel": "crafty", "loader": "neoforge"},
        "flags": {"java_running": True, "panel_running": True},
        "thresholds": {
            "disk_warn_pct": 85, "mem_warn_avail_gb": 2, "log_stale_minutes": 15,
            "cant_keep_up_warn": 5, "mspt_warn": 50, "tps_warn": 19.5,
            "cpu_throttle_pct": 95, "tick_lag_throttle_ms": 5000,
        },
        "system": {"uptime_seconds": 5000, "mem_available_gb": 10, "disk_use_pct": 5, "host_cpu_pct_now": 40},
        "events": [],
        "minecraft": {
            "log_had_activity_in_window": True,
            "last_log_time": datetime.now(timezone.utc).astimezone().isoformat(),
            "server_started": datetime.now(timezone.utc).astimezone().isoformat(),
            "cant_keep_up_count": 0,
            "cant_keep_up_session_count": 0,
            "new_crash_reports": [],
            "oom_in_logs": False,
            "tick_lag_evidence": [],
            "mod_count": 187,
            "log_errors": {"error": 847, "fatal": 0, "top": [{"message": "ItemStack invalid item", "count": 412}]},
            "tps": {
                "source": "rcon",
                "overworld": {"tps": 18.0, "mspt": 72.5},
                "peak_mspt_24h": 72.5,
            },
        },
        "health_log_gap_minutes": 1,
        "kernel_oom_evidence": [],
        "optional": {
            "storage": {"world_gb": 14.2, "delta_mb_24h": 186, "delta_mb_since_last": 12, "logs_mb": 890},
            "disk_io": {"util_pct": 12, "await_ms": 3.2, "device": "nvme0n1"},
            "security": {"failed_ssh": 3, "failed_crafty": 0, "failed_mc": 0, "unique_ip_count": 2, "private_ip_count": 1, "public_ip_count": 1},
            "bandwidth": {"interface": "eth0", "rx_mb_since_last": 120.5, "tx_mb_since_last": 45.2},
        },
    }
    facts, _, text = run_pipeline(data, "v30-mspt")
    facts_data = json.loads(facts.read_text(encoding="utf-8"))
    failed = []
    if not any(i.get("id") == "MSPT_HIGH" for i in facts_data.get("issues", [])):
        failed.append("expected MSPT_HIGH issue")
    if not any(i.get("id") == "TPS_LOW" for i in facts_data.get("issues", [])):
        failed.append("expected TPS_LOW issue")
    if "DEGRADED" not in text:
        failed.append("brief should show DEGRADED tick health")
    if "World size: 14.2 GB" not in text:
        failed.append("brief missing world size")
    if "Disk I/O: 12% util" not in text:
        failed.append("brief missing disk I/O")
    if "847 ERROR" not in text:
        failed.append("brief missing log error count")
    if "Failed logins: SSH 3" not in text:
        failed.append("brief missing security line")
    return failed


def test_watchtower_snapshot() -> list[str]:
    import tempfile

    build = load_build_module()
    failed: list[str] = []

    with tempfile.TemporaryDirectory() as tmp:
        server_dir = Path(tmp)
        wt_dir = server_dir / "watchtower"
        wt_dir.mkdir()
        snapshot = {
            "source": "watchtower",
            "polled_at": datetime.now(timezone.utc).astimezone().isoformat(),
            "overworld": {"tps": 19.85, "mspt": 42.3},
            "players_online": 2,
            "entities": 1500,
            "chunks": 320,
            "mod_count": 42,
        }
        (wt_dir / "snapshot.json").write_text(json.dumps(snapshot), encoding="utf-8")

        loaded = build.load_watchtower_snapshot(str(server_dir))
        if not loaded:
            return ["load_watchtower_snapshot returned None"]
        if loaded.get("source") != "watchtower":
            failed.append(f"expected source watchtower, got {loaded.get('source')}")
        ow = loaded.get("overworld") or {}
        if ow.get("mspt") != 42.3:
            failed.append(f"expected mspt 42.3, got {ow.get('mspt')}")
        if loaded.get("entities") != 1500:
            failed.append("expected entities from snapshot")
        if loaded.get("mod_count") != 42:
            failed.append("expected mod_count from snapshot")

        snapshot["session_mspt"] = {"min": 1.0, "max": 99.0, "p95": 50.0}
        snapshot["heap_mb"] = {"used": 1000, "max": 20480}
        (wt_dir / "snapshot.json").write_text(json.dumps(snapshot), encoding="utf-8")
        loaded2 = build.load_watchtower_snapshot(str(server_dir))
        native = (loaded2 or {}).get("_native") or {}
        if (native.get("session_mspt") or {}).get("max") != 99.0:
            failed.append("expected session_mspt.max in _native")

    return failed


def test_compute_peak_mspt() -> list[str]:
    build = load_build_module()
    failed: list[str] = []
    peak, src = build.compute_peak_mspt(
        4580.0,
        {"overworld": {"mspt": 3.0}, "source": "watchtower"},
        {"session_mspt": {"max": 45.0}},
        {"tps_samples": [{"time": datetime.now(timezone.utc).astimezone().isoformat(), "mspt": 10.0, "source": "watchtower"}]},
        time.time() - 3600,
    )
    if peak != 4580.0:
        failed.append(f"expected peak 4580 from log, got {peak}")
    if src != "mixed":
        failed.append(f"expected mixed source, got {src}")
    peak2, src2 = build.compute_peak_mspt(0, {"overworld": {"mspt": 5.0}}, None, {}, time.time())
    if peak2 != 5.0 or src2 != "watchtower":
        failed.append("expected watchtower-only peak")
    return failed


def test_infer_reboot_from_uptime() -> list[str]:
    build = load_build_module()
    if not Path("/proc/uptime").is_file():
        return []
    failed: list[str] = []
    cutoff = time.time() - 3600
    reboot = build._infer_reboot_from_uptime(cutoff)
    if reboot is None:
        failed.append("expected reboot event from /proc/uptime when boot within window")
    elif reboot.get("source") != "proc_uptime":
        failed.append("expected proc_uptime source")
    return failed


def test_crash_summary() -> list[str]:
    build = load_build_module()
    analyze = load_analyze_module()
    failed: list[str] = []
    text = "---- Minecraft Crash Report ----\nDescription: Ticking entity\n"
    summary = build.parse_crash_summary(text)
    if "Ticking entity" not in summary:
        failed.append(f"expected crash summary, got {summary!r}")
    facts = {
        "health": {"java_running": True, "log_gap_minutes": 0},
        "minecraft": {"crash_summary": summary, "new_crash_reports": [{"file": "x.txt"}]},
        "issues": [{"id": "CRASH_REPORT", "historical": True}],
        "thresholds": {},
        "optional": {},
        "events": [],
    }
    tldr = analyze.build_tldr(facts)
    if "Ticking entity" not in tldr:
        failed.append("TL;DR should include crash summary")
    return failed


def test_backup_stale_issue() -> list[str]:
    import tempfile

    analyze = load_analyze_module()
    failed: list[str] = []
    staging = {
        "meta": {"hostname": "test", "lookback_hours": 24, "incremental": False},
        "flags": {"java_running": True, "panel_running": True},
        "minecraft": {"log_had_activity_in_window": True},
        "system": {},
        "optional": {
            "last_backup": {
                "status": "stale",
                "stale": True,
                "age_days": 14,
                "warn_days": 7,
                "path": "old-backup.tar.gz",
            }
        },
        "events": [],
        "thresholds": {
            "disk_warn_pct": 85,
            "mem_warn_avail_gb": 2,
            "log_stale_minutes": 15,
            "cant_keep_up_warn": 5,
            "mspt_warn": 50,
            "tps_warn": 19.5,
        },
    }
    with tempfile.TemporaryDirectory() as tmp:
        staging_path = Path(tmp) / "staging.json"
        facts_path = Path(tmp) / "facts.json"
        staging_path.write_text(json.dumps(staging), encoding="utf-8")
        analyze.build_facts(str(staging_path), str(facts_path))
        facts = json.loads(facts_path.read_text(encoding="utf-8"))
    ids = [i.get("id") for i in facts.get("issues", [])]
    if "BACKUP_STALE" not in ids:
        failed.append("expected BACKUP_STALE issue")
    return failed


def main() -> int:
    if not ENGINE.is_dir():
        print("legacy/ not present — skipping legacy PoC regression (Java tests still run via Gradle)")
        return 0

    subprocess.run(
        [sys.executable, "-m", "py_compile", str(BUILD), str(ANALYZE), str(RCON), str(EXTRAS)],
        check=True,
    )

    all_failed: list[str] = []
    for name, fn in (
        ("panel incident", test_panel_incident),
        ("recovered server", test_recovered_server),
        ("no false OOM", test_containerd_not_oom),
        ("issue evidence", test_issue_evidence),
        ("journal filter", test_build_staging_journal_filter),
        ("jvm heap parse", test_parse_jvm_heap),
        ("pregen meaningful", test_pregen_meaningful),
        ("pregen pct parse", test_pregen_pct_parse),
        ("pregen brief pct", test_pregen_brief_pct),
        ("mem low alert", test_mem_low_alert),
        ("player join regex", test_player_join_regex),
        ("player session boundaries", test_player_session_boundaries),
        ("backup nested scan", test_backup_nested_scan),
        ("cpu snapshot", test_cpu_snapshot),
        ("cpu brief format", test_cpu_brief_format),
        ("player tracker", test_player_tracker),
        ("timeline chrono", test_timeline_chronological),
        ("v2.2 formatting", test_v22_formatting),
        ("rcon parse tps", test_rcon_parse_tps),
        ("session tick lag", test_session_scoped_tick_lag),
        ("tick lag historical count", test_tick_lag_historical_count_uses_historical_count),
        ("v3.0 mspt brief", test_v30_mspt_high),
        ("watchtower snapshot", test_watchtower_snapshot),
        ("peak mspt mixed", test_compute_peak_mspt),
        ("uptime reboot infer", test_infer_reboot_from_uptime),
        ("crash summary", test_crash_summary),
        ("backup stale", test_backup_stale_issue),
    ):
        failed = fn()
        if failed:
            print(f"FAIL {name}:")
            for f in failed:
                print(f"  - {f}")
            all_failed.extend(failed)
        else:
            print(f"OK   {name}")

    if all_failed:
        return 1
    print("VALIDATION OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
