"""Hysteresis decision tests for distance and percent modes."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "custom_components" / "tankwise"))

from helpers import (  # noqa: E402
    distance_to_percent,
    is_off_condition,
    is_on_condition,
    percent_to_distance,
)


def test_percent_roundtrip():
    d = percent_to_distance(50, 0.25, 0.47)
    assert d == pytest.approx(0.36)
    assert distance_to_percent(d, 0.25, 0.47) == pytest.approx(50)


def test_distance_mode_on_when_empty():
    assert is_on_condition(mode="distance", distance=0.42, percent=None, on_threshold=0.40)
    assert not is_on_condition(mode="distance", distance=0.39, percent=None, on_threshold=0.40)


def test_distance_mode_off_when_full():
    assert is_off_condition(mode="distance", distance=0.26, percent=None, off_threshold=0.28)
    assert not is_off_condition(mode="distance", distance=0.30, percent=None, off_threshold=0.28)


def test_percent_mode_on_when_low():
    assert is_on_condition(mode="percent", distance=0.4, percent=25, on_threshold=30)
    assert not is_on_condition(mode="percent", distance=0.3, percent=40, on_threshold=30)


def test_percent_mode_off_when_high():
    assert is_off_condition(mode="percent", distance=0.26, percent=96, off_threshold=95)
    assert not is_off_condition(mode="percent", distance=0.3, percent=80, off_threshold=95)


def test_user_level_at_82_percent_with_percent_thresholds():
    # full=0.25 empty=0.47 distance=0.290 -> ~82%
    pct = distance_to_percent(0.290, 0.25, 0.47)
    assert pct == pytest.approx(81.818, rel=1e-3)
    # With on=70% / off=95%, 82% is in the middle band
    assert not is_on_condition(mode="percent", distance=0.290, percent=pct, on_threshold=70)
    assert not is_off_condition(mode="percent", distance=0.290, percent=pct, off_threshold=95)
    # If user wants pump on at 82%, set on_threshold around 85
    assert is_on_condition(mode="percent", distance=0.290, percent=pct, on_threshold=85)
