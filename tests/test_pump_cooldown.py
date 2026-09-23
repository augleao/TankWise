"""Tests for automatic pump short-cycle protection helpers."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "custom_components" / "tankwise"))

from helpers import is_manual_control_reason  # noqa: E402


def test_manual_reasons_bypass_cooldown():
    assert is_manual_control_reason("ui_demand")
    assert is_manual_control_reason("demand:ui_demand")
    assert is_manual_control_reason("panel_demand")
    assert is_manual_control_reason("demand:panel_demand")
    assert is_manual_control_reason("http_demand")
    assert is_manual_control_reason("demand:http_demand")
    assert is_manual_control_reason("physical_toggle:switch.botao")
    assert is_manual_control_reason("demand:physical_toggle:switch.botao")
    assert is_manual_control_reason("service_turn_on")
    assert is_manual_control_reason("demand:service_turn_off")
    assert is_manual_control_reason("enabled:ui_enable")
    assert is_manual_control_reason("enabled:panel_enable")
    assert is_manual_control_reason("panel_reconcile")
    assert is_manual_control_reason("http_reconcile")
    assert is_manual_control_reason("manual")
    assert is_manual_control_reason("reconcile_now")


def test_automatic_reasons_do_not_bypass():
    assert not is_manual_control_reason("hysteresis_on")
    assert not is_manual_control_reason("demand:hysteresis_off")
    assert not is_manual_control_reason("pump_changed")
    assert not is_manual_control_reason("distance_changed")
    assert not is_manual_control_reason("interval")
    assert not is_manual_control_reason("boot_recovery")
    assert not is_manual_control_reason("demand:boot_full_level")
    assert not is_manual_control_reason("safety_full_level")
    assert not is_manual_control_reason("cooldown:interval")
    assert not is_manual_control_reason("cyclic_failsafe")
