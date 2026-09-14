"""Unit tests for Tankwise helpers (no Home Assistant core required)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "custom_components" / "tankwise"))

from helpers import (  # noqa: E402
    distance_to_percent,
    merge_entry_config,
    normalize_notify_services,
    with_normalized_notify,
)


@pytest.mark.parametrize(
    ("distance", "full", "empty", "expected"),
    [
        (82.0, 82.0, 120.0, 100.0),
        (120.0, 82.0, 120.0, 0.0),
        (101.0, 82.0, 120.0, 50.0),
        (50.0, 82.0, 120.0, 100.0),
        (150.0, 82.0, 120.0, 0.0),
    ],
)
def test_distance_to_percent(distance, full, empty, expected):
    assert distance_to_percent(distance, full, empty) == pytest.approx(expected)


def test_invalid_calibration():
    assert distance_to_percent(90.0, 120.0, 82.0) is None
    assert distance_to_percent(90.0, 100.0, 100.0) is None


def test_merge_options_win():
    merged = merge_entry_config(
        {"full_distance": 82.0, "pump_entity": "switch.a"},
        {"full_distance": 80.0},
    )
    assert merged["full_distance"] == 80.0
    assert merged["pump_entity"] == "switch.a"


def test_normalize_notify_from_legacy_string():
    assert normalize_notify_services({"notify_service": "notify.phone"}) == [
        "notify.phone"
    ]
    assert normalize_notify_services({"notify_service": "  "}) == []
    assert normalize_notify_services({}) == []


def test_normalize_notify_from_list():
    assert normalize_notify_services(
        {"notify_services": ["notify.a", "", " notify.b "]}
    ) == ["notify.a", "notify.b"]
    assert normalize_notify_services({"notify_services": "notify.a, notify.b"}) == [
        "notify.a",
        "notify.b",
    ]


def test_with_normalized_notify_prefers_list():
    cfg = with_normalized_notify(
        {"notify_service": "notify.legacy", "notify_services": ["notify.new"]}
    )
    assert cfg["notify_services"] == ["notify.new"]
