"""Pure hysteresis decision tests (ultrasonic: higher distance = emptier)."""

from __future__ import annotations


def should_arm_on(distance: float, on_threshold: float) -> bool:
    """Demand ON condition: tank empty enough."""
    return distance > on_threshold


def should_arm_off(distance: float, off_threshold: float) -> bool:
    """Demand OFF condition: tank full enough."""
    return distance < off_threshold


def test_user_scenario_after_migration():
    # Migrated from inverted 0.261/0.404 -> on=0.404, off=0.261
    on_th, off_th = 0.404, 0.261
    distance = 0.290
    assert not should_arm_on(distance, on_th)  # still fairly full (~82%)
    assert not should_arm_off(distance, off_th)


def test_turn_on_when_empty():
    assert should_arm_on(0.42, 0.40)
    assert not should_arm_on(0.39, 0.40)


def test_turn_off_when_full():
    assert should_arm_off(0.26, 0.28)
    assert not should_arm_off(0.30, 0.28)


def test_thresholds_must_not_overlap():
    on_th, off_th = 0.40, 0.28
    assert on_th > off_th
    # Mid band: neither on nor off
    mid = 0.34
    assert not should_arm_on(mid, on_th)
    assert not should_arm_off(mid, off_th)
