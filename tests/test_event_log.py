"""Unit tests for Tankwise event-log helpers (no Home Assistant core)."""

from __future__ import annotations

import sys
from collections import deque
from datetime import timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "custom_components" / "tankwise"))

from const import LOG_RETENTION_DAYS, PUMP_RELATED_LOG_EVENTS  # noqa: E402


def test_pump_related_events_cover_commands():
    assert "pump_command" in PUMP_RELATED_LOG_EVENTS
    assert "demand_changed" in PUMP_RELATED_LOG_EVENTS
    assert "safety_full_level" in PUMP_RELATED_LOG_EVENTS


def test_retention_is_one_week():
    assert LOG_RETENTION_DAYS == 7


def test_prune_keeps_recent_only():
    """Mirror controller prune logic without importing Home Assistant."""
    now = __import__("datetime").datetime(2026, 9, 20, 12, 0, 0)
    cutoff = now - timedelta(days=LOG_RETENTION_DAYS)
    rows = deque(
        [
            {"ts": (now - timedelta(days=1)).isoformat(), "event": "new"},
            {"ts": (now - timedelta(days=8)).isoformat(), "event": "old"},
            {"ts": (now - timedelta(days=7, minutes=1)).isoformat(), "event": "edge_old"},
            {"ts": (now - timedelta(days=6, hours=23)).isoformat(), "event": "edge_new"},
        ]
    )
    kept = deque()
    for entry in rows:
        ts = __import__("datetime").datetime.fromisoformat(entry["ts"])
        if ts >= cutoff:
            kept.append(entry)
    assert [e["event"] for e in kept] == ["new", "edge_new"]
